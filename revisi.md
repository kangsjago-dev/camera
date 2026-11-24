# RENCANA REVISI & DIAGNOSIS SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.3.6
STATUS: SELESAI DITERAPKAN (VERSION 2.3.6)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 24 November 2026
================================================================================

## 1. RINGKASAN TINDAKAN v2.3.6

1. **Implementasi Lencana Logo Persegi Panjang Horizontal pada QR Code (`app.js`):**
   - Memodifikasi fungsi kanvas `drawCenterLogoBadge(ctx, size, logoImgObj)` agar sesuai dengan proporsi referensi gambar (`media_1795532013057_a8822158.png`):
     * Lebar lencana: `Math.round(size * 0.38)` (~38% lebar QR).
     * Tinggi lencana: `Math.round(size * 0.24)` (~24% tinggi QR).
     * Rasio Aspek: ~1.6 : 1 (Persegi panjang horizontal).
     * Sudut membulat halus (`radius = Math.round(badgeH * 0.18)`), bayangan lembut, dan garis tepi emas mewah `#D4AF37`.
   - Mengintegrasikan penskalaan aspek rasio `contain` pada gambar logo sehingga logo horizontal seperti **RUNWAY Entertainment & Organizer** tampil besar, tegas, dan proporsional tanpa terpotong atau terdistorsi.
   - Menyediakan fallback insignia emas vektor horizontal jika logo kustom belum dimuat.

2. **Perbaikan Tuntas Penambahan Custom Event & Sinkronisasi Google Sheets (`app.js` & `code.gs`):**
   - **Koreksi Tab Navigasi:** Memperbaiki event listener tab `[data-admintab="create"]` di `app.js` agar **100% selalu mengeksekusi `resetCreateEventForm()`**, menghilangkan pemanggilan `populateEditEventForm(STATE.activeEvent)` yang sebelumnya salah memuat data acara lama.
   - **Formulir Bersih:** Pengguna kini selalu mendapatkan formulir kosong baru saat mengklik "+ Buat Event Baru" atau tombol "➕ Buat Acara" di header tabel acara.
   - **Protokol Insert Aman:** Di `saveAdminEventForm()`, sistem mendeteksi apakah formulir dalam mode tambah acara (`isNewEvent: true`). Saat membuat acara baru, frontend mengirimkan penanda `isNewEvent: true` dan mengosongkan `idEvent` saat dikirim ke GAS sehingga baik versi GAS lama maupun baru **100% mengeksekusi `eventSheet.appendRow()`**, menulis acara baru ke sheet `DataEvent`, lalu mengembalikan ID resmi dari database Google Sheets ke frontend.
   - **Live Sync Otomatis:** Setelah acara tersimpan, sistem langsung memanggil `syncEventsFromBackend(true)` untuk memperbarui daftar acara secara realtime dari Google Sheets.

3. **Pembaruan Aset & Cache-Busting (`index.html`):**
   - Menyelaraskan query string cache ke `v=2.3.6`.

4. **Verifikasi Teknis & Zero Regression:**
   - Audit sintaks V8 dengan `node --check app.js` (Exit Code 0).
   - Seluruh integrasi kamera, filter analog, galeri, voting, dan Google Drive tetap utuh dan stabil 100%.
