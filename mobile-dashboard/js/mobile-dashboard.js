/* ==============================================================
   MOBILE DASHBOARD — Core JS
   API integration matching the desktop dashboard endpoints.
   ============================================================== */

// ── HELPERS ──
function fmtUptime(s) {
  if (s == null) return '---';
  if (s < 60) return Math.round(s) + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + Math.round(s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}

function getSiColor(v, m) {
  if (v == null) return '#94A3B8';
  var t = { lcp: { good: 2500, poor: 4000 }, fcp: { good: 1800, poor: 3000 }, ttfb: { good: 800, poor: 1800 }, cls: { good: 0.1, poor: 0.25 }, inp: { good: 200, poor: 500 } }[m];
  if (!t) return '#94A3B8';
  return v <= t.good ? '#16A34A' : v <= t.poor ? '#D97706' : '#DC2626';
}

function calcPerfScore(paths) {
  if (!paths || !paths.length) return null;
  var thresholds = { lcp: { good: 2500, poor: 4000 }, fcp: { good: 1800, poor: 3000 }, ttfb: { good: 800, poor: 1800 }, cls: { good: 0.1, poor: 0.25 }, inp: { good: 200, poor: 500 } };
  var weights = { lcp: 30, fcp: 15, ttfb: 20, cls: 15, inp: 20 };
  var tw = 0, ts = 0;
  ['lcp', 'fcp', 'ttfb', 'cls', 'inp'].forEach(function (m) {
    var vals = paths.map(function (p) { return p[m] && p[m].median; }).filter(function (v) { return v != null; });
    if (!vals.length) return;
    var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var t = thresholds[m];
    var score = avg <= t.good ? 100 : avg <= t.poor ? Math.round(50 + 50 * (1 - (avg - t.good) / (t.poor - t.good))) : Math.max(0, Math.round(50 * (1 - (avg - t.poor) / t.poor)));
    ts += score * weights[m];
    tw += weights[m];
  });
  return tw > 0 ? Math.round(ts / tw) : null;
}

function renderVitalChips(paths, prefix) {
  var metrics = [{ key: 'lcp', label: 'LCP' }, { key: 'fcp', label: 'FCP' }, { key: 'ttfb', label: 'TTFB' }, { key: 'cls', label: 'CLS', f: true }, { key: 'inp', label: 'INP' }];
  var html = '';
  metrics.forEach(function (m) {
    var vals = paths.map(function (p) { return p[m.key] && p[m.key].median; }).filter(function (v) { return v != null; });
    if (!vals.length) return;
    var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var disp = m.f ? avg.toFixed(3) : Math.round(avg) + 'ms';
    html += '<div class="mob-vital-chip" style="border-color:' + getSiColor(avg, m.key) + '40;">';
    html += '<span class="mob-vital-label">' + m.label + '</span>';
    html += '<span class="mob-vital-val" style="color:' + getSiColor(avg, m.key) + ';">' + disp + '</span></div>';
  });
  document.getElementById(prefix + '-vitals-row').innerHTML = html;
  var score = calcPerfScore(paths);
  if (score !== null) {
    var fill = document.getElementById(prefix + '-score-fill');
    fill.style.width = score + '%';
    fill.style.background = score >= 90 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626';
    document.getElementById(prefix + '-score-num').textContent = score;
    document.getElementById(prefix + '-score-num').style.color = score >= 90 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626';
  }
}

function showToast(msg) {
  var t = document.getElementById('mob-toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._hide);
  t._hide = setTimeout(function () { t.classList.remove('show'); }, 2500);
}

// ── TAB SWITCHING ──
function switchTab(name) {
  document.querySelectorAll('.mob-tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.mob-tabbar-item').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector('.mob-tabbar-item[data-tab="' + name + '"]').classList.add('active');
}

// ── MODAL ──
function showAddAdmin() {
  document.getElementById('add-admin-error').classList.remove('show');
  document.getElementById('add-admin-success').classList.remove('show');
  document.getElementById('new-admin-username').value = '';
  document.getElementById('new-admin-password').value = '';
  document.getElementById('add-admin-modal').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Click overlay to close
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('mob-modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ── MAIN DATA REFRESH ──
async function dbRefresh() {
  var refreshIcon = document.getElementById('refresh-icon');
  refreshIcon.classList.add('spinning');
  setTimeout(function () { refreshIcon.classList.remove('spinning'); }, 600);

  try {
    // ── Health endpoint ──
    var hRes = await fetch('/api/dev/health');
    var h = await hRes.json();

    // Header status dots
    function setStatusDot(id, status) {
      var el = document.getElementById('mob-dot-' + id);
      if (el) { el.className = 'mob-status-dot ' + status; }
    }
    function setStatusLabel(id, val) {
      var el = document.getElementById('mob-label-' + id);
      if (el) el.textContent = val;
    }

    setStatusDot('website', h.website === 'ok' ? 'ok' : 'error');
    setStatusLabel('website', h.website === 'ok' ? 'Online' : 'Error');

    setStatusDot('db', h.db === 'ok' ? 'ok' : 'error');
    setStatusLabel('db', h.db === 'ok' ? 'DB: ' + h.dbPingMs + 'ms' : 'DB: Error');

    // Server info (monitoring tab)
    document.getElementById('mon-uptime').textContent = fmtUptime(h.uptimeSeconds || 0);
    document.getElementById('mon-memory').textContent = (h.memHeapUsedMB || 0) + ' MB / ' + (h.memHeapTotalMB || 0) + ' MB';
    document.getElementById('mon-node').textContent = h.nodeVersion || '---';
    document.getElementById('mon-platform').textContent = h.platform || '---';
    document.getElementById('mon-dbping').textContent = (h.dbPingMs || 0) + 'ms';
    document.getElementById('mon-requests').textContent = h.totalRequests || 0;

    // Overview: Server info card
    var siHtml =
      '<div class="mob-si-row"><span class="mob-si-key">Uptime</span><span class="mob-si-val">' + fmtUptime(h.uptimeSeconds || 0) + '</span></div>' +
      '<div class="mob-si-row"><span class="mob-si-key">Memory</span><span class="mob-si-val">' + (h.memHeapUsedMB || 0) + ' MB / ' + (h.memHeapTotalMB || 0) + ' MB</span></div>' +
      '<div class="mob-si-row"><span class="mob-si-key">Node</span><span class="mob-si-val">' + (h.nodeVersion || '---') + '</span></div>' +
      '<div class="mob-si-row"><span class="mob-si-key">Platform</span><span class="mob-si-val">' + (h.platform || '---') + '</span></div>' +
      '<div class="mob-si-row"><span class="mob-si-key">DB Ping</span><span class="mob-si-val">' + (h.dbPingMs || 0) + 'ms</span></div>';
    document.getElementById('mob-server-info').innerHTML = siHtml;

    // Overview status cards
    function setOvStatus(id, status, badge, val) {
      var card = document.getElementById('mob-card-' + id);
      var ind = document.getElementById('mob-ind-' + id);
      var pill = document.getElementById('mob-pill-' + id);
      var valEl = document.getElementById('mob-val-' + id);
      if (ind) ind.className = 'mob-status-indicator ' + status;
      if (pill) { pill.textContent = badge; pill.className = 'mob-status-badge ' + status; }
      if (valEl) valEl.textContent = val;
    }

    setOvStatus('website', h.website === 'ok' ? 'ok' : 'error', h.website === 'ok' ? 'Online' : 'Error', h.website === 'ok' ? 'Online' : 'Degraded');
    setOvStatus('db', h.db === 'ok' ? 'ok' : 'error', h.db === 'ok' ? 'Connected' : 'Error', h.db === 'ok' ? h.dbPingMs + 'ms ping' : (h.dbError || 'Disconnected'));

    // Overview: requests
    document.getElementById('mob-stat-requests').textContent = h.totalRequests || 0;

    // ── Stats endpoint ──
    var sRes = await fetch('/api/dev/stats');
    var stats = await sRes.json();
    var pv = stats.pvStats || {};

    // Overview stats
    document.getElementById('mob-online-count').textContent = pv.online || 0;
    document.getElementById('mob-stat-visitors').textContent = pv.visitors || 0;
    document.getElementById('mob-stat-pageviews').textContent = pv.pageviews || 0;
    document.getElementById('mob-stat-latency').textContent = (stats.metrics ? (stats.metrics.avgLatencyMs || 0) : 0) + 'ms';

    // Analytics tab stats
    document.getElementById('ana-visitors').textContent = pv.visitors || 0;
    document.getElementById('ana-pageviews').textContent = pv.pageviews || 0;
    document.getElementById('ana-latency').textContent = (stats.metrics ? (stats.metrics.avgLatencyMs || 0) : 0) + 'ms';
    document.getElementById('ana-online').textContent = pv.online || 0;

    // ── Admin statuses ──
    var aRes = await fetch('/dev/api/admins/statuses');
    var aData = await aRes.json();
    var statuses = aData.adminStatuses || {};
    var admins = aData.admins || [];
    var onlineAdmins = admins.filter(function (a) { return statuses[a.username] && statuses[a.username].online === true; });

    document.getElementById('mob-admin-count').textContent = onlineAdmins.length + '/' + admins.length;
    document.getElementById('mob-admin-badge').textContent = onlineAdmins.length + ' online';

    // Overview: admin list
    if (onlineAdmins.length === 0) {
      document.getElementById('mob-admin-list').innerHTML = '<div class="mob-empty" style="padding:16px;">Tidak ada admin online saat ini.</div>';
    } else {
      var adminHtml = '';
      onlineAdmins.forEach(function (a) {
        var st = statuses[a.username] || {};
        var last = st.lastOnline ? new Date(st.lastOnline).toLocaleString('id-ID') : '---';
        adminHtml += '<div class="mob-admin-row"><span class="mob-admin-dot"></span><span class="mob-admin-name">' + a.username + '</span><span class="mob-admin-last">' + last + '</span></div>';
      });
      document.getElementById('mob-admin-list').innerHTML = adminHtml;
    }

    // Admins tab: full admin list
    if (admins.length === 0) {
      document.getElementById('mob-admins-list').innerHTML = '<div class="mob-empty">Belum ada admin.</div>';
    } else {
      var accountHtml = '';
      admins.forEach(function (a) {
        var st = statuses[a.username] || {};
        var isOnline = st.online === true;
        var initial = a.username.charAt(0).toUpperCase();
        accountHtml += '<div class="mob-admin-account">' +
          '<div class="mob-admin-account-left">' +
            '<div class="mob-admin-account-avatar">' + initial + '</div>' +
            '<div class="mob-admin-account-info">' +
              '<span class="mob-admin-account-name">' + a.username + '</span>' +
              '<span class="mob-admin-account-status">' +
                '<span style="width:5px;height:5px;border-radius:50%;background:' + (isOnline ? '#16A34A' : '#64748B') + ';display:inline-block;"></span> ' +
                (isOnline ? 'Online' : 'Offline') +
              '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
      document.getElementById('mob-admins-list').innerHTML = accountHtml;
    }

    // ── Speed Insights ──
    var siStatusRes = await fetch('/api/dev/speed-insights/status');
    var siStatus = await siStatusRes.json();

    setStatusDot('si', siStatus.configured ? 'ok' : 'warn');
    setStatusLabel('si', siStatus.configured ? 'SI: OK' : 'SI: --');

    if (siStatus.configured) {
      var siRes = await fetch('/api/dev/speed-insights?range=7d');
      var siData = await siRes.json();

      // Analytics tab vitals
      if (siData.error || !siData.paths || !siData.paths.length) {
        document.getElementById('ana-vitals-loading').style.display = 'none';
        document.getElementById('ana-vitals-empty').style.display = 'block';
        document.getElementById('ana-vitals-empty').textContent = siData.error ? '⚠ ' + siData.error : '📊 Belum ada data Web Vitals.';
      } else {
        document.getElementById('ana-vitals-loading').style.display = 'none';
        document.getElementById('ana-vitals-data').style.display = 'block';
        renderVitalChips(siData.paths, 'ana');
      }

      // Monitoring tab vitals
      if (siData.error || !siData.paths || !siData.paths.length) {
        document.getElementById('mon-vitals-loading').style.display = 'none';
        document.getElementById('mon-vitals-empty').style.display = 'block';
      } else {
        document.getElementById('mon-vitals-loading').style.display = 'none';
        document.getElementById('mon-vitals-data').style.display = 'block';
        renderVitalChips(siData.paths, 'mon');
      }
    } else {
      document.getElementById('ana-vitals-loading').style.display = 'none';
      document.getElementById('ana-vitals-empty').style.display = 'block';
      document.getElementById('mon-vitals-loading').style.display = 'none';
      document.getElementById('mon-vitals-empty').style.display = 'block';
    }

    // ── Maintenance ──
    var mtRes = await fetch('/api/dev/maintenance/status');
    var mt = await mtRes.json();

    setStatusDot('mt', mt.enabled ? 'warn' : 'ok');
    setStatusLabel('mt', mt.enabled ? 'MT: ON' : 'MT: OFF');

    setOvStatus('mt', mt.enabled ? 'warn' : 'ok', mt.enabled ? 'ACTIVE' : 'Inactive', mt.enabled ? 'ACTIVE — users blocked' : 'Inactive');
    document.getElementById('mob-mt-toggle').checked = mt.enabled === true;

  } catch (e) {
    console.warn('[mobile-dashboard] refresh error', e);
  }
}

// ── MAINTENANCE TOGGLE ──
async function toggleMaintenance(enabled) {
  var ind = document.getElementById('mob-ind-mt');
  var val = document.getElementById('mob-val-mt');
  try {
    var res = await fetch('/api/dev/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled })
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error);
    if (ind) ind.className = 'mob-status-indicator ' + (enabled ? 'warn' : 'ok');
    if (val) val.textContent = enabled ? 'ACTIVE — users blocked' : 'Inactive';
    setStatusDot('mt', enabled ? 'warn' : 'ok');
    setStatusLabel('mt', enabled ? 'MT: ON' : 'MT: OFF');
    showToast(enabled ? 'Maintenance mode ACTIVE' : 'Maintenance mode OFF');
  } catch (e) {
    document.getElementById('mob-mt-toggle').checked = !enabled;
    showToast('Gagal toggle: ' + e.message);
  }
}

// ── ADD ADMIN ──
async function addAdmin() {
  var errorEl = document.getElementById('add-admin-error');
  var successEl = document.getElementById('add-admin-success');
  errorEl.classList.remove('show');
  successEl.classList.remove('show');

  var username = document.getElementById('new-admin-username').value.trim();
  var password = document.getElementById('new-admin-password').value;

  if (!username || !password) {
    errorEl.textContent = 'Username dan password wajib diisi';
    errorEl.classList.add('show');
    return;
  }

  try {
    var res = await fetch('/dev/api/admins/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    var d = await res.json();
    if (d.error) {
      errorEl.textContent = d.error;
      errorEl.classList.add('show');
    } else {
      successEl.textContent = 'Admin "' + username + '" berhasil dibuat!';
      successEl.classList.add('show');
      document.getElementById('new-admin-username').value = '';
      document.getElementById('new-admin-password').value = '';
      showToast('Admin "' + username + '" created');
      // Refresh admin list
      dbRefresh();
    }
  } catch (e) {
    errorEl.textContent = 'Network error: ' + e.message;
    errorEl.classList.add('show');
  }
}

// ── GLOBAL REFRESH HANDLER ──
window.dbRefreshNow = function () { dbRefresh(); };

// ── INIT ──
dbRefresh();
setInterval(dbRefresh, 30000);