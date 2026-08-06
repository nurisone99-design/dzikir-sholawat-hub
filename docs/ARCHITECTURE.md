# Arsitektur Sistem

Dokumen ini menjelaskan arsitektur aktual proyek **Dzikir Sholawat Hub** bagi developer. Sistem terdiri dari frontend React Single-Page Application (SPA), backend FastAPI berbasis REST, MongoDB sebagai penyimpanan data utama, dan filesystem lokal untuk file upload.

## Daftar isi

1. [Gambaran umum](#1-gambaran-umum-arsitektur-sistem)
2. [Frontend](#2-arsitektur-frontend)
3. [Backend](#3-arsitektur-backend)
4. [Alur data](#4-alur-data-browser-hingga-database)
5. [Autentikasi JWT](#5-alur-autentikasi-jwt)
6. [Otorisasi](#6-alur-otorisasi-berdasarkan-role)
7. [Tanggung jawab folder](#7-tanggung-jawab-setiap-folder)
8. [Komponen React](#8-struktur-komponen-react)
9. [State management](#9-state-management)
10. [Struktur API](#10-struktur-api)
11. [Struktur database](#11-struktur-database)
12. [Upload file](#12-alur-upload-file)
13. [Export](#13-alur-export-pdf-dan-excel)
14. [Backup dan restore](#14-alur-backup-dan-restore)
15. [Error handling](#15-error-handling)
16. [Logging](#16-logging)
17. [Security model](#17-security-model)
18. [Rekomendasi jangka panjang](#18-rekomendasi-arsitektur-jangka-panjang)

---

## 1. Gambaran umum arsitektur sistem

```text
                                    +------------------+
                                    |    MongoDB       |
                                    | collections/data |
                                    +---------^--------+
                                              |
                                              | Motor async driver
                                              |
+----------------+   HTTPS/HTTP    +----------+---------+     filesystem
| Browser        | <--------------> | FastAPI API        | <----------------+
| React SPA      |    JSON / Blob   | /api, port 8000    |                  |
| port 3000 dev  |                  +----------+---------+                  |
+-------+--------+                             |                            |
        |                                      | serves                      |
        | React Router                         v                            |
        |                               +--------------+                    |
        +------------------------------ | /uploads/... | -------------------+
                                        | backend/     |
                                        | uploads/     |
                                        +--------------+
```

Sistem memiliki tiga bentuk penyimpanan:

```text
Data bisnis / metadata         -> MongoDB
File gambar hasil upload       -> backend/uploads/
Token akses aktif di browser   -> localStorage (rj_token)
```

Backend tidak dipisahkan ke beberapa microservice. Semua endpoint, helper keamanan, integrasi database, upload, dan export saat ini berada dalam `backend/server.py`. Frontend dan backend dikembangkan/dideploy sebagai aplikasi terpisah.

---

## 2. Arsitektur frontend

Frontend adalah React SPA berbasis Create React App yang dikustomisasi CRACO. Browser hanya memuat satu shell HTML, lalu React Router memilih halaman yang sesuai tanpa full-page reload.

```text
public/index.html
       |
       v
src/index.js
       |
       +-- QueryClientProvider
       +-- ErrorBoundary
       `-- App
             |
             +-- AuthProvider
             +-- BrowserRouter
             +-- Public routes
             `-- Admin routes (ProtectedRoute)
```

### Lapisan frontend

```text
+----------------------------------------------------+
| Page layer                                         |
| public/* dan admin/*                               |
+---------------------------+------------------------+
                            |
+---------------------------v------------------------+
| Feature/reusable component layer                   |
| CrudPage, DataTable, FileUpload, layouts, UI       |
+---------------------------+------------------------+
                            |
+---------------------------v------------------------+
| Application services                               |
| AuthContext, Axios client (lib/api.js), utilities  |
+---------------------------+------------------------+
                            |
+---------------------------v------------------------+
| HTTP API                                           |
| ${REACT_APP_BACKEND_URL}/api                       |
+----------------------------------------------------+
```

### Routing utama

```text
/                              PublicLayout > Home
/profil, /profil-yayasan       PublicLayout > Profil
/pendiri, /profil-majelis     PublicLayout > Pendiri
/cabang                        PublicLayout > Cabang
/galeri                        PublicLayout > Galeri
/kontak                        PublicLayout > Kontak

/admin/login                   Login (tanpa proteksi)
/admin/*                       ProtectedRoute > AdminLayout > halaman admin
/admin                         redirect ke /admin/dashboard
*                              NotFound
```

`App.js` memakai `React.lazy` dan `Suspense` untuk memuat halaman secara lazy. Komponen layout sendiri tidak dilazy-load, sehingga navigasi dan shell tetap tersedia.

---

## 3. Arsitektur backend

Backend adalah aplikasi FastAPI dengan satu aplikasi `app`, satu `APIRouter` berprefix `/api`, dan satu koneksi Motor ke MongoDB.

```text
server.py
  |
  +-- konfigurasi environment dan koneksi MongoDB
  +-- middleware keamanan / CORS / rate-limit
  +-- helper JWT, password, serialisasi, audit, gambar
  +-- Pydantic request models tertentu
  +-- route groups
  |     |- auth
  |     |- users
  |     |- generic CRUD
  |     |- guru (custom/enriched)
  |     |- public
  |     |- dashboard, audit, settings
  |     |- backup/restore, export, upload
  |     `- lifecycle startup/shutdown
  |
  +-- MongoDB (Motor)
  `-- StaticFiles: /uploads -> backend/uploads
```

### Startup backend

```text
Uvicorn memuat server:app
          |
          v
FastAPI startup event
          |
          +-- coba koneksi MongoDB (maks. 10 percobaan)
          +-- buat indeks penting
          +-- buat/update super admin dari environment
          `-- panggil seed_all(...)
```

`seed_all` bersifat idempotent untuk data awal: jika cabang sudah ada, seed tidak mengisi ulang data domain, tetapi tetap memastikan settings dan user uji tersedia. Perilaku ini harus diperhatikan saat deployment production.

### Middleware aktif

```text
Request
  |
  +-- TrustedHostMiddleware      validasi Host
  +-- SecurityHeadersMiddleware  menambah security headers pada response
  +-- CORSMiddleware             mengatur akses lintas origin
  +-- SlowAPIMiddleware          menerapkan rate limiting
  `-- FastAPI routing
```

FastAPI juga menyediakan `/docs` dan `/openapi.json` secara default ketika tidak dinonaktifkan oleh deployment.

---

## 4. Alur data browser hingga database

### Contoh baca data admin

```text
User membuka /admin/cabang
        |
        v
DataCabang -> CrudPage.useEffect(load)
        |
        v
api.get('/cabang')
        |
        +-- Axios menambahkan Authorization: Bearer <rj_token>
        v
GET /api/cabang
        |
        +-- get_current_user memvalidasi JWT dan user MongoDB
        v
db.cabang.find(...).to_list(...)
        |
        v
serialize(_id -> id)
        |
        v
JSON response -> Axios -> CrudPage state rows -> DataTable
```

### Contoh mutasi data

```text
Form admin
  |
  v
CrudPage.save()
  |
  +-- POST  /api/<entity>          (create)
  `-- PUT   /api/<entity>/<id>     (update)
          |
          v
get_current_user -> require_write
          |
          +-- insert_one/update_one pada MongoDB
          +-- tambah created_at/updated_at
          `-- log_action -> audit_logs
                  |
                  v
Respons JSON -> refresh list -> UI terbaru
```

### Data publik

```text
Public page -> GET /api/public/* -> MongoDB -> JSON -> React state -> tampilan
```

Endpoint publik tidak memerlukan token. Endpoint administrasi memakai dependency autentikasi.

---

## 5. Alur autentikasi JWT

### Login

```text
Login.js
  |
  v
AuthContext.login(email, password)
  |
  v
POST /api/auth/login
  { email, password }
  |
  +-- backend mencari users berdasarkan email atau username
  +-- bcrypt.verify password terhadap password_hash
  +-- cek status user == active
  +-- JWT HS256 dibuat:
  |     sub = Mongo ObjectId user
  |     role = role user
  |     exp = sekarang + 7 hari
  +-- simpan event LOGIN pada audit_logs
  v
{ token, user }
  |
  +-- localStorage['rj_token'] = token
  `-- AuthContext.setUser(user)
```

### Pemulihan sesi dan request berikutnya

```text
Aplikasi dimuat
  |
  +-- AuthProvider membaca localStorage.rj_token
  |      |
  |      +-- tidak ada -> user = false, ready = true
  |      `-- ada -> GET /api/auth/me
  |
  `-- ProtectedRoute menunggu ready
          |
          +-- user valid -> render AdminLayout
          `-- tidak valid -> Navigate /admin/login

Setiap request Axios
  |
  `-- request interceptor menambah Bearer token
```

### Token tidak valid/kedaluwarsa

```text
Backend mengembalikan 401
  |
  v
Axios response interceptor
  |
  +-- hapus localStorage.rj_token
  `-- jika URL berada di /admin, redirect ke /admin/login
```

Tidak ada refresh token. Sesi berakhir saat token tujuh hari kedaluwarsa, saat user nonaktif, atau saat token dihapus/invalid.

---

## 6. Alur otorisasi berdasarkan role

Role disimpan pada dokumen `users.role` dan disertakan dalam token. Implementasi backend tetap mengambil user terbaru dari MongoDB pada setiap request autentikasi, sehingga status user diperiksa dari database.

```text
Request admin dengan Bearer token
       |
       v
get_current_user()
       |
       +-- decode JWT
       +-- cari users._id = payload.sub
       +-- status harus active
       `-- hasil user terserialisasi
               |
               +-- endpoint read: umumnya cukup authenticated
               +-- require_write: viewer ditolak (403)
               `-- require_super: hanya super_admin (403 selain itu)
```

| Role | Implementasi frontend | Implementasi backend |
|---|---|---|
| `super_admin` | Melihat semua menu termasuk User Management dan Pengaturan. | Operasi super seperti create/update/delete user, backup, dan restore diizinkan. |
| `admin_cabang` | Melihat menu admin kecuali menu yang bertanda khusus super admin. | Dapat memakai endpoint umum yang mensyaratkan `require_write`. |
| `viewer` | Tidak melihat tindakan tulis pada `CrudPage`. | `require_write` menolak create/update/delete/bulk-delete dengan 403. |
| publik | Tidak memakai portal admin. | Hanya memakai endpoint `/api/public/*` dan submit kontak. |

### Catatan penting: scope cabang

```text
users.cabang_id ada sebagai atribut data
          |
          `-- belum dipakai secara konsisten sebagai filter query di backend
```

Dengan demikian, `admin_cabang` saat ini adalah role penulis non-super, bukan isolasi data per cabang yang ditegakkan penuh. Jika data harus dipisahkan antar cabang, semua query dan mutasi perlu menerima/menegakkan scope `cabang_id` di backend.

---

## 7. Tanggung jawab setiap folder

```text
repository/
|
+-- frontend/             aplikasi browser
|   +-- public/           aset yang disajikan langsung
|   +-- src/              source React
|   |   +-- components/   komponen reusable dan layout
|   |   +-- context/      state lintas komponen
|   |   +-- constants/    test ID stabil
|   |   +-- hooks/        custom hooks
|   |   +-- lib/          API client dan utilitas
|   |   `-- pages/        komponen per route
|   `-- plugins/          plugin dev server/webpack opsional
|
+-- backend/              aplikasi FastAPI
|   +-- server.py         API, middleware, database, service logic
|   +-- seed.py           data awal dan helper seed
|   +-- uploads/          file upload yang disajikan sebagai static files
|   +-- tests/            integration tests API
|   `-- migrate_*.py      script maintenance data
|
+-- docs/                 dokumentasi teknis developer
+-- memory/               dokumen kebutuhan/produk
+-- tests/                package test tingkat repository
+-- test_reports/         artefak hasil test sebelumnya
`-- .emergent/            metadata/runtime otomasi lingkungan Emergent
```

### Folder yang tidak seharusnya menjadi source of truth aplikasi

```text
node_modules/       dependency hasil instalasi
backend/__pycache__/ cache Python
frontend/build/     output build produksi (saat dibuat)
backend/uploads/    aset runtime; perlu backup/persistent storage
```

---

## 8. Struktur komponen React

```text
App
|
+-- AuthProvider
|   `-- BrowserRouter
|       |
|       +-- PublicLayout
|       |   +-- PublicNav
|       |   +-- Outlet: Home / Profil / Pendiri / Cabang / Galeri / Kontak
|       |   `-- PublicFooter
|       |
|       +-- Login
|       |
|       `-- ProtectedRoute
|           `-- AdminLayout
|               +-- Sidebar/NavLink menu admin
|               +-- Header/logout
|               `-- Outlet: Dashboard / data pages / settings / ...
|
`-- Toaster
```

### Komponen administratif reusable

```text
DataCabang, DataGuru, DataPengurus
                 |
                 v
              CrudPage
              /  |    \
             /   |     \
      DataTable  form   ExportDialog
                  |
                  +-- FileUpload
                  `-- MapPicker
```

`CrudPage` menerima konfigurasi seperti endpoint, daftar kolom, field form, key pencarian, filter, lookup, dan jenis entitas export. Karena itu beberapa halaman master data dapat dibangun tanpa menduplikasi implementasi CRUD.

### UI primitives

`frontend/src/components/ui` berisi wrapper UI yang reusable untuk Radix UI/shadcn: button, input, select, dialog, alert-dialog, table, tabs, toast, dan lain-lain. Komponen ini tidak menyimpan logika domain yayasan.

---

## 9. State management

```text
Global app state
  |
  +-- AuthContext
  |     user, ready, login(), logout(), isViewer, isSuper
  |
  `-- QueryClientProvider
        tersedia secara global, tetapi belum menjadi pola utama pengambilan data

Local page/component state
  |
  +-- useState: rows, loading, form, dialog state, filters
  +-- useEffect: initial fetch dan side effect
  `-- useCallback: reload function pada CrudPage

Persistent browser state
  `-- localStorage.rj_token
```

Sebagian besar halaman mengambil data langsung menggunakan Axios dalam `useEffect`, kemudian menyimpan hasilnya pada state lokal. TanStack React Query telah dipasang dan provider-nya aktif, tetapi query/mutation hooks belum dipakai secara konsisten.

Konsekuensinya:

```text
Setelah mutasi data
  |
  `-- halaman biasanya memanggil load() lagi secara manual
```

---

## 10. Struktur API

Semua endpoint API berada di bawah prefix `/api`. File upload tersedia di luar prefix API sebagai static files pada `/uploads`.

```text
/api
|
+-- /auth
|   +-- POST /login
|   +-- GET  /me
|   +-- PUT  /profile
|   `-- PUT  /password
|
+-- /users
|   +-- GET
|   +-- POST
|   +-- PUT    /{uid}
|   `-- DELETE /{uid}
|
+-- generic CRUD (authenticated)
|   +-- /cabang
|   +-- /jamaah
|   +-- /pengurus
|   +-- /agenda
|   +-- /galeri
|   `-- /pengumuman
|       GET, GET /{id}, POST, PUT /{id}, DELETE /{id}, POST /bulk-delete
|
+-- /guru                 custom CRUD dan enriched response
+-- /dashboard/stats
+-- /audit-logs
+-- /settings
+-- /backup
+-- /restore
+-- /export-options/cabang
+-- /export/{entity}
+-- /upload/{folder}
|
`-- /public
    +-- /stats
    +-- /cabang
    +-- /agenda
    +-- /pengumuman
    +-- /galeri
    +-- /settings
    `-- /contact

/uploads/{folder}/{filename}.webp   static file gambar
```

### Konvensi respons

```text
MongoDB document                 API response
----------------                 ------------
_id: ObjectId(...)        ->    id: "..."
password_hash             ->    dihapus oleh serialize()
```

Daftar biasanya mengembalikan array JSON, item detail mengembalikan objek JSON, dan mutasi mengembalikan item terbaru atau objek status `message`.

---

## 11. Struktur database

### Koleksi

```text
users
  |- username, email, password_hash, name
  |- role: super_admin | admin_cabang | viewer
  |- status: active | ...
  `- cabang_id (opsional)

cabang
  |- id_cabang, kota, alamat, ketua, no_hp
  `- lat, lng

guru
  |- id_guru, nama, no_hp, alamat
  |- cabang_ids: [cabang id]
  |- ijazah_kitab, ijazah_amaliah, ijazah_nama_dalam
  `- foto, sk

jamaah
  |- id_jamaah, nama, nik, gender, alamat
  |- tempat_lahir, tanggal_lahir, nama_ortu
  |- cabang_id, guru_id
  `- foto dan data ijazah

pengurus
  `- id_pengurus, jamaah_id, nama, jabatan, cabang_id, alamat, no_hp

agenda
  `- judul, tanggal, waktu, lokasi, deskripsi, target, cabang_id

galeri
  `- judul, kategori, type, url, published

pengumuman
  `- judul, isi, kategori

messages
  `- nama, whatsapp, pesan, read, created_at

settings
  `- key: "yayasan", identitas, kontak, sosial media, notifikasi

audit_logs
  `- user_id, username, action, entity, details, timestamp
```

### Relasi konseptual

```text
                       +----------+
                       | cabang   |
                       +----+-----+
                       /    |      \
                      /     |       \
               jamaah*   pengurus*  agenda*
                  |
                  | guru_id
                  v
               +-------+
               | guru  |
               +-------+
                  ^
                  |
         guru.cabang_ids (many-to-many konseptual)

users.cabang_id -> cabang (atribut scope, belum ditegakkan penuh)
```

Dokumen domain umumnya memakai `created_at` dan `updated_at` dalam format ISO UTC. MongoDB `_id` adalah identity internal; API mengeksposnya sebagai string `id`.

---

## 12. Alur upload file

```text
Admin memilih file
  |
  v
FileUpload
  |
  +-- validasi ukuran client <= 10 MB
  +-- bentuk FormData { file }
  v
POST /api/upload/{folder}
  Authorization: Bearer token
  multipart/form-data
  |
  +-- get_current_user
  +-- folder harus salah satu dari:
  |     guru, jamaah, pengurus, galeri, sk
  +-- content type harus image/*
  +-- ukuran server <= 10 MB
  +-- Pillow: buka gambar
  +-- resize maksimum 1200px dan kompres menjadi WebP
  +-- nama UUID.webp
  v
backend/uploads/{folder}/{uuid}.webp
  |
  v
{ "url": "/uploads/{folder}/{uuid}.webp" }
  |
  v
URL disimpan ke field dokumen domain pada request CRUD berikutnya
```

```text
Browser menampilkan gambar
  |
  `-- <backend URL> + /uploads/... -> FastAPI StaticFiles -> filesystem
```

Catatan: API upload hanya mendukung gambar pada implementasi backend. Walaupun form guru dapat menerima pilihan file PDF untuk SK, endpoint akan menolak tipe non-image.

---

## 13. Alur export PDF dan Excel

```text
Laporan atau CrudPage/ExportDialog
  |
  +-- pilih entity, format, filter cabang/gender, kolom
  v
GET /api/export/{entity}?format=xlsx|pdf&...
  Authorization: Bearer token
  |
  +-- validasi entity terhadap DEFAULT_COLUMNS
  +-- susun filter MongoDB
  +-- load cabang sebagai lookup map
  +-- load dokumen entity dan normalisasi row
  +-- tulis audit action EXPORT
  |
  +-- format=xlsx -> Pandas + OpenPyXL -> BytesIO
  `-- selain xlsx -> ReportLab -> BytesIO
          |
          v
StreamingResponse dengan Content-Disposition attachment
          |
          v
Axios responseType=blob -> URL.createObjectURL -> download browser
```

Export mendukung entitas `jamaah`, `cabang`, `guru`, `pengurus`, dan `agenda`. File XLSX memakai satu worksheet sesuai nama entitas. File PDF dibuat dalam landscape A4 dengan tabel dan identitas yayasan dari `settings` bila tersedia.

---

## 14. Alur backup dan restore

### Backup

```text
Super admin menekan Backup
  |
  v
GET /api/backup
  |
  +-- get_current_user
  +-- require_super
  +-- baca koleksi BACKUP_COLLECTIONS
  |     cabang, guru, jamaah, pengurus, agenda,
  |     galeri, pengumuman, settings, messages
  +-- serialize ObjectId -> id
  +-- audit log EXPORT/backup
  v
JSON response
  |
  v
Frontend membuat Blob JSON dan mengunduh file
```

### Restore

```text
Super admin memilih file JSON
  |
  +-- frontend membaca file.text()
  +-- JSON.parse()
  v
POST /api/restore
  |
  +-- get_current_user
  +-- require_super
  +-- untuk setiap koleksi yang ada di payload:
  |     delete_many({})
  |     buang id / _id dari rows
  |     insert_many(rows)
  +-- audit log UPDATE/restore
  v
{ message: "Database berhasil dipulihkan" }
```

```text
Perlu diingat:
backup JSON hanya mencakup data MongoDB.
backend/uploads tidak termasuk dan harus dibackup/direstore terpisah.
```

Restore bersifat replace untuk koleksi yang terdapat di payload; data koleksi tersebut dihapus sebelum data backup dimasukkan.

---

## 15. Error handling

```text
Backend error
  |
  +-- FastAPI HTTPException -> response JSON dengan detail dan HTTP status
  +-- authentication -> 401
  +-- authorization -> 403
  +-- not found -> 404
  +-- validasi upload/entity -> 400 atau 413
  `-- rate limit -> handler SlowAPI
          |
          v
Axios response interceptor / page catch
          |
          +-- apiError(...) memetakan timeout/network/response detail
          +-- Sonner toast menampilkan feedback lokal
          `-- 401 menghapus token dan mengarahkan admin ke login
```

### Batas error frontend

```text
Error render React tak tertangani
  |
  v
ErrorBoundary
  |
  `-- layar error + tombol Muat Ulang
```

Sebagian halaman menangkap error request sendiri, mencetak detail ke `console.error`, lalu mengosongkan state data atau menampilkan toast. Tidak ada error-reporting eksternal terintegrasi saat ini.

---

## 16. Logging

Terdapat dua jalur logging.

```text
Application log (stdout/logging Python)
  |
  +-- status origin yang diizinkan
  +-- koneksi MongoDB dan percobaan ulang
  +-- provisioning super admin
  `-- kegagalan koneksi

Audit log (MongoDB audit_logs)
  |
  +-- LOGIN
  +-- CREATE
  +-- UPDATE
  +-- DELETE
  `-- EXPORT
```

`log_action()` menyimpan user, jenis aksi, entitas, detail, dan timestamp. Beberapa kode juga memiliki `print`/`console.log` untuk diagnosis lokal, terutama pada alur guru/CRUD. Belum ada log aggregation, request correlation ID, atau alerting terpusat.

---

## 17. Security model

```text
                Browser
                   |
     localStorage rj_token (Bearer token)
                   |
                   v
        +------------------------+
        | FastAPI security layer |
        +------------------------+
          |       |        |
          |       |        +-- trusted host
          |       +----------- CORS origin allowlist
          +------------------- JWT + user status check
                   |
                   v
       role guard: require_write / require_super
                   |
                   v
                 MongoDB
```

### Kontrol yang ada

- Password tidak disimpan plaintext; hash memakai bcrypt.
- Token JWT memakai algoritme HS256, masa berlaku tujuh hari.
- Token tidak valid, user tidak ditemukan, atau user tidak aktif ditolak.
- Login dibatasi `5/minute` dengan SlowAPI.
- CORS dibatasi `ALLOWED_ORIGINS`.
- Host dibatasi `ALLOWED_HOSTS`.
- Respons mendapat header `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, dan CSP yang dikustomkan.
- File upload memeriksa folder, content type, dan batas ukuran; file dikonversi menjadi WebP dengan nama UUID.
- `password_hash` dihapus sebelum user dikirim ke client.
- Operasi mutasi penting dicatat pada audit log.

### Batas model saat ini

```text
JWT di localStorage
  -> praktis untuk SPA, tetapi perlu disiplin XSS yang kuat.

Tidak ada refresh token / token revocation list
  -> token berlaku hingga expiry kecuali user dinonaktifkan.

Role admin_cabang belum dipakai untuk filter query per cabang
  -> bukan boundary isolasi data penuh.

Generic CRUD menerima Dict[str, Any]
  -> validasi field domain belum seragam.
```

Security boundary utama harus selalu berada di backend. Penyembunyian menu frontend adalah pengalaman pengguna, bukan kontrol keamanan.

---

## 18. Rekomendasi arsitektur jangka panjang

Perubahan berikut bukan bagian dari implementasi saat ini, tetapi direkomendasikan agar sistem lebih mudah dikembangkan dan dioperasikan.

### 18.1 Pecah backend berdasarkan domain

```text
backend/
  app/
    main.py
    core/          # config, security, middleware, logging
    db/            # Mongo client, repository, indexes
    models/        # Pydantic request/response schemas
    services/      # business rules
    routers/       # auth, users, cabang, guru, export, ...
    storage/       # upload abstraction
    tests/
```

Manfaat: mengurangi ukuran `server.py`, memisahkan business logic dari HTTP layer, dan membuat unit test lebih mudah.

### 18.2 Terapkan schema dan repository data

```text
Router -> Service -> Repository -> MongoDB
          |
          `-- Pydantic request/response models
```

- Ganti payload generic `Dict[str, Any]` dengan model create/update per entitas.
- Definisikan response schema agar kontrak API stabil.
- Validasi ObjectId dan referensi cabang/guru secara konsisten.
- Tambahkan pagination/filter/sort dari server, bukan hanya DataTable di browser.

### 18.3 Tegakkan scope role di backend

```text
get_current_user
  |
  `-- build_access_scope(user)
          |
          +-- super_admin  -> tanpa filter cabang
          +-- admin_cabang -> { cabang_id: user.cabang_id }
          `-- viewer       -> read-only dengan scope yang eksplisit
```

Semua query list/detail/update/delete harus memakai scope tersebut agar `admin_cabang` tidak dapat membaca atau mengubah data cabang lain.

### 18.4 Standardisasi frontend data layer

```text
Page -> useQuery/useMutation -> API client -> backend
                    |
                    `-- invalidateQueries setelah mutasi
```

- Gunakan TanStack React Query secara konsisten.
- Tempatkan key query dan API service per domain, misalnya `features/cabang/api.js`.
- Pisahkan page component, feature component, form schema, dan API call.
- Gunakan React Hook Form + Zod secara konsisten untuk validasi frontend.

### 18.5 Storage dan background work

```text
Upload API -> storage abstraction -> object storage (S3-compatible)
                                         |
                                         +-- lifecycle cleanup
                                         `-- backup terkelola

Export berat -> job queue -> worker -> file/object storage -> download URL
```

- Pindahkan file upload dari disk lokal ke object storage untuk deployment multi-instance.
- Simpan metadata upload dan lakukan cleanup file orphan.
- Untuk export besar, gunakan background worker/queue agar request API tidak terlalu lama.

### 18.6 Operasional, deployment, dan observability

```text
CI
  -> lint + unit/integration test + build frontend
  -> deploy backend + static frontend
  -> health checks + centralized logs + error tracking
```

- Tambahkan Dockerfile dan `docker-compose.yml` untuk development reproducible.
- Pisahkan seed development dari startup production melalui environment flag atau command CLI.
- Tambahkan health/readiness endpoint yang eksplisit.
- Gunakan structured logging, request ID, monitoring, dan error tracking.
- Simpan secret di secret manager; rotasi `JWT_SECRET` dan password bootstrap dengan prosedur terkontrol.
- Tambahkan backup MongoDB terjadwal serta backup object storage/uploads terverifikasi.

### 18.7 Keamanan lanjutan

- Evaluasi penggunaan access token singkat + refresh token aman (misalnya cookie `HttpOnly`) sesuai kebutuhan deployment.
- Terapkan rate limit terpisah untuk kontak dan upload.
- Validasi konten file berdasarkan magic bytes dan batasi dimensi/decompression bomb.
- Tinjau CSP untuk domain production, CDN, tile map, dan backend yang sebenarnya.
- Audit authorization dengan test matrix per endpoint dan per role.

---

## Referensi file penting

```text
frontend/src/index.js              bootstrap React
frontend/src/App.js                routing dan ProtectedRoute
frontend/src/context/AuthContext.js autentikasi frontend
frontend/src/lib/api.js            Axios dan interceptors
frontend/src/components/admin/CrudPage.js generic CRUD UI
backend/server.py                  FastAPI, API, auth, DB, export, upload
backend/seed.py                    data awal
backend/tests/backend_test.py      integration tests API
```
