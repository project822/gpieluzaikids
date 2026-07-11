# Panduan Create User Admin Baru (dengan Hash Password)

File terkait:

- Route: `GET /admins/new` dan `POST /admins/new`
- Password disimpan sebagai hash memakai `bcrypt`

## 1) Login sebagai Admin

1. Jalankan server admin:
   - `node backend/adminServer.js`
2. Buka:
   - `http://localhost:10083/login`
3. Login dengan akun admin default (kalau belum pernah dibuat):
   - **username:** `admin`
   - **password:** `admin123`

## 2) Buat Admin Baru

1. Setelah login, buka:
   - `http://localhost:10083/admins/new`
2. Isi:
   - **username** (unik)
   - **password** (password yang kamu mau untuk admin baru)
3. Klik **Create**.

### Yang terjadi saat Create

- Server akan membuat hash password dengan:
  - `bcrypt.hash(password, 10)`
- Lalu menyimpan ke DB sebagai:
  - `{ username, passwordHash }`

## 3) Login Menggunakan Akun Baru

1. Logout dari admin.
2. Login ulang di halaman:
   - `http://localhost:10083/login`
3. Gunakan:
   - username baru
   - password asli (bukan hash)

## 4) Tips Troubleshooting

- Jika muncul error “Username sudah dipakai”, berarti username tersebut sudah ada di `database/db.json`.
- Pastikan DB kamu sudah memiliki struktur `admins` (bukan `admin`):
  - `database/db.json` harus punya field `admins: []`.

## Catatan Keamanan

- Password **tidak** disimpan dalam bentuk plaintext.
- Hash menggunakan `bcrypt` (aman untuk skenario login sederhana).
