# Deploy ke GitHub: File/Foler yang Boleh & Tidak Boleh

## ✅ Boleh di-deploy (commit ke GitHub)

### Kode backend

- `backend/**`

### Template view

- `frontend/views/**`
- `backend/views/**`

### Static assets frontend

- `frontend/public/css/**`
- `frontend/public/js/**`
- `frontend/public/images/**`
- `frontend/public/*.js`, `frontend/public/*.css` (jika ada)
- `frontend/public/**` **selain** folder `uploads`

### Script & metadata project

- `scripts/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `TODO.md`
- `.gitignore` (boleh di-update)

## 🚫 Tidak boleh di-deploy (jangan commit)

### Database (berisi data autentikasi/operasional)

- `database/db.json`

### Hasil upload user/admin

- `frontend/public/uploads/`

### Secret / environment

- `.env`
- `*.env`

## Wajib: update `.gitignore` (agar aman)

Tambahkan (kalau belum ada):

```gitignore
database/db.json
frontend/public/uploads/
.env
*.env
```

## Penjelasan singkat (kenapa)

- `database/db.json` berisi daftar admin dan `passwordHash` (data autentikasi).
- `frontend/public/uploads/` berisi file poster hasil upload—harus disediakan di lingkungan deploy (mis. folder persist/volume), bukan dipush ke GitHub.
- `.env` adalah secret.
