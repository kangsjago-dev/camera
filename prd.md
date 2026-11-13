# PRODUCT REQUIREMENT DOCUMENT (PRD)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI: 1.5.1
STATUS: PRODUCTION READY (CUSTOM BACKEND & MASTER DRIVE SEEDED PERMANENTLY)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 09 November 2026
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
- [x] Tamu dapat memasukkan nama dan masuk ke viewfinder kamera tanpa error.
- [x] Kamera HP dapat memotret, menerapkan filter, menempelkan frame custom dan hashtag acara.
- [x] Kuota foto berkurang setiap berhasil upload dan memblokir upload ke-11 jika batas 10.
- [x] Foto tersimpan secara riil di folder Google Drive event.
- [x] Galeri menampilkan foto secara dinamis sesuai mode reveal (Langsung vs Ditahan).
- [x] Voting Like berfungsi sesuai kuota dan per kategori.
- [x] Admin dapat login dengan PIN/Password, membuat event baru, mengubah settingan, dan membuka Live Slideshow.
- [x] Multi-event management: aktifkan event, edit acara, dan isolasi galeri & voting 100% antar acara.
- [x] Gerbang proteksi tautan inaktif: memblokir akses tamu jika link acara lama/tidak aktif dibuka manual.
- [x] Panggung Slideshow Megah: foto berskala besar (84% layar) dengan efek Ambient Glow Blur anti-hitam dan QR Code raksasa tajam (500px).

================================================================================
ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
================================================================================
- **Status Arsitektur Aktif:** Standalone Modern Web App Frontend (HTML5 / Tailwind CSS / Canvas API SPA) terhubung dengan Google Apps Script Backend (`code.gs`, `setup.gs`), Google Sheets Database, dan Google Drive Storage.
- **Berkas Inti Projek:**
  1. `setup.gs`: Inisialisasi basis data otomatis & safe migration (Sheet names: `DataEvent`, `DataFoto`, `DataKategoriVoting`, `DataVoting`, `DataPengaturanGlobal`).
  2. `code.gs`: Backend Controller REST API (GET/POST router, upload base64 ke Google Drive, index-based column mapping, lock service, validasi kuota, handler `adminSetActiveEvent`).
  3. `index.html`: Antarmuka modern mobile-first SPA semantik, memuat `style.css` dan `app.js`, dilengkapi gerbang proteksi `#viewEventClosed`, ambient glow backdrop, dan stasiun scan QR proyektor raksasa.
  4. `style.css`: Lembar gaya kustom (Dark Luxury Gold, animasi Shutter Flash, Ken Burns Slideshow, dan efek Grain).
  5. `app.js`: Mesin logika aplikasi lengkap (Kamera, Canvas Processing, Galeri, Poling, Session Admin, Form Handler, Event Gatekeeper, Multi-Event Segregation).
  6. `README.md`: Panduan instalasi dan deployment ke Google Apps Script, GitHub Pages, Vercel, atau Netlify.
- **Skema Pemetaan Database Terkini:**
  - `DataEvent`: COL[0-16] (ID, Nama, Slug, Tanggal, Hashtag, MaxFoto, MaxVote, RevealMode, IsRevealed, LikeEnabled, PublicVisible, ActiveCameraStyles, ActiveFrames, GDriveFolderId, Status, CreatedAt, CustomFrameUrl).
  - `DataFoto`: COL[0-11] (ID, IdEvent, GuestId, GuestNama, Caption, CameraStyle, FrameStyle, GDriveFileId, GDriveViewUrl, TotalLikes, IsFeatured, CreatedAt).
  - `DataKategoriVoting`: COL[0-4] (ID, IdEvent, Nama, Deskripsi, Urutan).
  - `DataVoting`: COL[0-6] (ID, IdEvent, IdFoto, IdKategori, GuestId, GuestNama, VotedAt).
  - `DataPengaturanGlobal`: COL[0-2] (Kunci, Nilai, Keterangan) mencakup `app_title`, `app_logo_url`, `app_phone`, `app_instagram`, `admin_user`, `admin_pass`, `admin_pin`, `user_accounts`, `default_max_foto`, `default_max_vote`, `master_drive_folder_id`.
- **Logika Bisnis Berjalan:**
  - Manajemen Multi-Event & Aktivasi Satu-Klik: Daftar event tampil rapi di panel admin dengan tombol "✏️ Edit Acara" dan tombol "⭐ Aktifkan Event Ini". Saat diaktifkan, event tersebut langsung menjadi acara utama publik.
  - Reset Sesi Tamu Otomatis saat Ganti Acara: Ketika admin mengaktifkan acara baru, sesi tamu publik direset seketika sehingga pengunjung diarahkan ke Screen 1 ("NAMA PANGGILAN KAMU") untuk acara tersebut.
  - Isolasi Mandiri 100% Galeri & Voting: Setiap event memiliki riwayat foto (`snapevent_photos_${id}`) dan voting like (`snapevent_voted_photos_${id}`, `snapevent_voted_categories_${id}`) tersendiri tanpa pernah bercampur dengan acara lain.
  - Strict URL Gatekeeper: Tamu yang mencoba mengetikkan parameter `?event=ID_INAKTIF` secara manual akan langsung diblokir dan ditampilkan layar informatif `#viewEventClosed` ("Acara Tidak Aktif / Telah Berakhir") beserta tombol kembali ke acara aktif.
  - Proyektor Panggung Megah (Grand Ballroom Slideshow): Foto diperbesar mengisi 82-84% tinggi layar proyektor dengan lapisan dinamis Ambient Glow Blur (`#slideshowBackdropImg`) yang merefleksikan nuansa warna foto aktif (mengeliminasi kehampaan latar hitam pekat), serta Stasiun Scan QR Raksasa fisik (176–192 px) beresolusi tajam 500px (`getQrImageUrl(url, 500)`).
  - Selector Filter Floating Bar di Dalam Viewfinder: Bilah pemilih filter (RAW, 800T, Warm Sun, B&W) terintegrasi melayang (*glassmorphism floating pill*) di dalam frame kamera tanpa memakan ruang vertikal.
  - Unggah dari Galeri HP di Samping Shutter: Tombol galeri elegan di samping tombol shutter memungkinkan tamu memilih dan mengunggah foto langsung dari penyimpanan galeri ponsel.
  - Alur Pemilihan Frame Bersih: Penggantian bingkai difokuskan pada modal review pasca-jepret, menghilangkan gesture swipe pada kamera aktif untuk mencegah perubahan frame yang tidak disengaja.
  - Penyimpanan Foto Resilient & Sinkronisasi Drive: Setiap foto yang diambil atau diunggah langsung tersimpan ke galeri lokal (`STATE.photos` + `localStorage`) dan secara otomatis diunggah ke folder Google Drive acara melalui backend GAS.
  - Slideshow Responsif (Mobile vs Desktop PC): Pada layar ponsel, menu slideshow menyediakan tombol "📲 Bagikan Acara" (Web Share API / QR Modal), sementara pada layar desktop/proyektor ballroom menampilkan QR Code fisik beresolusi tinggi dengan foto yang membesar maksimal (`max-h-[92vh] max-w-[96vw]`).
  - Persistensi Halaman saat Refresh (F5): Rute tampilan aktif disimpan di `sessionStorage`, sehingga tamu maupun admin tidak terlempar ke layar awal saat browser dimuat ulang.
  - Interaksi Pemenang Voting (Click-to-Zoom): Seluruh area kartu podium Juara 1 Emas 🥇, Juara 2 Perak 🥈, dan Juara 3 Perunggu 🥉 dapat diklik untuk memperbesar gambar foto lengkap dengan ucapan dan jumlah perolehan suka.
  - Alur Kamera-First & Navigasi Tamu Terbuka (Unlocked Flow): Tamu yang pertama kali membuka web app langsung diarahkan ke layar kamera (`viewCamera`) dengan live viewfinder dan retro filter siap jepret seketika tanpa terhalang form nama di awal. Halaman tulis nama (`viewWelcome`) dapat diakses via navigasi bawah "Profil Tamu" atau saat menyimpan foto, dengan akses penuh tanpa batas ke menu Galeri & Voting juara.
  - Voting Ketat 1x per Kategori: Tamu hanya diperbolehkan memberikan 1 vote per kategori, divalidasi ganda di sisi frontend dan backend GAS.
  - Multi-User Management & Ganti Password: Menu admin dilengkapi modal tambah akun pengguna (Admin / Operator Kru) dan modal mandiri ganti password dengan validasi password lama yang tersinkronisasi ke Google Sheets.
  - Alur Pembuatan Acara Baru yang Bersih: Tombol "+ Buat Event Baru" mereset formulir dan menghasilkan ID unik baru (`EVT-YYYYMM-XXX`), mendaftarkan ke daftar acara dan menyinkronkan data ke backend.
  - Integrasi Google Drive Cerdas: Ekstraksi otomatis ID folder dari URL lengkap Drive, upload Base64 dengan header CORS aman (`text/plain;charset=utf-8`).
  - Multi-User Login & Branding Kustom: Mendukung penambahan akun operator/kru, kustomisasi nama brand aplikasi, unggah logo kustom, serta nomor WhatsApp & Instagram kontak resmi.
- **Log Pembaruan Resmi:**
  - [2026-11-14] Rilis v1.6.8: Zero Ghost Photos Sync (eliminasi total samplePhotos saat server kosong, pemangkasan seketika kartu foto terhapus di Drive, filter server-side isTrashed() di code.gs), Full HD 1080p Pure Sensor Capture (orientasi responsif tanpa OverconstrainedError), Preservasi Aspek Rasio Bingkai Kustom Dinamis (Anti-Gepeng pada rasio 3:4, 4:5, 9:16), dan Unggah Bingkai Kustom Otomatis ke Cloud Server Google Drive (Client-side PNG Optimization & Persistensi Multi-User Antar-Perangkat).
  - [2026-11-14] Rilis v1.6.7: Grand Ballroom Slideshow True Dead-Center Stage, Live Cam Frame Bar & Preview Sync, Google Drive Folder Deduplication, Desain Kamera 1 Layar Penuh 100dvh Bebas Tumpang Tindih, dan Category Voting Winners Podium.
  - [2026-11-14] Rilis v1.6.6: Full HD 1080p Photo Engine, Asynchronous Non-Blocking Background Upload, Target Google Drive Folder Routing, dan Modal Dialog Interaktif Pemilihan Kategori Voting (1x per kategori per user).
  - [2026-11-14] Rilis v1.6.5: HD live camera capture constraints, dual storage direct-to-device auto-save, asynchronous frame image preloader, dan eliminasi total bug fallback frame.
  - [2026-11-09] Rilis v1.5.1: Custom Backend & Master Drive Seeded Permanently (penanaman paten URL Web App GAS `https://script.google.com/macros/s/AKfycbxg-Owg7BrEqx4KHDI7UsLBX88ejLXcVxgQuSZNtz8d0rIJ_wCGVQFsOzpKGDO8w8cOrw/exec` dan Master Drive ID `12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw` di `setup.gs`, `code.gs`, `app.js`, dan `index.html` dengan proteksi fallback reset demo data, zero regression terhadap fitur lainnya).
  - [2026-11-09] Rilis v1.5.0: Permanent Cloud Bridge & Verified Google Drive Sync (penyematan paten URL Web App GAS aktif `https://script.google.com/macros/s/AKfycbxg-Owg7BrEqx4KHDI7UsLBX88ejLXcVxgQuSZNtz8d0rIJ_wCGVQFsOzpKGDO8w8cOrw/exec` dan Master Drive ID `12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw` pada `app.js` & `code.gs`, penguatan status feedback upload Drive transparan di `handleSavePhotoToDrive()`, auto-hydration judul 'SnapEvent Enterprise Studio', serta pemulihan total sinkronisasi foto galeri lintas-browser tanpa refresh manual).
  - [2026-11-09] Rilis v1.4.9: Camera-First Entry & Unlocked Guest Navigation (pengunjung pertama kali langsung membuka layar kamera `viewCamera` siap jepret, navigasi bawah `#bottomNavBar` terbuka bebas di halaman tulis nama `viewWelcome` untuk berpindah ke Galeri & Voting kapan saja, penambahan tombol pintas `#btnWelcomeGoGallery`, dan integrasi prompt nama ramah otomatis saat menyimpan foto ke Drive).
  - [2026-11-08] Rilis v1.4.8: Hotfix Kritis Responsivitas Menu (eliminasi duplikasi deklarasi `urlParams` di `initApp` yang memicu browser menolak parsing JS, pemulihan 100% seluruh event listener tombol, navigasi, dan menu).
  - [2026-11-08] Rilis v1.4.7: Omni-Device Persistent Cloud Sync (penyematan ID folder Google Drive resmi `12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw` sebagai default manifest di `app.js` dan seed di `setup.gs`, auto-hydration konfigurasi cloud dari sheet `DataPengaturanGlobal` ke `localStorage` pada setiap perangkat baru, Smart QR & Share URL Bridge yang membawa token cloud `?gas=...`, serta Realtime Cloud Heartbeat 45 detik untuk sinkronisasi otomatis proyektor dan HP tamu tanpa refresh manual).
  - [2026-11-08] Rilis v1.4.6: Penguatan Sinkronisasi Multi-Perangkat & Proteksi Cloud Config (validasi eksplisit saat Simpan Konfigurasi tanpa GAS URL, perbaikan mapping 17 kolom pada `handleAdminSaveEvent` di `code.gs`, perbaikan penargetan event ID dinamis pada `saveAdminEventForm`, dan safeguarding `handleAdminUpdateGlobalConfig`).
  - [2026-11-08] Rilis v1.4.5: Onboarding GAS URL Terpadu (dukungan prompt input instan satu-klik saat tombol '🔄 Sinkronkan Data GAS' ditekan sebelum URL tersimpan, dilengkapi transisi otomatis ke tab Pengaturan Global dengan glowing highlight pada field input target).
  - [2026-11-08] Rilis v1.4.4: Penyediaan 5 Data Dummy Master Lengkap beserta relasi bisnis (kategori voting, foto sampel realistis, suka, dan riwayat suara) di `setup.gs`, implementasi ERP Mode (`modeERP_ResetDanIsiDataDummy()`) dengan Custom Google Sheets Menu (`🚀 SnapEvent ERP` via `onOpen()`) dan dialog konfirmasi aman, penyempurnaan skema Enterprise Multi-Role, serta sinkronisasi otomatis daftar multi-event dua arah antara Google Sheets dan browser admin.
  - [2026-11-08] Rilis v1.4.3: Engine Sinkronisasi Multi-Event Lengkap (penyediaan endpoint `getAllEvents`, penambahan baris `allEvents` pada seluruh respon event GAS, fungsi otomatis `syncEventsFromBackend()`, tombol `🔄 Sinkronkan Data GAS` di panel admin, serta eliminasi batasan penarikan event tunggal).
  - [2026-11-08] Rilis v1.4.2: Manajemen multi-event terintegrasi (daftar event, edit, dan tombol aktivasi satu-klik), auto-reset identitas tamu ke Screen 1 saat ganti event, isolasi total data foto & voting per event (zero cross-contamination), URL guard proteksi acara inaktif (`#viewEventClosed`), serta transformasi visual Slideshow Proyektor Ballroom (upscaling foto 84vh, ambient backdrop glow blur anti-hitam kosong, dan Stasiun Scan QR resolusi 500px).
  - [2026-11-08] Rilis v1.4.1: Pemulihan tuntas parsing JavaScript (eliminasi fatal SyntaxError orphan brackets), penguatan header anti-CORS pada seluruh panggilan POST Google Apps Script (`adminLogin`, `adminSaveEvent`, `adminToggleReveal`), serta penyematan fitur "⚡ Tes Koneksi & Sinkronisasi" di panel Admin.
  - [2026-11-08] Rilis v1.4.0: Filter floating bar di dalam viewfinder, tombol unggah foto galeri ponsel di samping shutter, kembalikan pemilihan bingkai ke modal review foto, jaminan simpan galeri + Google Drive, slideshow responsif (Mobile Share vs Desktop PC Proyektor berskala maksimal), persistensi halaman saat refresh browser (F5), dan interaksi zoom foto pemenang podium.
  - [2026-11-08] Rilis v1.3.0: Live preview filter kamera real-time, auto-open camera stream, zero-scroll 1-page layout, pemilihan bingkai pasca-foto di modal review, pembatasan voting 1x per kategori, info uploader & pesan di slideshow proyektor, upload Google Drive anti-CORS, dan kustomisasi logo/branding serta multi-user login.
  - [2026-11-08] Rilis v1.2.0: Restrukturisasi modular untuk repositori GitHub (`index.html`, `style.css`, `app.js`), perbaikan tuntas SyntaxError penyebab menu macet, dan pengujian engine Chromium tanpa error.
  - [2026-11-08] Rilis v1.1.0: Menerapkan login username/password, persistensi sesi admin, unggah custom frame PNG per-event, pengaturan folder Google Drive eksplisit, dan perbaikan tuntas masalah pratinjau foto hitam.
  - [2026-11-08] Rilis v1.0.0: Seluruh kode inti frontend, backend GAS, frame generator, integrasi Drive, galeri poling, dan mode live slideshow proyektor berhasil diimplementasikan penuh.

