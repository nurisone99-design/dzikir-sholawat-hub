"""Seed sample data for Yayasan Raudhatul Jannah portal (idempotent)."""

CABANG = [
    {"id_cabang": "CAB-0001", "kota": "Jakarta Pusat", "alamat": "Jl. Kebon Sirih No. 12, Menteng, Jakarta Pusat",
     "ketua": "H. Abdul Karim", "no_hp": "628123456701", "lat": -6.1864, "lng": 106.8342},
    {"id_cabang": "CAB-0002", "kota": "Bandung", "alamat": "Jl. Asia Afrika No. 88, Bandung, Jawa Barat",
     "ketua": "H. Sulaiman Rais", "no_hp": "628123456702", "lat": -6.9218, "lng": 107.6072},
    {"id_cabang": "CAB-0003", "kota": "Surabaya", "alamat": "Jl. Tunjungan No. 45, Surabaya, Jawa Timur",
     "ketua": "KH. Mahfudz Anwar", "no_hp": "628123456703", "lat": -7.2575, "lng": 112.7521},
    {"id_cabang": "CAB-0004", "kota": "Yogyakarta", "alamat": "Jl. Malioboro No. 7, Yogyakarta",
     "ketua": "H. Bambang Riyadi", "no_hp": "628123456704", "lat": -7.7956, "lng": 110.3695},
    {"id_cabang": "CAB-0005", "kota": "Banjarmasin", "alamat": "Jl. Lambung Mangkurat No. 21, Banjarmasin, Kalsel",
     "ketua": "KH. Zainal Ilmi", "no_hp": "628123456705", "lat": -3.3186, "lng": 114.5944},
]

GURU_NAMES = [
    ("Ustadz Ahmad Fauzi", 0, 42), ("Ustadz Muhammad Ridwan", 0, 35),
    ("Ustadz Hasan Basri", 1, 51), ("Ustadz Umar Hidayat", 2, 38),
    ("Ustadz Yusuf Mansur", 3, 29), ("Ustadz Abdullah Gymnastiar", 4, 47),
]

JAMAAH = [
    ("Siti Aminah", "Perempuan", 0, "3171012501850001", "Jakarta", "1985-01-25"),
    ("Budi Santoso", "Laki-laki", 0, "3171011203900002", "Bogor", "1990-03-12"),
    ("Fatimah Zahra", "Perempuan", 1, "3273016007920003", "Bandung", "1992-07-20"),
    ("Ahmad Dahlan", "Laki-laki", 1, "3273010101880004", "Cimahi", "1988-01-01"),
    ("Khadijah Nur", "Perempuan", 2, "3578014508950005", "Surabaya", "1995-08-05"),
    ("Rizki Ramadhan", "Laki-laki", 2, "3578012009930006", "Sidoarjo", "1993-09-20"),
    ("Aisyah Putri", "Perempuan", 3, "3471011511960007", "Yogyakarta", "1996-11-15"),
    ("Fahri Abdullah", "Laki-laki", 3, "3471010503910008", "Sleman", "1991-03-05"),
    ("Nurul Hidayah", "Perempuan", 4, "6371012207940009", "Banjarmasin", "1994-07-22"),
    ("Zainuddin MZ", "Laki-laki", 4, "6371011010890010", "Martapura", "1989-10-10"),
    ("Halimah Sadiyah", "Perempuan", 0, "3171013012870011", "Jakarta", "1987-12-30"),
    ("Ibrahim Malik", "Laki-laki", 1, "3273010208950012", "Bandung", "1995-08-02"),
]

KITAB = ["Kitab Ratib Al-Haddad", "Kitab Dalail Khairat", "Kitab Simtud Duror"]
AMALIAH = ["Amaliah Istighosah", "Amaliah Sholawat Nariyah", "Amaliah Dzikir Asma"]
NAMA_DALAM = ["Nama Dalam 1 - Nurul Iman", "Nama Dalam 2 - Ma'rifatullah", "Nama Dalam 3 - Nurul Islam"]

PENGUMUMAN = [
    {"judul": "Peringatan Harlah Majelis ke-15", "isi": "Alhamdulillah, Majelis Dzikir dan Sholawat akan menyelenggarakan peringatan Harlah ke-15 secara akbar. Mari hadir bersama.", "kategori": "Harlah"},
    {"judul": "Pembukaan Cabang Baru di Banjarmasin", "isi": "Dengan penuh syukur, kami umumkan pembukaan cabang baru di Banjarmasin. Semoga menjadi wasilah keberkahan.", "kategori": "Pengumuman"},
    {"judul": "Jadwal Dzikir Rutin Mingguan", "isi": "Dzikir rutin diselenggarakan setiap malam Jumat ba'da Isya di seluruh cabang majelis.", "kategori": "Kegiatan"},
]

AGENDA = [
    {"judul": "Dzikir Akbar & Sholawat Bersama", "tanggal": "2026-07-15", "waktu": "19:30",
     "lokasi": "Masjid Agung Jakarta", "cabang_idx": 0, "deskripsi": "Dzikir akbar bulanan bersama seluruh jamaah cabang Jakarta.", "target": "Semua Jamaah"},
    {"judul": "Peringatan Maulid Nabi Muhammad SAW", "tanggal": "2026-08-20", "waktu": "20:00",
     "lokasi": "Aula Majelis Bandung", "cabang_idx": 1, "deskripsi": "Peringatan Maulid Nabi dengan pembacaan Simtud Duror.", "target": "Semua Jamaah"},
    {"judul": "Istighosah & Doa Bersama", "tanggal": "2026-07-25", "waktu": "19:00",
     "lokasi": "Masjid Al-Akbar Surabaya", "cabang_idx": 2, "deskripsi": "Istighosah kubro memohon keberkahan.", "target": "Cabang Surabaya"},
    {"judul": "Harlah Majelis ke-15", "tanggal": "2026-09-10", "waktu": "08:00",
     "lokasi": "Lapangan Utama Yogyakarta", "cabang_idx": 3, "deskripsi": "Puncak peringatan Harlah Majelis ke-15.", "target": "Semua Jamaah"},
]

GALERI = [
    {"judul": "Dzikir Rutin Malam Jumat", "kategori": "Dzikir Rutin", "type": "photo",
     "url": "https://images.pexels.com/photos/30947036/pexels-photo-30947036.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "published": True},
    {"judul": "Peringatan Hari Besar Islam", "kategori": "Hari Besar Islam", "type": "photo",
     "url": "https://images.unsplash.com/photo-1766166793579-4833898111a5?crop=entropy&cs=srgb&fm=jpg&q=85&w=940", "published": True},
    {"judul": "Suasana Harlah Majelis", "kategori": "Harlah", "type": "photo",
     "url": "https://images.pexels.com/photos/5777146/pexels-photo-5777146.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "published": True},
    {"judul": "Kegiatan Sosial & Santunan", "kategori": "Kegiatan Sosial", "type": "photo",
     "url": "https://images.unsplash.com/photo-1627091908405-30bd51eec537?w=940&q=85", "published": True},
    {"judul": "Sholawat Bersama Jamaah", "kategori": "Dzikir Rutin", "type": "photo",
     "url": "https://images.unsplash.com/photo-1591604442080-7a2d5a41a5b8?w=940&q=85", "published": True},
    {"judul": "Doa & Munajat Akbar", "kategori": "Hari Besar Islam", "type": "photo",
     "url": "https://images.unsplash.com/photo-1585036156171-384164a8c675?w=940&q=85", "published": True},
]

SETTINGS = {
    "key": "yayasan",
    "nama": "Yayasan Raudhatul Jannah Nurul Islam wa Iman",
    "nama_majelis": "Majelis Dzikir dan Sholawat Raudhatul Jannah Nurul Islam wa Iman",
    "alamat": "Jl. Kebon Sirih No. 12, Menteng, Jakarta Pusat",
    "email": "info@raudhatuljannah.id",
    "telepon": "628123456700",
    "whatsapp": "628123456700",
    "instagram": "https://instagram.com/raudhatuljannah",
    "facebook": "https://facebook.com/raudhatuljannah",
    "youtube": "https://youtube.com/@raudhatuljannah",
    "wa_api_key": "",
    "notif_email": True,
}


async def seed_all(db, hash_password, now_iso):
    if await db.cabang.count_documents({}) > 0:
        # ensure settings + test users exist even on reseed
        if not await db.settings.find_one({"key": "yayasan"}):
            await db.settings.insert_one({**SETTINGS, "created_at": now_iso()})
        await _seed_test_users(db, hash_password, now_iso)
        return

    # Cabang
    cabang_ids = []
    for c in CABANG:
        res = await db.cabang.insert_one({**c, "created_at": now_iso(), "updated_at": now_iso()})
        cabang_ids.append(str(res.inserted_id))

    # Guru
    guru_ids = []
    for i, (nama, cidx, jml) in enumerate(GURU_NAMES, 1):
        res = await db.guru.insert_one({
            "id_guru": f"GUR-{i:04d}", "nama": nama, "cabang_id": cabang_ids[cidx],
            "jumlah_jamaah": jml, "created_at": now_iso(), "updated_at": now_iso()})
        guru_ids.append(str(res.inserted_id))

    # Jamaah
    jamaah_ids = []
    for i, (nama, gender, cidx, nik, tl, tgl) in enumerate(JAMAAH, 1):
        res = await db.jamaah.insert_one({
            "id_jamaah": f"JAM-{i:04d}", "nama": nama, "nik": nik, "gender": gender,
            "alamat": f"Jl. Contoh No. {i}, {CABANG[cidx]['kota']}", "tempat_lahir": tl,
            "tanggal_lahir": tgl, "nama_ortu": f"Orang Tua {nama.split()[0]}",
            "cabang_id": cabang_ids[cidx], "guru_id": guru_ids[cidx % len(guru_ids)],
            "ijazah_kitab": KITAB[: (i % 3) + 1], "ijazah_amaliah": AMALIAH[: (i % 3) + 1],
            "ijazah_nama_dalam": NAMA_DALAM[: (i % 3) + 1],
            "created_at": now_iso(), "updated_at": now_iso()})
        jamaah_ids.append(str(res.inserted_id))

    # Pengurus
    jabatan = ["Ketua Umum", "Sekretaris", "Bendahara", "Koordinator Dakwah"]
    for i, jab in enumerate(jabatan):
        await db.pengurus.insert_one({
            "id_pengurus": f"PGR-{i+1:04d}", "jamaah_id": jamaah_ids[i], "nama": JAMAAH[i][0],
            "jabatan": jab, "cabang_id": cabang_ids[i % len(cabang_ids)],
            "alamat": f"Jl. Pengurus No. {i+1}", "no_hp": f"62812300000{i+1}",
            "created_at": now_iso(), "updated_at": now_iso()})

    # Pengumuman
    for p in PENGUMUMAN:
        await db.pengumuman.insert_one({**p, "created_at": now_iso(), "updated_at": now_iso()})

    # Agenda
    for a in AGENDA:
        d = dict(a)
        d["cabang_id"] = cabang_ids[d.pop("cabang_idx")]
        await db.agenda.insert_one({**d, "created_at": now_iso(), "updated_at": now_iso()})

    # Galeri
    for g in GALERI:
        await db.galeri.insert_one({**g, "created_at": now_iso(), "updated_at": now_iso()})

    # Settings
    await db.settings.insert_one({**SETTINGS, "created_at": now_iso()})

    await _seed_test_users(db, hash_password, now_iso)


async def _seed_test_users(db, hash_password, now_iso):
    users = [
        {"username": "admincabang", "email": "cabang@raudhatuljannah.id", "password": "Cabang@2026",
         "role": "admin_cabang", "name": "Admin Cabang Jakarta"},
        {"username": "viewer", "email": "viewer@raudhatuljannah.id", "password": "Viewer@2026",
         "role": "viewer", "name": "Pengamat Data"},
    ]
    for u in users:
        if not await db.users.find_one({"email": u["email"]}):
            await db.users.insert_one({
                "username": u["username"], "email": u["email"],
                "password_hash": hash_password(u["password"]), "name": u["name"],
                "role": u["role"], "status": "active", "created_at": now_iso()})
