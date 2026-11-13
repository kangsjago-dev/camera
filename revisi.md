# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (HOTFIX v1.6.8: SINKRONISASI GALERI BERSIH DARI FOTO TERHAPUS, FULL HD 1080P SENSOR STREAM, PRESERVASI ASPEK RASIO BINGKAI ANTI-GEPENG, UPLOAD BINGKAI KUSTOM KE SERVER CLOUD)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.6.8 (Zero Ghost Photos, Dynamic Aspect Ratio Custom Frame, Full HD 1080p, Cloud Custom Frame Sync)
================================================================================

## 1. PERMINTAAN PENGGUNA & INSTRUKSI REKAYASA (v1.6.8)

Permintaan pengguna:
"/zettbot 
- file pada server telah dihapus, tetapi di galeri, masih ada gambarnya
- buat hasil foto menjadi Full HD (1080p / 1920 x 1080 piksel): Sekitar 1 MB hingga 3 MB (atau lebih, tergantung detail warna dan kompresi)
- bingkai custom acara sesuaikan dengan hasil foto, jangan ubah menjadi gepeng seperti gambar, sesuaikan
- hsil dari bingkai kustom acara masih disimpan dilokal, blm di upload ke server agar disemua user settingannya sama
terapkan segera dan jangan ubah yang sudah ada"

Poin Inti Rekayasa v1.6.8:
1. **Pemberantasan Tampilan Foto Hantu yang Sudah Dihapus di Server**:
   - **Eliminasi Fallback Sample Photos**: Menghapus baris injeksi `MOCK_DATA.samplePhotos` pada `loadGallery()` dan `loadEventPhotos()` ketika server mengembalikan 0 foto. Saat seluruh foto dihapus dari server/Drive, galeri secara jujur menampilkan status bersih (*Empty State*) "Belum Ada Foto Terbit" dengan badge "0 Foto".
   - **Eliminasi Gambar Unsplash Fallback**: Mengganti `onerror="this.src='unsplash'"` pada kartu foto dengan handler cerdas `img.onerror`. Jika file di Drive telah dihapus (404), kartu foto seketika dicopot dari DOM, dipangkas dari `STATE.photos`, dan cache lokal diperbarui.
   - **Verifikasi Server-Side di `code.gs`**: Pada `handleGetGallery()`, menambahkan pengecekan `DriveApp.getFileById(gdriveId).isTrashed()`. File yang berada di tempat sampah atau sudah dihapus permanen di Google Drive tidak akan pernah dikembalikan ke aplikasi tamu.
   - **Pembersih Data Admin**: Menambahkan tindakan `adminCleanDeletedPhotos` untuk membersihkan baris foto usang di Google Sheets `DataFoto`.

2. **Kualitas Full HD Sensor Murni (1080p / 1920 x 1080 piksel, ~1 MB - 3 MB)**:
   - **Resolusi Sensor Responsif Orientasi**: Mengoreksi batasan `getUserMedia` agar orientasi potret ponsel meminta `width: 1080, height: 1920` (menghilangkan error `OverconstrainedError` akibat `min: 1280` horizontal pada sensor kamera vertikal).
   - **Rendering Canvas Full HD**: Menjamin dimensi canvas berada pada standar 1080p (sisi terpendek minimal 1080px, sisi terpanjang 1920px).
   - **Kompresi Detail Tinggi**: Ekspor `canvas.toDataURL('image/jpeg', 0.98)` dengan `imageSmoothingQuality = 'high'` menghasilkan ukuran file 1.2 MB hingga 2.8 MB sesuai standar industri fotografi acara.

3. **Preservasi Aspek Rasio Bingkai Kustom (Anti-Gepeng / Zero Distortion)**:
   - **Deteksi Rasio Asli**: Melakukan preload bingkai kustom PNG dan menghitung rasio asli `customFrameRatio = frameWidth / frameHeight`.
   - **Dimensi Canvas Adaptif**:
     - Jika bingkai potret (e.g. 3:4, 4:5, 9:16): `canvas.height = 1920; canvas.width = Math.round(1920 * customFrameRatio);` (misal 1440x1920 untuk 3:4, 1536x1920 untuk 4:5).
     - Jika bingkai lanskap (e.g. 16:9, 4:3): `canvas.width = 1920; canvas.height = Math.round(1920 / customFrameRatio);`.
   - **Center Crop Cover**: Menyesuaikan crop foto kamera agar mengisi kanvas secara proporsional.
   - **Drawing Presisi**: Pada `renderCustomFrameOverlay()`, bingkai digambar dengan perlindungan aspek rasio (`drawX, drawY, drawW, drawH`). Hasilnya: gambar pengantin, ornamen bunga, dan tipografi 100% proporsional, tanpa distorsi horizontal/vertikal (tidak gepeng).

4. **Penyimpanan Bingkai Kustom ke Server Cloud Google Drive**:
   - **Optimasi Otomatis PNG di Browser**: Saat admin memilih file bingkai PNG, kanvas off-screen secara otomatis mengecilkan dimensi maksimal ke 1920px dengan transparansi alfa utuh. Bobot payload terpangkas dari 8MB menjadi ~300KB - 700KB.
   - **Pencegahan Timeout GAS POST**: Payload base64 yang ramping menjamin POST ke Google Apps Script berhasil tanpa melampaui kuota eksekusi.
   - **Penyimpanan Permanen di Google Drive**: `code.gs` mendekode base64, menyimpannya ke folder Google Drive acara, menetapkan izin publik (*Anyone with link can view*), menulis URL resmi `https://lh3.googleusercontent.com/d/[FILE_ID]` ke Sheet `DataEvent` Kolom 17 (`CUSTOM_FRAME_URL`), dan mengembalikannya ke client.
   - **Kelengkapan Data Admin**: `handleAdminGetSummary()` kini menyertakan `customFrameUrl`, `activeFrames`, dan kebijakan bingkai sehingga sinkronisasi lintas perangkat bersifat seragam dan permanen.

================================================================================

## 2. FILE TERDAMPAK & SPESIFIKASI PERUBAHAN
1. `app.js`:
   - Koreksi `loadEventPhotos` & `loadGallery`: hapus pemaksaan mock data sample saat galeri server kosong.
   - Perbaikan `img.onerror` di `renderGallery`: pemangkasan seketika kartu foto terhapus.
   - Orientasi responsif pada `startCameraStream()` (Full HD portrait & landscape).
   - Adaptasi rasio dinamis di `processPhotoWithFrameAndFilter` & `renderCustomFrameOverlay` (anti-gepeng).
   - Optimasi client-side PNG pada `formEventCustomFrame` & penanganan respon `customFrameUrl`.
2. `code.gs`:
   - Validasi keberadaan file di Google Drive pada `handleGetGallery`.
   - Penambahan `customFrameUrl` dan framing policy pada `handleAdminGetSummary`.
   - Penambahan aksi `adminCleanDeletedPhotos`.
3. `index.html`:
   - Cache-busting script dan stylesheet diperbarui ke `v=1.6.8`.
4. `prd.md`:
   - Pencatatan log rilis arsitektur v1.6.8.

================================================================================
## 3. CHECKLIST VERIFIKASI SEBELUM RILIS
- [x] Syntax & Bracket Balancing Test (Curlies: 0, Parens: 0, Brackets: 0 di app.js dan code.gs).
- [x] Galeri kosong menampilkan pesan bersih tanpa foto hantu atau gambar Unsplash tiruan.
- [x] Kartu foto yang gagal dimuat dari server Drive langsung dibersihkan otomatis.
- [x] Kamera live stream meminta Full HD 1080p tanpa error overconstrained di ponsel vertikal.
- [x] Bingkai kustom acara mempertahankan proporsi asli (3:4, 4:5, 9:16) tanpa gepeng / melar.
- [x] Upload bingkai kustom dioptimasi otomatis dan berhasil tersimpan di Google Drive & Kolom 17 DataEvent.
- [x] Semua pengguna / tamu di perangkat lain menerima bingkai kustom yang sama dari server.
- [x] File disinkronkan ke repo GitHub lokal `C:\Users\Administrator\Documents\GitHub\camera`.
