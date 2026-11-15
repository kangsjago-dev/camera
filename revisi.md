# RENCANA REVISI & PENYEMPURNAAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.2.9
STATUS: SELESAI DITERAPKAN (VERSION 2.2.9)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 15 November 2026
================================================================================

## 1. LATAR BELAKANG & TUJUAN REVISI v2.2.9
Berdasarkan keluhan, instruksi, dan 8 tangkapan layar (screenshot) terbaru dari pengguna:
1. **Tombol QR Sambutan Tamu Logo/Ikon Saja (viewWelcome):** Pada kartu `#welcomeQrCard`, ubah tombol Bagikan Link, Unduh QR Meja, dan Salin Link QR menjadi tombol berbentuk logo/ikon elegan saja tanpa tulisan teks (sesuai screenshot close-up tombol).
2. **Perbaikan Sinkronisasi Foto Galeri (Foto Berhasil Upload Google Drive Tapi Tidak Tampil di Galeri):** Memperbaiki bug di mana foto yang telah terunggah ke Google Drive tidak muncul di galeri tamu dan admin.
3. **Perbaikan Pengaturan Menu Foto Panggung (Toggle & Tautan Tidak Bisa Diubah):** Memperbaiki bug pada panel admin di mana switch aktif/nonaktif dan tautan menu Foto Panggung selalu kembali tidak tercentang saat halaman dimuat atau disimpan.
4. **Perbaikan Tampilan Live Cam & Pratinjau Foto (Bebas Terpotong & Bebas Void Hitam):** Memperbaiki tampilan viewfinder kamera live dan modal pratinjau foto agar tampil proporsional, menyatu dengan bingkai, bebas dari bar hitam mati (*black void letterboxing*), dan tampak mewah serta estetis.
5. **100% Online Cloud Sync:** Seluruh perintah dan pengaturan tersimpan secara online di Google Sheets `DataPengaturanGlobal` (`globalConfig`) dan Google Drive.
6. **Pertahankan Fitur Eksisting:** Dilarang mengubah fitur yang tidak diperintahkan (live streaming kamera, switch depan/belakang, zoom slider 1x-3x, filter analog 800T, kuota foto, dan sistem voting).

---

## 2. ANALISIS AKAR MASALAH & RANCANGAN TEKNIS PER POIN

### A. Tombol Aksi QR Sambutan Tamu: Format Logo Saja Tanpa Tulisan (#welcomeQrCard)
* **Kondisi Saat Ini:**
  Tiga tombol di samping QR Code (`#btnWelcomeShareLink`, `#btnWelcomeDownloadQr`, `#btnWelcomeCopyQrLink`) saat ini memuat label teks panjang seperti "Bagikan Link Acara", "Unduh QR Meja HD 1000px", dan "Salin Link QR Acara". Pada layar ponsel, teks panjang ini membuat tata letak terasa padat dan kurang ringkas.
* **Solusi Rekayasa:**
  1. Hapus seluruh elemen teks `<span>` di dalam ketiga tombol tersebut.
  2. Tampilkan ketiga tombol sebagai **Luxury Icon Buttons** berbentuk lingkaran / rounded squircle modern:
     - 🔗 **Tombol 1 (Share Link):** Ikon SVG Bagikan modern berlatar gradasi emas berkilau (`gold-gradient-bg`), efek bayangan emas halus.
     - ⬇️ **Tombol 2 (Unduh QR HD):** Ikon SVG Download / QR Code berlatar dark glass VIP (`bg-white/10 border-white/15`).
     - 📋 **Tombol 3 (Salin Tautan):** Ikon SVG Copy Link berlatar dark glass border emas (`border-brand-gold/30`).
  3. Berikan atribut `title` dan `aria-label` yang ramah aksesibilitas ("Bagikan Link Acara", "Unduh QR Meja HD 1000px", "Salin Link Acara") sehingga tooltip tetap muncul saat disentuh/dihari mouse.
  4. Susun tombol secara sejajar vertikal atau horizontal kompak di samping kotak QR Code besar.

---

### B. Sinkronisasi Foto Galeri (Foto Berhasil Upload ke Google Drive Tapi Tidak Muncul di Galeri)
* **Akar Masalah:**
  1. **Penghapusan Baris Destruktif di Backend (`code.gs` baris 893-908):**
     Pada fungsi `handleGetGallery`, terdapat logika yang memeriksa keberadaan file di Google Drive via `DriveApp.getFileById(fileId)`. Google Drive API seringkali memerlukan jeda waktu 1–3 detik untuk mengindeks file baru yang baru saja diunggah, atau mengalami rate limit sesaat. Ketika verifikasi sementara gagal, script langsung memasukkan baris tersebut ke `rowsToDelete` dan menjalankan `fotoSheet.deleteRow()`. Akibatnya, baris foto yang baru saja berhasil diunggah langsung TERHAPUS dari sheet `DataFoto` oleh request pembacaan galeri!
  2. **Pembersihan Prematur di Frontend (`app.js` baris 2157-2174):**
     Di fungsi `loadGallery()`, filter `pendingLocalPhotos` hanya mempertahankan foto lokal jika `p.gdriveViewUrl.startsWith('data:')`. Begitu upload selesai di latar belakang, `gdriveViewUrl` berubah menjadi URL Google Drive (`https://lh3.googleusercontent.com/...`). Jika server Google Sheets belum mengembalikan foto tersebut saat request `getGallery` pertama tiba, foto langsung dibuang dari memori `STATE.photos` sehingga foto lenyap dari galeri.
  3. **Tombstone Deleted Photos Server:**
     ID foto yang pernah dihapus saat pengujian sebelumnya tersimpan di `deleted_photos` Google Sheets dan memfilter foto yang diunggah dengan nomor urut yang sama.
* **Solusi Rekayasa:**
  1. **Hapus Total Operasi `deleteRow` dari `handleGetGallery` (`code.gs`):**
     Operasi pembacaan galeri (GET) DILARANG KERAS menghapus data fisik database. Hapus blok `rowsToDelete` dan `fotoSheet.deleteRow()`. Seluruh foto yang tercatat di `DataFoto` yang statusnya bukan `SEMBUNYI` akan dikembalikan ke galeri dengan andal.
  2. **Retensi Pintar Foto Baru di Frontend (`app.js`):**
     Pada fungsi `loadGallery()`, pertahankan foto di `pendingLocalPhotos` jika foto tersebut diunggah kurang dari 5 menit yang lalu (`Date.now() - p.uploadStartedAt < 300000`), baik status URL-nya masih `data:` maupun sudah `https:`, sampai server resmi mengembalikan foto tersebut di dalam `serverPhotos`.
  3. **Pencocokan Multi-Kunci Anti-Duplikasi:**
     Gunakan Set pencocokan komprehensif berdasarkan `idFoto`, `gdriveFileId`, dan `driveFileId` sehingga foto yang baru diunggah langsung tampil mulus tanpa pernah hilang.

---

### C. Pengaturan Menu Foto Panggung Tidak Bisa Diubah (Admin Settings Fix)
* **Akar Masalah:**
  1. Di Google Sheets tab `DataPengaturanGlobal`, nilai boolean disimpan otomatis oleh Google Sheets sebagai huruf kapital `"TRUE"`.
  2. Di `app.js` (baris 1767 dan 2055), kode menggunakan perbandingan ketat:
     `STATE.stagePhotosEnabled = (res.globalConfig.stage_photos_enabled === 'true' || res.globalConfig.stage_photos_enabled === true);`
     Karena string `"TRUE" !== 'true'`, ekspresi tersebut menghasilkan nilai `false`!
  3. Akibatnya, setiap kali halaman di-refresh atau sinkronisasi background berjalan, status `stagePhotosEnabled` dipaksa kembali menjadi `false`, dan checkbox di panel admin otomatis menjadi tidak tercentang (unchecked).
* **Solusi Rekayasa:**
  1. Buat fungsi pembantu `parseBoolSafe(val)`:
     ```javascript
     function parseBoolSafe(val) {
       if (typeof val === 'boolean') return val;
       if (typeof val === 'number') return val === 1;
       const s = String(val || '').trim().toLowerCase();
       return s === 'true' || s === '1' || s === 'yes';
     }
     ```
  2. Terapkan `parseBoolSafe` pada pembacaan `stage_photos_enabled` di `loadEventData()`, `syncEventsFromBackend()`, `applyGlobalConfigToUI()`, dan saat inisialisasi state.
  3. Pastikan tombol "⚡ Uji Tautan Drive" dan formulir "Simpan Konfigurasi" (`btnSaveGlobalSettings`) mengirimkan pembaruan ke Google Apps Script dengan benar dan langsung memperbarui status tampilan di seluruh perangkat.

---

### D. Presisi Tampilan Live Cam & Preview Live Cam (Bebas Terpotong & Bebas Void Hitam)
* **Akar Masalah:**
  1. Kontainer `#viewfinderViewport` memiliki background hitam pekat (`bg-black`), dan di dalamnya `#viewfinderFrameContainer` dipatok kaku dengan class `aspect-[4/5] mx-auto`. Pada smartphone modern (rasio 9:19 atau 9:20), ini memicu ruang kosong hitam raksasa di atas dan bawah viewfinder kamera, membuat tampilan tampak seperti terpotong atau terkotak sempit di tengah.
  2. Tag `#vfCustomFrameImg` menggunakan `object-contain` sementara video menggunakan `object-cover`. Jika gambar bingkai kustom memiliki aspek yang sedikit berbeda dari 4:5, bingkai mengecil di dalam kontainer dan menyisakan celah transparan antara bingkai dan pinggiran video.
  3. Pada modal pratinjau foto (`#modalReviewPhoto`), kontainer foto juga dikunci kaku dengan `aspect-[4/5]` dan `object-contain`, menghasilkan bar hitam void yang mengelilingi foto hasil tangkapan.
* **Solusi Rekayasa:**
  1. **Harmonisasi Viewfinder Kamera Live (`#viewfinderViewport` & `#viewfinderFrameContainer`):**
     - Hilangkan ruang kosong hitam mati. Buat kontainer kamera live mengisi viewport secara alami dan proporsional.
     - Pasang bingkai kustom `#vfCustomFrameImg` agar melekat pas pada area video secara presisi tanpa celah kosong.
     - Berikan frame styling studio modern: sudut melengkung mewah (`rounded-2xl`), border aksen tipis emas, dan penempatan kontrol zoom serta filter yang ergonomis.
  2. **Desain Ulang Pratinjau Foto Acara (`#modalReviewPhoto`):**
     - Ganti kontainer kaku `aspect-[4/5]` dengan kontainer pratinjau adaptif (`max-h-[55vh] w-auto mx-auto`) yang menyesuaikan dengan proporsi asli foto hasil jepretan.
     - Hilangkan black void letterboxing. Foto hasil jepretan tampil utuh, tajam, dengan sudut melengkung elegan dan bayangan mewah.
     - Tata ulang tombol "Foto Ulang" dan "Simpan ke Rol" agar kompak dan mudah dijangkau satu tangan.

---

## 3. BERKAS YANG AKAN DIMODIFIKASI
1. `index.html`:
   - Redesain tombol aksi di `#welcomeQrCard` menjadi **Icon-Only Luxury Buttons** (tanpa tulisan teks).
   - Penataan ulang kontainer `#viewfinderViewport` dan `#viewfinderFrameContainer` di `#viewCamera` agar imersif dan tidak tampak terpotong.
   - Penataan ulang kontainer pratinjau di `#modalReviewPhoto` agar adaptif mengikuti foto dan bebas dari bar hitam void.
2. `app.js`:
   - Implementasi `parseBoolSafe()` untuk memastikan konfigurasi `stage_photos_enabled` ("TRUE" / "true") terbaca benar 100%.
   - Penyempurnaan `loadGallery()` untuk mempertahankan foto lokal yang baru diunggah (< 5 menit) agar tidak hilang saat transisi upload ke cloud.
   - Penyesuaian `processPhotoWithFrameAndFilter()` dan render pratinjau agar foto dan bingkai pas 1:1 tanpa celah.
3. `code.gs`:
   - Hapus total operasi `deleteRow` dari `handleGetGallery()` agar pembacaan galeri tidak pernah menghapus data foto.
4. `prd.md`:
   - Sinkronisasi master context dan log pembaruan resmi v2.2.9 pada zona bawah living context.

---

## 4. PERBANDINGAN SEBELUM VS SESUDAH

| Fitur / Komponen | Sebelum Revisi (v2.2.8) | Sesudah Revisi (v2.2.9) |
| :--- | :--- | :--- |
| **Tombol Aksi QR Sambutan** | Tombol lebar berisi teks panjang ("Bagikan Link Acara", "Unduh QR Meja HD 1000px", "Salin Link QR Acara") | **Icon-Only Luxury Buttons** (Ikon SVG tajam, tanpa teks, layout ringkas & mewah) |
| **Foto Baru di Galeri** | Foto berhasil upload ke Google Drive tapi hilang dari galeri karena dihapus oleh `deleteRow` di GAS atau dibuang oleh filter lokal | **Foto 100% Tampil Stabil & Permanen** (Tidak ada `deleteRow` pada GET galeri, retensi lokal pintar 5 menit) |
| **Pengaturan Foto Panggung** | Checkbox kembali tidak tercentang saat refresh karena `"TRUE" !== 'true'` | **Status Tersimpan Mantap 100% Online** (Mendukung `"TRUE"`, `"true"`, boolean riil di Google Sheets) |
| **Tampilan Live Cam & Preview** | Viewfinder terkotak sempit dengan void hitam besar di atas/bawah, preview modal tampak terpotong | **Imersif, Rapi & Proporsional** (Menyatu presisi dengan bingkai, bebas letterbox hitam janggal) |

---

## 5. RENCANA PENGUJIAN & VALIDASI
1. **Uji Tombol QR Sambutan:** Buka halaman selamat datang tamu — pastikan 3 tombol aksi di samping QR Code tampil berbentuk logo/ikon mewah tanpa teks tulisan, dengan fungsi Bagikan, Unduh HD, dan Salin Link berjalan sempurna.
2. **Uji Upload & Galeri:** Ambil foto menggunakan live camera atau upload galeri, tunggu proses simpan selesai — pastikan foto langsung tampil di galeri tamu dan galeri admin tanpa pernah hilang.
3. **Uji Pengaturan Foto Panggung:** Buka panel Admin tab Pengaturan Global, centang "Aktif (Tampil untuk Tamu)", isi tautan folder Drive, klik "Simpan Konfigurasi", lalu refresh halaman — pastikan pengaturan tetap aktif tercentang dan menu muncul di tamu.
4. **Uji Tampilan Viewfinder & Pratinjau:** Buka live camera dan ambil foto — pastikan tampilan viewfinder terasa pas dan tidak ada area hitam mati yang memotong layar, serta modal pratinjau menampilkan foto secara utuh dan memukau.

================================================================================
Rencana siap dieksekusi setelah pengguna memberikan persetujuan dengan mengetik:
"OKE TERAPKAN"
================================================================================
