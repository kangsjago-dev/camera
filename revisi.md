# RENCANA REVISI & PENYEMPURNAAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.3.0
STATUS: SELESAI DITERAPKAN (VERSION 2.3.0)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 15 November 2026
================================================================================

## 1. LATAR BELAKANG & TUJUAN REVISI v2.3.0
Berdasarkan tangkapan layar terbaru (`media_1794755102755_c24cf01b.png`) dan instruksi pengguna:
> *"buat menjadi lebih elegan dan presisi*  
> *- semua perintah yang masih disimpan di local, buat menjadi online*  
> *- jangan ubah yang tidak diperintahkan, pertahankan yang sudah ada"*

Sistem akan disempurnakan pada estetika visual, presisi geometris kartu QR sambutan tamu, serta penegasan arsitektur 100% online cloud sync.

---

## 2. ANALISIS AKAR MASALAH VISUAL & RANCANGAN TEKNIS PRESISI

### A. Evaluasi Geometri & Estetika Kartu QR Saat Ini (Berdasarkan Screenshot)
1. **Inkonsistensi Bahasa Visual 3 Tombol Aksi:**
   - Tombol 1 (Share) menggunakan latar solid emas cerah (`gold-gradient-bg text-black`).
   - Tombol 2 (Download) menggunakan latar gelap semi-transparan (`bg-white/10`) tanpa border emas yang tegas.
   - Tombol 3 (Copy Link) menggunakan latar sangat gelap (`bg-white/5 border border-brand-gold/30`).
   - Ketiganya memiliki 3 perlakuan visual yang berbeda sehingga tampak tidak serasi (*unbalanced/disconnected*).
2. **Posisi Badge "HD" Menabrak Border:**
   - Pada tombol Unduh QR, badge `HD` berposisi absolute di pojok kanan atas (`-top-1.5 -right-1.5`) yang menabrak dan memotong lekukan sudut tombol (*squircle*), memberi kesan kurang presisi (*awkward clipping*).
3. **Pill "Zoom" Menutupi Pola QR Code:**
   - Tag abu-abu `🔍 Zoom` di sudut kanan bawah kotak QR code menindih sebagian sudut modul pola piksel QR Code. Hal ini tidak hanya mengurangi keindahan estetika, tetapi juga berisiko mengganggu kamera HP tamu yang sedang memindai QR Code.
4. **Keseimbangan Tinggi & Spasi Vertikal:**
   - Kotak QR Code dan tumpukan 3 tombol aksi di sampingnya belum terikat dalam satu kesatuan proporsional (*dock container*), sehingga tampak seperti 3 kotak yang melayang longgar di samping kotak putih besar.

---

### B. Solusi Rekayasa: Ultra-Luxury VIP Action Dock & Pixel-Perfect Alignment

1. **Wadah Terpadu "VIP Action Dock" (Unified Luxury Container):**
   - Satukan ketiga tombol aksi di dalam kontainer dock vertikal kaca obsidian beraksen emas (`bg-[#121218]/90 border border-brand-gold/25 rounded-3xl p-2 shadow-inner`).
   - Ketinggian dock diselaraskan secara presisi 1:1 agar seimbang sempurna dengan tinggi kotak QR Code.

2. **Penyelarasan Desain 3 Tombol Aksi (Cohesive Gold VIP Palette):**
   - **Tombol 1 (Bagikan Acara):** Tombol utama dengan gradasi emas mewah (*Royal Metallic Gold Gradient*), ikon SVG bagikan presisi, efek hover glowing emas lembut.
   - **Tombol 2 (Unduh QR Meja HD):** Obsidian glass berpadu border aksen emas (`border-brand-gold/40 hover:border-brand-gold`). Ikon unduh dengan label **`HD` terintegrasi rapi secara simetris di dalam tata letak tombol** (bukan badge tempelan yang menabrak border), menghasilkan tampilan yang bersih dan proporsional.
   - **Tombol 3 (Salin Tautan Acara):** Obsidian glass selaras berpadu border aksen emas (`border-brand-gold/40 hover:border-brand-gold`) dengan ikon salin tautan kembar.
   - Ketiga tombol berukuran presisi seragam (52px × 52px) dengan lekukan sudut halus (`rounded-2xl`) dan feedback sentuhan lembut (*micro-interaction*).

3. **Penyempurnaan Kotak QR Code (Bebas Halangan Piksel):**
   - Hilangkan pill gelap yang menutupi sudut QR Code.
   - Ganti dengan indikator zoom non-obstruktif: sebuah ikon kaca pembesar mini elegan di luar area aktif QR atau frame aksen emas yang bersih dan siap scan 100%.
   - Kotak putih QR Code dilapisi ring emas halus (`ring-2 ring-brand-gold/40 shadow-xl shadow-brand-gold/15 rounded-2xl`).

4. **Keseimbangan Tata Letak Kartu `#welcomeQrCard`:**
   - Penataan grid/flex yang simetris sempurna antara QR Box dan Action Dock (`flex-row items-center justify-center gap-5 sm:gap-6`).
   - Kartu berlatar belakang gradasi gelap mewah (`bg-gradient-to-b from-[#181822] via-[#121217] to-[#0A0A0F] border border-brand-gold/30 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-brand-gold/15`).

---

### C. Jaminan 100% Online Cloud Sync (Semua Perintah Terhubung ke Cloud)
- Memastikan seluruh mutasi data tersinkronisasi ke Google Sheets `DataPengaturanGlobal` (`globalConfig`) dan Google Drive:
  1. Pengaturan Foto Panggung (Status aktif/nonaktif, judul kustom, tautan Drive) -> tersimpan di Google Sheets tab `DataPengaturanGlobal`.
  2. Pengaturan Bingkai Kustom (Single Lock vs Multi-Frame) -> tersimpan di Google Sheets `event_frame_settings_${id}`.
  3. Kategori Voting Kustom -> tersimpan di Google Sheets `event_categories_${id}`.
  4. Status Sembunyi/Tampil & Penghapusan Foto -> tersimpan di Google Sheets `DataFoto` dan `hidden_photos` / `deleted_photos`.
  5. Pengunggahan Foto Jepretan Tamu -> tersimpan langsung ke Google Drive dan tercatat di sheet `DataFoto`.

---

### D. Komitmen Pemeliharaan Fitur Eksisting (Strict Zero-Regressions)
> [!IMPORTANT]
> Seluruh fitur yang berjalan baik **tetap dipertahankan 100% utuh**:
> - Live streaming kamera & switch kamera depan/belakang
> - Floating camera zoom controls (1x, 2x, 3x)
> - Realtime analog filter grading (RAW, 800T Cine, Warm Sun)
> - Kuota foto dan penomoran otomatis
> - Sistem voting 2x per tamu dan live leaderboard podium

---

## 3. BERKAS YANG AKAN DIMODIFIKASI
1. `index.html`:
   - Penataan ulang komponen kartu `#welcomeQrCard`: integrasi VIP Action Dock vertikal untuk 3 tombol aksi, pemindahan/penghilangan tag zoom yang menutupi QR code, dan penyelarasan margin simetris.
2. `app.js`:
   - Penyesuaian event listener dan styling interaksi mikro pada suite tombol aksi.
   - Pengecekan menyeluruh untuk memastikan 100% mutasi data tersinkronisasi online ke backend Google Apps Script.
3. `prd.md`:
   - Dokumentasi pembaruan living context v2.3.0.

---

## 4. PERBANDINGAN SEBELUM VS SESUDAH

| Elemen UI | Kondisi Saat Ini (Screenshot User) | Rencana Penyempurnaan (v2.3.0) |
| :--- | :--- | :--- |
| **Gaya 3 Tombol Aksi** | 3 gaya berbeda (1 solid gold, 1 semi-transparan, 1 gelap bergaris) | **Unified Luxury VIP Suite** (Palet emas & kaca obsidian serasi dan harmonis) |
| **Badge "HD" Tombol Unduh** | Menempel di luar dan memotong lekukan border secara canggung | **Integrated Micro-Badge** (Menyatu rapi dan presisi di dalam tombol tanpa memotong border) |
| **Kotak QR Code** | Tertutup modul pill abu-abu "Zoom" di sudut kanan bawah | **100% Bebas Obstruksi** (Pola QR bersih utuh, mudah dipindai kamera HP tamu) |
| **Penyusunan Elemen** | 3 tombol mengambang terpisah di samping QR Code | **VIP Action Dock** (Tersusun rapi dalam wadah dock mewah yang seimbang dengan QR Code) |
| **Sinkronisasi Data** | Campuran lokal & cloud | **100% Online Cloud Sync** ke Google Sheets `DataPengaturanGlobal` & Google Drive |

---

## 5. RENCANA PENGUJIAN & VALIDASI
1. **Pengujian Visual Kartu QR:** Buka halaman utama — pastikan QR Code tampil bersih dan tajam tanpa ada elemen yang menutupi pola piksel QR, serta 3 tombol aksi tersusun rapi di dalam dock mewah berbalut aksen emas yang seimbang sempurna.
2. **Pengujian Fungsionalitas Tombol:**
   - Klik tombol **Bagikan**: pastikan dialog share native atau link terbagikan dengan lancar.
   - Klik tombol **Unduh QR**: pastikan gambar QR resolusi tinggi 1000px terunduh otomatis.
   - Klik tombol **Salin Link**: pastikan tautan tersalin ke clipboard dengan notifikasi toast emas.
3. **Pengujian Cloud Sync:** Lakukan perubahan pengaturan atau foto — pastikan data tersimpan online ke Google Sheets dan terdistribusi ke seluruh perangkat.

================================================================================
Rencana siap dieksekusi setelah pengguna memberikan persetujuan dengan mengetik:
"OKE TERAPKAN"
================================================================================
