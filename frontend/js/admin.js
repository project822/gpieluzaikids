// ============================================================
// GPI ELUZAI KIDS — Panel Admin logic
// ============================================================

const $ = (id) => document.getElementById(id);

// ---------- CSRF (PRD FR-9) ----------
// Token dibuat server saat login & dibagikan via /api/status.
// Semua request mutasi (POST/PUT/DELETE) wajib menyertakan header
// X-CSRF-Token agar lolos middleware requireAdmin di server.
let csrfToken = "";
async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  return fetch(url, { ...options, headers });
}

// ---------- Status DB ----------
// Ambil status server; kembalikan data (/api/status) agar init bisa
// memakainya sekali jalan (badge DB + cek admin + csrfToken).
async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    const badge = $("db-badge");
    if (data.db) {
      badge.textContent = "🍃 Terhubung";
      badge.className = "db-badge on";
    } else {
      badge.textContent = "📁 Mode JSON";
      badge.className = "db-badge off";
    }
    return data;
  } catch {
    $("db-badge").textContent = "⚠️ Server tidak merespons";
    return null;
  }
}

// ---------- Auth guard ----------
// Login sudah dipindah ke halaman terpisah /admin/login (sesuai PRD).
// Halaman ini hanya tampil bila session admin valid; bila tidak, redirect.
function redirectToLogin() {
  window.location.href = "/admin/login";
}

// ---------- Message helper ----------
// style: true/"ok" (hijau), false/"err" (merah), atau "warn" (kuning)
function setMsg(id, text, style = true) {
  const m = $(id);
  if (!m) return;
  m.textContent = text;
  m.className = `form-msg ${style === "warn" ? "warn" : style ? "ok" : "err"}`;
  setTimeout(() => { m.textContent = ""; m.className = "form-msg"; }, 4000);
}

// ---------- Form serialization ----------
function formData(form) {
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v; });
  return data;
}

// ---------- Inisial dari nama lengkap (avatar absensi) ----------
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0];
}

// ============================================================
// TAB: INFORMASI
// ============================================================
function fillInfoForm(info) {
  const form = $("info-form");
  Object.keys(info).forEach((key) => {
    const input = form.elements[key];
    if (input) input.value = info[key] ?? "";
  });
}

$("info-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await apiFetch("/api/admin/info", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData(e.target)),
  });
  const data = await res.json();
  setMsg("info-msg", res.ok ? "✅ Informasi berhasil disimpan" : `❌ ${data.error || "Gagal"}`, res.ok);
});

// ============================================================
// TAB: ANGGOTA KELAS
// (Kelas bersifat tetap — hanya anggota yang bisa dikelola)
// ============================================================
let membersClasses = [];
let membersClassId = "";

function renderMembersPicker(classes) {
  membersClasses = classes || [];
  const sel = $("members-class-select");
  sel.innerHTML = "";
  (classes || []).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.nama} (${c.kelompok})`;
    sel.appendChild(opt);
  });
  if (classes && classes.length) {
    // Pertahankan pilihan sebelumnya bila masih ada
    const keep = classes.some((c) => c.id === membersClassId);
    sel.value = keep ? membersClassId : classes[0].id;
    membersClassId = sel.value;
  }
  loadMembersList();
}

async function loadMembersList() {
  const list = $("members-list");
  if (!list) return;
  if (!membersClassId) {
    list.innerHTML = `<div class="empty-list"><span class="emoji">🎒</span>Belum ada kelas.</div>`;
    return;
  }
  const cls = membersClasses.find((c) => c.id === membersClassId);
  const members = (cls && cls.anggota) || [];
  $("members-class-name").textContent = cls ? cls.nama : "";
  $("members-count").textContent = `${members.length} anggota`;
  if (!members.length) {
    list.innerHTML = `<div class="empty-list"><span class="emoji">👥</span>Belum ada anggota di kelas ini.</div>`;
    return;
  }
  list.innerHTML = "";
  members.forEach((m) => {
    const d = new Date(`${m.tanggalLahir || ""}T00:00:00`);
    const tgl = m.tanggalLahir && !isNaN(d)
      ? `🎂 ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
      : "";
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div style="font-size:1.6rem">👤</div>
      <div class="member-info">
        <h4>${m.nama}</h4>
        <div class="sub">${cls.nama} · ${cls.kelompok}${tgl ? ` · ${tgl}` : ""}</div>
        <button class="btn btn-danger btn-sm" data-del-member="${m.id}">🗑 Hapus</button>
      </div>`;
    list.appendChild(item);
  });
}

$("members-class-select").addEventListener("change", (e) => {
  membersClassId = e.target.value;
  loadMembersList();
});

$("members-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("member-name");
  const tglInput = $("member-tgl");
  const nama = input.value.trim();
  const tanggalLahir = tglInput.value || "";
  if (!nama || !membersClassId) return;
  const res = await apiFetch(`/api/admin/classes/${membersClassId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nama, tanggalLahir }),
  });
  const data = await res.json();
  setMsg("members-msg", res.ok ? `✅ ${nama} ditambahkan` : `❌ ${data.error || "Gagal"}`, res.ok);
  if (res.ok) {
    input.value = "";
    tglInput.value = "";
    loadAll();
  }
});

$("members-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-member]");
  if (!btn) return;
  if (!confirm("Hapus anggota ini?")) return;
  await apiFetch(`/api/admin/classes/${membersClassId}/members/${btn.dataset.delMember}`, { method: "DELETE" });
  loadAll();
});

// ============================================================
// TAB: ABSENSI (data anak diambil dari #class — hanya nama kelas & nama anggota)
// ============================================================
let absensiClasses = [];
let absensiEditId = null; // id record absensi yang sedang diedit (null = mode input baru)

// Tampilkan/sembunyikan mode edit di form absensi (bar info + label tombol simpan)
function setAbsensiEditUi(on) {
  const bar = $("absensi-editbar");
  const btn = $("absensi-submit-btn");
  if (bar) bar.hidden = !on;
  if (btn) btn.textContent = on ? "💾 Simpan Perubahan" : "💾 Simpan Absensi";
  const form = $("absensi-form");
  if (form) form.classList.toggle("is-editing", on);
}

function cancelAbsensiEdit() {
  absensiEditId = null;
  setAbsensiEditUi(false);
  const note = $("absensi-conflict-note");
  if (note) note.hidden = true;
}

// Muat record absensi ke form & aktifkan mode edit (simpan berikutnya = PUT).
// `records` (opsional) dipakai untuk peringatan konflik: ada record LAIN dengan
// kelas + tanggal yang sama (kemungkinan duplikat lama). Kembalikan true bila
// sudah menampilkan pesan peringatan di #absensi-msg (agar pemanggil tidak
// menimpa dengan pesan lain).
function enterEditMode(rec, records) {
  const sel = $("absensi-class-select");
  const kelasAda = [...sel.options].some((o) => o.value === rec.kelasId);
  if (kelasAda) sel.value = rec.kelasId;
  $("absensi-tanggal").value = rec.tanggal || "";
  renderAbsensiMembers();
  const cls = absensiClasses.find((c) => c.id === sel.value);
  const members = cls && Array.isArray(cls.anggota) ? cls.anggota : [];

  let warned = false;
  if (!kelasAda) {
    // Kelas sudah dihapus — kasih tahu pengguna, jangan gagal diam-diam
    setMsg("absensi-msg", `⚠️ Kelas "${rec.kelasNama || rec.kelasId}" sudah tidak ada — hanya tanggal yang dimuat`, false);
    warned = true;
  } else if (!members.length) {
    setMsg("absensi-msg", "⚠️ Kelas ini belum punya anggota — data kehadiran tidak dapat dimuat", false);
    warned = true;
  }

  document.querySelectorAll(".absensi-check").forEach((box) => {
    const item = box.closest(".absensi-item");
    let recMember = (rec.anggota || []).find((a) => String(a.id) === String(box.dataset.absensiMember));
    // Fallback: cocokkan via nama bila id anggota berubah (mis. dihapus & ditambah ulang)
    if (!recMember && item) {
      const namaBox = item.querySelector(".absensi-name");
      const nama = namaBox ? namaBox.textContent : "";
      recMember = (rec.anggota || []).find((a) => String(a.nama).trim() === String(nama).trim());
    }
    box.checked = !!(recMember && recMember.hadir);
    if (item) {
      item.classList.toggle("hadir", box.checked);
      const status = item.querySelector(".absensi-status");
      if (status) status.textContent = box.checked ? "Hadir" : "Tidak Hadir";
    }
  });
  updateAbsensiSummary();

  // Peringatan konflik PERSISTEN (selama mode edit): ada absensi LAIN untuk
  // kelas + tanggal yang sama (kemungkinan duplikat lama).
  const note = $("absensi-conflict-note");
  let dupCount = 0;
  if (Array.isArray(records)) {
    dupCount = records.filter(
      (r) =>
        String(r.id) !== String(rec.id) &&
        String(r.tanggal || "") === String(rec.tanggal || "") &&
        String(r.kelasId || "") === String(rec.kelasId || "")
    ).length;
  }
  if (note) {
    note.textContent = dupCount
      ? `⚠️ Terdapat ${dupCount} absensi lain untuk kelas & tanggal yang sama — kemungkinan duplikat lama. Periksa & hapus yang tidak dipakai.`
      : "";
    note.hidden = !dupCount;
  }

  absensiEditId = rec.id;
  setAbsensiEditUi(true);
  const tglDisp = rec.tanggal ? rec.tanggal.split("-").reverse().join("/") : "";
  $("absensi-edit-info").textContent = `${tglDisp} · ${rec.kelasNama || rec.kelasId || ""}`.trim();
  $("absensi-form").scrollIntoView({ behavior: "smooth", block: "start" });
  return warned;
}

function renderAbsensiPicker(classes) {
  absensiClasses = classes || [];
  const sel = $("absensi-class-select");
  sel.innerHTML = "";
  (classes || []).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.nama} (${c.kelompok})`;
    sel.appendChild(opt);
  });
  if (classes && classes.length) {
    sel.value = classes[0].id;
  }
  // Default tanggal hari ini (waktu lokal, bukan UTC)
  const tgl = $("absensi-tanggal");
  if (tgl && !tgl.value) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    tgl.value = `${y}-${m}-${d}`;
  }
  renderAbsensiMembers();
}

function renderAbsensiMembers() {
  const wrap = $("absensi-members");
  const cls = absensiClasses.find((c) => c.id === $("absensi-class-select").value);
  if (!cls) {
    wrap.innerHTML = `<div class="empty-list"><span class="emoji">🎒</span>Belum ada kelas.</div>`;
    return;
  }
  const members = Array.isArray(cls.anggota) ? cls.anggota : [];
  $("absensi-class-name").textContent = cls.nama;
  $("absensi-count").textContent = `${members.length} anak`;

  if (!members.length) {
    wrap.innerHTML = `<div class="empty-list"><span class="emoji">👥</span>Belum ada anggota di kelas ini.</div>`;
    updateAbsensiSummary();
    return;
  }

  wrap.innerHTML = "";
  members.forEach((m) => {
    const label = document.createElement("label");
    label.className = "absensi-item";
    label.innerHTML = `
      <span class="absensi-avatar">${initials(m.nama)}</span>
      <span class="absensi-name">${m.nama}</span>
      <input type="checkbox" class="absensi-check" data-absensi-member="${m.id}" aria-label="Hadir: ${m.nama}" />
      <span class="absensi-checkbox">
        <span class="absensi-check-icon" aria-hidden="true">✓</span>
      </span>
      <span class="absensi-status" aria-hidden="true">Tidak Hadir</span>
    `;
    wrap.appendChild(label);
  });

  updateAbsensiSummary();
}

// Listener delegasi (dipasang sekali) — jangan dipasang di dalam render
// agar tidak menumpuk tiap kali render ulang.
$("absensi-members").addEventListener("change", (e) => {
  const box = e.target.closest(".absensi-check");
  if (!box) return;
  const item = box.closest(".absensi-item");
  item.classList.toggle("hadir", box.checked);
  const status = item.querySelector(".absensi-status");
  status.textContent = box.checked ? "Hadir" : "Tidak Hadir";
  updateAbsensiSummary();
});

function updateAbsensiSummary() {
  const wrap = $("absensi-members");
  const boxes = wrap ? wrap.querySelectorAll(".absensi-check") : [];
  const hadir = [...boxes].filter((b) => b.checked).length;
  $("absensi-summary").textContent = hadir
    ? `✅ ${hadir} hadir · ${boxes.length - hadir} tidak hadir`
    : "Belum ada yang dicentang — semua dianggap Tidak Hadir.";
}

$("absensi-class-select").addEventListener("change", () => {
  cancelAbsensiEdit();
  renderAbsensiMembers();
});
// Ganti tanggal saat mode edit → keluar dari mode edit agar tidak menimpa record lama
$("absensi-tanggal").addEventListener("change", cancelAbsensiEdit);

$("absensi-all").addEventListener("click", () => {
  document.querySelectorAll(".absensi-check").forEach((b) => {
    b.checked = true;
    b.closest(".absensi-item").classList.add("hadir");
    b.closest(".absensi-item").querySelector(".absensi-status").textContent = "Hadir";
  });
  updateAbsensiSummary();
});

$("absensi-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cls = absensiClasses.find((c) => c.id === $("absensi-class-select").value);
  if (!cls) return setMsg("absensi-msg", "Pilih kelas terlebih dahulu", false);
  const members = Array.isArray(cls.anggota) ? cls.anggota : [];
  const anggota = members.map((m) => {
    const box = document.querySelector(`.absensi-check[data-absensi-member="${m.id}"]`);
    return { id: String(m.id), nama: m.nama, hadir: !!(box && box.checked) };
  });
  const payload = {
    tanggal: $("absensi-tanggal").value,
    kelasId: cls.id,
    kelasNama: cls.nama,
    anggota,
  };
  if (!payload.tanggal) return setMsg("absensi-msg", "Tanggal wajib diisi", false);

  const submitBtn = $("absensi-submit-btn");
  if (submitBtn) submitBtn.disabled = true; // cegah submit ganda
  try {
    const isEdit = !!absensiEditId;
    const res = await apiFetch(
      isEdit ? `/api/admin/attendance/${absensiEditId}` : "/api/admin/attendance",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();

    // Cegah absensi ganda: POST ditolak karena sudah ada record utk kelas+tanggal ini.
    // Tawarkan beralih ke mode edit record yang ada (tidak membuat duplikat).
    if (!isEdit && res.status === 409 && data.existing) {
      const rec = data.existing;
      const tglDisp = rec.tanggal ? rec.tanggal.split("-").reverse().join("/") : "";
      const ok = confirm(
        `Absensi untuk ${rec.kelasNama || ""} tanggal ${tglDisp} sudah tersimpan.\n\nOK = edit data yang sudah ada (tidak membuat duplikat)\nBatal = batalkan penyimpanan`
      );
      if (ok) {
        const listRes = await fetch("/api/admin/attendance");
        const list = listRes.ok ? await listRes.json() : [];
        // Pakai record lengkap dari daftar (pastikan `anggota` ikut termuat)
        const fullRec = list.find((r) => String(r.id) === String(rec.id)) || rec;
        const editWarned = enterEditMode(fullRec, list);
        // Jangan timpa peringatan dari enterEditMode (mis. kelas sudah dihapus)
        if (!editWarned) setMsg("absensi-msg", "⚠️ Absensi sudah ada — beralih ke mode edit untuk memperbarui data tersebut", "warn");
      } else {
        setMsg("absensi-msg", "Penyimpanan dibatalkan — absensi untuk kelas & tanggal ini sudah ada", false);
      }
      return;
    }

    setMsg(
      "absensi-msg",
      res.ok
        ? isEdit
          ? "✅ Perubahan absensi berhasil disimpan"
          : "✅ Absensi berhasil disimpan"
        : `❌ ${data.error || "Gagal"}`,
      res.ok
    );
    if (res.ok) {
      if (isEdit) cancelAbsensiEdit();
      loadAbsensiHistory();
    } else if (isEdit && res.status === 404) {
      // Record sudah dihapus (admin lain) — keluar dari mode edit agar tidak macet
      cancelAbsensiEdit();
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

// Format tanggal-waktu (ISO string/Date) → "2 Agt 2026 14.30" atau "" bila kosong
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- Riwayat absensi ----------
// Riwayat menampilkan hanya 5 hari terakhir (pembersihan tampilan); data
// lama tetap aman di database & tetap ikut dalam export SEMUA data.
const ABSENSI_HISTORY_DAYS = 5;

async function loadAbsensiHistory() {
  const list = $("absensi-history");
  let records = [];
  try {
    const res = await fetch("/api/admin/attendance");
    if (res.ok) records = await res.json();
  } catch {}
  if (!records.length) {
    list.innerHTML = `<div class="empty-list"><span class="emoji">📋</span>Belum ada data absensi tersimpan.</div>`;
    return;
  }

  // Filter tampilan: hanya record dengan tanggal >= hari ini - (DAYS-1)
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (ABSENSI_HISTORY_DAYS - 1));
  const pad = (n) => String(n).padStart(2, "0");
  const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  const visible = records.filter((r) => String(r.tanggal || "") >= cutoffStr);
  const hiddenCount = records.length - visible.length;

  list.innerHTML = "";
  const note = document.createElement("p");
  note.className = "history-note";
  note.textContent = hiddenCount > 0
    ? `🗓️ Riwayat menampilkan ${ABSENSI_HISTORY_DAYS} hari terakhir — ${hiddenCount} data lebih lama tetap aman di database & ikut dalam export.`
    : `🗓️ Riwayat menampilkan ${ABSENSI_HISTORY_DAYS} hari terakhir — data lama tetap aman di database & ikut dalam export.`;
  list.appendChild(note);
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.innerHTML = `<span class="emoji">🗓️</span>Belum ada absensi dalam ${ABSENSI_HISTORY_DAYS} hari terakhir.`;
    list.appendChild(empty);
    return;
  }
  visible.forEach((r) => {
    const hadir = (r.anggota || []).filter((a) => a.hadir).length;
    const total = (r.anggota || []).length;
    const tgl = r.tanggal ? r.tanggal.split("-").reverse().join("/") : "";
    const createdTxt = fmtDateTime(r.createdAt);
    const updatedTxt = fmtDateTime(r.updatedAt);
    // Waktu edit: tampil bila record pernah diperbarui; kalau belum, tampilkan waktu dibuat
    const timeTxt = updatedTxt
      ? `✏️ Diedit ${updatedTxt}${createdTxt ? ` · Dibuat ${createdTxt}` : ""}`
      : createdTxt
        ? `💾 Dibuat ${createdTxt}`
        : "";
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div style="font-size:1.6rem">📋</div>
      <div>
        <h4>${r.kelasNama} <span class="mini-badge">${tgl}</span></h4>
        <div class="sub">✅ ${hadir} hadir · ✖ ${total - hadir} tidak hadir (dari ${total} anak)</div>
        ${timeTxt ? `<div class="sub sub-time">${timeTxt}</div>` : ""}
      </div>
      <div class="spacer"></div>
      <button class="btn btn-ghost btn-sm" data-edit-absensi="${r.id}">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" data-del-absensi="${r.id}">🗑 Hapus</button>`;
    list.appendChild(item);
  });
}

// Muat kembali data absensi tersimpan ke form
$("absensi-history").addEventListener("click", async (e) => {
  const delBtn = e.target.closest("[data-del-absensi]");
  if (delBtn) {
    if (!confirm("Hapus data absensi ini?")) return;
    await apiFetch(`/api/admin/attendance/${delBtn.dataset.delAbsensi}`, { method: "DELETE" });
    // Jika record yang diedit dihapus → keluar dari mode edit
    if (String(absensiEditId) === String(delBtn.dataset.delAbsensi)) cancelAbsensiEdit();
    loadAbsensiHistory();
    return;
  }
  const editBtn = e.target.closest("[data-edit-absensi]");
  if (!editBtn) return;
  const res = await fetch("/api/admin/attendance");
  const records = res.ok ? await res.json() : [];
  const rec = records.find((r) => String(r.id) === String(editBtn.dataset.editAbsensi));
  if (!rec) {
    setMsg("absensi-msg", "Data absensi tidak ditemukan (mungkin sudah dihapus)", false);
    return;
  }
  enterEditMode(rec, records);
});

// Batal edit — kembali ke mode input baru
$("absensi-edit-cancel").addEventListener("click", cancelAbsensiEdit);

// ============================================================
// EXPORT REKAP ABSENSI (Excel & PDF) — file: "Rekap Kehadiran $tanggal"
// ============================================================

// ---------- Helper unduh ----------
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

// Ubah 1 record absensi (dari database) menjadi bentuk data rekap untuk export
function recordToData(r) {
  const rows = (r.anggota || []).map((a, i) => ({
    no: i + 1,
    nama: a.nama,
    status: a.hadir ? "Hadir" : "Tidak Hadir",
    hadir: !!a.hadir,
  }));
  const hadir = rows.filter((x) => x.hadir).length;
  return {
    tanggal: r.tanggal || "",
    kelasNama: r.kelasNama || r.kelasId || "Kelas",
    rows,
    hadir,
    tidakHadir: rows.length - hadir,
    total: rows.length,
  };
}

// Nama file export: rentang tanggal dari semua record (jadi 1 file)
// Pakai pemisah '-' (bukan '/') agar aman sebagai nama file di Windows.
function exportFileName(ext, list) {
  const dates = (list || []).map((d) => String(d.tanggal || "")).filter(Boolean).sort();
  const fmt = (s) => s.split("-").reverse().join("-");
  let range;
  if (!dates.length) range = "Semua Data";
  else if (dates[0] === dates[dates.length - 1]) range = fmt(dates[0]);
  else range = `${fmt(dates[0])} s.d. ${fmt(dates[dates.length - 1])}`;
  return `Rekap Kehadiran ${range}.${ext}`;
}

// ---------- Export Excel (.xlsx OOXML asli — tanpa warning "file rusak") ----------
// Sebelumnya memakai tabel HTML ber-ekstensi .xls yang memicu peringatan Excel
// "file could be corrupted or unsafe". Kini dirakit file .xlsx (Open XML) asli
// murni client-side: ZIP (metode store) + CRC-32 + bagian-bagian OOXML standar.
// ----[EXPORT-XLSX-START]----
function escXml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// CRC-32 (untuk header ZIP) — tabel dihitung sekali, lalu dipakai ulang
let _crcTable = null;
function crc32(bytes) {
  if (!_crcTable) {
    _crcTable = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      _crcTable[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ _crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Rakit ZIP minimal (metode store, tanpa kompresi) dari daftar {name, data}
function buildZip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  const dosTime = (1 << 11) | (1 << 5);               // jam tetap (02:00)
  const dosDate = ((2020 - 1980) << 9) | (1 << 5) | 1; // tanggal tetap (2020-01-01)

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    // Central directory header
    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    centrals.push(cen);

    offset += local.length;
  }

  const centralSize = centrals.reduce((a, p) => a + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const p of locals) { out.set(p, pos); pos += p.length; }
  for (const p of centrals) { out.set(p, pos); pos += p.length; }
  out.set(eocd, pos);
  return out;
}

// Susun worksheet (sheet1.xml) — sel teks pakai inlineStr (tanpa shared strings)
function buildSheetXml(data) {
  const tgl = String(data.tanggal || "").split("-").reverse().join("/");
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const txt = (ref, s) => `<c r="${ref}" t="inlineStr"><is><t>${escXml(s)}</t></is></c>`;
  const num = (ref, n) => `<c r="${ref}" t="n"><v>${n}</v></c>`;
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  xml += `<row r="1">${txt("A1", "Rekap Kehadiran")}</row>`;
  xml += `<row r="2">${txt("A2", "Kelas: " + (data.kelasNama || ""))}${txt("B2", "Tanggal: " + tgl)}</row>`;
  xml += `<row r="3">${txt("A3", "No")}${txt("B3", "Nama")}${txt("C3", "Keterangan")}</row>`;
  rows.forEach((r, i) => {
    const n = i + 4;
    xml += `<row r="${n}">${num("A" + n, r.no)}${txt("B" + n, r.nama)}${txt("C" + n, r.status)}</row>`;
  });
  const last = rows.length + 4;
  xml += `<row r="${last}">${txt("A" + last, "Hadir: " + (data.hadir || 0) + " | Tidak Hadir: " + (data.tidakHadir || 0) + " | Total: " + (data.total || rows.length))}</row>`;
  xml += "</sheetData></worksheet>";
  return xml;
}

// Rakit paket XLSX lengkap (bagian-bagian OOXML standar)
// Mendukung banyak sheet: 1 sheet per record absensi (SEMUA data jadi 1 file).
function buildXlsx(dataList) {
  const enc = new TextEncoder();
  const list = Array.isArray(dataList) ? dataList : [dataList];

  // Nama sheet: maks 31 karakter & tanpa karakter terlarang []:*?/\ — unik.
  const sheetNames = [];
  const used = new Set();
  list.forEach((d, i) => {
    const tgl = String(d.tanggal || "").split("-").reverse().join("-");
    const base = `${d.kelasNama || "Kelas"}${tgl ? " " + tgl : ""}`.replace(/[\\\[\]:*?/]/g, "").slice(0, 31) || `Sheet${i + 1}`;
    let name = base;
    let n = 2;
    while (used.has(name)) {
      const suffix = ` (${n++})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name);
    sheetNames.push(name);
  });

  // [Content_Types].xml — Override per sheet
  let ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
  list.forEach((_, i) => {
    ct += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  });
  ct += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';

  // xl/workbook.xml — daftar semua sheet
  let wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
  list.forEach((_, i) => {
    wb += `<sheet name="${escXml(sheetNames[i])}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
  });
  wb += "</sheets></workbook>";

  // xl/_rels/workbook.xml.rels — relasi per sheet + styles
  let rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  list.forEach((_, i) => {
    rels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
  });
  rels += `<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const files = [
    { name: "[Content_Types].xml", data: enc.encode(ct) },
    { name: "_rels/.rels", data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: "xl/workbook.xml", data: enc.encode(wb) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(rels) },
    { name: "xl/styles.xml", data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>') },
  ];
  list.forEach((d, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(buildSheetXml(d)) });
  });
  return buildZip(files);
}
// ----[EXPORT-XLSX-END]----

function exportAbsensiExcel(dataList) {
  const list = Array.isArray(dataList) ? dataList : [dataList];
  downloadBlob(
    new Blob([buildXlsx(list)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    exportFileName("xlsx", list)
  );
}

// ---------- Export PDF (generator minimal murni client-side, tanpa library) ----------
// Escaping teks agar aman untuk sintaks string PDF (kurung) + hanya ASCII/WinAnsi
// ----[EXPORT-PDF-START]----
function escPdf(text) {
  return String(text == null ? "" : text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // é → e, dst.
    .replace(/[^\x20-\x7E]/g, "?")   // karakter non-ASCII → "?"
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// Susun isi halaman (content stream) — A4, 3 kolom: No | Nama | Keterangan
function absensiPdfStream(data) {
  const tgl = String(data.tanggal || "").split("-").reverse().join("/");
  const kelas = String(data.kelasNama || "");
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const l = [];
  l.push("BT /F1 20 Tf 50 800 Td (Rekap Kehadiran) Tj ET");
  l.push("BT /F2 11 Tf 50 776 Td (Kelas: " + escPdf(kelas) + ") Tj ET");
  l.push("BT /F2 11 Tf 300 776 Td (Tanggal: " + escPdf(tgl) + ") Tj ET");
  const headY = 736;
  l.push("BT /F1 11 Tf 50 " + headY + " Td (No) Tj ET");
  l.push("BT /F1 11 Tf 92 " + headY + " Td (Nama) Tj ET");
  l.push("BT /F1 11 Tf 420 " + headY + " Td (Keterangan) Tj ET");
  l.push("50 " + (headY - 8) + " m 545 " + (headY - 8) + " l S");
  let y = headY - 32;
  let drawn = 0;
  for (const r of rows) {
    if (y < 120) break; // sisakan ruang untuk ringkasan
    l.push("BT /F2 11 Tf 50 " + y + " Td (" + escPdf(String(r.no)) + ") Tj ET");
    l.push("BT /F2 11 Tf 92 " + y + " Td (" + escPdf(String(r.nama)) + ") Tj ET");
    l.push("BT /F2 11 Tf 420 " + y + " Td (" + escPdf(String(r.status)) + ") Tj ET");
    y -= 22;
    drawn++;
  }
  if (drawn < rows.length) {
    y -= 4;
    l.push("BT /F2 10 Tf 50 " + y + " Td (... dan " + (rows.length - drawn) + " anggota lainnya.) Tj ET");
    y -= 26;
  } else {
    y -= 4;
  }
  l.push("BT /F1 11 Tf 50 " + y + " Td (Hadir: " + (data.hadir || 0) + "    Tidak Hadir: " + (data.tidakHadir || 0) + "    Total: " + (data.total || rows.length) + ") Tj ET");
  return l.join("\n");
}

// Rakit dokumen PDF: header objek + xref offset yang akurat
// Mendukung banyak halaman: 1 halaman per record absensi (SEMUA data jadi 1 file).
function buildAbsensiPdf(dataList) {
  const list = Array.isArray(dataList) ? dataList : [dataList];
  const N = list.length;
  const streams = list.map((d) => absensiPdfStream(d));
  const font1Obj = 3 + N; // objek Font F1 (Helvetica-Bold)
  const font2Obj = 4 + N; // objek Font F2 (Helvetica)

  const objs = [];
  // 1: Catalog
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages — kids: halaman 3..(2+N)
  const kids = [];
  for (let i = 0; i < N; i++) kids.push(`${3 + i} 0 R`);
  objs.push(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${N} >>`);
  // 3..(2+N): halaman, masing-masing /Contents menunjuk objek stream-nya
  for (let i = 0; i < N; i++) {
    const contentObj = 5 + N + i;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1Obj} 0 R /F2 ${font2Obj} 0 R >> >> /Contents ${contentObj} 0 R >>`);
  }
  // Font
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // Stream isi tiap halaman
  streams.forEach((stream) => {
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += i + 1 + " 0 obj\n" + body + "\nendobj\n";
  });
  const xrefStart = pdf.length;
  pdf += "xref\n0 " + (objs.length + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  offsets.forEach((off) => {
    pdf += String(off).padStart(10, "0") + " 00000 n \n";
  });
  pdf += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF";
  return pdf;
}
// ----[EXPORT-PDF-END]----

function exportAbsensiPdf(dataList) {
  const list = Array.isArray(dataList) ? dataList : [dataList];
  const pdf = buildAbsensiPdf(list);
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), exportFileName("pdf", list));
}

// Tombol export — export SEMUA data absensi dari database (jadi 1 file)
async function handleExport(kind) {
  let records = [];
  try {
    const res = await fetch("/api/admin/attendance");
    if (res.ok) records = await res.json();
  } catch {}
  if (!records.length) return setMsg("absensi-msg", "Belum ada data absensi untuk diexport", false);
  const dataList = records.map(recordToData);
  if (kind === "excel") exportAbsensiExcel(dataList);
  else exportAbsensiPdf(dataList);
  setMsg("absensi-msg", `✅ ${dataList.length} data absensi diexport jadi 1 file`);
}

$("absensi-export-excel").addEventListener("click", () => handleExport("excel"));
$("absensi-export-pdf").addEventListener("click", () => handleExport("pdf"));

// ============================================================
// TAB: JADWAL (dokumen tunggal: ibadah & latihan)
// ============================================================
function fillScheduleForm(schedule) {
  const form = $("schedule-form");
  if (!schedule || typeof schedule !== "object") schedule = {};
  const ib = schedule.ibadah || {};
  const lt = schedule.latihan || {};
  form.elements.ibadah_ada.checked = !!ib.ada;
  form.elements.ibadah_jam.value = ib.jam || "";
  form.elements.ibadah_keterangan.value = ib.keterangan || "";
  form.elements.latihan_ada.checked = !!lt.ada;
  form.elements.latihan_jam.value = lt.jam || "";
  form.elements.latihan_keterangan.value = lt.keterangan || "";
}

$("schedule-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const schedule = {
    ibadah: {
      ada: f.elements.ibadah_ada.checked,
      jam: f.elements.ibadah_jam.value.trim(),
      keterangan: f.elements.ibadah_keterangan.value.trim(),
    },
    latihan: {
      ada: f.elements.latihan_ada.checked,
      jam: f.elements.latihan_jam.value.trim(),
      keterangan: f.elements.latihan_keterangan.value.trim(),
    },
  };
  const res = await apiFetch("/api/admin/schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schedule),
  });
  const json = await res.json();
  setMsg("schedule-msg", res.ok ? "✅ Jadwal berhasil disimpan" : `❌ ${json.error || "Gagal"}`, res.ok);
});

// ============================================================
// TAB: BANNER
// ============================================================
$("banners-form").addEventListener("change", (e) => {
  if (e.target.name !== "image") return;
  const file = e.target.files[0];
  const preview = $("banner-preview");
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  }
});

$("banners-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const res = await apiFetch("/api/admin/banners", { method: "POST", body: fd });
  const data = await res.json();
  setMsg("banners-msg", res.ok ? "✅ Banner berhasil diunggah" : `❌ ${data.error || "Gagal"}`, res.ok);
  if (res.ok) {
    e.target.reset();
    $("banner-preview").hidden = true;
    loadAll();
  }
});

function renderBanners(banners) {
  const list = $("banners-list");
  if (!banners.length) {
    list.innerHTML = `<div class="empty-list"><span class="emoji">📢</span>Belum ada banner.</div>`;
    return;
  }
  list.innerHTML = "";
  banners.forEach((b) => {
    const item = document.createElement("div");
    item.className = "list-item banner-item";
    item.innerHTML = `
      <img class="banner-thumb" src="${b.imageUrl}" alt="${b.judul}" loading="lazy" />
      <div>
        <h4>${b.judul}</h4>
        <div class="banner-url">🔗 ${b.url}</div>
        ${b.deskripsi ? `<div class="sub">${b.deskripsi}</div>` : ""}
      </div>
      <div class="spacer"></div>
      <button class="btn btn-danger btn-sm" data-del-banner="${b.id}">🗑 Hapus</button>`;
    list.appendChild(item);
  });
}

$("banners-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-banner]");
  if (!btn) return;
  if (!confirm("Hapus banner ini?")) return;
  await apiFetch(`/api/admin/banners/${btn.dataset.delBanner}`, { method: "DELETE" });
  loadAll();
});

// ============================================================
// TABS
// ============================================================
$("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
  $(`tab-${tab.dataset.tab}`).hidden = false;
});

// ============================================================
// LOAD SEMUA DATA
// ============================================================
async function loadAll() {
  const res = await fetch("/api/admin/data");
  if (!res.ok) throw new Error("Unauthorized");
  const data = await res.json();
  fillInfoForm(data.info);
  renderMembersPicker(data.classes);
  renderAbsensiPicker(data.classes);
  loadAbsensiHistory();
  fillScheduleForm(data.schedule);
  renderBanners(data.banners);
}

// ============================================================
// INIT
// ============================================================
(async function init() {
  // Ambil status sekali: badge DB + cek session + csrfToken
  const status = await loadStatus();
  if (!status || !status.admin) {
    redirectToLogin();
    return;
  }
  csrfToken = status.csrfToken || "";

  // Logout → route server /admin/logout (PRD FR-8)
  $("logout-btn").addEventListener("click", () => {
    window.location.href = "/admin/logout";
  });

  try {
    $("dashboard-view").hidden = false;
    await loadAll();
  } catch {
    // Session kedaluwarsa di tengah jalan → kembali ke halaman login
    redirectToLogin();
  }
})();
