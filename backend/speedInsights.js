/**
 * Vercel Speed Insights API client
 * Fetches real-time Web Vitals data from Vercel Speed Insights.
 * 
 * Credentials diperiksa secara dinamis (bisa dari env vars atau DB),
 * bukan hanya dari environment variable saat module di-load.
 * Urutan prioritas: parameter > environment variable
 */

const https = require("https");

const VERCEL_API_BASE = "api.vercel.com";

/**
 * Baca credentials dari environment variable sebagai default.
 */
function getEnvCredentials() {
  return {
    token: process.env.VERCEL_TOKEN || "",
    teamId: process.env.VERCEL_TEAM_ID || "",
    projectId: process.env.VERCEL_PROJECT_ID || "",
  };
}

/**
 * Gabungkan credentials: parameter > env var.
 */
function resolveCredentials(overrides = {}) {
  const env = getEnvCredentials();
  return {
    token: overrides.token || env.token,
    teamId: overrides.teamId || env.teamId,
    projectId: overrides.projectId || env.projectId,
  };
}

/**
 * Make a GET request to the Vercel REST API.
 */
function vercelApiGet(path, creds) {
  return new Promise((resolve, reject) => {
    const query = [];
    if (creds.teamId) query.push(`teamId=${encodeURIComponent(creds.teamId)}`);
    if (creds.projectId) query.push(`projectId=${encodeURIComponent(creds.projectId)}`);

    const qs = query.length ? `?${query.join("&")}` : "";
    const url = path + qs;

    const options = {
      hostname: VERCEL_API_BASE,
      path: url,
      method: "GET",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch {
          resolve({ error: "Failed to parse response", raw: body });
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.end();
  });
}

/**
 * Fetch Speed Insights records (Web Vitals per path).
 * @param {object} opts
 * @param {string} [opts.from] - ISO timestamp (default: 24h ago)
 * @param {string} [opts.to]   - ISO timestamp (default: now)
 * @param {number} [opts.limit] - max records (default: 50)
 * @param {object} [creds] - Optional credentials (token, teamId, projectId)
 */
async function getSpeedRecords({ from, to, limit = 50 } = {}, creds) {
  const resolved = resolveCredentials(creds);
  if (!resolved.token) {
    return { error: "VERCEL_TOKEN not configured" };
  }

  const now = to || new Date().toISOString();
  const fromDate = from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const path = `/v1/web/insights/speed-records?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(now)}&limit=${limit}`;
  try {
    return await vercelApiGet(path, resolved);
  } catch (err) {
    return { error: err.message || "Gagal menghubungi Vercel API" };
  }
}

/**
 * Fetch Speed Insights with per-path grouping and aggregated metrics.
 * Returns data compatible with the dashboard top-pages view.
 * 
 * @param {string} [timeRange] - '24h', '7d', or '30d'
 * @param {object} [creds] - Optional credentials override { token, teamId, projectId }
 */
async function getSpeedInsightsData(timeRange = "7d", creds) {
  const resolved = resolveCredentials(creds);
  if (!resolved.token) {
    return { enabled: false, error: "VERCEL_TOKEN not configured" };
  }

  const now = new Date();
  let from;
  if (timeRange === "24h") {
    from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (timeRange === "30d") {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const records = await getSpeedRecords({
    from: from.toISOString(),
    to: now.toISOString(),
    limit: 200,
  });

  if (records.error) {
    return { enabled: true, error: records.error };
  }

  // Check if we got actual record data
  if (!records || !records.records || !records.records.length) {
    // Fallback: try the older API format
    if (Array.isArray(records)) {
      return processRecords(records);
    }
    return { enabled: true, records: [], total: 0 };
  }

  return processRecords(records.records);
}

function processRecords(records) {
  // Group by path
  const pathMap = {};

  for (const rec of records) {
    const path = rec.path || rec.url || "/unknown";
    if (!pathMap[path]) {
      pathMap[path] = {
        path,
        count: 0,
        lcp: [],
        fcp: [],
        ttfb: [],
        cls: [],
        inp: [],
      };
    }

    const group = pathMap[path];
    group.count++;

    if (rec.lcp != null) group.lcp.push(rec.lcp);
    if (rec.fcp != null) group.fcp.push(rec.fcp);
    if (rec.ttfb != null) group.ttfb.push(rec.ttfb);
    if (rec.cls != null) group.cls.push(rec.cls);
    if (rec.inp != null) group.inp.push(rec.inp);
  }

  function median(arr) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function p75(arr) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.75) - 1;
    return sorted[Math.max(0, idx)];
  }

  const paths = Object.values(pathMap).map((g) => ({
    path: g.path,
    count: g.count,
    lcp: {
      median: median(g.lcp),
      p75: p75(g.lcp),
    },
    fcp: {
      median: median(g.fcp),
      p75: p75(g.fcp),
    },
    ttfb: {
      median: median(g.ttfb),
      p75: p75(g.ttfb),
    },
    cls: {
      median: median(g.cls),
      p75: p75(g.cls),
    },
    inp: {
      median: median(g.inp),
      p75: p75(g.inp),
    },
  }));

  // Sort by count descending
  paths.sort((a, b) => b.count - a.count);

  const totalRecords = records.length;

  return {
    enabled: true,
    paths,
    total: totalRecords,
  };
}

/**
 * Get rating for a metric value.
 * LCP (ms): good <= 2500, poor > 4000
 * FCP (ms): good <= 1800, poor > 3000
 * TTFB (ms): good <= 800, poor > 1800
 * CLS: good <= 0.1, poor > 0.25
 * INP (ms): good <= 200, poor > 500
 */
function getMetricRating(metric, value) {
  if (value === null || value === undefined) return { rating: "none", color: "#8b949e" };

  const thresholds = {
    lcp: { good: 2500, poor: 4000 },
    fcp: { good: 1800, poor: 3000 },
    ttfb: { good: 800, poor: 1800 },
    cls: { good: 0.1, poor: 0.25 },
    inp: { good: 200, poor: 500 },
  };

  const t = thresholds[metric];
  if (!t) return { rating: "none", color: "#8b949e" };

  if (value <= t.good) return { rating: "good", color: "#3fb950" };
  if (value <= t.poor) return { rating: "needs-improvement", color: "#d29922" };
  return { rating: "poor", color: "#f85149" };
}

module.exports = {
  getSpeedRecords,
  getSpeedInsightsData,
  getMetricRating,
};