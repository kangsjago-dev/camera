# RENCANA REVISI & DIAGNOSIS SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.4.1
STATUS: SELESAI DITERAPKAN (VERSION 2.4.1)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 25 November 2026
================================================================================

## 1. INVESTIGASI & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Berdasarkan laporan Anda:
1. *"1x capture, foto 2x / 3x terupload di googledrive"* (Bukti: tangkapan layar folder Google Drive `media_1795557848796_9b802baf.png` di mana foto yang sama terunggah 2-3 kali).
2. *"tampilkan hasil upload ke galeri 'semua foto'"* (Bukti: tangkapan layar galeri `media_1795557955468_ac4d9edb.png` masih menampilkan "Belum Ada Foto Terbit").

Berikut hasil audit investigasi mendalam terhadap kode sumber:

---

### A. Akar Masalah 1: Kenapa 1x Capture Terunggah 2x / 3x ke Google Drive?
1. **Pemicu Utama (`autoUploadPendingPhotos` di `app.js` baris 2288):**
   - Saat pengguna menekan tombol **"Simpan ke Rol"**, fungsi `handleSavePhotoToDrive()` langsung memicu fungsi upload pertama:
     `uploadPhotoInBackground(payload, tempPhotoId)`.
   - Namun, pada `handleSavePhotoToDrive()` baris 3581-3602, objek foto disimpan ke memori lokal dengan `gdriveViewUrl = finalDataUrl` (data Base64).
   - Selang 600ms kemudian, atau setiap 6 detik via auto-poll timer `setInterval` galeri, fungsi `loadGallery()` terpanggil.
   - Di dalam `loadGallery()`, terdapat kode auto-sync:
     ```javascript
     const offlineUnstarted = pendingLocalPhotos.filter(p => 
       p && p.gdriveViewUrl && p.gdriveViewUrl.startsWith('data:') && !IN_FLIGHT_PHOTO_UPLOADS.has(p.idFoto)
     );
     if (offlineUnstarted.length > 0) {
       autoUploadPendingPhotos(offlineUnstarted);
     }
     ```
   - **BENTROKAN WAKTU (*Race Condition*):**
     * Request upload pertama masih terbang di jaringan (*in-flight*).
     * Jika terjadi respons balik lambat, error sementara, atau `loadGallery` dipanggil beruntun (dari interval 6s, event `window.focus`, atau perpindahan tab), fungsi `autoUploadPendingPhotos()` membaca foto base64 tersebut sebagai "foto offline yang belum diunggah" lalu **mengirimkan request upload kedua dan ketiga ke Google Apps Script!**
2. **Ketiadaan Kunci Idempotensi Klien di Backend (`code.gs`):**
   - Di `code.gs`, generator ID foto `generateIncrementalPhotoId` menghitung nomor urut baru untuk setiap request yang masuk (`FTO-20261125-001`, `FTO-20261125-002`, dst).
   - Karena request duplikat dari frontend membawa `tempPhotoId` lokal yang berbeda atau dikirim ulang sebelum cache terisi, backend membuat file fisik baru di Google Drive sebanyak 2x hingga 3x!

---

### B. Akar Masalah 2: Kenapa Foto Hasil Upload Belum Tampil di Tab "Semua Foto"?
1. **Filter LocalStorage Menghapus Data URL Base64 (`saveEventPhotos` di `app.js` baris 535):**
   - Pada `saveEventPhotos(eventId)`:
     ```javascript
     const cleanPhotos = (STATE.photos || [])
       .filter(p => {
         ...
         if (p.gdriveViewUrl && p.gdriveViewUrl.startsWith('data:')) return false; // <-- BUG KRITIS
         return true;
       });
     ```
   - Kode ini sengaja membuang foto base64 dari `localStorage` untuk menghemat kuota browser.
   - Akibatnya: Saat foto selesai diunggah atau halaman di-refresh, jika server Google Apps Script belum mengembalikan data (`res.photos` masih `[]` karena isu otorisasi DriveApp backend), foto lokal tersebut **sama sekali tidak tersimpan di `localStorage`**!
   - Saat tab "Semua Foto" dibuka atau direfresh, `loadEventPhotos` membaca `localStorage` yang kosong (`STATE.photos = []`), sehingga galeri menampilkan status *"Belum Ada Foto Terbit"*.
2. **Retensi Foto Berhasil Unggah yang Belum Terindeks Server:**
   - Setelah upload ke Drive sukses, objek foto lokal di frontend harus segera diperbarui menjadi URL Drive resmi (`https://lh3.googleusercontent.com/d/{fileId}`) dan dipertahankan secara permanen di `localStorage`, agar tidak terhapus oleh filter base64 maupun oleh server yang lambat mengindeks file baru.
3. **Filter Tab Kategori di Galeri:**
   - Pastikan tab "Semua Foto" (`STATE.activeGalleryFilter = 'ALL'`) selalu merender seluruh foto rol acara tamu tanpa ada pemotongan status kategori.

---

## 2. RENCANA PERBAIKAN PRESISI (ACTION PLAN v2.4.1)

### 1. Eliminasi Total Duplikasi Upload (Anti-Duplicate Guard):
- [ ] **Kunci Upload Global Berbasis Fingerprint (`app.js`):**
  - Kunci tombol `btnSaveToDrive` secara mutlak segera setelah ditekan (disable + status "Menyimpan...").
  - Berikan flag permanen `p.isUploading = true` dan `p.uploadRequested = true` pada objek foto lokal.
  - **Nonaktifkan pemanggilan `autoUploadPendingPhotos` ganda** di `loadGallery()` untuk foto yang baru diambil dalam 3 menit terakhir atau yang sudah memiliki request upload aktif.
- [ ] **Idempotensi Kuat di Backend (`code.gs`):**
  - Perketat pemeriksaan `CLIENT_UPL_{clientPhotoId}` dan hash konten gambar pada `handleUploadPhoto` di `code.gs`.
  - Jika request dengan `clientPhotoId` atau hash gambar yang sama diterima dalam jendela 5 menit, backend **wajib mengembalikan file yang sudah dibuat sebelumnya** (reuse file ID & view URL), BUKAN membuat file fisik baru di Google Drive!

### 2. Tampilkan Hasil Upload Seketika di Galeri "Semua Foto":
- [ ] **Simpan Thumbnail Ringan ke `localStorage` (`app.js`):**
  - Pada `saveEventPhotos()`, jangan membuang foto lokal yang baru diambil! Simpan metadata foto beserta URL foto (jika berupa base64, kompres/simpan thumbnail ringan atau prioritaskan direct view URL Google Drive).
- [ ] **Instant Gallery Sync:**
  - Begitu respons sukses dari Google Apps Script diterima (`res.status === 'success'`), seketika perbarui:
    * `p.idFoto = res.idFoto`
    * `p.gdriveViewUrl = res.viewUrl || ('https://lh3.googleusercontent.com/d/' + res.fileId)`
    * `p.gdriveFileId = res.fileId`
    * `p.isUploading = false`
    * `p.cloudUploaded = true`
  - Simpan langsung ke `localStorage` dan panggil `renderGallery()`.
  - Pastikan tab default galeri aktif adalah **"Semua Foto"** (`STATE.activeGalleryFilter = 'ALL'`) dan kontainer kartu foto langsung dirender di layar.

---

## 3. STATUS EKSEKUSI
- **Status saat ini:** MENUNGGU PERSETUJUAN USER
- **Perintah Eksekusi:** Menunggu instruksi `OKE TERAPKAN` dari Anda. Tidak ada kode produksi yang diubah sebelum instruksi diberikan.
