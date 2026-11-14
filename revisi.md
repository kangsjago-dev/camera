# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SIAP DITERAPKAN (HOTFIX & COMPREHENSIVE REVISION v1.9.0)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.9.0 (Full HD Capture 1-3MB, Vercel & GitHub Dual Support, Non-Blocking Background Upload, Smart Drive Folder & Category Voting)
================================================================================

## 1. URUTAN PENGERJAAN SECARA BERURUTAN (DARI ATAS SAMPAI BAWAH)

Berikut adalah urutan teknis pelaksanaan rekayasa secara runtut dan sistematis:

---

### **TAHAP 1: INFRASTRUKTUR & DEPLOYMENT GANDA (GITHUB & VERCEL)**
1. **Dukungan Vercel & GitHub (`vercel.json`)**:
   - Menyediakan berkas konfigurasi `vercel.json` di root workspace agar projek dapat langsung di-deploy di Vercel maupun GitHub Pages secara berdampingan tanpa bentrok routing atau CORS.

---

### **TAHAP 2: KAMERA & TANGKAPAN FOTO FULL HD (1 MB - 3 MB)**
2. **Kualitas Foto Full HD (1080p / 1920x1080 atau 1080x1350) 1 MB – 3 MB**:
   - Memastikan resolusi canvas Full HD 1080x1350 (potret 4:5) / 1080x1920 dengan `imageSmoothingQuality = 'high'`.
   - Mengoptimalkan kompresi JPEG 0.98 dan menyematkan sampling granulasi analog halus (`ensureJpegMinimumSize`) agar ukuran file output foto secara konsisten berada dalam rentang **1 MB hingga 3 MB** (tidak lagi puluhan/ratusan KB).
3. **Penyelarasan Rasio Aspek Bingkai Custom (Anti-Gepeng)**:
   - Kalkulasi rendering overlay bingkai kustom PNG (`renderCustomFrameOverlay`) disesuaikan secara proporsional sesuai rasio canvas 4:5, mengeliminasi efek distorsi/gepeng.
4. **Pilihan Bingkai Custom di Viewfinder Live Cam**:
   - Mengaktifkan `#frameListContainer` di live cam dengan pill selektor ber-thumbnail gambar asli dari bingkai kustom acara, sehingga tamu dapat memilih dan melihat pratinjau bingkai kustom langsung sebelum memotret.
   - Mode *Single Lock Frame* secara otomatis mengunci dan menerapkan bingkai resmi yang ditentukan admin.
5. **Penataan Ulang UI Live Cam (Anti Saling Menutupi)**:
   - Memberikan padding bawah yang memadai (`pb-20` / safe-area padding) pada `#viewCamera` agar tombol shutter (`#btnShutter`), tombol buka galeri HP (`#btnOpenGalleryUpload`), dan tombol switch kamera (`#btnSwitchCamera`) tidak lagi tertutupi oleh navigasi bawah (`#bottomNavBar`).

---

### **TAHAP 3: LATAR BELAKANG PENGUNGGAHAN (NON-BLOCKING BACKGROUND UPLOAD) & DUAL STORAGE**
6. **Upload Non-Blocking di Latar Belakang**:
   - Tamu menekan tombol "Simpan ke Rol" -> foto seketika diunduh ke memori ponsel tamu (`downloadPhotoToDevice`) dan dimasukkan ke galeri web app lokal (*optimistic update*).
   - Modal preview foto langsung ditutup sehingga tamu dapat seketika mengambil foto berikutnya tanpa menunggu selesainya proses upload Google Drive.
   - Pengunggahan ke cloud berjalan di latar belakang (*background queue*) secara senyap.
7. **Pemberantasan Duplikasi Foto (1x Snap = 1 File di Google Drive)**:
   - Menerapkan penguncian ID unik (`IN_FLIGHT_PHOTO_UPLOADS`) berbasis token jepretan sebelum proses upload dikirim ke server.
   - Di backend GAS, dilakukan pengecekan ID foto agar 1 jepretan tidak pernah membuat file dobel di Google Drive.

---

### **TAHAP 4: GOOGLE DRIVE & GOOGLE APPS SCRIPT CLOUD INTEGRATION**
8. **Penyimpanan Foto Tepat ke Subfolder Acara (Eliminasi Folder Kosong Dobel)**:
   - Di `code.gs`: Fungsi `getOrCreateEventFolder()` menggunakan pencarian folder berbasis nama/slug acara di bawah folder master `SnapEvent_Gallery_Master`. Jika folder acara sudah ada, folder tersebut langsung dipakai ulang. **Dilarang keras membuat folder baru jika folder dengan nama yang sama sudah ada**.
   - Seluruh foto acara otomatis disimpan ke dalam folder acara yang benar (`ilham---sherwin`).
9. **Unggah Bingkai Kustom ke Google Drive Server**:
   - Saat admin memilih bingkai kustom di tab Pengaturan Acara, file gambar diunggah ke Google Drive master folder melalui backend GAS (`action: "uploadCustomFrame"`), menghasilkan direct view URL Google Drive, dan disimpan ke Google Sheets `DataEvent`.
   - Menghapus bingkai kustom lama saat yang baru diunggah agar di Google Drive hanya terdapat 1 file bingkai per acara.
   - Seluruh perangkat tamu otomatis menarik URL bingkai yang sama dari server Google Sheets.
10. **Sinkronisasi URL Web App GAS Lintas Perangkat**:
    - URL Web App GAS disimpan di Google Sheets tab `Config` (`gas_webapp_url`). Saat admin menyimpan URL baru, seluruh perangkat tamu yang mengakses web app otomatis memperbarui endpoint backend mereka.
11. **Pembersihan File yang Telah Dihapus di Google Drive (Purge Dead Photos)**:
    - Di `code.gs`, fungsi `handleGetGallery()` memeriksa keberadaan file di Google Drive. Baris untuk file yang sudah dihapus dari Drive (`023` & `024`) otomatis dihapus dari sheet `DataFoto`.
    - Di frontend, handler `img.onerror` langsung menghapus kartu hitam pekat dan memanggil `markPhotoAsDead()` agar galeri tidak menampilkan kotak hitam pekat.
12. **Auto-Ingest Foto Drive yang Belum Tercatat**:
    - File foto yang diunggah ke Google Drive (seperti `032_Budi.jpg` dan `033_Budi.jpg`) otomatis dideteksi oleh backend `handleGetGallery()` dan dimasukkan ke galeri acara.

---

### **TAHAP 5: SISTEM VOTING & PODIUM PEMENANG**
13. **Sistem Voting Berbasis Kategori (1 Tamu = 1 Suara Per Kategori)**:
    - Saat menekan tombol ❤️ pada foto di galeri, muncul modal pemilihan kategori (misal: *Best Outfit*, *Pose Terheboh*, *Momen Terbaper*).
    - Tamu hanya dapat memilih 1 kali untuk masing-masing kategori. Kategori yang sudah dipilih ditandai nonaktif ("Sudah Memilih").
    - Menghapus label "Sisa Suara: 3" yang membingungkan tamu dari antarmuka galeri.
14. **Tampilan Galeri Berdasarkan Kategori Voting (Hanya Foto Ber-Suara)**:
    - Ketika tab kategori voting diklik (misal: "👑 Best Outfit"), galeri HANYA menampilkan foto-foto yang telah menerima vote untuk kategori tersebut, diurutkan dari like terbanyak.
15. **Podium Pemenang & Kustomisasi Gelar Juara Khusus Admin**:
    - Tampilan "🏆 Pemenang Voting" menyediakan filter: **🌟 Semua**, **🏆 Juara Umum**, dan **👑 Per Kategori**.
    - Admin dapat mengedit kata gelar juara (Juara 1 Emas, Juara 2 Perak, Juara 3 Perunggu) melalui menu pengaturan di tab Admin.

---

### **TAHAP 6: LIVE BALLROOM STREAM (LAYAR PROYEKTOR PESTA)**
16. **Penyelarasan Tampilan Slideshow Proyektor**:
    - Foto diatur tepat di tengah layar (*center aligned*), tidak terdorong terlalu ke atas.
    - Ukuran foto proporsional dengan bingkai emas mewah, nama pengunggah, caption, QR Code 500px tajam di pojok bawah, dan transisi halus.

---

### **TAHAP 7: SINKRONISASI REALTIME & PEMBERSIHAN DATA OFFLINE**
17. **Auto-Refresh Galeri Tanpa Reload Halaman (Polling Realtime)**:
    - Polling otomatis setiap 5 detik saat membuka tab galeri atau slideshow proyektor untuk menarik foto dan perolehan suara terbaru dari tamu lain.
18. **Tombol "Bersihkan Cache & Sync Cloud" di Admin**:
    - Menghapus seluruh cache lokal usang (`localStorage`) dan memuat data murni dari Google Sheets & Drive agar seluruh perangkat memiliki tampilan yang 100% sinkron.

================================================================================
## 2. FILE TERDAMPAK
1. `vercel.json` (Baru: Konfigurasi static hosting & routing Vercel)
2. `index.html` (Penyesuaian tata letak live cam, eliminasi Sisa Suara: 3, frame pill selector, centering ballroom stream)
3. `style.css` (Full-bleed viewfinder, responsivitas kontrol kamera, centering proyektor)
4. `app.js` (FHD 1-3MB, non-blocking upload, modal vote kategori, podium custom title, filter kategori)
5. `code.gs` (Anti-duplikasi folder Drive, single-lock custom frame upload, sanitasi sel 45k, purge dead photos)
6. `prd.md` (Update Master Context)
================================================================================
