# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (RILIS v1.7.2: EDIT KATA GELAR KHUSUS ADMIN, RESOLUSI TOTAL ERROR FETCHeventDetails & 50K CHAR CELL GAS, CLOUD SYNC MENYELURUH, LIVE GALLERY AUTO-REFRESH ENGINE 5 DETIK TANPA F5)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.7.2 (Production Enterprise: Admin-Gated Podium Titles, Zero 50k Sheet Error via Pre-Drive Conversion, Robust Cloud Sync, Real-Time Live Gallery Auto-Update)
================================================================================

## 1. PERMINTAAN PENGGUNA & INSTRUKSI REKAYASA (v1.7.2)

Permintaan pengguna:
"/zettbot 
- ✏️ Edit Kata Gelar = hanya dibisa dilakukan pada halaman admin
- perbaiki semua error pada gambar 
- sync dan fungsikan semua data
- galeri otomatis tampilkan gambar terbaru tanpa refresh
terapkan segera dan jangan ubah yang sudah ada"

Poin Inti Rekayasa v1.7.2:
1. **✏️ Edit Kata Gelar Juara Khusus Halaman Admin (Admin-Gated Title Editing)**:
   - **Pembersihan Tampilan Publik Tamu**: Tombol `#btnEditPodiumTitlesInline` dihapus dari tampilan publik podium galeri (`renderVotingWinners()`). Tamu undangan di layar galeri tidak dapat melihat ataupun mengedit sebutan gelar juara.
   - **Tombol & Input Khusus Halaman Admin**:
     a) Tab Leaderboard Admin (`adminTabLeaderboard`): Ditambahkan tombol `#btnAdminEditPodiumTitles` ("✏️ Edit Kata Gelar Juara") untuk pengeditan cepat.
     b) Tab Buat & Edit Acara (`adminTabCreate`): Disediakan 3 input field terstruktur (`#formEventPodiumP1`, `#formEventPodiumP2`, `#formEventPodiumP3`).
     Semua perubahan tersimpan permanen di cloud Google Sheets dan tersinkron ke semua perangkat.

2. **Resolusi Tuntas Seluruh Error pada Gambar**:
   - **Error 1: "Peringatan saat sinkronisasi cloud: fetchEventDetails is not defined" (Gambar 1)**:
     - Diperbaiki pada `purgeAllOfflineDataAndResync()` di `app.js`: fungsi memanggil `await loadEventData()` yang merupakan nama fungsi resmi pemuat data acara.
     - Ditambahkan deklarasi alias global `window.fetchEventDetails = loadEventData` untuk proteksi komprehensif.
   - **Error 2: "Peringatan GAS: Error processing request: Your input contains more than the maximum of 50000 characters in a single cell." (Gambar 2)**:
     - **Pre-Drive Upload Shield di Client (`app.js`)**: Saat admin menyimpan acara (`saveAdminEventForm()`), jika terdapat bingkai kustom baru bertipe base64 (`data:image/`), skrip otomatis mengunggah gambar tersebut ke Google Drive terlebih dahulu via `action: "uploadPhoto"`. Hasil URL file Drive ringkas (`https://lh3.googleusercontent.com/d/{fileId}`) kemudian dikirimkan ke `adminSaveEvent`.
     - **Sanitisasi Mutlak String > 500 Karakter**: Client menjamin tidak pernah mengirimkan string base64 (>500 karakter) ke payload `adminSaveEvent`.
     - **Sanitisasi Server-Side di `code.gs`**: Seluruh cell spreadsheet diproteksi fungsi `sanitizeCellValue(val, 49000)`, dan URL bingkai dibatasi maksimal 500 karakter.
     - **Pencegahan Resend Base64 pada `populateEditEventForm(ev)`**: Properti `STATE.tempCustomFrameData` tidak lagi menyalin string base64 lama dari acara yang sudah ada.

3. **Sinkronisasi & Fungsionalitas Penuh Seluruh Data (Data Integrity & Resync)**:
   - Tombol **"🧹 Bersihkan Cache Offline & Sync Ulang"** (`#btnAdminPurgeOfflineCache`) kini tereksekusi 100% mulus tanpa error.
   - Fungsi menghapus cache offline usang, mengunduh ulang data murni dari Google Sheets & Google Drive (`loadEventData()`, `loadGallery()`), serta merehidrasi antarmuka secara reaktif (`applyEventToUI()`, `applyGlobalConfigToUI()`, `renderGallery()`, `renderAdminDashboard()`).

4. **Galeri Otomatis Tampilkan Gambar Terbaru Tanpa Refresh (Live Auto-Refresh Engine)**:
   - **Active Background Poller**: Dijalankan interval 5 detik (`setInterval`) yang aktif memeriksa foto baru saat tamu membuka tab Galeri (`viewGallery`) atau Slideshow Proyektor (`modalSlideshow`).
   - **Signature Diffing (Anti-Flicker DOM)**: Sistem membandingkan signature array foto (`oldSignature !== newSignature`). Grid galeri hanya di-render ulang jika ada foto baru, perubahan status unggahan, atau perolehan like bertambah, menjaga posisi scroll tamu tetap stabil dan nyaman.
   - **Status Visual Interaktif**: Ditambahkan pill badge `Auto-Sync` dengan lampu hijau berkedip (*pulsing dot*) pada banner album foto bersama di `index.html`.
   - **Reactive Tab Resync**: Event `visibilitychange` memastikan galeri langsung memperbarui foto seketika saat tamu kembali membuka tab peramban.

================================================================================

## 2. FILE TERDAMPAK & SPESIFIKASI PERUBAHAN
1. `app.js`:
   - Penghapusan tombol edit gelar dari podium publik tamu (`renderVotingWinners()`).
   - Penambahan tombol `#btnAdminEditPodiumTitles` pada tab leaderboard admin di `bindEvents()`.
   - Pre-upload bingkai kustom ke Google Drive via `uploadPhoto` pada `saveAdminEventForm()`.
   - Pencegahan mutlak pengiriman string base64 (>500 karakter) ke `adminSaveEvent`.
   - Pemulihan fungsi `loadEventData()` pada `purgeAllOfflineDataAndResync()` dan alias `window.fetchEventDetails`.
   - Engine polling live gallery otomatis 5 detik dan signature diffing di `loadGallery()`.
2. `index.html`:
   - Penambahan tombol `#btnAdminEditPodiumTitles` pada `adminTabLeaderboard`.
   - Penambahan badge visual `Auto-Sync` dengan pulsing dot di header galeri bersama.
   - Peningkatan versi cache-buster ke `v=1.7.2`.
3. `code.gs`:
   - Sanitisasi mutlak `updates[key]` pada `handleAdminUpdateGlobalConfig` dengan `sanitizeCellValue(..., 49000)`.
   - Penjaminan batasan kolom spreadsheet 17 kolom pada `handleAdminSaveEvent`.
4. `prd.md`:
   - Dokumentasi resmi rilis v1.7.2.

================================================================================
## 3. CHECKLIST VERIFIKASI SEBELUM RILIS
- [x] Syntax & Bracket Balancing Test (CurliesDiff: 0, ParensDiff: 0, BracketsDiff: 0 pada seluruh berkas).
- [x] Tombol "Edit Kata Gelar" bersih terhapus dari tampilan tamu/publik dan hanya tersedia di halaman admin.
- [x] Error `fetchEventDetails is not defined` tuntas teratasi.
- [x] Error Google Sheets 50.000 karakter per cell tuntas tereliminasi via Pre-Drive conversion di client & server.
- [x] Tombol Bersihkan Cache Offline & Sync Ulang berhasil membersihkan dan merehidrasi seluruh data cloud.
- [x] Galeri dan Slideshow otomatis menampilkan foto terbaru dalam 5 detik tanpa perlu F5 / refresh halaman.
- [x] Seluruh berkas disinkronkan ke repositori GitHub lokal `C:\Users\Administrator\Documents\GitHub\camera`.
