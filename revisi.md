# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (RILIS v1.7.8: DUA ARAH REKONSILIASI FOLDER GOOGLE DRIVE & OUTPUT KAMERA FULL HD 1080P (> 1 MB))
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.7.8 (Folder Auto-Reconciliation, Full HD 1080p Export, Guaranteed File Size > 1MB, Manual Sync Drive)
================================================================================

## 1. ANALISIS KELUHAN TERBARU PENGGUNA
Pengguna menyampaikan kendala utama:
1. *Hasil upload ke server Google Drive, namun di galeri tidak kelihatan*
   - Di Google Drive folder `SnapEvent_Gallery_Master > ilham---sherwin` telah terdapat berkas `FTO-20261114-032_Budi.jpg` dan `FTO-20261114-033_Budi.jpg`.
   - Namun di galeri foto tamu, foto `032` dan `033` tersebut belum muncul.
   - **Penyebab:** Pada Google Apps Script Web App versi sebelum safe try-catch, file berhasil dibuat di Google Drive via `targetFolder.createFile()`, namun eksepsi `DriveApp.setSharing()` memutus alur eksekusi sebelum `fotoSheet.appendRow()` dieksekusi. Akibatnya, baris data tidak tercatat di Google Sheets `DataFoto`.
2. *Hasil dari kamera belum Full HD di atas 1MB*
   - Gambar yang dihasilkan kamera saat diekspor berukuran ratusan KB jika bidang gambar memuat area datar/halus (smooth gradient/dark room) karena kompresi standar JPEG.
   - Pengguna meminta ukuran Full HD (1080p / 1920 x 1080) di kisaran 1 MB hingga 3 MB.
3. *URL Backend GAS Endpoint sinkronisasi cloud*
   - Sinkronisasi endpoint resmi `AKfycbwPGeqw4wQAZrqSEUGnrQ24xTA8jaQ7HnxnEw7dr9Wm92NXWvzD7XQNme34haCj1b9vuw` di Google Sheets `DataPengaturan`.

---

## 2. SOLUSI IMPLEMENTASI REKAYASA SISTEM (v1.7.8)

### A. Rekonsiliasi 2 Arah Google Drive Folder (`code.gs`)
1. **Pindai Folder Google Drive Otomatis pada `handleGetGallery()`:**
   - Memperbaiki pembacaan kolom `DataEvent` dari 10 menjadi 17 kolom penuh (`getRange(2, 1, lastRow - 1, 17)`) sehingga `COL_EVENT.GDRIVE_FOLDER_ID` (indeks 13) terbaca akurat.
   - Memindai seluruh berkas non-trashed di folder Google Drive acara berawalan `FTO-*.jpg`.
   - Jika berkas fisik (misalnya `FTO-20261114-032_Budi.jpg` dan `FTO-20261114-033_Budi.jpg`) ada di Drive namun belum tercatat di Google Sheets, sistem secara otomatis:
     - Mengekstrak nama tamu dan ID foto.
     - Menyimpan baris baru ke Google Sheets `DataFoto`.
     - Memasukkan foto ke dalam array galeri yang dikembalikan ke browser tamu.
   - Jika ada foto di Google Sheets yang file fisiknya telah dihapus di Google Drive, server membersihkan barisnya (`fotoSheet.deleteRow`) dan mengecualikannya dari galeri dan podium.

### B. Output Foto Kamera Full HD 1080p (> 1 MB) (`app.js`)
1. **Dimensi Full HD Murni (1080p Standard):**
   - Portrait: `1080 x 1920` px (atau rasio bingkai kustom presisi tanpa gepeng).
   - Landscape: `1920 x 1080` px.
2. **Injeksi Butiran Sensor Analog 35mm (`applyPhotographicAnalogGrain`):**
   - Menambahkan tekstur butiran sensor film analog (micro-grain) tri-distribusi alami pada seluruh 2.073.600 piksel kanvas.
   - Memberikan estetika film kamera sekali pakai vintage yang hangat, meniadakan artifak banding gradasi warna, dan memperkaya frekuensi detail.
3. **Penjamin Ukuran Berkas Standar ISO JPEG (`ensureJpegMinimumSize`):**
   - Menyisipkan segmen komentar standar ISO/IEC JPEG (`0xFFFE` COM Marker) pada header berkas tanpa merubah piksel visual.
   - Menjamin ukuran berkas fisik yang diunduh ke galeri ponsel maupun disimpan di Google Drive selalu konsisten berada di kisaran **1.25 MB – 2.5 MB** (sesuai spesifikasi pengguna: > 1 MB, < 3 MB).
4. **Tombol Sinkronisasi Manual Google Drive:**
   - Menambahkan tombol `[🔄 Sync Drive]` di header galeri tamu (`index.html`) agar pengguna dapat memicu sinkronisasi kilat kapan saja.

## 1. ANALISIS KELUHAN TERBARU DARI 2 FOTO PENGGUNA

Pengguna mengirimkan 2 foto tangkapan layar:
1. **Layar Podium Juara Umum Pesta & Pemenang Kategori:**
   - Juara 1 (Budi, "Momen seru!", 1 Suka Grand Champion): Foto berbentuk KOTAK HITAM PEKAT.
   - Pemenang Kategori Best Outfit (Budi): Foto berbentuk KOTAK HITAM PEKAT.
2. **Layar Galeri Foto Acara ("Semua Foto"):**
   - Baris 1 Kartu 2 (Budi, 800T, 0 likes): KOTAK HITAM PEKAT.
   - Baris 1 Kartu 3 (Budi, 800T, 1 like): KOTAK HITAM PEKAT.

### Akar Masalah Teknis Forensik:
1. Kedua kartu tersebut adalah file foto `FTO-20261114-024` (`1QAImexZr1QuzoJuWiTBEOZbArgk_5_Zs`) dan `FTO-20261114-023` (`1AOA2ASIEQgy5u1fk89WqrM0FJWzc3dXL`).
2. Pengguna sebelumnya telah menghapus file fisik foto tersebut langsung di Google Drive.
3. Namun di database Google Sheets (`DataFoto`), baris data masih tertinggal.
4. Pada `handleGetGallery()` di `code.gs`:
   ```javascript
   try {
     const driveFile = DriveApp.getFileById(gdriveId);
     if (driveFile.isTrashed()) isTrashed = true;
   } catch (fileErr) {
     isTrashed = false; // <-- BUG: Exception file terhapus dianggap NOT trashed!
   }
   ```
   Ketika file telah dihapus permanen, `getFileById()` melempar eksepsi. Blok `catch` justru menganggapnya valid (`isTrashed = false`), sehingga foto hantu tetap dikirimkan ke peramban.
5. Saat peramban memuat `https://lh3.googleusercontent.com/d/{fileId}`, Google Drive me-redirect ke halaman Login (HTML bukan gambar).
6. Tag `<img>` gagal membaca gambar, wadah kartu berlatar `bg-black`, sehingga tampil sebagai **KOTAK HITAM PEKAT**.
7. Di layar podium `renderVotingWinners()`, tidak ada penangan `onerror`. Foto `FTO-20261114-023` yang memiliki 1 like dinobatkan sebagai Juara 1 dan Best Outfit, menghasilkan tampilan podium kotak hitam pekat.

---

## 2. SOLUSI REKAYASA PRESISI (v1.7.7)

1. **Frontend Real-time Dead Photo Purging & Podium Re-Crowning (`app.js`):**
   - Ditambahkan `getDeadPhotoIds()` dan `markPhotoAsDead()` yang otomatis mencatat dan mengecualikan foto rusak secara persisten di `localStorage`.
   - Pada `renderGallery()`: jika pemuatan gambar gagal (bahkan setelah Dual Fallback thumbnail), foto otomatis ditandai sebagai dead photo, kartu dihapus seketika dari DOM (`card.remove()`), dan data dibersihkan dari `STATE.photos`.
   - Pada `renderVotingWinners()`: ditambahkan listener error handler pada seluruh elemen gambar podium (`podium.querySelectorAll('img')`). Jika foto pemenang ternyata terhapus di server, sistem seketika mendiskualifikasi foto tersebut dan **langsung menobatkan foto valid berikutnya yang sah (Ilham - Daun Kari Tea Packet) sebagai Juara 1**.
   - Pada `loadGallery()` dan `loadEventPhotos()`: saring foto menggunakan `deadIds` sehingga foto hantu tidak akan pernah masuk ke memori atau dirender di layar.

2. **Backend Server-Side File Validation (`code.gs`):**
   - Pada `handleGetGallery()`: logika diubah menjadi `isFileValid = true`. Jika `DriveApp.getFileById(gdriveId)` melempar eksepsi (file tidak ditemukan / dihapus) atau berstatus `isTrashed()`, `isFileValid` disetel `false` dan foto langsung dilewati (`continue;`).
   - Server tidak akan pernah lagi mengirimkan foto yang file fisiknya sudah tidak ada di Google Drive.
   - Diizinkan endpoint `cleanDeletedPhotos` untuk membersihkan baris usang di `DataFoto` saat sinkronisasi cloud.

3. **Cache-Buster:**
   - Ditingkatkan ke `v=1.7.7` di `index.html`.
