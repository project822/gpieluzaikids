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
- `frontend/public/**` **selain** `frontend/public/uploads/**`

### Script & metadata project

- `scripts/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `TODO.md`
- `.gitignore` (BOLEH dan bahkan DIWAJIBKAN di-commit)

## 🚫 Tidak boleh di-deploy (jangan commit)

### Database (berisi data autentikasi/operasional)

- `database/db.json`

### Hasil upload user/admin

- `frontend/public/uploads/`

### Secret / environment

- `.env`
- `*.env`

## Wajib: isi `.gitignore` yang benar (supaya aman)

Pastikan `.gitignore` berisi setidaknya:

```gitignore
database/db.json
frontend/public/uploads/
.env
*.env
```

## Jawaban untuk pertanyaan: “.gitignore perlu di-upload di GitHub?”

YA. `.gitignore` itu file konfigurasi, **bukan secret**, jadi harus di-commit agar GitHub tahu file apa yang tidak boleh dipush.

## Penjelasan singkat (kenapa)

- `database/db.json` berisi daftar admin dan `passwordHash` (data autentikasi).
- `frontend/public/uploads/` berisi file hasil upload (poster) yang harus disediakan di lingkungan deploy (mis. folder persisten/volume), bukan dipush ke GitHub.
- `.env` adalah secret.
