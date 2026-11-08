# PRODUCT REQUIREMENT DOCUMENT (PRD)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI: 1.2.0
STATUS: PRODUCTION READY (MODULAR ARCHITECTURE)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 08 November 2026
================================================================================

================================================================================
ZONA ATAS: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT AWAL)
================================================================================

## 1. NAMA PROJEK & PROBLEM STATEMENT
- **Nama Aplikasi:** SnapEvent (Disposable Camera & Event Gallery System)
- **Problem Statement:**
  Pada acara pernikahan, ulang tahun, konser, atau gathering, tamu sering mengambil foto berharga namun tercecer di ponsel masing-masing. Di sisi lain, tren kamera analog sekali pakai (*disposable camera*) sangat disukai karena memberi sensasi estetika retro, kuota terbatas yang membuat momen lebih bermakna, serta kejutan saat foto diungkap (*reveal*).
  SnapEvent menghadirkan pengalaman kamera sekali pakai digital berbasis web app (tanpa install aplikasi), di mana tamu memotret dengan filter retro dan custom frame acara, otomatis tersimpan ke folder Google Drive penyelenggara, memiliki kuota jepretan & voting, serta galeri interaktif dengan mode kompetisi foto dan layar proyektor panggung (Live Slideshow).

---

## 2. PERAN PENGGUNA (USER ROLES)
1. **Tamu Acara (Guest):**
   - Akses via scan QR Code meja atau link event (`?event=KODE_EVENT`).
   - Masukkan nama panggilan singkat (tersimpan di browser localStorage + device fingerprint).
   - Memotret foto langsung menggunakan kamera HP / upload galeri.
   - Memilih filter kamera analog (RAW, 800T, Vintage Grain, Black & White, Warm Sun).
   - Memilih custom frame foto berlogo/bernama event (Gold Art-Deco, Polaroid Klasik, Minimalist Border).
   - Dibatasi kuota foto per event (misal: 10 jepretan).
   - Melihat galeri foto (jika sudah diungkap/reveal) dan memberikan voting Like per kategori (misal: Best Outfit, Funniest Pose) sesuai kuota voting.
2. **Administrator / Penyelenggara (Admin):**
   - Login aman dengan Master PIN Admin.
   - **Kelola Event:** Tambah event baru, edit detail event, aktif/nonaktifkan status event, hapus event.
   - **Pengaturan per Event:**
     * Nama event, tanggal, deskripsi, hashtag resmi (`#TandaPagar`).
     * Kuota foto per tamu (contoh: 5, 10, 25, Unlimited).
     * Kuota voting per tamu per kategori.
     * Mode pengungkapan galeri: *Terungkap Langsung Selama Acara* vs *Ditahan Sampai Acara Selesai (Manual Reveal / Schedule)*.
     * Izin visibilitas galeri (Publik untuk semua tamu vs Ditutup).
     * Tombol like/voting (Aktif / Disembunyikan).
     * Pilihan frame kustom & filter aktif.
     * Daftar kategori voting dinamis (misal: *Best Outfit, Momen Terlucu, Pose Terheboh*).
     * ID Folder Google Drive khusus untuk event tersebut.
   - **Pengaturan Global Sistem:**
     * Judul platform & branding.
     * Folder Google Drive Master.
     * Default kuota foto & default kuota voting.
     * Master PIN Admin.
   - **Fitur Live Venue Slideshow:**
     * Mode layar penuh (Full Screen) untuk disambungkan ke proyektor / LED screen ballroom.
     * Auto-slideshow foto-foto terbaru beranimasi elegan.
     * Menampilkan QR Code scan untuk tamu di pojok layar.
   - **Export & Download:**
     * Akses langsung ke folder Google Drive event.
     * Pemenang voting per kategori otomatis dirangking.

---

## 3. ARSITEKTUR & LINGKUNGAN KERJA
- **Frontend:** Modern Web App (SPA) responsive mobile-first menggunakan HTML5, Tailwind CSS / Custom Luxury Dark Theme, Canvas API (untuk filter & watermarking frame), dan Vanilla JavaScript murni.
- **Backend API:** Google Apps Script (GAS) Web App Endpoint yang mengelola routing `doGet` dan `doPost`.
- **Database:** Google Sheets terstruktur sebagai basis data relasional ringan.
- **Penyimpanan Berkas (Storage):** Google Drive API terintegrasi via Google Apps Script (otomatis membuat sub-folder per event, menyimpan file gambar JPEG terkompresi & framed, serta menghasilkan public thumbnail link).
- **Hosting Frontend:** Fleksibel (Bisa berjalan langsung di Google Apps Script HTML Service, atau di-deploy gratis di GitHub Pages / Vercel / Netlify dengan menyambungkan endpoint GAS).

---

## 4. ALUR KERJA APLIKASI (USER FLOW)

### A. Alur Tamu Acara:
```
Scan QR / Buka Link Event
       ↓
Input Nama Panggilan (Otomatis dapat Guest Token)
       ↓
Tampilan Disposable Camera (Viewfinder, Tombol Shutter, Sisa Rol Foto)
       ↓
Pilih Filter Retro & Frame Event → Jepret Foto
       ↓
Preview Foto & Tambah Caption Singkat
       ↓
Unggah (Otomatis diproses Canvas Frame & disimpan ke Google Drive)
       ↓
Masuk ke Menu Galeri (Terkunci jika mode "Setelah Acara", atau Terbuka jika "Selama Acara")
       ↓
Beri Suara / Vote pada Foto Favorit per Kategori
```

### B. Alur Admin:
```
Buka Panel Admin → Masukkan PIN
       ↓
Dashboard Metrik (Total Event, Total Foto, Total Tamu, Penyimpanan Drive)
       ↓
Kelola Event (Buat Event Baru → Atur Kuota, Waktu Reveal, Folder Drive, Kategori Vote)
       ↓
Generate QR Meja & Link Event
       ↓
Buka Live Slideshow Proyektor saat Acara Berlangsung
       ↓
Umumkan Pemenang Voting Kategori & Buka Folder Google Drive
```

---

## 5. DESAIN BASIS DATA (GOOGLE SHEETS DATABASE)
*Catatan Mutlak ZettBOT: Nama Sheet TANPA karakter underscore (_).*

### Tab 1: `DataEvent`
Menyimpan seluruh master data acara.
| Indeks Kolom | Nama Header | Tipe Data | Keterangan & Contoh |
| :--- | :--- | :--- | :--- |
| COL[0] | idEvent | String | Kode unik sekuensial (misal: `EVT-202611-001`) |
| COL[1] | namaEvent | String | "Wedding of Sarah & Kevin" |
| COL[2] | slugEvent | String | "sarah-kevin-wedding" (untuk URL ramah) |
| COL[3] | tanggalEvent | String | "2026-11-20" |
| COL[4] | hashtagEvent | String | "#SarahKevinEverAfter" |
| COL[5] | maxFotoPerGuest | Number | Batas jepretan (misal: 10) |
| COL[6] | maxVotePerGuest | Number | Batas suara per tamu (misal: 3) |
| COL[7] | revealMode | String | `SEGERA` (Selama Acara) / `SETELAH` (Setelah Acara) |
| COL[8] | isRevealed | Boolean | `TRUE` jika galeri sudah resmi diungkap |
| COL[9] | likeEnabled | Boolean | `TRUE` jika tombol like aktif |
| COL[10] | publicVisible | Boolean | `TRUE` jika galeri terbuka untuk tamu |
| COL[11] | activeCameraStyles | String (JSON) | Daftar filter kamera: `["RAW","800T","BW","WARM"]` |
| COL[12] | activeFrames | String (JSON) | Daftar frame: `["GOLD_DECO","POLAROID","MINIMAL"]` |
| COL[13] | gdriveFolderId | String | ID Folder Google Drive khusus event |
| COL[14] | statusEvent | String | `AKTIF` / `SELESAI` / `DRAFT` |
| COL[15] | createdAt | String | Timestamp pembuatan |

### Tab 2: `DataFoto`
Menyimpan riwayat foto yang diunggah tamu.
| Indeks Kolom | Nama Header | Tipe Data | Keterangan & Contoh |
| :--- | :--- | :--- | :--- |
| COL[0] | idFoto | String | Kode unik (misal: `FTO-20261108-001`) |
| COL[1] | idEvent | String | Relasi ke `DataEvent` |
| COL[2] | guestId | String | Device Fingerprint tamu |
| COL[3] | guestNama | String | Nama tamu pengunggah |
| COL[4] | captionFoto | String | Catatan momen singkat |
| COL[5] | cameraStyle | String | "800T", "RAW", dll |
| COL[6] | frameStyle | String | "GOLD_DECO", "POLAROID", dll |
| COL[7] | gdriveFileId | String | ID File di Google Drive |
| COL[8] | gdriveViewUrl | String | URL Google Drive / Direct Image |
| COL[9] | totalLikes | Number | Jumlah akumulasi like/vote |
| COL[10] | isFeatured | Boolean | Ditampilkan di highlight proyektor |
| COL[11] | createdAt | String | Timestamp pengunggahan |

### Tab 3: `DataKategoriVoting`
Menyimpan daftar kategori voting per event.
| Indeks Kolom | Nama Header | Tipe Data | Keterangan & Contoh |
| :--- | :--- | :--- | :--- |
| COL[0] | idKategori | String | Kode unik (misal: `KAT-001`) |
| COL[1] | idEvent | String | Relasi ke `DataEvent` |
| COL[2] | namaKategori | String | "Best Outfit", "Pose Terheboh", "Momen Terbaper" |
| COL[3] | deskripsi | String | Keterangan singkat kriteria |
| COL[4] | urutan | Number | Urutan tampilan di tab |

### Tab 4: `DataVoting`
Mencatat suara tamu agar tidak melebihi kuota.
| Indeks Kolom | Nama Header | Tipe Data | Keterangan & Contoh |
| :--- | :--- | :--- | :--- |
| COL[0] | idVote | String | Kode unik (misal: `VOT-001`) |
| COL[1] | idEvent | String | Relasi ke `DataEvent` |
| COL[2] | idFoto | String | Relasi ke `DataFoto` |
| COL[3] | idKategori | String | Relasi ke `DataKategoriVoting` |
| COL[4] | guestId | String | Device ID pemilih |
| COL[5] | guestNama | String | Nama pemilih |
| COL[6] | votedAt | String | Timestamp vote |

### Tab 5: `DataPengaturanGlobal`
Menyimpan konfigurasi sistem umum.
| Indeks Kolom | Kunci Pengaturan | Nilai Pengaturan | Keterangan |
| :--- | :--- | :--- | :--- |
| COL[0] | `app_title` | "SnapEvent Studio" | Nama platform |
| COL[1] | `admin_pin` | "889900" | Master PIN Admin (Bisa diganti) |
| COL[2] | `master_drive_folder_id` | "" | Folder induk Google Drive |
| COL[3] | `default_max_foto` | "10" | Default kuota jepret |
| COL[4] | `default_max_vote` | "3" | Default kuota suara |

---

## 6. ATURAN VALIDASI & LOGIKA KHUSUS
1. **Batas Kuota Foto (Disposable Camera Roll):**
   - Di sisi frontend: Visualisasi sisa rol film di layar kamera (contoh: "🎞️ 7 / 10 foto tersisa"). Tombol jepret dinonaktifkan jika kuota habis.
   - Di sisi backend: Sebelum menyimpan foto, backend memeriksa jumlah upload dari `guestId` pada `idEvent`. Jika `>= maxFotoPerGuest`, request ditolak dengan pesan edukatif.
2. **Batas Kuota Voting & Anti-Double Vote:**
   - Tamu hanya dapat memilih 1 kali untuk foto yang sama, dan total vote tidak boleh melebihi `maxVotePerGuest` per kategori.
3. **Mekanisme Sensor & Kamera Native (Radar Batasan Teknis ZettBOT):**
   - Menggunakan HTML5 `<input type="file" accept="image/*" capture="environment">` dikombinasikan dengan Canvas API untuk penggabungan frame dan efek film retro.
   - Sangat kompatibel di semua browser HP (Safari iOS & Chrome Android) tanpa kendala izin iframe sandbox.
4. **Watermark Custom Frame & Filter Canvas:**
   - Foto yang dijepret diproses di sisi klien melalui HTML5 Canvas:
     * Diberikan grading warna filter (misal: grain vintage, tint hangat, atau BW kontras).
     * Ditempelkan bingkai pilihan (Gold Art-Deco, Polaroid dengan teks `#Hashtag` acara dan tanggal).
   - Menghasilkan gambar base64 berkualitas tinggi yang ringan dan siap diunggah ke Google Drive.
5. **Google Drive Folder Otomatis:**
   - Backend Google Apps Script otomatis membuat sub-folder baru di Google Drive sesuai nama event jika belum ada.
   - Hak akses file otomatis disetel agar dapat ditampilkan di galeri web app.

---

## 7. RENCANA ANTARMUKA & DESAIN LAYOUT (ANTI-AI LUXURY AESTHETIC)
Mengikuti 5 referensi foto visual yang diserahkan pengguna:
- **Tema Warna:** Dark Luxury (#111114 Deep Charcoal, #1C1C22 Card Surface, aksen Warm Amber/Gold `#D4AF37`, dan teks lembut Zinc `#E4E4E7`).
- **Halaman Tamu (Guest View):**
  1. *Welcome Screen:* Input nama santai, info sisa rol kamera, dan tombol mulai jepret.
  2. *Disposable Camera Viewfinder:* Tampilan ala bodi kamera retro, indikator sisa film, tombol switch filter (RAW, 800T, Warm, BW), tombol switch frame (Gold Art Deco, Polaroid, Modern Clean), dan tombol shutter besar yang memuaskan.
  3. *Preview & Caption Modal:* Menampilkan hasil foto dengan frame yang sudah terpasang rapi, input caption singkat, dan tombol "Simpan ke Rol Acara".
  4. *Galeri & Poling Tab:* Grid foto rapi 2 kolom, tab kategori voting, indikator peringkat favorit, tombol Like dengan counter, dan status "Foto akan terungkap saat acara selesai" jika mode reveal ditahan.
- **Halaman Live Slideshow (Proyektor Mode):**
  - Tampilan layar penuh minim tombol, transisi fade mewah setiap 5 detik menampilkan foto tamu beserta nama & hashtag, QR Code melayang di pojok bawah.
- **Halaman Admin:**
  - Login modal PIN.
  - Form Wizard Buat/Edit Event (Langkah 1: Info Dasar & Hashtag -> Langkah 2: Kuota & Reveal -> Langkah 3: Frame & Filter -> Selesai).
  - Tabel Data Event responsif dengan tombol Aksi (Edit, Buka Galeri, Buka Slideshow, Unduh QR, Buka Google Drive).
  - Panel Pengaturan Global (Ganti PIN, Default Folder Drive).

---

## 8. KRITERIA PENGUJIAN (TESTING CHECKLIST)
- [ ] Tamu dapat memasukkan nama dan masuk ke viewfinder kamera tanpa error.
- [ ] Kamera HP dapat memotret, menerapkan filter, menempelkan frame custom dan hashtag acara.
- [ ] Kuota foto berkurang setiap berhasil upload dan memblokir upload ke-11 jika batas 10.
- [ ] Foto tersimpan secara riil di folder Google Drive event.
- [ ] Galeri menampilkan foto secara dinamis sesuai mode reveal (Langsung vs Ditahan).
- [ ] Voting Like berfungsi sesuai kuota dan per kategori.
- [ ] Admin dapat login dengan PIN, membuat event baru, mengubah settingan, dan membuka Live Slideshow.

================================================================================
ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
================================================================================
- **Status Arsitektur Aktif:** Standalone Modern Web App Frontend (HTML5 / Tailwind CSS / Canvas API SPA) terhubung dengan Google Apps Script Backend (`code.gs`, `setup.gs`), Google Sheets Database, dan Google Drive Storage.
- **Berkas Inti Projek:**
  1. `setup.gs`: Inisialisasi basis data otomatis & safe migration (Sheet names: `DataEvent`, `DataFoto`, `DataKategoriVoting`, `DataVoting`, `DataPengaturanGlobal`).
  2. `code.gs`: Backend Controller REST API (GET/POST router, upload base64 ke Google Drive, index-based column mapping, lock service, validasi kuota).
  3. `index.html`: Antarmuka modern mobile-first SPA semantik, memuat `style.css` dan `app.js`, siap hosting di GitHub Pages.
  4. `style.css`: Lembar gaya kustom (Dark Luxury Gold, animasi Shutter Flash, Ken Burns Slideshow, dan efek Grain).
  5. `app.js`: Mesin logika aplikasi lengkap (Kamera, Canvas Processing, Galeri, Poling, Session Admin, Form Handler).
  6. `README.md`: Panduan instalasi dan deployment ke Google Apps Script, GitHub Pages, Vercel, atau Netlify.
- **Skema Pemetaan Database Terkini:**
  - `DataEvent`: COL[0-16] (ID, Nama, Slug, Tanggal, Hashtag, MaxFoto, MaxVote, RevealMode, IsRevealed, LikeEnabled, PublicVisible, ActiveCameraStyles, ActiveFrames, GDriveFolderId, Status, CreatedAt, CustomFrameUrl).
  - `DataFoto`: COL[0-11] (ID, IdEvent, GuestId, GuestNama, Caption, CameraStyle, FrameStyle, GDriveFileId, GDriveViewUrl, TotalLikes, IsFeatured, CreatedAt).
  - `DataKategoriVoting`: COL[0-4] (ID, IdEvent, Nama, Deskripsi, Urutan).
  - `DataVoting`: COL[0-6] (ID, IdEvent, IdFoto, IdKategori, GuestId, GuestNama, VotedAt).
  - `DataPengaturanGlobal`: COL[0-2] (Kunci, Nilai, Keterangan) mencakup `admin_user`, `admin_pass`, `admin_pin`, `master_drive_folder_id`.
- **Logika Bisnis Berjalan:**
  - Pemecahan Berkas Modular: Kode raksasa monolith dipisahkan menjadi `index.html`, `style.css`, dan `app.js` agar terorganisir untuk version control di GitHub dan hosting di GitHub Pages.
  - Perbaikan Tuntas Menu Macet: Menghilangkan SyntaxError duplikasi properti yang sebelumnya menghentikan eksekusi script.
  - Autentikasi Admin: Menggunakan Username & Password (default: `admin` / `admin123`).
  - Persistensi Sesi Admin: Disimpan di `sessionStorage` sehingga ketika browser di-refresh (F5), admin tetap berada di Dashboard Admin tanpa terlempar keluar.
  - Bingkai Kustom Acara: Admin dapat mengunggah file frame PNG transparan per-event, yang otomatis muncul sebagai opsi bingkai di Viewfinder tamu.
  - Perbaikan Pratinjau Foto: Pengecekan dimensi video (`videoWidth`/`videoHeight`) dan perenderan modal via elemen `<img>` murni menjamin pratinjau foto tidak pernah hitam.
  - Kuota foto per tamu divalidasi ganda di sisi frontend (sisa jepretan) dan backend (penolakan jika melebihi batas).
  - Mode reveal fleksibel: Selama Acara (Langsung terlihat) vs Setelah Acara (Terkunci sampai admin membuka kunci).
- **Log Pembaruan Resmi:**
  - [2026-11-08] Rilis v1.2.0: Restrukturisasi modular untuk repositori GitHub (`index.html`, `style.css`, `app.js`), perbaikan tuntas SyntaxError penyebab menu macet, dan pengujian engine Chromium tanpa error.
  - [2026-11-08] Rilis v1.1.0: Menerapkan login username/password, persistensi sesi admin, unggah custom frame PNG per-event, pengaturan folder Google Drive eksplisit, dan perbaikan tuntas masalah pratinjau foto hitam.
  - [2026-11-08] Rilis v1.0.0: Seluruh kode inti frontend, backend GAS, frame generator, integrasi Drive, galeri poling, dan mode live slideshow proyektor berhasil diimplementasikan penuh.

