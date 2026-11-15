# RENCANA REVISI & PENYEMPURNAAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.3.2
STATUS: SELESAI DITERAPKAN (VERSION 2.3.2)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 16 November 2026
================================================================================

## 1. RINGKASAN TINDAKAN v2.3.2 (AKSES RESMI www.runway.my.id/cam)
1. **Universal Base Path Resolver di `<head>` `index.html`:**
   - Menambahkan skrip sinkron pada baris teratas `<head>`:
     ```html
     <script>
       (function() {
         try {
           var p = window.location.pathname || '';
           var baseHref = (p.indexOf('/cam') !== -1) ? '/cam/' : '/';
           document.write('<base href="' + baseHref + '">');
         } catch (e) {}
       })();
     </script>
     ```
   - Mengunci resolusi berkas aset `style.css` dan `app.js` ke `/cam/` saat diakses via `https://www.runway.my.id/cam`.
   - Mengeliminasi total masalah 404 NOT FOUND pada aset CSS & JS peramban.

2. **Dual-Layer Defensive Asset Loading:**
   - Menyematkan handler `onerror` defensif pada tag `<link rel="stylesheet">` dan `<script defer>` agar peramban mobile secara otomatis mencoba kembali memuat aset dari `/cam/style.css` dan `/cam/app.js` bila terjadi kendala jaringan.

3. **Sinkronisasi Tautan & QR Code Acara:**
   - Menyelaraskan fallback `getEventShareUrl()` di `app.js` ke `https://www.runway.my.id/cam` sehingga seluruh tautan yang digenerate oleh sistem ramah terhadap alamat `/cam`.

4. **Komitmen Zero-Regression:**
   - Fitur kamera analog live, kontrol zoom 1x-3x, filter grading, kuota jepretan, upload Google Drive, galeri tamu, dan pengaturan admin Google Sheets dipertahankan 100% utuh tanpa gangguan.
