# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: MENUNGGU PERSETUJUAN PENGGUNA (RILIS v1.7.6: PENYELESAIAN TUNTAS 7 ERROR DARI 9 TANGKAPAN LAYAR)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.7.6 (Zero-Regression & Bulletproof Enterprise Stabilization)
================================================================================

## 1. ANALISIS AKAR MASALAH DARI 9 GAMBAR PENGGUNA

Berdasarkan investigasi forensik menyeluruh terhadap 9 gambar dan pengujian langsung ke Cloud Endpoint Google Apps Script:

### A. Gambar 1: Pembentukan Folder Berganda di Google Drive (`ilham---sherwin` & `SnapEvent_ilham___sherwin`)
- **Akar Masalah:**
  Pada fungsi `handleAdminSaveEvent()` di `code.gs`, saat membuat folder baru:
  ```javascript
  const newFolder = masterFolder.createFolder(safeFolderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  folderId = newFolder.getId();
  ```
  Baris `newFolder.setSharing(...)` melempar eksepsi fatal `Akses ditolak: DriveApp.` pada akun Google yang memiliki pembatasan hak bagi tautan publik (Public Link Sharing Restriction).
  Karena eksepsi ini tidak ditangkap dengan `try/catch`, eksekusi terhenti sebelum `folderId` berhasil disimpan ke lembar kerja `DataEvent`.
  Setiap kali Admin mengedit/menyimpan acara, sistem mendeteksi `folderId` masih kosong, sehingga membuat folder baru lagi di Google Drive tanpa pernah menyimpan ID-nya!
- **Solusi Rekayasa:**
  1. Bungkus seluruh pemanggilan `setSharing()` pada file maupun folder di dalam blok `try { ... } catch (e) { Logger.log("Safe setSharing warn: " + e.message); }`.
  2. Implementasikan pemindaian idempotensi: sebelum memanggil `createFolder()`, periksa terlebih dahulu apakah folder dengan nama tersebut sudah ada di dalam `masterFolder` atau root Drive. Jika sudah ada, langsung gunakan folder ID yang ada dan DILARANG membuat folder baru.
  3. Pastikan `folderId` langsung direkam ke kolom `DataEvent` sehingga tersimpan permanen.

---

### B. Gambar 3, 5, 9: "Your input contains more than the maximum of 50000 characters in a single cell."
- **Akar Masalah:**
  Batas maksimum Google Sheets adalah 50.000 karakter per sel.
  Dari pengujian API `getInitialData`, ditemukan bahwa baris acara `EVT-202611-001` di `DataEvent` kolom `customFrameUrl` terisi string data Base64 raksasa (`data:image/png;base64,AAAA...`) yang mencapai tepat 50.000 karakter!
  Ketika `eventSheet.getRange(...).setValues(...)` atau `appendRow()` dijalankan, Google Sheets langsung menolak pembaruan data dan melemparkan pesan error tersebut.
- **Solusi Rekayasa:**
  1. Pada `handleAdminSaveEvent()` di `code.gs`, pasang filter tegas: jika `customFrameUrl` berupa string Base64 (`data:image/`), konversikan ke file gambar tunggal di Google Drive (`frame_{eventId}.png`) dan hanya simpan URL pendek `https://lh3.googleusercontent.com/d/{fileId}` (< 100 karakter). Jika konversi Drive gagal, simpan string kosong `""` dan DILARANG KERAS menulis string data Base64 ke dalam sel Google Sheets.
  2. Tambahkan pembersih otomatis sel korup pada `handleGetInitialData()` dan `handleAdminSaveEvent()` agar baris `EVT-202611-001` yang terlanjur terisi Base64 50.000 karakter dinetralkan seketika.
  3. Di `app.js` pada fungsi `saveAdminEventForm()`, pastikan payload yang dikirim ke `adminSaveEvent` tidak pernah menyertakan Base64 mentah jika panjangnya > 500 karakter.

---

### C. Gambar 7: Foto `FTO-20261114-032_Budi.jpg` Terunggah Dobel 7 Kali & Gambar Hilang dari Galeri
- **Akar Masalah Utama (Smoking Gun):**
  Pada `handleUploadPhoto()` di `code.gs`:
  ```javascript
  const driveFile = targetFolder.createFile(blob); // <-- File BERHASIL dibuat di Google Drive!
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // <-- MELEMPAR 'Akses ditolak: DriveApp.'!
  fotoSheet.appendRow([...]); // <-- TIDAK PERNAH DIJALANKAN KARENA ERROR DI ATAS!
  ```
  Karena `driveFile.setSharing(...)` melempar `Akses ditolak: DriveApp.`:
  1. File fisik foto berhasil masuk ke Google Drive,
  2. Namun baris foto **GAGAL dicatat ke `DataFoto` Google Sheets**,
  3. Server mengirimkan respons error ke browser tamu,
  4. Antrean latar belakang frontend (`autoUploadPendingPhotos`) menganggap unggahan gagal, sehingga mencoba mengunggah ulang (*retry*) setiap 5 detik,
  5. Setiap kali retry berjalan, file baru dibuat lagi di Google Drive dengan ID yang sama (`032`) karena database belum mencatat nomor urut tersebut,
  6. Akibatnya: file menumpuk 7 kali di Google Drive, sementara di tampilan Galeri Tamu foto **TIDAK MUNCUL SAMA SEKALI** karena `DataFoto` masih kosong!
- **Solusi Rekayasa:**
  1. Lindungi `driveFile.setSharing(...)` dengan `try/catch` protektif agar kegagalan izin tautan publik tidak pernah membatalkan pencatatan foto ke `DataFoto`.
  2. Pindahkan operasi pencatatan `fotoSheet.appendRow()` dan `SpreadsheetApp.flush()` langsung setelah `createFile(blob)`, sehingga keabsahan data di Sheets terjamin 100%.
  3. Tambahkan proteksi deduplikasi di `handleUploadPhoto()`: jika file dengan nama `newIdFoto_*.jpg` sudah ada di folder Drive target, gunakan file tersebut tanpa membuat file duplikat.
  4. Di frontend `app.js`, batasi retry maksimal 3 kali untuk mencegah looping tak terbatas.

---

### D. Gambar 8: "Peringatan saat sinkronisasi cloud: fetchEventDetails is not defined"
- **Akar Masalah:**
  Pada fungsi `purgeAllOfflineDataAndResync()` di `app.js`, terdapat pemanggilan `await fetchEventDetails()`.
  Meskipun alias `window.fetchEventDetails = loadEventData` sempat dipasang di baris 4019, pemanggilan yang terjadi sebelum inisialisasi atau di dalam fungsi terpisah memicu `ReferenceError: fetchEventDetails is not defined`.
- **Solusi Rekayasa:**
  1. Definisikan `function fetchEventDetails() { return loadEventData(); }` di bagian atas `app.js` (hoisted) agar dapat dipanggil dari mana saja dan kapan saja secara aman.
  2. Ganti pemanggilan di `purgeAllOfflineDataAndResync()` menjadi `await loadEventData()`.

---

### E. Gambar 2: Pratinjau Foto Acara Memiliki Bilah Hitam / Rasio Terdistorsi
- **Akar Masalah:**
  Pada `index.html` baris 854, wadah pratinjau modal review di-hardcode dengan kelas Tailwind `aspect-[4/5] bg-black`.
  Ketika foto diambil menggunakan kamera vertikal Full HD 1080x1920 (rasio 9:16) atau bingkai kustom berasio khusus, gambar berstatus `object-contain` meninggalkan ruang hitam lebar di sisi kiri dan kanan.
- **Solusi Rekayasa:**
  1. Ubah wadah pratinjau di `processPhotoWithFrameAndFilter()` agar rasio aspek wadah disesuaikan secara dinamis mengikuti rasio asli canvas:
     `previewContainer.style.aspectRatio = `${canvas.width} / ${canvas.height}`;`
  2. Batasi tinggi maksimal `max-h-[58vh]` agar modal tidak meluap keluar layar HP tamu dan pas membungkus foto tanpa bilah hitam kosong.

---

### F. Gambar 6: Galeri Menampilkan Foto Budi & Ilham Berulang
- **Akar Masalah:**
  Penggabungan `pendingLocalPhotos` dan `serverPhotos` di `loadGallery()` tidak membuang foto lokal yang memiliki *caption* atau waktu pembuatan identik dengan foto yang sudah resmi tersimpan di server.
- **Solusi Rekayasa:**
  1. Terapkan filter deduplikasi ketat di `loadGallery()`: jika foto server dengan caption dan identitas tamu yang sama sudah ada, hapus foto pending lokal dari `STATE.photos` dan `localStorage`.
  2. Pastikan filter kategori galeri menampilkan foto sesuai kategori voting yang dipilih secara akurat.

---

## 2. RENCANA BERKAS YANG DIUBAH & SPESIFIKASI PERUBAHAN

| File | Bagian / Fungsi | Rencana Perubahan |
|---|---|---|
| `code.gs` | `handleUploadPhoto` | Bungkus `setSharing` dalam `try/catch`. Pastikan `fotoSheet.appendRow()` dan `SpreadsheetApp.flush()` mutlak berhasil. Cegah duplikasi file fisik di Drive. |
| `code.gs` | `handleAdminSaveEvent` | Bungkus `setSharing` folder/file dalam `try/catch`. Cegah pembentukan folder duplikat jika folder sudah ada. Tolak Base64 > 500 karakter ke sel Sheets. |
| `code.gs` | `handleGetInitialData` & `doGet` | Bersihkan string Base64 korup 50.000 karakter yang ada pada data event lama. |
| `app.js` | `fetchEventDetails` | Buat fungsi hoisted di atas file: `function fetchEventDetails() { return loadEventData(); }`. |
| `app.js` | `loadGallery` | Deduplikasi `STATE.photos` agar foto duplikat lokal otomatis dibersihkan saat server sinkron. |
| `app.js` | `processPhotoWithFrameAndFilter` | Atur rasio wadah pratinjau review modal secara dinamis agar pas tanpa bilah hitam. |
| `app.js` | `autoUploadPendingPhotos` | Pasang batas maksimal retry 3x agar tidak terjadi upload berulang di latar belakang. |
| `index.html` | Cache-buster | Bump ke `v=1.7.6`. |
| `prd.md` | Living Context | Catat pembaruan arsitektur v1.7.6. |

---

## 3. GARANSI & KOMITMEN (ZERO REGRESSION)
- Seluruh fitur yang sudah berjalan normal (filter kamera RAW, 800T, WARM, BW; panggung live streaming; podium pemenang voting per kategori; sistem kuota dan mode offline) **100% DIPERTAHANKAN DAN TIDAK AKAN DIUBAH**.
- Hanya fokus menuntaskan 7 titik error yang dilaporkan pada 9 tangkapan layar.
