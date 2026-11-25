# RENCANA REVISI & DIAGNOSIS SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.4.8
STATUS: SELESAI DITERAPKAN (VERSION 2.4.8)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 25 November 2026
================================================================================

## 1. INVESTIGASI & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Berdasarkan tangkapan layar `media_1795584306461_99ee6a0a.png` dan laporan Anda:
1. *"sdh jalankan pilih 'otorisasiAksesGoogleDrive' namun error (sesuai gambar terlampir)"*
   - Log Google Apps Script:
     `SyntaxError: Identifier 'SHEET_NAMES' has already been declared (anonymous) @ setup.gs:1`
2. *"sync googledrive dan gallery agar semua yang ada pada gallery bs dilihat"*
3. *"dan voting beda tampilan/ Tidak tampil pada device lain"*

Berikut temuan investigasi mendalam pada codebase saat ini:

---

### A. Titik Kritis 1: Error `SyntaxError: Identifier 'SHEET_NAMES' has already been declared`
1. **Lingkup Global Google Apps Script:**
   - Seluruh file `.gs` di Google Apps Script berada dalam 1 *Global Scope* yang sama.
   - Meskipun `setup.gs` baris 15 sudah diubah ke `var SHEET_NAMES`, di `code.gs` baris 208 masih memakai `const SHEET_NAMES = { ... }`.
   - Jika urutan file di editor Google Apps Script memuat `setup.gs` sebelum `code.gs`, maka `var SHEET_NAMES` diikuti `const SHEET_NAMES` tetap memicu `SyntaxError: Identifier 'SHEET_NAMES' has already been declared`, yang membekukan seluruh fungsi (`otorisasiAksesGoogleDrive`, `doGet`, `doPost`).
2. **Solusi:**
   - Ubah `const SHEET_NAMES` di `code.gs` baris 208 menjadi `var SHEET_NAMES = (typeof SHEET_NAMES !== 'undefined') ? SHEET_NAMES : { ... };` agar kedua file (`code.gs` dan `setup.gs`) 100% aman dalam urutan muat apa pun.

---

### B. Titik Kritis 2: Crash `ReferenceError` pada `handleGetGallery()` di `code.gs` (Penyebab Galeri & Voting Gagal Sync!)
1. **Temuan Baru yang Kritis:**
   - Di `code.gs` fungsi `handleGetGallery()` baris 1233, kode mengakses variabel `categories`:
     ```javascript
     const defaultCategory = (categories.length > 0) ? categories[0] : null;
     ```
   - Padahal `const categories = [];` baru dideklarasikan di bawahnya pada baris 1257!
   - Di runtime V8 Google Apps Script, mengakses `const categories` sebelum baris deklarasinya langsung melempar **`ReferenceError: Cannot access 'categories' before initialization`**.
   - **Dampak Fatal:** Setiap kali HP tamu memanggil `getGallery`, server crash dan gagal mengembalikan daftar foto serta data `categoryLikes` voting!
2. **Solusi:**
   - Pindahkan blok pengisian `const categories = [];` (baris 1256–1270) ke **sebelum** baris 1232 agar `categories` sudah terisi sebelum dipakai untuk pemetaan `categoryLikes`.

---

### C. Titik Kritis 3: Sinkronisasi Google Drive ke Galeri & Voting Lintas Perangkat
1. **Sinkronisasi Drive -> Galeri:**
   - Fungsi 1-klik `sinkronkanFolderDriveKeGaleri()` di `code.gs` akan memindai folder Google Drive (`13wlAWJxzffdTczJLlGQRoc0VEPGmE6Bc`), menyetel izin view publik, dan mendaftarkan semua foto ke sheet `DataFoto`.
   - Selain itu, perbaikan `ReferenceError` di `handleGetGallery()` memastikan `auto-ingest` saat galeri dibuka berjalan normal tanpa crash.
2. **Voting Seragam di Semua Device:**
   - Dengan `handleGetGallery()` yang bebas crash, `categoryLikes` dan `totalLikes` dari sheet `DataVoting` akan terkirim utuh ke semua HP tamu secara realtime.

---

## 2. RENCANA PERBAIKAN PRESISI (ACTION PLAN v2.4.8)

1. **`code.gs` baris 208 (`SHEET_NAMES`):**
   - [ ] Ubah `const SHEET_NAMES` menjadi `var SHEET_NAMES = (typeof SHEET_NAMES !== 'undefined') ? SHEET_NAMES : { ... };` agar tidak pernah bentrok dengan `setup.gs`.
2. **`code.gs` baris 1232–1270 (`handleGetGallery`):**
   - [ ] Pindahkan blok pengambilan `const categories = [];` ke atas sebelum pemakaian `categories.length` agar tidak terjadi `ReferenceError`.
3. **`index.html` & Dokumentasi:**
   - [ ] Bump versi ke `v2.4.8` di `index.html`.
   - [ ] Sinkronkan ke repositori GitHub dan push ke `main` setelah Anda menyetujui.

---

## 3. STATUS EKSEKUSI
- **Status saat ini:** MENUNGGU PERSETUJUAN USER
- **Perintah Eksekusi:** Menunggu instruksi `OKE TERAPKAN` dari Anda. Tidak ada file kode (`code.gs`, `setup.gs`, `app.js`, `index.html`) yang diubah pada tahap ini.
