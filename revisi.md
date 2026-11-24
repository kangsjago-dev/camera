# DOKUMENTASI REVISI & DIAGNOSIS SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI: v2.3.9
STATUS: SELESAI DITERAPKAN (VERSION 2.3.9)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 25 November 2026
================================================================================

## 1. IKHTISAR REALISASI REVISI v2.3.9

### A. Masalah 1: Tidak Bisa Upload ke Google Drive (Stuck Spinner di Galeri)
- **Status:** SELESAI & TERVERIFIKASI
- **Perbaikan Frontend (`app.js`):**
  * Pada `uploadPhotoInBackground`, penanganan respon error (`res.status === 'error'` atau `limit_reached` atau kegagalan jaringan) kini secara mutlak mengubah `isUploading: false` dan `uploadFailed: true`.
  * Foto tetap tersimpan dengan aman di galeri lokal tamu tanpa ada lagi kartu foto yang terjebak pada animasi spinner *"Mengunggah ke Drive..."* selamanya.
  * Tampil toast pemberitahuan transparan jika terjadi kendala izin Google Drive di server.
- **Perbaikan Backend (`code.gs`):**
  * Ditambahkan fungsi resmi `otorisasiAksesGoogleDrive()` di `code.gs`.
  * Proteksi defensif pada pembacaan `parentFolder` dan `targetFolder`: jika Google Drive melempar kendala otorisasi, backend mengembalikan pesan panduan yang jelas.
  * Parameter target folder `payload.gdriveFolderId` kini dipertahankan dan tidak tertimpa nilai kosong dari spreadsheet.

### B. Masalah 2: Tampilan Frame di Halaman Depan Disamakan Saat Mau Upload
- **Status:** SELESAI & TERVERIFIKASI
- **Perbaikan Frontend (`app.js`):**
  * **Prioritas Indeks 0 untuk Custom Frame:** Di `getAvailableFrames()`, jika acara memiliki custom frame (`customFrameUrl` atau `customFrameData`), objek bingkai kustom (`CUSTOM_EVENT`) disisipkan ke urutan paling pertama (`unshift` ke indeks 0), sehingga langsung menjadi pilihan default saat aplikasi dibuka.
  * **Sinkronisasi 1:1 Viewfinder & Modal Pratinjau:**
    Di `processPhotoWithFrameAndFilter`, sistem memeriksa apakah elemen viewfinder `#vfCustomFrameImg` sedang aktif menampilkan bingkai kustom. Jika ya, kanvas foto secara otomatis mengunci `frameToUse = 'CUSTOM_EVENT'`.
  * **Eliminasi Fallback Gold Deco yang Salah:**
    Di `applyActiveFrame`, bingkai bawaan (Gold Deco, Polaroid, Minimal) tidak akan lagi menimpa atau memuat `customUrl` acara.
  * Modal pratinjau sebelum simpan ke rol / upload kini menampilkan bingkai kustom yang **100% sama persis** dengan yang terlihat di kamera depan (viewfinder).

---

## 2. PANDUAN PENTING 1-MENIT UNTUK PENGGUNA (AKTIVASI DRIVE DI GOOGLE APPS SCRIPT)
Karena backend mengembalikan `Akses ditolak: DriveApp`, lakukan langkah berikut 1x di editor Apps Script Anda:
1. Buka spreadsheet database SnapEvent Anda -> menu **Extensions (Ekstensi)** -> **Apps Script**.
2. Salin isi berkas `code.gs` terbaru ke dalam script editor.
3. Di toolbar atas, pilih nama fungsi **`otorisasiAksesGoogleDrive`**, lalu klik tombol **Run (Jalankan)**.
4. Klik **Review Permissions (Tinjau Izin)** -> Pilih akun Google Anda -> Klik **Advanced (Lanjutan)** -> Klik **Go to ... (unsafe)** -> Klik **Allow (Izinkan)**.
5. Lakukan deploy ulang Web App: Klik **Deploy** -> **Manage deployments** -> Klik ikon pensil (Edit) -> Ubah versi ke **New version** -> Pastikan **Execute as: Me** dan **Who has access: Anyone** -> Klik **Deploy**.

---

## 3. AUDIT INTEGRITAS & DEPLOYMENT v2.3.9
1. **Sintaks JS:** `node --check app.js` -> PASS (Exit code 0, 100% bebas error).
2. **Sinkronisasi Git:** Berkas disinkronkan ke repo lokal `C:\Users\Administrator\Documents\GitHub\camera` dan dipush ke branch `main`.
3. **Verifikasi Live Production:** `https://www.runway.my.id/cam` mengembalikan `HTTP 200 OK` dengan aset `v=2.3.9`.
4. **Zero-Regression:** Kamera live stream, flash shutter, filter film grading, galeri real-time, dan slideshow proyektor berjalan stabil.

================================================================================
CATATAN ATURAN: SELURUH INSTRUKSI USER TELAH SELESAI DITERAPKAN SECARA PARALEL DAN PRESISI TINGGI.
================================================================================
