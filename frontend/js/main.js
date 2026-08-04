// ============================================================
// GPI ELUZAI KIDS — Frontend logic
// ============================================================

const API = {
  info: "/api/info",
  schedule: "/api/schedule",
  classes: "/api/classes",
  events: "/api/events",
  images: "/api/images",
  banners: "/api/banners",
};

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat ${url}`);
  return res.json();
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

// ---------- Jam & tanggal real-time ----------
function startClock() {
  const clock = document.getElementById("clock");
  const update = () => {
    const now = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
    const dd = p(now.getDate());
    const mm = p(now.getMonth() + 1);
    const yyyy = now.getFullYear();
    const hh = p(now.getHours());
    const mi = p(now.getMinutes());
    const ss = p(now.getSeconds());
    clock.innerHTML = `<span class="clock-date">${hari} ${dd}/${mm}/${yyyy} · </span><span class="clock-time">${hh}:${mi}:${ss}</span>`;

  };
  update();
  setInterval(update, 1000);
}

// ---------- Toggle tema ----------
function setupTheme() {
  const btn = document.getElementById("theme-toggle");
  const saved = localStorage.getItem("eluzai-theme");
  if (saved) document.body.dataset.theme = saved;
  btn.textContent = document.body.dataset.theme === "light" ? "🌙" : "☀️";
  btn.addEventListener("click", () => {
    const next = document.body.dataset.theme === "light" ? "dark" : "light";
    document.body.dataset.theme = next;
    btn.textContent = next === "light" ? "🌙" : "☀️";
    localStorage.setItem("eluzai-theme", next);
  });
}

// ---------- Slider foto ----------
function setupSlider(images) {
  const track = document.getElementById("slider-track");
  const dotsWrap = document.getElementById("slider-dots");
  const caption = document.getElementById("slider-caption");
  if (!track) return;

  // Jika belum ada foto di folder image/
  if (!images.length) {
    track.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text-soft);text-align:center;padding:20px"><span style="font-size:3rem">📷</span><p>Belum ada foto di folder <code style="background:var(--card-border);padding:2px 8px;border-radius:8px">image/</code></p></div>`;
    return;
  }

  const captions = [
    "Ibadah Sekolah Minggu",
    "Pujian & Penyembahan",
    "Kelas Kelompok",
    "Keluarga Eluzai",
    "Suasana Gereja",
  ];

  track.innerHTML = "";
  dotsWrap.innerHTML = "";
  images.forEach((img, i) => {
    const slide = el("div", "slide");
    const picture = el("img");
    picture.src = img.url;
    picture.alt = captions[i % captions.length];
    picture.loading = i === 0 ? "eager" : "lazy";
    const overlay = el("div", "slide-overlay");
    overlay.appendChild(el("span", "", captions[i % captions.length]));
    slide.append(picture, overlay);
    track.appendChild(slide);

    const dot = el("button", "dot");
    dot.setAttribute("aria-label", `Slide ${i + 1}`);
    dot.addEventListener("click", () => go(i));
    dotsWrap.appendChild(dot);
  });

  let current = 0;
  let timer = null;

  function go(index) {
    current = (index + images.length) % images.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dotsWrap.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === current));
    caption.textContent = captions[current % captions.length];
    restart();
  }

  function next() { go(current + 1); }
  function restart() {
    if (timer) clearInterval(timer);
    // Hormati prefers-reduced-motion: jangan autoplay
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = setInterval(next, 4500);
  }

  document.getElementById("slider-prev").addEventListener("click", () => go(current - 1));
  document.getElementById("slider-next").addEventListener("click", next);

  // Jeda autoplay saat kursor di atas slider
  const slider = document.getElementById("slider");
  slider.addEventListener("mouseenter", () => timer && clearInterval(timer));
  slider.addEventListener("mouseleave", restart);
  slider.addEventListener("touchstart", () => timer && clearInterval(timer), { passive: true });

  go(0);
  restart();
}

// ---------- Jadwal (2 kartu status: Ibadah & Latihan) ----------
function renderSchedule(schedule) {
  const grid = document.getElementById("schedule-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const items = [
    { key: "ibadah", emoji: "⛪", judul: "Ibadah", cls: "schedule-card-ibadah" },
    { key: "latihan", emoji: "🎸", judul: "Latihan", cls: "schedule-card-latihan" },
  ];

  items.forEach((it) => {
    const data = (schedule && schedule[it.key]) || {};
    const ada = !!data.ada;
    const card = el("article", `schedule-card ${it.cls}${ada ? "" : " schedule-card-off"}`);
    card.innerHTML = `
      <div class="schedule-card-head">
        <div class="schedule-card-icon">${it.emoji}</div>
        <h3>${it.judul}</h3>
        ${ada ? `<span class="status-badge status-yes">✓ Ada</span>` : `<span class="status-badge status-no">✗ Tidak</span>`}
      </div>
      <div class="schedule-card-time">🕒 ${ada && data.jam ? data.jam : "—"}</div>
      <p class="schedule-card-note">${ada && data.keterangan ? data.keterangan : "Tidak ada jadwal hari ini."}</p>`;
    grid.appendChild(card);
  });
}

// ---------- Kelas (kartu menuju halaman anggota: /baby, /samuel, dst) ----------
function renderClasses(classes) {
  const grid = document.getElementById("class-grid");
  if (!grid) return;
  grid.innerHTML = "";
  classes.forEach((k, i) => {
    const members = Array.isArray(k.anggota) ? k.anggota : [];
    const card = el("article", `card class-card color-${k.warna}`);
    // Fade masuk/keluar menyilang: kartu ganjil dari kiri, genap dari kanan
    card.setAttribute("data-reveal", i % 2 === 0 ? "left" : "right");
    card.innerHTML = `
      <div class="card-icon">${k.emoji}</div>
      <div class="class-group">Kelompok ${k.kelompok}</div>
      <h3>${k.nama}</h3>
      <div class="class-tags">
        <span class="tag">👶 ${k.usia}</span>
      </div>
      <div class="class-teacher">👩‍🏫 ${k.pengajar}</div>
      <a class="class-toggle" href="/${k.id}">
        <span class="class-toggle-label">Lihat Anggota</span>
        <span class="class-count">${members.length}</span>
        <span class="class-chevron">→</span>
      </a>`;
    grid.appendChild(card);
  });
}

// ---------- Thumbnail real-time event ----------
// mshots (s.wordpress.com) kini mengembalikan HTTP 403 untuk situs ini,
// jadi dipakai chain layanan dengan fallback otomatis:
//   Microlink (PNG) → thum.io (GIF) → mshots (legacy)
// Setiap layanan dicoba berurutan; yang berhasil pertama dipakai.
function setupEventThumb(events) {
  const url = events.website;

  const services = [
    {
      name: "microlink",
      build: (ts) =>
        `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&embed=screenshot.url&meta=false${ts ? `&v=${ts}` : ""}`,
    },
    {
      name: "thumio",
      build: (ts) =>
        `https://image.thum.io/get/width/900/crop/507/${url}${ts ? `?ts=${ts}` : ""}`,
    },
    {
      // mshots (s.wordpress.com) kini 403 untuk situs ini — disimpan sebagai
      // fallback terakhir. baseUrl sengaja di-hardcode agar konsisten dengan
      // dua layanan lain (chain sudah self-contained, tidak bergantung config).
      name: "mshots",
      build: (ts) =>
        `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=900&h=507${ts ? `&v=${ts}` : ""}`,
    },
  ];

  // isi link & teks
  document.getElementById("event-url").textContent = url.replace(/^https?:\/\//, "");
  document.getElementById("event-link").href = url;
  document.getElementById("event-cta").href = url;
  document.getElementById("event-note-link").href = url;
  if (events.deskripsi) document.getElementById("event-desc").textContent = events.deskripsi;

  const img = document.getElementById("event-thumb");
  const loading = document.getElementById("thumb-loading");
  const fallback = document.getElementById("thumb-fallback");

  let serviceIdx = 0;
  let ts = "";
  let timer = null;
  let attempt = 0; // token percobaan: menolak event basi dari request yang sudah diganti

  // Screenshot cold-cache bisa memakan waktu lama atau menggantung tanpa
  // memicu onerror. Timeout per layanan memastikan spinner TIDAK pernah
  // berputar selamanya: kalau lambat, lanjut ke layanan berikutnya.
  const SERVICE_TIMEOUT = 12000;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function tryNext() {
    clearTimer();
    if (serviceIdx >= services.length) {
      loading.hidden = true;
      fallback.hidden = false;
      return;
    }
    const s = services[serviceIdx++];
    const myAttempt = ++attempt;
    // Handler dipasang ulang per percobaan & hanya dihiraukan jika masih
    // percobaan yang sama — event onload/onerror telat dari request lama
    // (mis. setelah timeout) tidak boleh melewati layanan yang sedang dicoba.
    img.onload = () => {
      if (myAttempt !== attempt) return;
      clearTimer();
      loading.hidden = true;
      img.style.opacity = "1";
    };
    img.onerror = () => {
      if (myAttempt !== attempt) return;
      tryNext();
    };
    img.src = s.build(ts);
    img.style.opacity = "0";
    loading.hidden = false;
    fallback.hidden = true;
    timer = setTimeout(() => {
      if (myAttempt === attempt) tryNext();
    }, SERVICE_TIMEOUT);
  }

  function loadThumb(cacheBust) {
    clearTimer();
    ts = cacheBust ? String(Date.now()) : "";
    serviceIdx = 0;
    tryNext();
  }

  document.getElementById("thumb-refresh").addEventListener("click", () => loadThumb(true));
  loadThumb(false);
}

// ---------- Footer ----------
function renderFooter(info) {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
  const address = document.getElementById("footer-address");
  if (address) address.textContent = `📍 ${info.alamat}`;
  const tagline = document.getElementById("hero-tagline");
  if (tagline) tagline.textContent = info.tagline;

  // Link kontak: WA / IG / YouTube (dari panel admin) — section #contact
  const contacts = {
    wa: { url: info.whatsapp, ids: ["contact-wa-btn"] },
    ig: { url: info.instagram, ids: ["contact-soc-ig"] },
    yt: { url: info.youtube, ids: ["contact-soc-yt"] },
  };
  Object.entries(contacts).forEach(([, { url, ids }]) => {
    ids.forEach((id) => {
      const link = document.getElementById(id);
      if (!link) return;
      if (url) {
        link.href = url;
        link.classList.remove("is-empty");
      } else {
        link.removeAttribute("href");
        link.classList.add("is-empty");
      }
    });
  });
}

// ---------- Banner / Pengumuman ----------
function renderBanners(banners) {
  const grid = document.getElementById("banners-grid");
  const empty = document.getElementById("banners-empty");
  if (!grid) return;

  if (!banners.length) {
    grid.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }

  grid.hidden = false;
  if (empty) empty.hidden = true;
  grid.innerHTML = "";

  banners.forEach((b) => {
    const card = el("a", "banner-card");
    card.href = b.url;
    card.target = "_blank";
    card.rel = "noopener";
    card.innerHTML = `
      <img class="banner-img" src="${b.imageUrl}" alt="${b.judul}" loading="lazy" />
      <div class="banner-overlay">
        <span class="banner-arrow">↗</span>
        <h3 class="banner-title">${b.judul}</h3>
        ${b.deskripsi ? `<p class="banner-desc">${b.deskripsi}</p>` : ""}
      </div>`;
    grid.appendChild(card);
  });
}

// ---------- Scroll anim (template lib/scroll.js) ----------
// Panggil refresh() setelah konten dinamis dirender supaya elemen
// [data-reveal]/[data-stagger] yang baru ikut teramati observer.
function refreshScroll() {
  if (window.ScrollAnim && window.ScrollAnim.refresh) window.ScrollAnim.refresh();
}

// ---------- Init ----------
(async function init() {
  try {
    const [info, schedule, classes, events, images, banners] = await Promise.all([
      getJSON(API.info),
      getJSON(API.schedule),
      getJSON(API.classes),
      getJSON(API.events),
      getJSON(API.images),
      getJSON(API.banners),
    ]);

    renderFooter(info);
    setupSlider(images);
    renderSchedule(schedule);
    renderClasses(classes);
    setupEventThumb(events);
    renderBanners(banners);

    refreshScroll();
  } catch (err) {
    console.error("Gagal memuat data:", err);
    const main = document.querySelector("main") || document.body;
    const warn = el("div", "empty-state");
    warn.style.cssText = "text-align:center;padding:60px 20px;color:var(--text-soft);";
    warn.innerHTML = `<div style="font-size:3.5rem">😢</div><h3 style="margin:10px 0">Ups, terjadi kesalahan</h3><p>Pastikan server berjalan lalu muat ulang halaman.</p>`;
    main.prepend(warn);
  }
})();

// Fungsi yang tidak bergantung pada data
startClock();
setupTheme();
