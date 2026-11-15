# RENCANA REVISI & PENYEMPURNAAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.2.8
STATUS: SELESAI DITERAPKAN (VERSION 2.2.8)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 15 November 2026
================================================================================

## 1. LATAR BELAKANG & TUJUAN REVISI
Berdasarkan instruksi pengguna dan 4 tangkapan layar (screenshot) yang dilampirkan, sistem perlu disempurnakan pada 5 fokus utama:
1. **Presisi Bingkai Live Cam & Hasil Jepretan Kanvas (Tanpa Ubah Ukuran Bingkai):** Menghilangkan distorsi vertikal/horizontal pada live camera dan menjaga ukuran/proporsi asli bingkai kustom PNG 100% utuh tanpa dipotong atau diubah skalanya. Menata tombol zoom/filter agar tidak menutupi nama pengantin di banner bawah bingkai.
2. **Desain Menarik Kartu QR Code & Suite Tombol Aksi (viewWelcome):** Memperbesar QR Code dan mempercantik tombol Bagikan Link, Unduh QR Meja HD 1000px, dan Salin Link QR dengan sentuhan luxury gold VIP aesthetic.
3. **Perbaikan Multi-Frame Selection (Pilih 1 Saja atau 2 Bingkai):** Memperbaiki bug over-matching pada `isCustomMatch` yang membuat bingkai kustom global tercentang otomatis, serta mengizinkan admin memilih bebas 1 bingkai, 2 bingkai, atau lebih dalam mode Multi-Frame.
4. **Eliminasi Total Duplikasi Upload Foto (2x Upload Google Drive Saat Pindah App):** Mencegah pemicu upload ganda ketika pengguna beralih aplikasi saat foto sedang disimpan ke Google Drive melalui penerapan idempotency key `clientPhotoId` dan proteksi throttle di frontend & backend.
5. **Fitur Baru Menu "Foto Panggung" (Sync Google Drive, Custom Label, Custom Link, Admin Toggle):** Menyediakan menu galeri khusus foto panggung/vendor yang disinkronkan langsung dari Google Drive dengan label nama dan link yang dapat dikustomisasi, serta dapat diaktifkan/dinonaktifkan oleh admin.
6. **100% Online Cloud Sync:** Seluruh konfigurasi tersimpan aman di Google Sheets `DataPengaturanGlobal` (`globalConfig`).

---

## 2. ANALISIS AKAR MASALAH & RANCANGAN TEKNIS PER POIN

### A. Presisi Bingkai Live Cam & Hasil Jepretan (Zero-Distortion & Zero-Crop)
* **Akar Masalah:**
  1. Kontainer `#viewfinderViewport` memiliki dimensi dinamis flexbox layar HP. Penggunaan `object-fill` pada `#vfCustomFrameImg` memaksakan gambar bingkai meregang/tergencet (squashed) mengikuti dimensi layar perangkat alih-alih mempertahankan aspect ratio aslinya.
  2. Floating control zoom (`1x 2x 3x`) dan filter (`RAW`, `800T Cine`, dll) berada di `bottom-10` dan `bottom-2` di dalam viewport, tepat menutupi tulisan nama pengantin, tanggal, dan logo pada banner bawah bingkai kustom.
  3. Pada kanvas rendering (`processPhotoWithFrameAndFilter`), ukuran kanvas di-hardcode ke 1080x1350 sehingga jika bingkai memiliki rasio atau resolusi berbeda, bingkai dipaksa berubah ukuran.
* **Solusi Rekayasa:**
  1. Buat kontainer proporsional `#viewfinderFrameContainer` di dalam viewport dengan `aspect-ratio` yang secara dinamis mengikuti proporsi asli bingkai aktif (`frameImg.naturalWidth / frameImg.naturalHeight` atau rasio standar 4:5).
  2. Gambar bingkai `#vfCustomFrameImg` ditampilkan dengan `w-full h-full object-contain` sehingga bingkai tampil 100% proporsional, tajam, dan tidak terdistorsi.
  3. Video live feed kamera `<video id="cameraVideo">` mengisi kontainer yang sama persis dengan `object-cover`.
  4. Pindahkan floating zoom dan filter selector agar lebih ramping dan tidak menutupi area teks/banner bawah bingkai (misal: diletakkan di atas shutter bar atau dibuat melayang rapi di atas area banner bingkai).
  5. Pada kanvas `processPhotoWithFrameAndFilter`, dimensi kanvas diatur mengikuti dimensi asli bingkai (`canvas.width = frameImg.naturalWidth || 1080; canvas.height = frameImg.naturalHeight || 1350;`). Bingkai digambar 100% 1:1 pixel-perfect: **JANGAN DIUBAH UKURAN FRAMENYA**.

---

### B. Penyempurnaan Tampilan Kartu QR Code & Tombol Aksi (viewWelcome)
* **Akar Masalah:** Pada layar sambutan tamu, kotak QR Code saat ini berukuran sekitar 112px–128px dan tombol aksi terlihat sederhana dalam satu kolom samping.
* **Solusi Rekayasa:**
  1. Perbesar kotak QR Code menjadi 160px–180px dengan bingkai emas berornamen (*luxury gold border*), bayangan ambient glow (`shadow-brand-gold/20`), dan indikator scan yang elegan.
  2. Tata ulang 3 tombol aksi di sampingnya:
     * 📲 **Bagikan Acara**: Desain tombol gradasi emas berkilau (*gold gradient*), icon share modern, efek hover halus.
     * ⬇️ **Unduh QR Meja (HD 1000px)**: Desain dark glass luxury dengan badge "Siap Cetak Banner/Meja".
     * 📋 **Salin Link Acara**: Aksen garis emas transparan dengan feedback toast langsung.
  3. Berikan sentuhan tipografi elegan bernuansa VIP Wedding.

---

### C. Pemulihan Seleksi Multi-Frame (Pilih 1 atau 2 Bingkai Bebas)
* **Akar Masalah:**
  1. Logika `isCustomMatch` di `app.js` mengevaluasi semua bingkai bertipe `'custom'` sebagai cocok dengan `'CUSTOM_EVENT'`. Akibatnya, ketika satu frame kustom acara dicentang, bingkai kustom global ("Wedding Gold Arch PNG") ikut otomatis tercentang.
  2. Di `code.gs` baris 470 & 591, terdapat logika otomatis yang mengubah mode menjadi `fMode = "single"` jika array frame hanya berjumlah 1.
* **Solusi Rekayasa:**
  1. Perbaiki `isCustomMatch`: Setiap bingkai kustom diverifikasi secara ketat berdasarkan ID spesifiknya (`frame.id === id`). Event custom frame hanya cocok dengan `CUSTOM_EVENT` miliknya sendiri, dan global frame hanya cocok dengan ID-nya sendiri.
  2. Di `code.gs`, hapus pemaksaan `fMode = "single"` ketika mode yang dipilih admin adalah `"multi"`.
  3. Di `saveAdminEventForm()`, ambil seluruh checkbox yang dicentang secara akurat: Jika admin memilih 1 bingkai saja, simpan 1 bingkai; jika memilih 2 bingkai, simpan 2 bingkai; jika memilih semua, simpan semua.
  4. Tamu pada live camera hanya akan melihat pilihan bingkai yang dicentang oleh admin.

---

### D. Eliminasi 2x Upload Foto Kembar Saat Pengguna Beralih Aplikasi
* **Akar Masalah:**
  Saat proses upload foto berlangsung (membutuhkan waktu 3–6 detik), jika pengguna berpindah ke aplikasi lain (WhatsApp/Instagram) lalu kembali ke browser, event `window.onfocus` dan `document.visibilitychange` memicu `loadGallery()`. Karena in-memory set `IN_FLIGHT_PHOTO_UPLOADS` dapat ter-reset dan foto lokal masih berstatus `data:`, fungsi `autoUploadPendingPhotos` mendeteksi foto tersebut sebagai "belum diunggah" dan mengirimkan request upload kedua. Kedua request berhasil diproses oleh server sehingga menghasilkan 2 foto kembar di Google Drive dan Google Sheets.
* **Solusi Rekayasa:**
  1. **Idempotency Key di Frontend & Backend:** Setiap foto yang diambil diberi `clientPhotoId` unik permanen (contoh: `FTO-CLI-173167...`).
  2. **Cache Deduping di Backend (`code.gs`):** `CacheService` mencatat `clientPhotoId` selama 10 menit. Jika ada request kedua dengan `clientPhotoId` yang sama persis, backend langsung mengembalikan respon sukses dari upload pertama tanpa membuat file ganda di Google Drive atau baris ganda di sheet `DataFoto`.
  3. **Throttle di Frontend:** Catat waktu mulai upload (`uploadStartedAt: Date.now()`) di objek foto lokal. Fungsi `autoUploadPendingPhotos` dilarang mengunggah ulang foto yang waktu simpannya kurang dari 60 detik yang lalu.

---

### E. Menu Baru "Foto Panggung" (Stage Photos Gallery)
* **Kebutuhan Pengguna:**
  Menu khusus bernama "Foto Panggung" (nama dapat dikustomisasi) yang berisi galeri foto yang disinkronkan dari Google Drive. Tautan Google Drive dapat dikustomisasi, dan menu ini dapat diaktifkan/dinonaktifkan (tampil/sembunyi) oleh admin.
* **Solusi Rekayasa:**
  1. **Google Sheets (`DataPengaturanGlobal`):**
     * `stage_photos_enabled`: `"true"` atau `"false"` (default: `"false"`).
     * `stage_photos_title`: Nama label menu (default: `"Foto Panggung"`).
     * `stage_photos_link`: Tautan Google Drive folder atau link publik dokumentasi panggung.
  2. **Backend GAS (`code.gs`):**
     * Tambahkan handler `action: "getStagePhotos"`: membaca folder Google Drive berdasarkan folder ID dari `stage_photos_link`, mengekstrak file gambar (`.jpg`, `.jpeg`, `.png`, `.webp`), dan mengembalikan data foto (ID, nama file, URL thumbnail CDN `lh3.googleusercontent.com`, waktu dibuat).
  3. **Panel Admin (`viewAdmin` -> Pengaturan Global & Form Event):**
     * Sediakan kartu konfigurasi "🎪 Pengaturan Menu Foto Panggung":
       - Toggle Switch: Aktifkan Menu Foto Panggung (Tampil untuk Tamu).
       - Input Teks: Label Nama Menu (contoh: "Foto Panggung", "Official Stage Photos", "Galeri Dokumentasi").
       - Input URL: Tautan / Folder Google Drive Resmi.
       - Tombol: ⚡ Uji Tautan & Sinkronkan Foto Panggung.
  4. **Antarmuka Tamu (`index.html` & `app.js`):**
     * Jika `stage_photos_enabled === true`:
       - Tampilkan tombol navigasi baru di navigasi bawah `#bottomNavBar` (atau tab khusus di galeri) dengan label yang dikustomisasi admin.
       - Tampilkan layar `#viewStagePhotos`: Galeri foto panggung grid responsif dengan fitur perbesar (lightbox zoom) dan tombol aksi "Buka Folder di Google Drive ↗".
     * Jika `stage_photos_enabled === false`:
       - Menu dan seluruh elemen foto panggung otomatis tersembunyi sepenuhnya dari tamu.

---

## 3. BERKAS YANG AKAN DIMODIFIKASI
1. `index.html`:
   - Penataan ulang `#viewfinderFrameContainer` di `#viewCamera` agar aspect ratio terkunci presisi sesuai bingkai.
   - Reposisi floating zoom & filter bar agar tidak menghalangi banner nama pengantin di bawah bingkai.
   - Redesain kartu QR Code `#welcomeQrCard` (QR lebih besar & tombol aksi lebih menarik).
   - Penambahan layar tampilan baru `#viewStagePhotos` (Galeri Foto Panggung) & tombol nav `#navBtnStagePhotos`.
   - Penambahan kartu konfigurasi Menu Foto Panggung di tab Pengaturan Global panel admin.
2. `app.js`:
   - Penyesuaian `processPhotoWithFrameAndFilter` agar kanvas 100% mengikuti ukuran asli bingkai tanpa resize/crop.
   - Penyesuaian live cam aspect ratio dinamis pada `applyEventToUI()` dan `startCameraStream()`.
   - Perbaikan `isCustomMatch`, `renderAdminFrameSettings()`, dan `saveAdminEventForm()` untuk seleksi 1 atau 2 bingkai Multi-Frame.
   - Implementasi `clientPhotoId`, deduping token, dan throttle anti-2x upload pada `handleSavePhotoToDrive()` dan `autoUploadPendingPhotos()`.
   - Logika sinkronisasi, toggle, dan perenderan galeri foto panggung dari Google Drive (`loadStagePhotos()`).
3. `code.gs`:
   - Endpoint `action: "getStagePhotos"` untuk membaca daftar file foto panggung dari Google Drive.
   - Penguatan idempotency cache pada `handleUploadPhoto` berbasis `clientPhotoId` untuk mengeliminasi file kembar di Google Drive dan Google Sheets.
   - Perbaikan parsing `frames` agar tidak memaksa single mode jika admin memilih 1 frame dalam mode multi.
4. `prd.md`:
   - Pencatatan spesifikasi produk dan fitur resmi v2.2.8 pada zona bawah living context.

---

## 4. RENCANA PENGUJIAN & VALIDASI
1. **Uji Live Cam & Hasil Jepretan:** Buka kamera dengan bingkai kustom — pastikan bingkai tidak gepeng/tergencet, tombol zoom/filter tidak menutupi tulisan nama pengantin, dan hasil jepretan kanvas tercetak 100% presisi sesuai ukuran asli bingkai.
2. **Uji Kartu QR Code:** Periksa halaman sambutan — pastikan QR Code tampil besar, mewah, dan ketiga tombol aksi (Bagikan, Unduh QR HD 1000px, Salin Link) berfungsi mulus.
3. **Uji Seleksi 1 & 2 Bingkai:** Di menu Admin "Pilih & Atur Urutan Bingkai", centang hanya 1 bingkai atau hanya 2 bingkai lalu simpan — pastikan hanya bingkai yang dipilih yang tampil pada tamu.
4. **Uji Anti-Duplikasi Upload:** Ambil foto, saat indikator "Menyimpan..." muncul, segera minimize browser atau buka aplikasi lain selama 5 detik, lalu kembali ke browser — pastikan foto HANYA terunggah 1x (tidak pernah ada 2 foto kembar).
5. **Uji Menu Foto Panggung:** Aktifkan menu di admin dengan nama kustom dan tautan folder Google Drive — pastikan menu muncul di sisi tamu dan menampilkan foto-foto dari Google Drive dengan benar. Nonaktifkan menu — pastikan menu langsung tersembunyi dari tamu.

================================================================================
Rencana siap dieksekusi setelah pengguna memberikan persetujuan dengan mengetik:
"OKE TERAPKAN"
================================================================================
