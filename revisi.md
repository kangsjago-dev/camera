# RENCANA REVISI & DIAGNOSIS SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.3.5
STATUS: SELESAI DITERAPKAN (VERSION 2.3.5)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 24 November 2026
================================================================================

## 1. RINGKASAN TINDAKAN v2.3.5

1. **Implementasi Lencana Logo Tengah pada Seluruh QR Code Acara (`app.js`):**
   - Mendeklarasikan helper `normalizeDriveDirectUrl(rawUrl)` yang mengekstrak Google Drive ID dari link berbagi `/file/d/...`, `open?id=...`, `uc?id=...`, maupun raw ID, lalu mengonversinya ke stream CDN langsung `https://lh3.googleusercontent.com/d/{fileId}`.
   - Membangun renderer kanvas `drawCenterLogoBadge(ctx, size, logoImgObj)`:
     * Menggambar lencana squircle putih bersih dengan bayangan lembut dan bingkai emas mewah `#D4AF37`.
     * Jika link logo kustom Google Drive disetel di Settingan Global (`cfgAppLogoUrl`), logo tersebut digambar dengan presisi di tengah lencana.
     * Jika link kustom belum disetel (atau gagal memuat), otomatis merender **Insignia Kamera Emas SnapEvent Vektor** (gradien `#F3E5AB` ke `#D4AF37` dengan ring lensa emas dan pupil).
     * **Hasil:** QR Code pada Kartu Sambutan (`#welcomeQrImg`), Modal Bagikan (`#shareQrImg`), Unduhan HD (`#btnWelcomeDownloadQr` / `#btnDownloadQrCode`), dan Slideshow Ballroom (`#slideshowQrImg`) **100% selalu berlogo elegan di tengah dan tidak pernah polos**.

2. **Perbaikan Tautan Modal Share Mengikuti Nama / Slug Acara (`app.js` & `code.gs`):**
   - Memperbarui `getEventShareUrl(eventOrId)` menjadi polimorfik: menerima objek acara maupun string ID.
   - Mengonversi nama acara seperti `"Tommy & Natasha"` menjadi slug URL bersih tanpa spasi atau karakter ganda: `"tommy-natasha"`.
   - Mengubah pemanggilan di `openShareQrModal(ev)` dan kartu sambutan agar mengirim objek event lengkap sehingga input URL modal **100% selalu berakhiran `?event=tommy-natasha`**.
   - Menyempurnakan resolusi `getResolvedEventId` di frontend dan `handleGetEventDetails` di `code.gs` agar pencocokan event berbasis slug dua arah berjalan mulus.

3. **Pembaruan Versi Aset (`index.html`):**
   - Menyelaraskan query string cache ke `v=2.3.5`.

4. **Verifikasi Teknis & Zero Regression:**
   - Telah diaudit menggunakan `node --check app.js` (Exit Code 0).
   - Telah diuji dengan script uji eksekusi headless (Normalisasi URL Google Drive, resolusi slug nama acara, dan mapping event ID terverifikasi 100% valid).
