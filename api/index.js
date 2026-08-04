// ============================================================
// GPI ELUZAI KIDS — Vercel Serverless Entry
// ------------------------------------------------------------
// Vercel hanya menjalankan code dari folder `api/` (serverless
// function). Fungsi ini mengekspor aplikasi Express dari
// backend/server.js (module.exports = app), sehingga SEMUA rute
// (/api/*, /admin, halaman statis, /:slug) ditangani Express.
//
// Catch-all rewrite di vercel.json mengarahkan seluruh request
// ke fungsi ini, dengan path asli tetap diteruskan ke Express.
// ============================================================
const app = require("../backend/server");

module.exports = app;
