# LOG REVISI & STATUS PERBAIKAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (VERSION 2.2.6)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 15 November 2026
================================================================================

## 1. RINGKASAN IMPLEMENTASI V2.2.6

### A. Penggantian Upload File Bingkai Menjadi Input Link Target Bingkai:
1. **Komponen UI di `index.html`:**
   - Komponen `<input type="file" id="formEventCustomFrame">` telah sepenuhnya digantikan oleh:
     `<input type="url" id="formEventCustomFrameUrl" placeholder="https://drive.google.com/file/d/... atau https://.../bingkai.png" ...>`
   - Dilengkapi tombol cepat uji link `➔` (`#btnTestFrameUrl`) dan tombol `Hapus` (`#btnRemoveCustomFrame`).
   - Kotak pratinjau `#customFramePreviewBox` langsung memverifikasi dan menampilkan gambar dari URL.
2. **Normalisasi Cerdas URL Google Drive (`normalizeFrameTargetUrl`):**
   - Mendukung input link Google Drive publik (`/file/d/ID`, `?id=ID`, `open?id=ID`, `uc?id=ID`).
   - Otomatis mengubah link Google Drive menjadi direct image CDN URL berkecepatan tinggi:
     `https://lh3.googleusercontent.com/d/{ID}`
   - Mendukung link direct PNG/WebP dari server hosting eksternal.
   - Kebal terhadap batas 50.000 karakter Google Sheets (ukuran link hanya ~100 karakter).

### B. Sinkronisasi Online 100% Seluruh Perintah & Konfigurasi ke Google Sheets:
1. **Bingkai Kustom Tersimpan Online:**
   - Saat admin menyimpan acara (`formSaveEvent`), sistem menyimpan:
     * `event_custom_frame_${idEvent}`: Link target URL bingkai acara.
     * `global_custom_frames`: Seluruh koleksi bingkai kustom lintas acara via `adminUpdateGlobalConfig`.
   - Di perangkat lain, `loadEventData()` membaca `global_custom_frames` dan `event_custom_frame_${idEvent}` langsung dari sheet `Pengaturan` (`res.globalConfig`).
2. **Kategori Poling & Penghapusan Kategori Tersinkron Online:**
   - Penghapusan kategori via tombol `✕` (`recordDeletedCategory`) langsung disinkronkan ke server cloud melalui `deleted_categories_${idEvent}` di `globalConfig`.
   - Kategori yang sudah dihapus tidak akan muncul kembali saat halaman direfresh atau dibuka di HP lain.
3. **Penyimpanan Tanggal Acara:**
   - Proteksi anti-reset tanggal acara: jika tanggal acara sudah lewat atau input tidak diubah, tanggal resmi yang sudah ada tetap dipertahankan.
   - Validasi format RFC 3339 (`YYYY-MM-DD`) memastikan input tanggal tidak pernah kosong (`mm/dd/yyyy`).

### C. Jaminan Nol Regresi (Zero Regression):
- Live camera stream, switch front/back camera, slider zoom 1x-3x tetap berjalan normal.
- Fitur watermark Canvas saat foto diambil tetap menggunakan gambar dari link target bingkai.
- Galeri, kuota foto tamu, kuota voting 2x per tamu, dan podium pemenang tetap aktif 100%.

================================================================================
