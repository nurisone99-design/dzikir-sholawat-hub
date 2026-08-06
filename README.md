# Dzikir Sholawat Hub

Portal web Yayasan Raudhatul Jannah Nurul Islam wa Iman. Aplikasi ini menyediakan situs publik untuk informasi yayasan dan panel administrasi untuk mengelola cabang, guru, jamaah, pengurus, agenda, galeri, laporan, pesan, serta pengaturan sistem.

## Daftar isi

- [Arsitektur](#arsitektur)
- [Teknologi](#teknologi)
- [Struktur folder](#struktur-folder)
- [Prasyarat](#prasyarat)
- [Instalasi dan menjalankan aplikasi](#instalasi-dan-menjalankan-aplikasi)
- [Environment variable](#environment-variable)
- [Struktur database](#struktur-database-mongodb)
- [Hak akses](#hak-akses-setiap-role)
- [Deployment](#deployment)
- [Backup dan restore](#backup-dan-restore)
- [Fitur](#fitur-yang-sudah-ada)
- [Testing](#testing)

## Arsitektur

```text
Browser
  |
  +-- Frontend React (port 3000 pada development)
  |     |- situs publik
  |     `- panel admin
  |
  `-- REST API melalui Axios + JWT
          |
          v
      Backend FastAPI (port 8000 pada development)
        |- autentikasi dan otorisasi
        |- CRUD, laporan, upload, backup/restore
        |- static files: /uploads
        `- MongoDB
```

Frontend dan backend adalah dua proses terpisah. Frontend memanggil endpoint backend dengan awalan `/api`; backend menyimpan metadata pada MongoDB dan file gambar pada `backend/uploads`.

## Teknologi

### Frontend

- React 19 dan React DOM
- Create React App (`react-scripts`) dengan CRACO
- React Router DOM 7
- Axios untuk REST API
- TanStack React Query
- Tailwind CSS, Radix UI, dan komponen bergaya shadcn/ui
- Framer Motion untuk animasi
- Leaflet / React Leaflet untuk peta cabang
- Recharts untuk grafik dashboard
- React Hook Form dan Zod tersedia untuk pengelolaan form/validasi

### Backend

- Python dan FastAPI
- Uvicorn sebagai server ASGI
- MongoDB dengan Motor (async driver)
- Pydantic untuk model request tertentu
- PyJWT dan bcrypt untuk autentikasi
- SlowAPI untuk rate limiting login
- Pillow untuk konversi/kompresi gambar WebP
- Pandas + OpenPyXL untuk ekspor XLSX
- ReportLab untuk ekspor PDF

## Struktur folder

```text
.
├── frontend/
│   ├── public/                 # HTML shell dan aset publik (logo)
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/          # Layout, tabel, CRUD, upload, export, peta
│   │   │   ├── common/         # Error boundary
│   │   │   ├── public/         # Navbar, footer, layout situs publik
│   │   │   └── ui/             # UI primitives bersama
│   │   ├── context/            # AuthContext
│   │   ├── lib/                # Axios client dan helpers
│   │   ├── pages/
│   │   │   ├── admin/          # Halaman panel administrasi
│   │   │   └── public/         # Halaman situs publik
│   │   ├── App.js              # Routing aplikasi
│   │   └── index.js            # Entry point React
│   ├── craco.config.js         # Konfigurasi CRA/webpack
│   ├── tailwind.config.js
│   └── package.json
├── backend/
│   ├── server.py               # Aplikasi FastAPI dan seluruh endpoint API
│   ├── seed.py                 # Seed data awal dan akun uji
│   ├── migrate_base64_images.py# Migrasi gambar base64 lama ke file WebP
│   ├── uploads/                # Penyimpanan gambar lokal
│   ├── tests/                  # Integration test backend
│   ├── requirements.txt
│   └── pytest.ini
├── memory/PRD.md               # Dokumen kebutuhan produk
├── test_reports/               # Hasil test historis
├── design_guidelines.json
└── README.md
```

## Prasyarat

- Node.js 18+ dan npm
- Python 3.10+ (disarankan versi modern yang kompatibel dengan dependensi)
- MongoDB 6+ lokal, atau MongoDB Atlas
- Git (opsional, untuk clone repository)

## Instalasi dan menjalankan aplikasi

### 1. Siapkan MongoDB

Buat database kosong, misalnya `dzikir_sholawat_hub`. Pastikan connection string dapat diakses dari backend.

### 2. Instalasi backend

Di PowerShell dari root repository:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Buat file `backend/.env` berdasarkan contoh pada bagian [Environment variable](#environment-variable).

Jalankan API:

```powershell
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

API tersedia di `http://localhost:8000`; dokumentasi interaktif FastAPI tersedia di `http://localhost:8000/docs`.

> Saat startup, backend membuat indeks MongoDB, memastikan super admin dari environment tersedia, dan memanggil seed data. Jangan gunakan akun seed atau password development pada lingkungan produksi.

### 3. Instalasi frontend

Buka terminal PowerShell kedua dari root repository:

```powershell
cd frontend
npm install
```

Buat file `frontend/.env` berdasarkan contoh pada bagian berikutnya.

Jalankan frontend:

```powershell
npm start
```

Frontend tersedia di `http://localhost:3000`.

### 4. Menjalankan keduanya

Pada development, jalankan backend dan frontend di dua terminal terpisah:

```text
Terminal 1: backend  -> uvicorn server:app --host 0.0.0.0 --port 8000 --reload
Terminal 2: frontend -> npm start
```

## Environment variable

Semua file `.env` telah diabaikan Git dan tidak boleh di-commit.

### Backend: `backend/.env`

```dotenv
# Wajib: connection string MongoDB
MONGO_URL=mongodb://127.0.0.1:27017

# Wajib: nama database
DB_NAME=dzikir_sholawat_hub

# Wajib: minimal 32 karakter; gunakan nilai acak yang kuat di production
JWT_SECRET=ganti-dengan-rahasia-minimal-32-karakter

# Wajib: super admin yang dibuat/diperbarui saat backend startup
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ganti-dengan-password-kuat

# Opsional: origin frontend yang boleh mengakses API, pisahkan dengan koma
ALLOWED_ORIGINS=http://localhost:3000

# Opsional: host HTTP yang diizinkan, pisahkan dengan koma
ALLOWED_HOSTS=localhost,127.0.0.1

# Opsional: isi true hanya untuk membuat data demo dan akun test pada development
# Default: false. Jangan aktifkan pada production.
SEED_DEMO_DATA=false
```

| Variabel | Wajib | Fungsi |
|---|---:|---|
| `MONGO_URL` | Ya | URI koneksi MongoDB / MongoDB Atlas. |
| `DB_NAME` | Ya | Nama database yang digunakan aplikasi. |
| `JWT_SECRET` | Ya | Kunci penandatangan token JWT; backend menolak nilai kurang dari 32 karakter. |
| `ADMIN_EMAIL` | Ya | Email super admin bootstrap. |
| `ADMIN_PASSWORD` | Ya | Password super admin bootstrap. |
| `ALLOWED_ORIGINS` | Tidak | Daftar origin CORS; default `http://localhost:3000`. |
| `ALLOWED_HOSTS` | Tidak | Daftar host untuk Trusted Host middleware; default `localhost,127.0.0.1`. |
| `SEED_DEMO_DATA` | Tidak | Aktifkan hanya dengan nilai `true` untuk menjalankan seed data demo dan akun test. Default `false`; production tidak menjalankan seed otomatis. |

### Frontend: `frontend/.env`

```dotenv
# URL dasar backend tanpa path /api di belakangnya
REACT_APP_BACKEND_URL=http://localhost:8000

# Opsional: timeout Axios dalam milidetik
REACT_APP_API_TIMEOUT=15000

# Opsional: endpoint API eksplisit; saat ini FileUpload memiliki fallback lokal
REACT_APP_API_URL=http://127.0.0.1:8000/api

# Opsional: aktifkan endpoint pemeriksaan kesehatan pada dev server
ENABLE_HEALTH_CHECK=false
```

> Variabel frontend dengan awalan `REACT_APP_` dibundel ke aplikasi browser. Jangan menyimpan secret, password, atau connection string database di sana.

## Struktur database MongoDB

MongoDB bersifat schema-flexible, tetapi aplikasi menggunakan koleksi berikut.

| Koleksi | Tanggung jawab | Field penting |
|---|---|---|
| `users` | Akun panel admin | `username`, `email`, `password_hash`, `name`, `role`, `status`, `cabang_id`, `created_at` |
| `cabang` | Data cabang | `id_cabang`, `kota`, `alamat`, `ketua`, `no_hp`, `lat`, `lng`, `created_at`, `updated_at` |
| `guru` | Guru/pembimbing | `id_guru`, `nama`, `no_hp`, `alamat`, `cabang_ids`, `foto`, `sk`, data ijazah, timestamp |
| `jamaah` | Data anggota | `id_jamaah`, `nama`, `nik`, `gender`, data kelahiran, `cabang_id`, `guru_id`, foto, data ijazah, timestamp |
| `pengurus` | Pengurus yayasan/majelis | `id_pengurus`, `jamaah_id`, `nama`, `jabatan`, `cabang_id`, kontak, timestamp |
| `agenda` | Agenda kegiatan | `judul`, `tanggal`, `waktu`, `lokasi`, `deskripsi`, `target`, `cabang_id`, timestamp |
| `galeri` | Galeri publik | `judul`, `kategori`, `type`, `url`, `published`, timestamp |
| `pengumuman` | Pengumuman publik | `judul`, `isi`, `kategori`, timestamp |
| `messages` | Pesan dari formulir kontak | `nama`, `whatsapp`, `pesan`, `read`, `created_at` |
| `settings` | Konfigurasi identitas yayasan | `key: "yayasan"`, nama, alamat, kontak, sosial media, notifikasi |
| `audit_logs` | Jejak aktivitas admin | `user_id`, `username`, `action`, `entity`, `details`, `timestamp` |

### Relasi konseptual

```text
cabang 1 --- n jamaah
cabang n --- n guru       (melalui guru.cabang_ids)
guru   1 --- n jamaah     (melalui jamaah.guru_id)
cabang 1 --- n pengurus
cabang 1 --- n agenda
users.cabang_id           (asosiasi untuk role admin cabang)
```

Backend membuat indeks berikut saat startup:

- `users.email` unik
- `guru.id_guru` unik dan `guru.cabang_ids`
- `jamaah.id_jamaah` unik, `jamaah.cabang_id`, `jamaah.guru_id`
- `cabang.kota`

## Hak akses setiap role

| Role | Hak akses aplikasi |
|---|---|
| `super_admin` | Akses penuh: seluruh data, manajemen user, pengaturan, backup, restore, serta operasi tulis. |
| `admin_cabang` | Dapat login dan menggunakan operasi baca/tulis yang diizinkan endpoint. Sidebar menyembunyikan menu khusus super admin. Saat ini pembatasan data per cabang belum diterapkan secara penuh di layer backend. |
| `viewer` | Hanya baca data yang memerlukan autentikasi; endpoint tulis ditolak. Sidebar menyembunyikan tindakan tambah/edit/hapus pada halaman CRUD. |
| Pengunjung publik | Hanya mengakses endpoint publik: informasi, statistik, cabang, agenda, galeri, pengumuman, pengaturan publik, dan formulir kontak. |

Catatan implementasi: frontend menyembunyikan beberapa menu berdasarkan role, tetapi backend adalah sumber otorisasi yang sebenarnya. Endpoint user management, backup, dan restore memerlukan `super_admin`; operasi CRUD umum menolak `viewer`.

## Deployment

Repository ini belum menyediakan Dockerfile, `docker-compose.yml`, atau konfigurasi hosting khusus. Berikut pola deployment yang sesuai dengan arsitektur saat ini.

### Backend

1. Sediakan MongoDB terkelola (misalnya MongoDB Atlas) atau MongoDB private yang terlindungi jaringan.
2. Deploy folder `backend` pada layanan Python/ASGI.
3. Install `requirements.txt`.
4. Buat environment variable produksi.
5. Jalankan worker menggunakan proses manager/command hosting, misalnya:

   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```

6. Atur `ALLOWED_ORIGINS` ke domain frontend sebenarnya, misalnya `https://portal.example.org`.
7. Atur `ALLOWED_HOSTS` ke domain API sebenarnya, misalnya `api.example.org`.
8. Sediakan volume persisten untuk `backend/uploads`, karena folder tersebut menyimpan gambar hasil upload.

Untuk produksi, jalankan tanpa `--reload`, gunakan HTTPS melalui reverse proxy atau platform hosting, dan gunakan `JWT_SECRET`/password admin yang kuat serta unik.

### Frontend

1. Isi `REACT_APP_BACKEND_URL` dengan URL HTTPS backend, misalnya `https://api.example.org`.
2. Buat bundle produksi:

   ```bash
   cd frontend
   npm ci
   npm run build
   ```

3. Deploy isi folder `frontend/build` ke static hosting, CDN, atau web server.
4. Konfigurasikan fallback SPA: semua rute non-file harus mengembalikan `index.html`, agar URL seperti `/admin/dashboard` dapat dibuka langsung.

### Checklist production

- Gunakan HTTPS untuk frontend dan backend.
- Jangan gunakan kredensial seed/test pada production.
- Batasi `ALLOWED_ORIGINS` dan `ALLOWED_HOSTS` ke domain nyata.
- Gunakan MongoDB user dengan hak akses minimum.
- Backup database dan folder upload secara berkala.
- Pastikan folder `uploads` menggunakan persistent volume atau object storage.
- Pastikan deployment memiliki proses monitoring, logging, dan rotasi secret.

## Backup dan restore

### Melalui panel admin

1. Login sebagai `super_admin`.
2. Buka **Pengaturan Sistem**.
3. Gunakan **Backup** untuk mengunduh JSON koleksi aplikasi.
4. Gunakan **Restore** untuk mengunggah JSON backup.

Endpoint terkait:

```text
GET  /api/backup
POST /api/restore
```

Backup mencakup `cabang`, `guru`, `jamaah`, `pengurus`, `agenda`, `galeri`, `pengumuman`, `settings`, dan `messages`.

> Restore mengganti isi koleksi yang terdapat dalam file backup. Lakukan backup baru sebelum restore dan uji proses pada database non-production terlebih dahulu.

### Hal penting tentang gambar upload

Backup API adalah backup data MongoDB, bukan backup file fisik pada `backend/uploads`. Saat melakukan backup lengkap, salin juga folder ini ke penyimpanan aman. Ketika restore dilakukan pada server baru, pulihkan folder `uploads` beserta database agar URL gambar tetap valid.

## Fitur yang sudah ada

### Situs publik

- Beranda dengan statistik, pengumuman, dan agenda.
- Profil yayasan serta pendiri/penerus majelis.
- Daftar cabang dengan peta OpenStreetMap/Leaflet.
- Galeri yang dapat difilter berdasarkan kategori dan ditampilkan pada lightbox.
- Informasi kontak dan formulir pesan.
- Footer dengan informasi yayasan yang diambil dari pengaturan sistem.

### Panel admin

- Login JWT dan pemulihan sesi pengguna.
- Role `super_admin`, `admin_cabang`, dan `viewer`.
- Dashboard statistik, grafik, dan agenda mendatang.
- CRUD cabang, guru, jamaah, pengurus, agenda, galeri, dan pengumuman melalui API.
- Manajemen pengguna oleh super admin.
- Upload gambar dengan validasi ukuran dan konversi WebP di backend.
- Pemilihan koordinat cabang melalui peta.
- Pencarian, filter, pengurutan, pagination, dan bulk delete pada tabel.
- Export data ke XLSX dan PDF.
- Pesan masuk dari situs publik.
- Audit log aktivitas.
- Pengaturan identitas yayasan dan profil admin.
- Backup dan restore data oleh super admin.

## Testing

### Backend

Test backend memakai `pytest` dan `pytest-xdist`:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
```

File [backend/tests/backend_test.py](backend/tests/backend_test.py) adalah integration test dan secara implementasi saat ini dapat menggunakan URL backend dari `REACT_APP_BACKEND_URL`. Siapkan environment testing yang terpisah dan jangan arahkan test yang memodifikasi data ke database production.

### Frontend

```powershell
cd frontend
npm test
```

## Perintah ringkas

```powershell
# Backend
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn server:app --host 0.0.0.0 --port 8000 --reload

# Frontend (terminal lain)
cd frontend
npm start

# Build frontend
cd frontend
npm run build
```
