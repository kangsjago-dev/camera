# RENCANA REVISI & PENYEMPURNAAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.3.3
STATUS: SELESAI DITERAPKAN (VERSION 2.3.3)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 24 November 2026
================================================================================

## 1. RINGKASAN TINDAKAN v2.3.3

1. **Perbaikan Tuntas Tambah Event Baru (`code.gs`):**
   - Menambahkan blok penanganan `else` saat `targetRow === -1` pada fungsi `handleAdminSaveEvent()` di `code.gs`.
   - Ketika admin membuat event baru dari antarmuka web, berkas backend kini secara otomatis mengeksekusi `eventSheet.appendRow(...)` lengkap dengan 17 kolom parameter event sehingga event baru tersimpan permanen ke tab `DataEvent` di Google Sheets.

2. **Engine Komposit QR Code dengan Logo di Titik Tengah (`app.js`):**
   - Mengimplementasikan fungsi komposit berbasis canvas `generateQrWithLogo()` dan `setQrWithLogoToElement()`.
   - Menggunakan Error Correction Level **H (High - 30% Redundancy)** sehingga pola QR code tetap 100% terbaca tajam dan akurat oleh kamera smartphone meskipun bagian tengahnya disematkan logo.
   - Logo diambil dari Pengaturan Global (`cfgAppLogoUrl`) yang tersimpan di Google Drive dan dinormalisasi menjadi direct CDN image (`https://lh3.googleusercontent.com/d/{ID}`).
   - Logo digambar di atas badge putih *squircle* berbalut aksen border emas mewah (`#D4AF37`) di tengah QR.
   - Terintegrasi penuh pada:
     * Layar Sambutan Tamu (`#welcomeQrImg`)
     * Modal Pop-up QR Acara Admin (`#modalQrImage`)
     * Layar Proyektor Panggung Ballroom (`#slideshowQrImg`)
     * Tombol Unduh QR Resolusi Tinggi 1000px HD (`#btnWelcomeDownloadQr` & `#btnDownloadQrCode`)

3. **Alamat Tautan & QR Mengikuti Nama Event di Akhir Link (`app.js`):**
   - Memperbarui fungsi `getEventShareUrl(eventId)` agar menyematkan nama/slug acara target:
     `${baseUrl}?event=${targetSlug}` (contoh: `https://camera.runway.my.id?event=tommy-natasha`).
   - Tautan tidak lagi polosan, dan ketika dibuka atau dipindai tamu, aplikasi otomatis mengenali dan membuka acara tersebut.

4. **Eliminasi Total Fallback Hardcode Demo (`app.js`):**
   - Mengosongkan data dummy `MOCK_DATA` (Sarah & Kevin, Hans & Yurike, dan sample photos).
   - Menghapus penimpaan nama hardcode pada `revalidateFromBackend()` dan injeksi sample photos pada `loadGallery()`.
   - Seluruh daftar acara dan galeri foto kini 100% murni dan realtime ditarik langsung dari database Google Sheets.

5. **Komitmen Zero-Regression:**
   - Seluruh fitur live camera, kontrol zoom 1x-3x, filter grading, kuota jepretan, upload Google Drive, dan docking tombol tetap dipertahankan 100% utuh tanpa gangguan.
