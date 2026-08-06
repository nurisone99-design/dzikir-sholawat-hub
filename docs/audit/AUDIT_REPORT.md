# Audit Report — Dzikir Sholawat Hub

**Jenis audit:** static code review / read-only

**Ruang lingkup:** frontend React, backend FastAPI, konfigurasi repository, script seed, dan test yang tersedia.

**Tidak termasuk:** penetration test aktif, dependency vulnerability scan, review infrastruktur/cloud runtime, maupun pengujian terhadap database production. Temuan di bawah adalah berdasarkan implementasi yang ada pada repository.

## Ringkasan eksekutif

Proyek memiliki fondasi yang baik untuk aplikasi internal skala kecil: autentikasi JWT, hash bcrypt, CORS allowlist, audit log, role dasar, middleware keamanan, dan API test sudah tersedia. Namun aplikasi belum siap dijalankan sebagai sistem yang menangani PII secara aman tanpa perbaikan prioritas tinggi.

Risiko terbesar adalah kebocoran rahasia konfigurasi melalui endpoint publik, kredensial seed tetap yang otomatis diprovisioning, serta pembatasan hak akses `admin_cabang` yang belum benar-benar mengisolasi data per cabang. Selain itu, desain backend monolitik, payload CRUD generik, pemuatan data tanpa pagination, dan belum adanya deployment automation akan menyulitkan pertumbuhan jangka panjang.

| Prioritas | Jumlah temuan |
|---|---:|
| Critical | 2 |
| High | 8 |
| Medium | 15 |
| Low | 9 |

## Peta temuan prioritas

```text
Critical
  C-01  wa_api_key disajikan oleh endpoint publik
  C-02  akun seed berkredensial tetap diprovisioning saat startup

High
  H-01  admin_cabang tidak dibatasi ke cabang sendiri
  H-02  daftar user dapat dibaca semua user terautentikasi
  H-03  settings dapat diubah role penulis non-super dan memuat secret
  H-04  restore destruktif tanpa validasi/rollback
  H-05  PII dapat dibaca/diekspor tanpa scope minimum
  H-06  payload CRUD generik membuka mass assignment/data invalid
  H-07  password bootstrap dipaksa mengikuti environment tiap startup
  H-08  tidak ada keamanan deployment/persistent storage yang terdefinisi
```

## Keterangan prioritas

- **Critical** — kebocoran rahasia atau kompromi sistem/data yang sangat mungkin dan perlu ditangani sebelum production.
- **High** — akses tidak semestinya, kehilangan data, atau dampak bisnis/privasi besar.
- **Medium** — risiko nyata terhadap keandalan, keamanan, atau kemampuan tumbuh; perlu direncanakan dalam siklus dekat.
- **Low** — penguatan kualitas, konsistensi, atau hygiene teknis.

---

## 1. Security

### C-01 — `wa_api_key` berpotensi bocor ke publik

- **Prioritas:** Critical
- **Masalah:** `GET /api/public/settings` mengembalikan seluruh dokumen `settings` melalui `serialize()` tanpa allowlist field. Dokumen tersebut dapat memuat `wa_api_key`, yang diinput dari halaman admin Pengaturan. Endpoint publik dapat diakses tanpa autentikasi.
- **Dampak:** API key WhatsApp atau secret lain yang kelak ditambahkan ke `settings` dapat diekspos ke internet. Penyerang dapat menyalahgunakan provider pihak ketiga atau mengakses layanan yang menggunakan key tersebut.
- **Rekomendasi:** Pisahkan koleksi/struktur `public_settings` dari secret operasional. Buat response model/allowlist eksplisit untuk endpoint publik, misalnya hanya nama, alamat, telepon, sosial media, dan URL publik. Jangan pernah menyimpan secret pada dokumen yang dibaca endpoint publik.
- **Referensi:** `backend/server.py` — `public_settings()`, `get_settings()`, `update_settings()`; `frontend/src/pages/admin/Pengaturan.js`.

### C-02 — Kredensial seed tetap ada di repository dan dibuat otomatis

- **Prioritas:** Critical
- **Masalah:** `backend/seed.py` menyimpan password akun seed secara hard-coded. `server.py` memanggil `seed_all()` pada setiap startup; bahkan ketika data cabang sudah ada, script masih memastikan akun uji tersedia.
- **Dampak:** Bila password tersebut digunakan pada environment yang dapat diakses, penyerang dapat login menggunakan kredensial yang diketahui. Password juga sudah menjadi bagian riwayat source control dan test memakai nilai sama.
- **Rekomendasi:** Hapus kredensial tetap dari source code dan jangan membuat akun test di production. Jadikan seed sebagai command development eksplisit yang membutuhkan `APP_ENV=development` atau `SEED_DEMO_DATA=true`. Rotasi akun yang mungkin sudah terbuat dan pindahkan kredensial test ke secret test environment.
- **Referensi:** `backend/seed.py` — `_seed_test_users()` dan `seed_all()`; `backend/server.py` — startup; `backend/tests/backend_test.py`.

### M-01 — Rate limiting hanya melindungi login

- **Prioritas:** Medium
- **Masalah:** Hanya endpoint login diberi decorator `@limiter.limit("5/minute")`. Endpoint publik kontak dan endpoint upload tidak memiliki limit khusus.
- **Dampak:** Form kontak dapat menjadi sasaran spam/penumpukan database. Upload dapat digunakan untuk menghabiskan CPU, I/O, dan kapasitas penyimpanan oleh akun yang disalahgunakan.
- **Rekomendasi:** Terapkan rate limit per IP/user untuk `/public/contact`, `/upload/*`, export, dan restore. Tambahkan quota per user/role serta observability atas limit yang terpicu.

### M-02 — Validasi upload hanya mengandalkan MIME header sebelum Pillow membuka file

- **Prioritas:** Medium
- **Masalah:** Backend memeriksa `file.content_type.startswith("image/")`, lalu langsung membuka bytes dengan Pillow. MIME header dikendalikan client dan file gambar yang rusak atau dekompresi besar dapat menghasilkan exception/resource pressure.
- **Dampak:** Penggunaan CPU/memori berlebih atau error 500 saat memproses file tidak valid/berbahaya.
- **Rekomendasi:** Tangkap exception Pillow dan kembalikan 400 yang aman. Batasi pixel count (`Image.MAX_IMAGE_PIXELS`), verifikasi/decode image, validasi format hasil, dan pertimbangkan antivirus/content scanning sesuai kebutuhan.

### M-03 — Token JWT disimpan di `localStorage`

- **Prioritas:** Medium
- **Masalah:** Access token dibaca/ditulis dari `localStorage` dan berlaku tujuh hari.
- **Dampak:** Jika ada XSS, token dapat diekstrak dan dipakai dari perangkat lain sampai masa berlaku habis.
- **Rekomendasi:** Perkuat XSS prevention/CSP; evaluasi access token berumur pendek dengan refresh token di cookie `HttpOnly`, `Secure`, dan `SameSite` sesuai domain deployment. Tambahkan mekanisme revocation/session version bila kebutuhan keamanan meningkat.
- **Referensi:** `frontend/src/context/AuthContext.js`, `frontend/src/lib/api.js`, `backend/server.py` — `create_access_token()`.

### L-01 — CSP production tidak berbasis konfigurasi deployment

- **Prioritas:** Low
- **Masalah:** CSP `connect-src` berisi `http://localhost:8000` secara hard-coded, sementara aplikasi memakai peta dan gambar eksternal pada frontend.
- **Dampak:** Kebijakan dapat tidak sesuai dengan domain production atau memberi rasa aman yang keliru karena response API bukan selalu dokumen frontend yang mengeksekusi script.
- **Rekomendasi:** Definisikan CSP pada host yang menyajikan frontend dan bangun dari environment per deployment. Dokumentasikan domain API, CDN, tile map, font, dan image yang memang diperlukan.

---

## 2. Authentication

### H-07 — Password super admin dapat direset pada setiap startup

- **Prioritas:** High
- **Masalah:** Startup backend membandingkan password super admin dengan `ADMIN_PASSWORD`; jika berbeda, password hash akun tersebut diubah agar sama dengan environment variable.
- **Dampak:** Perubahan password melalui UI dapat ditimpa saat restart. Kebocoran/rotasi environment yang tidak dikelola dapat mengubah password admin tanpa audit yang jelas. Perilaku ini berisiko untuk operasi production.
- **Rekomendasi:** Bootstrap super admin hanya bila user belum ada. Pisahkan reset password menjadi command administratif eksplisit dengan audit event kuat dan persetujuan operasional.
- **Referensi:** `backend/server.py` — startup event.

### M-04 — Tidak ada kebijakan password pada backend

- **Prioritas:** Medium
- **Masalah:** Model `UserCreate`, `UserUpdate`, dan `PasswordChange` tidak menerapkan panjang minimum, kompleksitas, password breach screening, atau riwayat password.
- **Dampak:** Super admin dapat membuat akun berpassword sangat lemah; risiko credential stuffing dan brute force meningkat.
- **Rekomendasi:** Validasi minimal panjang dan karakter pada backend, jangan hanya frontend. Tambahkan optional breach-password checking dan pemaksaan reset password saat akun pertama dibuat jika relevan.

### M-05 — Tidak ada refresh token, logout server-side, atau session revocation

- **Prioritas:** Medium
- **Masalah:** Logout hanya menghapus token di browser. JWT akses tidak memiliki identifier/session version dan tetap valid sampai expiry selama akun masih active.
- **Dampak:** Token yang dicuri tetap dapat digunakan hingga tujuh hari; logout tidak membatalkan token yang sudah dieksfiltrasi.
- **Rekomendasi:** Pertimbangkan refresh-token rotation, access token singkat, session table atau `token_version` pada user untuk revoke semua sesi/pilih sesi tertentu.

### L-02 — Tidak ada observability untuk percobaan login gagal

- **Prioritas:** Low
- **Masalah:** Login gagal mengembalikan 401, tetapi tidak tampak pencatatan audit/metric untuk kegagalan autentikasi.
- **Dampak:** Deteksi credential stuffing/brute force menjadi lebih lambat.
- **Rekomendasi:** Catat event login gagal secara aman (tanpa password), IP hashed/terbatas, user identifier, dan rate-limit event ke monitoring.

---

## 3. Authorization

### H-01 — `admin_cabang` belum memiliki data scope cabang yang dipaksakan

- **Prioritas:** High
- **Masalah:** User memiliki atribut opsional `cabang_id`, tetapi helper `require_write()` hanya menolak role `viewer`. Query CRUD, dashboard, messages, export, dan guru tidak memfilter berdasarkan cabang user.
- **Dampak:** Admin cabang dapat membaca dan menulis data cabang lain, termasuk data pribadi jamaah. Ini melanggar prinsip least privilege dan berpotensi menjadi pelanggaran privasi.
- **Rekomendasi:** Bangun `access_scope(user)` di backend. Terapkan filter `cabang_id` pada seluruh list/detail/mutation/export/dashboard. Super admin saja yang tanpa scope. Tambahkan test negatif untuk setiap endpoint dan role.
- **Referensi:** `backend/server.py` — `require_write()`, `make_crud()`, `dashboard_stats()`, `export_data()`.

### H-02 — Daftar seluruh user dapat dibaca oleh setiap user terautentikasi

- **Prioritas:** High
- **Masalah:** `GET /api/users` hanya memakai `get_current_user()`; tidak memakai `require_super()`.
- **Dampak:** Viewer dan admin cabang dapat memperoleh username, email, nama, role, status, dan asosiasi cabang semua akun. Ini memperluas data disclosure dan membantu social engineering.
- **Rekomendasi:** Terapkan `require_super(user)` untuk endpoint list user. Tambahkan response model minimal dan test RBAC untuk viewer/admin cabang.
- **Referensi:** `backend/server.py` — `list_users()`.

### H-03 — Settings dapat diubah oleh admin cabang dan digunakan untuk menyimpan secret

- **Prioritas:** High
- **Masalah:** `PUT /api/settings` hanya memakai `require_write`, sehingga `admin_cabang` dapat mengubah identitas global, konfigurasi notifikasi, dan `wa_api_key`.
- **Dampak:** Pengguna non-super dapat merusak konfigurasi organisasi atau mengganti/menghapus secret global. Dikombinasikan dengan C-01, secret tersebut kemudian dapat bocor ke publik.
- **Rekomendasi:** Jadikan perubahan settings global sebagai aksi `super_admin` saja. Pisahkan settings global, settings cabang, dan secret. Audit field change secara terstruktur tanpa menulis secret ke log.

### H-05 — Data PII dapat dibaca dan diekspor tanpa pemisahan kebutuhan akses

- **Prioritas:** High
- **Masalah:** Daftar/detail jamaah, messages, dashboard, dan export hanya mensyaratkan user terautentikasi; `viewer` dapat membaca data yang mengandung NIK, alamat, tanggal lahir, nomor telepon, dan pesan kontak. Export juga tidak dibatasi pada role atau scope cabang.
- **Dampak:** PII dapat disalin massal oleh role yang seharusnya hanya observer atau cabang lain.
- **Rekomendasi:** Klasifikasikan PII dan buat permission per aksi (`member:read`, `member:export`, `message:read`). Masking field sensitif untuk viewer, filter berdasarkan scope cabang, dan batasi export PII ke role yang benar-benar berwenang.

### M-06 — Audit log dapat dibaca semua user terautentikasi

- **Prioritas:** Medium
- **Masalah:** `GET /api/audit-logs` tidak memerlukan role super admin.
- **Dampak:** Detail aktivitas, username, dan operasi administratif dapat terlihat oleh role yang tidak perlu mengetahuinya.
- **Rekomendasi:** Batasi audit log pada super admin/auditor role. Tambahkan filtering/pagination dan redaksi detail sensitif.

### M-07 — Tombol broadcast WhatsApp tersedia tanpa guard `canWrite`

- **Prioritas:** Medium
- **Masalah:** Pada halaman Agenda, penambahan/edit/hapus memakai `canWrite`, tetapi aksi "Kirim Broadcast WhatsApp" ditampilkan untuk semua role login dan memakai daftar jamaah yang dapat dibaca user.
- **Dampak:** Viewer dapat membuka banyak link `wa.me` ke nomor jamaah. Ini bukan broadcast API otomatis, namun tetap merupakan aksi eksternal dan peningkatan risiko penyalahgunaan kontak.
- **Rekomendasi:** Terapkan permission khusus untuk aksi broadcast di frontend dan backend bila kelak broadcast dipindahkan ke API. Jangan gunakan NIK sebagai fallback nomor telepon.

---

## 4. API Design

### H-06 — Generic CRUD menerima payload bebas (`Dict[str, Any]`)

- **Prioritas:** High
- **Masalah:** Sebagian besar create/update generic dan endpoints guru/settings menerima dictionary bebas, bukan model Pydantic per entitas. Hanya `id`/`_id` tertentu yang dibuang.
- **Dampak:** Mass assignment, field tak diharapkan, inkonsistensi tipe, dan dokumen MongoDB tidak konsisten dapat terjadi. Kontrak API sulit didokumentasikan dan berubah tanpa kontrol.
- **Rekomendasi:** Buat schema `Create`/`Update`/`Response` per resource. Gunakan `extra="forbid"` bila sesuai, whitelist field update, validasi enum/tanggal/foreign key, dan hasilkan OpenAPI yang akurat.
- **Referensi:** `backend/server.py` — `make_crud()`, `create_guru()`, `update_guru()`, `update_settings()`, `restore()`.

### M-08 — List endpoint tidak memiliki pagination/filter server-side

- **Prioritas:** Medium
- **Masalah:** Endpoint list melakukan `to_list(1000)` atau `to_list(5000)` dan DataTable memfilter/memaginasi di browser.
- **Dampak:** Transfer data besar, penggunaan memori backend/browser, respon lambat, dan potensi disclosure data berlebihan.
- **Rekomendasi:** Tambahkan query `page`, `page_size`, `search`, `sort`, dan filter terverifikasi di backend; kembalikan `{items, total, page, page_size}`. Indeks harus mengikuti query yang sering dipakai.

### M-09 — Format export tidak divalidasi secara eksplisit

- **Prioritas:** Medium
- **Masalah:** Bila `format` bukan `xlsx`, endpoint mengambil jalur pembentukan PDF.
- **Dampak:** Kontrak API ambigu dan input typo menghasilkan output yang tidak diharapkan.
- **Rekomendasi:** Gunakan enum/query validation untuk hanya menerima `xlsx` dan `pdf`; return 422/400 untuk nilai lain.

### M-10 — Error ObjectId invalid dapat berubah menjadi 500

- **Prioritas:** Medium
- **Masalah:** Banyak endpoint langsung menjalankan `ObjectId(item_id)` atau membuat daftar `ObjectId(i)` tanpa lebih dahulu memeriksa `ObjectId.is_valid()`.
- **Dampak:** URL/payload ID tidak valid dapat menghasilkan error server internal alih-alih 400/404 yang konsisten; log noise meningkat.
- **Rekomendasi:** Buat dependency/helper parser ObjectId tunggal yang mengembalikan HTTP 400 bila invalid, lalu gunakan pada semua route dan bulk operation.

### M-11 — Endpoint tidak memiliki versioning atau response contract yang konsisten

- **Prioritas:** Medium
- **Masalah:** API berada pada `/api` tanpa versi; sebagian respons berupa item, array, atau `{message}`; sebagian memakai schema dan sebagian generic dict.
- **Dampak:** Perubahan API berisiko merusak frontend/consumer masa depan dan sulit dikelola jika ada integrasi eksternal.
- **Rekomendasi:** Introduksi `/api/v1`, response schema, envelope/pagination convention, serta OpenAPI review sebagai kontrak CI.

### L-03 — `POST /restore` menerima dokumen mentah tanpa batas payload eksplisit

- **Prioritas:** Low
- **Masalah:** Tidak ada schema dan batas ukuran aplikasi pada body restore.
- **Dampak:** Kegagalan parsing/memori untuk file JSON sangat besar dan pesan error yang tidak spesifik.
- **Rekomendasi:** Tambahkan schema backup berversi, batas ukuran request pada proxy dan aplikasi, serta validasi collection/row sebelum mutasi database.

---

## 5. Database Design

### H-04 — Restore menghapus data sebelum payload tervalidasi dan tanpa rollback

- **Prioritas:** High
- **Masalah:** Restore melakukan `delete_many({})` per koleksi lalu memasukkan row payload. Tidak ada validasi penuh sebelum penghapusan, snapshot, transaction, atau rollback.
- **Dampak:** File backup salah/terpotong dapat menyebabkan kehilangan data permanen atau database berada pada keadaan parsial.
- **Rekomendasi:** Validasi seluruh backup terhadap schema dan version sebelum perubahan. Buat snapshot database; restore ke database/staging collection baru lalu promote atomically bila memungkinkan. Tambahkan confirmation token dan job audit yang memuat backup ID/checksum.

### M-12 — Referensial data tidak dijaga

- **Prioritas:** Medium
- **Masalah:** MongoDB menyimpan relasi melalui string ID (`cabang_id`, `guru_id`, `jamaah_id`) tanpa validasi atau strategi cascade/restrict. Delete cabang/guru tidak memeriksa dokumen yang merujuknya.
- **Dampak:** Orphan reference membuat UI/export menampilkan data kosong atau salah; integritas data menurun saat delete/restore.
- **Rekomendasi:** Validasi referensi di service layer. Pilih kebijakan `restrict`, cascade terkendali, atau soft delete. Tambahkan maintenance job untuk mendeteksi orphan.

### M-13 — Pembuatan ID bisnis rentan race condition dan constraint tidak lengkap

- **Prioritas:** Medium
- **Masalah:** Frontend membuat beberapa `id_*` dari `rows.length + 1`; generic CRUD jamaah mencari ID terakhir lalu menambah nomor. Hanya beberapa indeks unik dibuat saat startup.
- **Dampak:** Request paralel atau data yang dihapus dapat menghasilkan ID duplikat/urutan tidak valid. `id_cabang` dan `id_pengurus` tidak tampak memiliki unique index backend.
- **Rekomendasi:** Gunakan counter collection dengan atomic `$inc`, UUID, atau sequence service. Tambahkan unique indexes pada semua ID bisnis yang harus unik dan tangani duplicate-key error sebagai 409.

### M-14 — Tidak ada data migration/versioning database

- **Prioritas:** Medium
- **Masalah:** Schema berkembang secara implicit melalui code/seed; hanya ada script migrasi base64 yang berdiri sendiri.
- **Dampak:** Deployment lintas versi sulit diprediksi dan rollback data hampir tidak terkontrol.
- **Rekomendasi:** Simpan schema version, bangun migration runner idempotent dengan log, dan pisahkan data demo dari migrasi produksi.

### L-04 — Indeks belum mengikuti seluruh query operasional

- **Prioritas:** Low
- **Masalah:** Ada indeks dasar untuk beberapa ID/relasi, tetapi query umum juga menyortir `created_at`, `timestamp`, `tanggal`, memfilter `published`, dan mencari cabang/gender saat export.
- **Dampak:** Koleksi besar dapat mengalami collection scan dan sort mahal.
- **Rekomendasi:** Ukur query dengan MongoDB profiler/explain lalu tambahkan compound indexes yang dibutuhkan, misalnya `galeri(published, created_at)`, `agenda(tanggal)`, `audit_logs(timestamp)`, dan indeks filter export yang terbukti dipakai.

---

## 6. React Architecture

### M-15 — Pengambilan data belum memakai React Query secara konsisten

- **Prioritas:** Medium
- **Masalah:** `QueryClientProvider` sudah dibuat di `index.js`, tetapi halaman utamanya masih memanggil Axios dari `useEffect` dan menyimpan loading/error/cache secara manual.
- **Dampak:** Duplikasi pola fetch, cache tidak konsisten, stale data, refetch manual setelah mutasi, dan semakin sulit mengelola screen kompleks.
- **Rekomendasi:** Buat feature API hooks berbasis `useQuery`/`useMutation`, gunakan query keys per resource, invalidate cache setelah mutasi, dan standardisasi loading/error state.

### M-16 — Halaman admin berisi UI, aturan bisnis, dan HTTP call dalam satu file

- **Prioritas:** Medium
- **Masalah:** Halaman seperti `Agenda`, `DataJamaah`, `Pengaturan`, dan `UserManagement` menggabungkan state form, request, transformasi data, dan rendering besar.
- **Dampak:** Sulit diuji, direview, dan dikembangkan tanpa regresi; pola berubah antar halaman.
- **Rekomendasi:** Organisasikan per feature: `features/<domain>/api`, `hooks`, `schemas`, `components`, dan `pages`. Ekstrak form/dialog/broadcast logic dari page container.

### L-05 — Ada state/import tidak terpakai dan artefak debugging

- **Prioritas:** Low
- **Masalah:** Contoh yang terlihat: state `scrolled` di `PublicNav` tidak memengaruhi render; `API_URL` di `FileUpload` tidak dipakai; beberapa source memiliki `console.log` debugging.
- **Dampak:** Membingungkan pembaca dan menambah noise pada bundle/log.
- **Rekomendasi:** Aktifkan lint CI untuk unused imports/vars dan hapus debugging/artefak saat perubahan feature selesai.

### L-06 — Konfigurasi URL backend tersebar

- **Prioritas:** Low
- **Masalah:** `lib/api.js` memakai `REACT_APP_BACKEND_URL`, sedangkan beberapa file menggunakan fallback URL sendiri atau `REACT_APP_API_URL`.
- **Dampak:** Konfigurasi deployment dapat tidak konsisten antar fitur (terutama preview file).
- **Rekomendasi:** Jadikan `lib/api.js`/satu config module sebagai satu-satunya source of truth untuk base API dan URL static upload; fail-fast bila production env tidak lengkap.

---

## 7. FastAPI Architecture

### M-17 — `server.py` adalah monolit yang memuat banyak tanggung jawab

- **Prioritas:** Medium
- **Masalah:** Konfigurasi, middleware, model, auth, database access, CRUD, reporting, upload, static file, startup, dan lifecycle berada dalam satu file besar.
- **Dampak:** Konflik merge, coupling tinggi, test unit sulit, dan perubahan domain dapat tidak terisolasi.
- **Rekomendasi:** Pecah menjadi `core/`, `db/`, `schemas/`, `services/`, `repositories/`, dan `routers/`. Pertahankan `main.py` hanya untuk app assembly.

### M-18 — Startup memiliki side effect data bisnis

- **Prioritas:** Medium
- **Masalah:** Startup API membuat indexes, memprovision super admin, berpotensi reset password, dan menjalankan seed data.
- **Dampak:** Restart produksi tidak idempotent secara operasional dan dapat membuat akun/data tak terduga.
- **Rekomendasi:** Pisahkan init database, bootstrap user, seed demo, dan migration ke CLI/job deployment yang eksplisit. Startup hanya melakukan health/connectivity yang aman.

### L-07 — Static mount `uploads` didaftarkan dua kali

- **Prioritas:** Low
- **Masalah:** `app.mount("/uploads", ...)` muncul sebelum router dan kembali setelah `include_router`.
- **Dampak:** Ambiguitas konfigurasi dan maintenance noise, walau biasanya tidak mengubah perilaku pada path sama.
- **Rekomendasi:** Daftarkan static mount satu kali dalam fungsi app factory yang terstruktur.

### L-08 — Import dan dependency backend tampak lebih luas dari pemakaian inti

- **Prioritas:** Low
- **Masalah:** `server.py` mengimpor beberapa modul yang tidak tampak dipakai dalam alur utama; `requirements.txt` juga memuat banyak paket AI/cloud di luar kebutuhan portal inti.
- **Dampak:** Build lebih lambat, attack surface dependency lebih besar, dan sulit memahami dependensi wajib.
- **Rekomendasi:** Audit dependency dengan lockfile/SBOM; hapus dependency/import tidak digunakan dan pisahkan optional tooling dari runtime dependencies.

---

## 8. Code Quality

### M-19 — Validasi dan aturan bisnis tersebar/tidak seragam

- **Prioritas:** Medium
- **Masalah:** Sebagian validation dilakukan pada UI, sebagian Pydantic, sebagian inline dalam route. Generic CRUD tidak memiliki schema domain.
- **Dampak:** Client berbeda dapat memasukkan data berbeda; kualitas data dan error behavior tidak konsisten.
- **Rekomendasi:** Jadikan backend sebagai source of truth untuk validation domain; gunakan shared constants/schema bila diperlukan frontend; tulis service tests untuk aturan bisnis.

### M-20 — Penanganan status operasi CRUD tidak selalu memeriksa hasil database

- **Prioritas:** Medium
- **Masalah:** Banyak `update_one`/`delete_one` tidak memeriksa `matched_count`/`deleted_count` sebelum mengembalikan item/`message` sukses.
- **Dampak:** Update/delete ID yang tidak ada dapat tampak sukses atau menghasilkan response tidak konsisten.
- **Rekomendasi:** Periksa hasil operasi dan return 404 bila target tidak ditemukan; gunakan helper repository standar.

### L-09 — Encoding/mojibake terlihat dalam literal UI

- **Prioritas:** Low
- **Masalah:** Beberapa string UI menampilkan karakter seperti `â€”`/emoji ter-encode pada source/output.
- **Dampak:** Tampilan pengguna menurun dan source sulit dibaca.
- **Rekomendasi:** Standarkan UTF-8, pastikan editor/build pipeline, dan tambahkan lint/test snapshot untuk teks penting.

---

## 9. Performance

### M-21 — Dashboard melakukan query N+1 untuk jumlah jamaah per cabang

- **Prioritas:** Medium
- **Masalah:** `dashboard_stats()` memuat seluruh cabang lalu menjalankan `count_documents` per cabang secara serial.
- **Dampak:** Latensi meningkat seiring jumlah cabang dan membebani MongoDB.
- **Rekomendasi:** Gunakan satu aggregation `$group` berdasarkan `cabang_id`, lalu join hasil di memori. Tambahkan caching pendek untuk statistik bila perlu.

### M-22 — Endpoint guru melakukan enrichment global setiap request

- **Prioritas:** Medium
- **Masalah:** `_enrich_guru` membaca seluruh cabang dan aggregate seluruh jamaah pada setiap list/detail guru.
- **Dampak:** Query tambahan dan data scan meningkat walau hanya satu guru diminta.
- **Rekomendasi:** Gunakan aggregation pipeline terfilter/lookup, denormalisasi count dengan mekanisme konsisten, atau cache lookup. Hilangkan `print` timing setelah profiling formal.

### M-23 — Export dan backup memuat hingga 100.000 dokumen ke memori

- **Prioritas:** Medium
- **Masalah:** Export/backup memakai `to_list(100000)` dan membangun dataframe/table di memory.
- **Dampak:** Risiko memory exhaustion, timeout, dan event-loop blocking saat data bertambah.
- **Rekomendasi:** Gunakan cursor streaming/batching, batasi export async, pagination, job queue background, serta storage file untuk hasil besar.

### L-10 — Pagination dan filter tabel sepenuhnya client-side

- **Prioritas:** Low
- **Masalah:** `DataTable` baru melakukan pagination setelah seluruh records diambil browser.
- **Dampak:** UX dan memory browser memburuk untuk dataset besar.
- **Rekomendasi:** Sejalan dengan M-08, pindahkan pagination/filter/sort ke API dan gunakan React Query dengan `keepPreviousData`.

---

## 10. Scalability

### H-08 — Penyimpanan upload lokal tidak siap untuk multi-instance

- **Prioritas:** High
- **Masalah:** File upload ditulis ke `backend/uploads` lokal dan URL disajikan oleh instance FastAPI yang sama. Tidak ada storage abstraction, CDN, atau persistent-volume requirement dalam konfigurasi deployment.
- **Dampak:** Pada autoscaling/container restart, file dapat hilang atau hanya tersedia di sebagian instance. Backup API juga tidak mencakup file upload.
- **Rekomendasi:** Gunakan object storage S3-compatible dengan URL/metadata tersentralisasi, lifecycle cleanup, CDN bila perlu, dan backup yang diverifikasi. Minimal, gunakan persistent shared volume secara eksplisit.

### M-24 — API monolitik tanpa job worker untuk pekerjaan berat

- **Prioritas:** Medium
- **Masalah:** Kompresi gambar, export PDF/XLSX, backup/restore seluruh data, dan seed berjalan dalam proses web/API.
- **Dampak:** Request panjang mengurangi kapasitas worker API dan lebih mudah timeout saat data/berkas bertambah.
- **Rekomendasi:** Pindahkan pekerjaan panjang ke worker/queue; simpan progress/status job dan berikan link download hasil ketika selesai.

### M-25 — Tidak ada cache, quota, atau strategi kapasitas eksplisit

- **Prioritas:** Medium
- **Masalah:** Statistik publik/dashboard dan lookup dimuat ulang per request; tidak ada quota upload/export/backups atau baseline monitoring.
- **Dampak:** Biaya dan latensi naik secara non-linear saat traffic meningkat.
- **Rekomendasi:** Tambahkan caching selektif, rate/quota per role, index review, APM metrics, dan capacity test sebelum scale-out.

---

## 11. Maintainability

### M-26 — Kontrak domain belum didokumentasikan/diuji sebagai schema tunggal

- **Prioritas:** Medium
- **Masalah:** Struktur koleksi, form frontend, seed, export map, dan API payload didefinisikan di banyak lokasi.
- **Dampak:** Perubahan field memerlukan edit multi-file dan mudah menghasilkan mismatch seperti field lama/baru.
- **Rekomendasi:** Jadikan Pydantic schema sebagai kontrak backend, hasilkan tipe TypeScript/OpenAPI client bila memungkinkan, dan dokumentasikan data dictionary per entitas.

### M-27 — Seed test data bercampur dengan lifecycle aplikasi

- **Prioritas:** Medium
- **Masalah:** Data sample, akun test, dan code produksi berada dalam jalur startup sama.
- **Dampak:** Developer dan operator sulit membedakan data yang aman untuk demo dengan data yang boleh berada di production.
- **Rekomendasi:** Pisahkan fixtures test, demo seed, dan production bootstrap. Gunakan profile environment eksplisit dan CI database ephemeral.

### L-11 — Dokumentasi ada tetapi belum menggantikan runbook operasional

- **Prioritas:** Low
- **Masalah:** README/arsitektur menjelaskan sistem, tetapi belum ada runbook incident, rotasi secret, rollback restore, monitoring, dan prosedur release yang executable.
- **Dampak:** Onboarding dan respons operasional lebih bergantung pada pengetahuan individu.
- **Rekomendasi:** Tambahkan `docs/runbooks/` untuk deployment, rollback, restore drill, incident response, dan checklist release.

---

## 12. Duplicate Code

### M-28 — Logika CRUD, fetch, dialog, dan export diduplikasi pada halaman khusus

- **Prioritas:** Medium
- **Masalah:** `CrudPage` sudah mengabstraksikan beberapa entitas, tetapi Agenda, GaleriAdmin, UserManagement, Pesan, Laporan, dan Pengaturan masih memiliki pola request/error/loading/form yang serupa secara terpisah.
- **Dampak:** Bug fix dan perubahan UX/error handling harus diterapkan berulang serta dapat drift antar halaman.
- **Rekomendasi:** Ekstrak hooks/query/mutation bersama, dialog form generik secukupnya, dan service API per domain. Hindari membuat satu komponen generic yang terlalu besar; pertahankan boundary domain.

### L-12 — Transformasi export PDF dan XLSX mengulang fallback field

- **Prioritas:** Low
- **Masalah:** Normalisasi nilai (`nik`, `nama_ortu`, cabang, id, list) diulang pada dua loop pembentukan XLSX dan PDF.
- **Dampak:** Perbedaan output format mudah muncul saat field ditambah.
- **Rekomendasi:** Buat helper `render_export_value(row, key)`/row normalization tunggal sebelum renderer XLSX/PDF.

---

## 13. Dead Code

### L-13 — Artefak frontend yang kemungkinan tidak digunakan

- **Prioritas:** Low
- **Masalah:** `use-toast.js` ada bersamaan dengan penggunaan `sonner`; constants test ID lebih luas daripada fitur aktual; `FileUpload` mendefinisikan `API_URL` yang tidak dipakai.
- **Dampak:** Surface area dan kebingungan developer bertambah.
- **Rekomendasi:** Konfirmasi referensi melalui lint/coverage, hapus artefak yang benar-benar tidak dipakai, dan pilih satu sistem toast sebagai standar.

### L-14 — Import/konfigurasi backend yang tidak dipakai perlu dibersihkan

- **Prioritas:** Low
- **Masalah:** Static review menunjukkan import yang tampak tidak dipakai dan dependency runtime yang tidak terkait fitur inti.
- **Dampak:** Waktu instalasi, ukuran image, dan risiko supply-chain meningkat tanpa manfaat jelas.
- **Rekomendasi:** Jalankan lint Python (`ruff`/`flake8`) dan dependency audit; pindahkan dependency optional ke requirements ekstra atau hapus setelah verifikasi test.

---

## 14. Missing Validation

### H-06 — Schema entity dan whitelist field belum ada

- **Prioritas:** High
- **Masalah:** Lihat H-06. Ini juga merupakan gap validation utama: tanggal, nomor telepon, enum gender/role/status, URL, limit string, referensi, dan field writable tidak seragam.
- **Dampak:** Data corrupt/berbahaya dapat tersimpan dan memicu masalah ekspor/UI/otorisasi berikutnya.
- **Rekomendasi:** Terapkan Pydantic schema domain, validator tipe/format, foreign-key checks, dan database uniqueness constraints.

### M-29 — Backup/restore tidak memiliki schema version atau validasi referensi

- **Prioritas:** Medium
- **Masalah:** Restore menerima payload bebas dan menulis seluruh koleksi yang ada di JSON.
- **Dampak:** Backup antar versi dapat memulihkan data dengan format yang tidak kompatibel atau orphan relation.
- **Rekomendasi:** Tambahkan format `{version, created_at, checksum, data}`, schema validate, preflight report, dan compatibility migration sebelum commit restore.

### M-30 — Validasi form frontend tidak menggantikan server validation

- **Prioritas:** Medium
- **Masalah:** Banyak required check hanya mengecek nilai kosong di komponen. Client dapat dilewati dan beberapa halaman memiliki aturan berbeda.
- **Dampak:** Request langsung dapat menyimpan field wajib kosong/tidak valid apabila generic route menerimanya.
- **Rekomendasi:** Pindahkan semua invariant ke backend; gunakan frontend schema yang sama secara konseptual untuk UX, bukan sebagai security boundary.

---

## 15. Error Handling

### M-31 — Error database/transformasi belum dinormalisasi secara menyeluruh

- **Prioritas:** Medium
- **Masalah:** Route langsung memanggil MongoDB/Pillow/export library tanpa exception handler domain yang konsisten. Invalid ObjectId, duplicate key, image decode, atau export errors dapat muncul sebagai 500 generik.
- **Dampak:** Pengguna mendapat feedback buruk; API behavior sulit diandalkan; developer sulit membedakan client error dari server error.
- **Rekomendasi:** Buat global exception handlers dan domain exception. Petakan invalid ID ke 400, constraint ke 409, payload validation ke 422, dan proses file ke 400/413; log stack trace secara aman di server.

### M-32 — Pesan error frontend tidak selalu memakai objek error Axios yang tepat

- **Prioritas:** Medium
- **Masalah:** Banyak call menggunakan pola `apiError(e.response?.data?.detail)`, padahal `apiError` didesain menerima error Axios lengkap dan mengecek `error.response`/`error.code`.
- **Dampak:** Timeout/network errors dapat berubah menjadi pesan generik atau tidak tepat.
- **Rekomendasi:** Panggil konsisten `apiError(e)` atau buat normalizer tunggal interceptor. Tambahkan test untuk error 400/401/403/422/500/timeout/offline.

### L-15 — Tidak ada halaman/komponen standar untuk error API per layar

- **Prioritas:** Low
- **Masalah:** Sebagian halaman mengosongkan data setelah gagal, sebagian toast saja; tidak ada retry affordance yang konsisten.
- **Dampak:** UX tidak seragam dan transient failure sulit dipulihkan.
- **Rekomendasi:** Dengan React Query, gunakan reusable loading/error/empty state dan tombol retry.

---

## 16. Logging

### M-33 — Logging tidak terstruktur dan tidak memiliki correlation context

- **Prioritas:** Medium
- **Masalah:** Backend menggunakan `logging` dasar dan sejumlah `print`; frontend memakai `console.*`. Tidak ada request ID, JSON log, environment tag, atau central log sink.
- **Dampak:** Sulit menelusuri error lintas request, mendeteksi anomaly, atau melakukan forensic setelah insiden.
- **Rekomendasi:** Gunakan structured logging JSON, middleware correlation ID, level log standar, redaction secret/PII, dan integrasi log aggregation/APM.

### M-34 — Audit trail belum lengkap dan tidak dilindungi sebagai artefak sensitif

- **Prioritas:** Medium
- **Masalah:** Banyak CRUD dicatat, tetapi tidak semua read sensitif, failed login, password reset, restore detail, source/IP, maupun before/after change tercatat. Audit endpoint juga terlalu luas aksesnya.
- **Dampak:** Investigasi akses data dan pemulihan insiden tidak lengkap.
- **Rekomendasi:** Definisikan audit event taxonomy, tambah actor/IP/request ID/target/before-after yang sudah disanitasi, restrict audit read, dan atur retention/immutability policy.

---

## 17. Testing Coverage

### M-35 — Tidak ada test frontend yang terdeteksi

- **Prioritas:** Medium
- **Masalah:** Repository memiliki komponen dan constants `data-testid`, tetapi tidak ditemukan file test/spec frontend. Script frontend menjalankan CRA test, namun tidak ada suite yang terlihat.
- **Dampak:** Routing, guard autentikasi, role UI, form, error state, dan regresi pada reusable CRUD UI tidak memiliki perlindungan otomatis.
- **Rekomendasi:** Tambahkan unit/component test dengan React Testing Library untuk App routes, AuthContext, API error behavior, CrudPage/DataTable, dan role visibility. Tambahkan E2E untuk login dan alur CRUD utama.

### M-36 — Integration test backend bergantung pada URL remote/default dan shared state

- **Prioritas:** Medium
- **Masalah:** Test backend menggunakan `requests` ke `REACT_APP_BACKEND_URL` atau default preview remote, membawa kredensial hard-coded, dan melakukan create/update/delete pada data nyata target.
- **Dampak:** Test dapat merusak environment bersama, flakey, tidak reproducible, dan berisiko menjalankan mutasi ke target yang salah.
- **Rekomendasi:** Jalankan test terhadap database ephemeral/container khusus CI. Gunakan fixture lifecycle/cleanup yang kuat, env `TEST_API_URL` wajib, dan fail jika target bukan test environment.

### L-16 — Cakupan backend ada, tetapi belum menutup banyak negative/security path

- **Prioritas:** Low
- **Masalah:** Ada sekitar 34 fungsi test integration yang mencakup public/auth/RBAC/CRUD/export, tetapi belum tampak test untuk invalid ObjectId, settings secret exposure, cabang scoping, restore malformed/partial, upload image failure, rate limits selain login, serta concurrency ID.
- **Dampak:** Temuan prioritas tinggi dapat kembali muncul tanpa terdeteksi CI.
- **Rekomendasi:** Tambahkan test matrix endpoint × role × scope serta regression test untuk setiap temuan Critical/High sebelum fix dirilis.

---

## 18. Deployment Readiness

### H-08 — Runtime upload dan backup belum mendefinisikan persistence production

- **Prioritas:** High
- **Masalah:** Lihat H-08. Tidak ada Dockerfile, compose, IaC, atau konfigurasi persistent volume/object storage pada repository.
- **Dampak:** Deploy baru/restart/scale-out berisiko kehilangan file atau menyajikan file tidak konsisten; restore database tidak memulihkan gambar.
- **Rekomendasi:** Definisikan deployment target; gunakan object storage atau persistent volume, backup terjadwal untuk database dan file, serta restore drill.

### M-37 — Tidak ada build/release pipeline yang terlihat

- **Prioritas:** Medium
- **Masalah:** Tidak ada konfigurasi CI, Docker, environment promotion, lint gate, test gate, atau langkah deployment yang executable di repository.
- **Dampak:** Release manual lebih rentan drift, dependency issue, dan regresi yang lolos ke production.
- **Rekomendasi:** Tambahkan CI yang menjalankan lint/test/build, dependency scan, image build, dan deploy promotion per environment. Pastikan secret tidak keluar ke log.

### M-38 — Konfigurasi production hanya sebagian dan tidak fail-fast di frontend

- **Prioritas:** Medium
- **Masalah:** Backend memerlukan environment penting, tetapi frontend dapat membangun dengan `REACT_APP_BACKEND_URL` kosong atau fallback berbeda pada file tertentu. Tidak ada environment profile yang terdokumentasi/executable selain `.env` manual.
- **Dampak:** Frontend dapat menunjuk API salah, preview gambar gagal, atau build production dipublikasikan dengan konfigurasi development.
- **Rekomendasi:** Tambahkan validation build environment, `.env.example` tanpa secret, config matrix dev/staging/prod, dan smoke test setelah deployment.

### L-17 — Tidak ada health/readiness endpoint backend yang eksplisit

- **Prioritas:** Low
- **Masalah:** Health plugin tersedia untuk dev frontend secara opsional, tetapi backend tidak mengekspos readiness check yang memverifikasi koneksi layanan dependensi.
- **Dampak:** Platform deployment sulit membedakan proses hidup dengan API yang siap menerima traffic.
- **Rekomendasi:** Tambahkan `/healthz` dan `/readyz`; readiness harus memeriksa kemampuan koneksi MongoDB dengan timeout ringan.

---

## Rencana remediasi yang disarankan

```text
Fase 0 — sebelum production / segera
  1. Tutup kebocoran public settings (C-01).
  2. Hapus/rotasi akun dan password seed; nonaktifkan seed prod (C-02).
  3. Terapkan scope cabang dan batasi endpoint user/settings/audit/export (H-01..H-05).
  4. Lindungi restore dengan preflight, backup, dan validasi (H-04).

Fase 1 — hardening data/API
  5. Pydantic schema per domain + validasi ObjectId/foreign key (H-06, M-10, M-29).
  6. Password policy, session/revocation strategy, rate limits upload/contact.
  7. Response contracts, pagination server-side, RBAC regression tests.

Fase 2 — scalability/maintainability
  8. Pecah server.py dan frontend per feature; gunakan React Query.
  9. Pindahkan export/upload berat ke storage/worker yang sesuai.
 10. Tambah index berdasarkan profiling dan perbaiki N+1 dashboard.

Fase 3 — operasi berkelanjutan
 11. Docker/CI/CD, structured logging, monitoring, health checks.
 12. Backup terjadwal + restore drill, migration versioning, runbook operasional.
```

## File utama yang direview

```text
backend/server.py
backend/seed.py
backend/migrate_base64_images.py
backend/tests/backend_test.py
backend/requirements.txt
frontend/src/App.js
frontend/src/context/AuthContext.js
frontend/src/lib/api.js
frontend/src/components/admin/CrudPage.js
frontend/src/components/admin/DataTable.js
frontend/src/components/admin/FileUpload.js
frontend/src/pages/admin/*
frontend/src/pages/public/*
frontend/package.json
frontend/craco.config.js
.gitignore
```

## Penutup

Audit ini tidak mengubah source code. Prioritas pertama adalah menghilangkan secret yang diekspos publik dan kredensial seed otomatis, kemudian memperbaiki authorization scope serta kontrol operasi destruktif. Setelah itu, refactor menuju schema domain, pagination, structured observability, storage production, dan CI akan memberikan landasan yang jauh lebih aman dan mudah dirawat.
