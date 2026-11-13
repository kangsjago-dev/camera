# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (HOTFIX v1.6.5: HD LIVE CAPTURE, AUTO-SAVE TO DEVICE GALLERY & GOOGLE DRIVE, ASYNC FRAME PRELOADING)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.6.5 (HD Quality Live Camera, Dual Storage to Phone & Cloud, Async Custom Frame Preloading)
================================================================================

## 1. PERMINTAAN PENGGUNA & INSTRUKSI REKAYASA (v1.6.5)

Permintaan pengguna:
"/zettbot pada saat capture live camera, upload ke googledrive serta save ke galery masing masing, serta capture dengan menggunakan mode kualitas HD. perbaiki penentuan serta preview penggunaan frame. terapkan segera dan jangan ubah yang sudah ada"

Poin Inti Rekayasa:
1. **Mode Tangkap Kualitas HD (High Definition / Sensor Quality)**:
   - Stream kamera live (`startCameraStream()`) ditingkatkan ke resolusi ideal Full HD / 4K (`width: { min: 1280, ideal: 1920, max: 3840 }`, `height: { min: 720, ideal: 1080, max: 2160 }`) dengan fallback defensif bertingkat.
   - Pemanfaatan `window.ImageCapture.takePhoto()` pada `triggerCameraShutter()` untuk menangkap frame foto pada resolusi sensor fisik kamera perangkat secara langsung jika didukung browser seluler.
   - Canvas smoothing diatur ke `imageSmoothingQuality = 'high'` dan ekspor JPEG ditingkatkan ke kualitas `0.95`.

2. **Dual Storage (Google Drive + Galeri Perangkat Masing-Masing Tamu)**:
   - "Upload ke Google Drive": Pengunggahan live via Google Apps Script Web App API (`action: "uploadPhoto"`) langsung ke folder Google Drive acara dan pencatatan sheet `DataFoto`.
   - "Save ke Galeri Masing-Masing": Penambahan fungsi `downloadPhotoToDevice(dataUrl, photoId)` yang otomatis mengunduh file foto berkualitas tinggi ke memori fisik ponsel tamu (masuk langsung ke album Foto/Galeri perangkat) saat tombol "Simpan ke Rol" ditekan, baik mode cloud live maupun mode offline.
   - Sinkronisasi galeri internal web app secara instan (`renderGallery()`).

3. **Perbaikan Penentuan & Preview Penggunaan Bingkai (Frame Determination & Async Preload)**:
   - Mengatasi akar masalah mengapa bingkai kustom PNG kadang gagal tampil dan mundur ke bingkai emas teks bawaan: instansiasi `new Image()` sinkron pada saat render canvas belum sempat menyelesaikan proses loading.
   - Menambahkan map cache global `FRAME_IMG_CACHE` dan fungsi preloader asynchronous `preloadFrameImage(dataUrl)` yang di-`await` di `renderCustomFrameOverlay()`.
   - Live Viewfinder Preview (`applyActiveFrame()`): menyembunyikan overlay teks built-in saat custom PNG aktif dan langsung memuat custom PNG ke viewfinder serta preloading ke cache.
   - Mode Single Lock: Viewfinder seketika terkunci dan menampilkan bingkai yang ditentukan admin, tombol ganti bingkai disembunyikan/dikunci.
   - Mode Multi-Frame: Hanya menampilkan bingkai yang dicentang admin sesuai urutan prioritas.

4. **Kebijakan Tidak Mengubah Fitur Eksisting**:
   - Filter kamera analog (`RAW`, `800T`, `WARM`, `BW`) tetap terjaga utuh.
   - Sistem voting 1x per kategori, login kru/admin, dan batas kuota foto tetap berjalan persis seperti semula.

================================================================================
## 2. FILE TERDAMPAK & SPESIFIKASI PERUBAHAN
1. `app.js`:
   - Penambahan `FRAME_IMG_CACHE` dan `preloadFrameImage()`.
   - Upgrade `startCameraStream()` dengan constraints HD (1080p-4K ideal) dan try-catch fallback.
   - Penambahan sensor snapshot via `ImageCapture` di `triggerCameraShutter()`.
   - Transformasi `processPhotoWithFrameAndFilter()` dan `renderCustomFrameOverlay()` menjadi `async/await`.
   - Penambahan helper `downloadPhotoToDevice()` di `handleSavePhotoToDrive()`.
   - Sinkronisasi penentuan bingkai di `getAvailableFrames()`, `loadEventData()`, `initCameraView()`, dan `showView('viewCamera')`.
2. `code.gs`:
   - Otomatisasi pengunggahan gambar bingkai kustom berformat base64 langsung ke Google Drive jika diunggah via form admin acara, dan mengembalikan direct view URL Google Drive.
3. `index.html`:
   - Bump cache-busting version ke `v=1.6.5` pada `style.css` dan `app.js`.

================================================================================
## 3. CHECKLIST VERIFIKASI SEBELUM RILIS
- [x] Syntax & Bracket Balancing Test (Curlies: 0, Parens: 0, Brackets: 0 di app.js dan code.gs).
- [x] Stream kamera HD aktif dengan fallback kompatibel untuk ponsel lama.
- [x] Jepret foto via shutter mengeksekusi `takePhoto()` atau video capture dengan canvas high-smoothing 1080x1350 JPEG 0.95.
- [x] Unduh otomatis ke memori galeri HP tamu berjalan saat menyimpan foto.
- [x] Unggah live langsung ke Google Drive dan Google Sheets berjalan mulus.
- [x] Preload gambar bingkai kustom mencegah kegagalan render atau border emas dadakan.
- [x] Sinkronisasi Git ke repository GitHub.
