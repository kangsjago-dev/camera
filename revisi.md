# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (RILIS v1.7.7: PEMULIHAN TUNTAS KARTU HITAM / BROKEN IMAGE DI GALERI & PODIUM)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.7.7 (Zero Broken Images, Dual Fallback Auto-Purge, Dynamic Podium Re-Crowning)
================================================================================

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
