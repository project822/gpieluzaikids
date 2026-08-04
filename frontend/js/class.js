// ============================================================
// GPI ELUZAI KIDS — Halaman Kelas (/baby, /samuel, /yosua, /musa)
// ============================================================

// Slug kelas diambil dari path URL (mis. "/baby" -> "baby")
const SLUG = (location.pathname.match(/^\/([^/]+)/) || [])[1] || "";

const API = { classes: "/api/classes", info: "/api/info" };

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

// ---------- Format tanggal lahir ----------
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// ---------- Inisial dari nama lengkap ----------
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0];
}

// ---------- Render halaman ----------
function renderClassPage(cls) {
  const body = document.getElementById("class-page-body");
  if (!body) return;

  // Halaman kelas fade bertahap: grid anggota (konten) duluan,
  // baru heading + body menyusul (data-reveal-delay).
  body.setAttribute("data-reveal", "");
  body.setAttribute("data-reveal-delay", "150");

  const members = Array.isArray(cls.anggota) ? cls.anggota : [];

  const head = el("div", "class-page-head");
  head.innerHTML = `
    <div class="class-page-icon">${cls.emoji || "🎒"}</div>
    <div class="class-page-title">
      <span class="class-group">Kelompok ${cls.kelompok}</span>
      <h1>${cls.nama}</h1>
      <div class="class-page-meta">
        <span class="tag">👶 ${cls.usia}</span>
        <span class="tag">👩‍🏫 ${cls.pengajar}</span>
      </div>
    </div>`;
  body.appendChild(head);

  const membersHead = el("div", "class-members-head");
  membersHead.innerHTML = `<h2>Anggota</h2><span class="class-count-badge">${members.length} anak</span>`;
  body.appendChild(membersHead);

  const grid = el("div", "class-members-grid");
  grid.setAttribute("data-reveal", "");
  body.appendChild(grid);

  if (!members.length) {
    grid.innerHTML = `<div class="empty-list"><span class="emoji">👥</span>Belum ada anggota terdaftar.</div>`;
    return;
  }

  members.forEach((m) => {
    const card = el("article", "class-member-card");
    card.innerHTML = `
      <div class="class-member-avatar">${initials(m.nama)}</div>
      <div class="class-member-info">
        <h3>${m.nama}</h3>
        <div class="class-member-birth">🎂 ${fmtDate(m.tanggalLahir)}</div>
      </div>`;
    grid.appendChild(card);
  });
}

// ---------- Footer ----------
function renderFooter(info) {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
  const address = document.getElementById("footer-address");
  if (address) address.textContent = `📍 ${info.alamat}`;

  // Link kontak footer: WA / IG / YouTube (dari panel admin)
  const contacts = {
    wa: info.whatsapp,
    ig: info.instagram,
    yt: info.youtube,
  };
  Object.entries(contacts).forEach(([key, url]) => {
    const link = document.getElementById(`contact-${key}`);
    if (!link) return;
    if (url) {
      link.href = url;
      link.classList.remove("is-empty");
    } else {
      link.removeAttribute("href");
      link.classList.add("is-empty");
    }
  });
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

// ---------- Scroll anim (template lib/scroll.js) ----------
// Panggil refresh() setelah konten dinamis dirender supaya elemen
// [data-reveal]/[data-stagger] yang baru ikut teramati observer.
function refreshScroll() {
  if (window.ScrollAnim && window.ScrollAnim.refresh) window.ScrollAnim.refresh();
}

// ---------- Init ----------
(async function init() {
  startClock();
  setupTheme();

  try {
    const [classes, info] = await Promise.all([getJSON(API.classes), getJSON(API.info)]);
    const cls = classes.find((c) => String(c.id) === String(SLUG));
    if (!cls) {
      location.replace("/#class");
      return;
    }
    document.title = `${cls.nama} — GPI Eluzai Kids`;
    renderClassPage(cls);
    renderFooter(info);
    refreshScroll();
  } catch (err) {
    console.error("Gagal memuat data:", err);
    document.getElementById("class-page-body").innerHTML =
      `<div class="empty-list"><span class="emoji">😢</span><h3>Terjadi kesalahan</h3><p>Pastikan server berjalan lalu muat ulang halaman.</p></div>`;
  }
})();
