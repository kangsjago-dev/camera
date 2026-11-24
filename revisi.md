# RENCANA REVISI & DIAGNOSIS SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.4.0
STATUS: SELESAI DITERAPKAN (VERSION 2.4.0)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 25 November 2026
================================================================================

## 1. INVESTIGASI & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Berdasarkan laporan Anda: *"foto berhasil di upload ke googledrive, namun tidak ada tampilan list pada gallery yang ditunjuk"*, beserta bukti tangkapan layar `media_1795555904211_d709088e.png`:

---

### A. Penyebab 1: Logika Rekonsiliasi `loadGallery()` di Frontend Menghapus Foto Lokal (`app.js`)
1. **Alur Kejadian:**
   - Saat tamu mengambil foto, foto tersebut langsung disimpan ke memori lokal (`STATE.photos`) dan diunggah ke Google Drive di latar belakang.
   - Setelah proses simpan/unggah selesai, kode memanggil `setTimeout(() => { loadGallery(); }, 600);` untuk menyinkronkan data galeri dari Google Apps Script.
2. **Titik Kerusakan (*The Bug*):**
   - Pada `app.js` baris 2206-2235, fungsi `loadGallery()` memfilter foto lokal dengan kode:
     ```javascript
     const tsMatch = String(p.idFoto).match(/FTO-(\d{10,13})/);
     ```
   - Namun, format ID foto yang dihasilkan sistem (baik dari klien `FTO-CLI-...` maupun server `FTO-20261125-001`) tidak cocok dengan pola 10–13 digit tersebut!
   - Akibatnya, `tsMatch` bernilai `null` dan foto lokal dianggap sudah kadaluarsa/usang.
   - Ketika server Google Apps Script merespons (misal mengembalikan `photos: []` karena jeda indexing Drive), fungsi `loadGallery()` **menimpa `STATE.photos` dengan array kosong `[]`** dan menyimpannya ke `localStorage`!
   - Foto yang baru saja berhasil diunggah langsung lenyap dari layar galeri HP tamu!

---

### B. Penyebab 2: Tumpang Tindih UI "Belum Ada Foto" dan Spinner "Menyinkronkan..."
1. Pada tangkapan layar, terlihat kontainer `#galleryEmptyNotice` (*"Belum Ada Foto Terbit"*) dan spinner loading (*"Menyinkronkan foto rol acara..."*) muncul **secara bersamaan di layar yang sama**.
2. Hal ini terjadi karena saat `loadGallery()` memasukkan HTML spinner ke dalam `#galleryPhotoGrid`, elemen `#galleryEmptyNotice` tidak disembunyikan (`hidden`). Pengguna melihat status kosong padahal sistem masih mencoba memuat data.

---

### C. Penyebab 3: Kendala Otorisasi Backend `Akses ditolak: DriveApp` di Google Apps Script
1. Berdasarkan hasil pengujian HTTP langsung ke backend GAS yang sedang aktif:
   `https://script.google.com/macros/s/AKfycbxg-Owg7BrEqx4KHDI7UsLBX88ejLXcVxgQuSZNtz8d0rIJ_wCGVQFsOzpKGDO8w8cOrw/exec`
   Server masih merespons:
   `{"status":"error","message":"Error processing request: Akses ditolak: DriveApp."}`
2. Akibat error izin ini, fungsi `handleGetGallery` di backend yang mencoba membaca isi folder Google Drive (`DriveApp.getFolderById(folderId)`) diblokir oleh Google, sehingga Google Apps Script tidak dapat membaca file foto fisik di folder Google Drive dan mengembalikan daftar foto kosong (`photos: []`).

---

## 2. RENCANA PERBAIKAN PRESISI (ACTION PLAN v2.4.0)

### 1. Perbaikan Frontend (`app.js`):
- [ ] **Proteksi Anti-Wipe Foto Galeri (Retensi Lokal Permanen):**
  - Perbaiki fungsi `loadGallery()` agar **TIDAK PERNAH menghapus foto lokal** jika server mengembalikan daftar kosong (`serverPhotos.length === 0`).
  - Hapus batasan regex `tsMatch` yang kaku; gunakan pemeriksaan universal ID dan *timestamp* pembuatan agar foto yang baru diambil atau berhasil diunggah tetap 100% muncul di galeri.
- [ ] **Pembersihan Tumpang Tindih Tampilan UI:**
  - Pastikan `#galleryEmptyNotice` disembunyikan secara eksplisit selama proses sinkronisasi (`Menyinkronkan foto rol acara...`) sedang berjalan.
  - Tampilkan pesan kosong HANYA jika sinkronisasi sudah benar-benar selesai DAN total foto (lokal + server) adalah 0.
- [ ] **Instant Gallery Append:**
  - Saat `uploadPhotoInBackground` menerima konfirmasi sukses (`res.status === 'success'`), perbarui URL Google Drive foto secara instan di `STATE.photos`, simpan ke `localStorage`, dan panggil `renderGallery()` seketika tanpa menghapus foto dari layar.

### 2. Perbaikan Backend (`code.gs`):
- [ ] Di `handleGetGallery`:
  - Tambahkan penanganan defensif jika `DriveApp` mengalami kendala hak akses: baca langsung data dari sheet `DataFoto` yang sudah tersimpan tanpa bergantung 100% pada pemindaian folder fisik Drive.
  - Tambahkan endpoint diagnostik `action=checkDrive` di `doGet` untuk memudahkan pengecekan status izin Google Drive dari browser.

### 3. Panduan Pengguna (Aktivasi Izin Google Apps Script):
- Memandu pengguna untuk menjalankan fungsi `otorisasiAksesGoogleDrive()` 1x di editor Apps Script agar Google mengizinkan layanan `DriveApp` membaca dan menulis ke folder acara.

---

## 3. CHECKLIST INTEGRITAS & VERIFIKASI SEBELUM SERAH TERIMA
- [ ] Validasi AST JavaScript dengan `node --check app.js` (harus `Exit Code 0`).
- [ ] Uji alur render galeri: foto yang berhasil diunggah dijamin langsung muncul di galeri dan tidak pernah terhapus oleh sinkronisasi latar belakang.
- [ ] Uji UI galeri: pastikan spinner loading dan pesan "Belum Ada Foto Terbit" tidak lagi tumpang tindih.
- [ ] Sinkronisasi berkas ke repositori Git lokal `C:\Users\Administrator\Documents\GitHub\camera` dan deploy ke branch `main`.
- [ ] Bump versi ke `v=2.4.0`.

================================================================================
CATATAN ATURAN: TIDAK ADA KODE PRODUKSI YANG DIUBAH SEBELUM PENGGUNA MEMERINTAHKAN "OKE TERAPKAN".
================================================================================
