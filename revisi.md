# LOG REVISI & STATUS PERBAIKAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (VERSION 2.2.7)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 15 November 2026
================================================================================

## 1. RINGKASAN IMPLEMENTASI V2.2.7

### A. Fitur Akses & Autentikasi Admin:
1. **Dukungan Tombol Enter Login Admin:**
   - Input `#inputAdminUser` dan `#inputAdminPass` telah dibungkus dalam `<form id="formAdminLogin">`.
   - Menambahkan event listener tombol `keydown` (Enter) dan form `submit` pada modal `#modalAdminPin`.
   - Pengguna cukup menekan Enter untuk langsung masuk ke panel admin.
2. **Akses Bebas Live Cam & Galeri Tamu bagi Admin:**
   - Menambahkan tombol pintas di header admin: `[📷 Lihat Live Cam]` (`#btnAdminGoCamera`) dan `[🖼️ Buka Galeri]` (`#btnAdminGoGallery`).
   - Sesi admin tetap aktif saat admin memeriksa kamera live atau galeri.
   - Admin yang sedang login tidak lagi terhalang oleh pembatasan wajib isi nama tamu saat membuka kamera.
   - Admin dapat kembali ke panel admin kapan saja dengan menekan tombol Admin di header tanpa perlu login ulang.

### B. Proyektor Panggung (Ballroom Slideshow):
- **Filter Foto Tersembunyi (100% Bersih):**
  - Implementasi fungsi `getEligibleSlideshowPhotos()` yang menyaring foto menggunakan `getHiddenPhotosSet()` dan `getDeletedPhotosSet()`.
  - Foto yang disembunyikan admin di galeri (`hidden_photos` / `isVisible === false`) tidak akan pernah muncul di layar proyektor panggung.

### C. Live Cam & Canvas Watermark (Zero-Crop):
1. **Bingkai Live Camera Fit:**
   - Mengubah kelas `#vfCustomFrameImg` menjadi `w-full h-full object-fill` agar proporsional dan membentang pas memenuhi kotak viewfinder kamera tanpa menyisakan ruang kosong (letterbox).
2. **Hasil Foto Canvas Tanpa Pemotongan:**
   - Mengeliminasi conditional cropping pada `processPhotoWithFrameAndFilter()`.
   - Seluruh elemen bingkai kustom PNG (ornamen bunga atas, teks tengah, serta logo sudut bawah) digambar penuh 100% dari `(0, 0)` ke `(w, h)` tanpa ada bagian yang terpotong.

### D. Pembersihan Antarmuka & Eliminasi Menu Dobel:
- Menghapus tab duplikat `[+ Buat Event Baru]` dari header tab admin `#adminTabsContainer`.
- Pembuatan acara baru difokuskan satu pintu melalui tombol `[➕ Buat Acara]` (`#btnAddNewEventTop`) pada tab Daftar Event.
- Memastikan tidak ada menu/tombol yang dobel di seluruh halaman aplikasi.

### E. Persistensi Refresh (F5 Anti-Lompat Halaman):
- Status tampilan aktif (`snapevent_current_view`) dan sub-tab admin (`snapevent_current_admintab`) disimpan di `sessionStorage`.
- Saat browser direfresh (F5), aplikasi tetap berada di halaman dan tab yang sama persis tanpa berpindah sepihak.

### F. Tombol Aksi Lengkap pada Kartu QR Code Acara (viewWelcome):
- Mengubah tata letak kartu QR Code menjadi 2 kolom berdampingan:
  1. 📲 **Bagikan Link (Share):** Membuka Web Share API ponsel atau menyalin link jika di desktop.
  2. ⬇️ **Unduh QR Code:** Mengunduh file gambar QR Code resolusi tinggi 1000px (`QR-Code-[NamaEvent].png`) untuk dicetak di banner/meja.
  3. 📋 **Salin Link QR:** Menyalin URL acara langsung ke clipboard dengan toast notifikasi instan.

================================================================================
