# LOG REVISI & STATUS PERBAIKAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: RENCANA IMPLEMENTASI (v2.2.5) - 100% ONLINE CLOUD SYNC & ISOLASI KATEGORI
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 15 November 2026
================================================================================

## 1. AKAR MASALAH (ROOT CAUSE) PADA KELUHAN TERBARU

### A. Foto yang Disembunyikan & Ditampilkan Kembali Tidak Berubah di Device Lain:
- **Penyebab Utama 1:** Di `app.js` fungsi `loadEventData()` (baris 1664–1668):
  ```javascript
  const serverHidden = JSON.parse(res.globalConfig.hidden_photos);
  if (Array.isArray(serverHidden) && serverHidden.length > 0) {
    const localHidden = JSON.parse(localStorage.getItem('snapevent_hidden_photos') || '[]');
    const merged = Array.from(new Set([...localHidden, ...serverHidden]));
    localStorage.setItem('snapevent_hidden_photos', JSON.stringify(merged));
  }
  ```
  Ketika Admin di Device 1 **menampilkan kembali (unhide)** sebuah foto, server Google Sheets mengosongkan/menghapus ID foto tersebut dari `hidden_photos` (menjadi `[]` atau daftar tanpa ID foto tersebut). Namun saat Device 2 menyinkronkan data:
  1. Jika `serverHidden` menjadi kosong (`[]`), kondisi `serverHidden.length > 0` menjadi `false`, sehingga pembaruan dilewati sama sekali.
  2. Sekalipun dieksekusi, `merged = Array.from(new Set([...localHidden, ...serverHidden]))` tetap mempertahankan ID foto lama yang ada di `localHidden` Device 2, sehingga foto tersebut **tidak pernah bisa muncul kembali di Device 2**.
- **Penyebab Utama 2:** Panggilan backend `callGasApiSafe('adminTogglePhotoVisibility', ...)` mengembalikan pesan error: `"Action POST 'adminTogglePhotoVisibility' tidak dikenali"` karena action tersebut tidak ada di build GAS backend yang telah dideploy.

### B. Kategori Foto Masih Belum Berubah di Device Lain:
- **Penyebab Utama 1:** Di `renderGallery()` (baris 3564–3570):
  Ketika pengguna mengklik salah satu tombol kategori (misal `👑 Best Dressed Guest`), jika belum ada foto yang terpetakan ke kategori tersebut, kode memiliki fallback:
  `filtered = [...allEligiblePhotos];`
  Akibatnya, saat pengguna mengklik tombol kategori manapun, seluruh foto galeri tetap tampil utuh (sehingga di mata pengguna, filter kategori "tidak mau berubah").
- **Penyebab Utama 2:** Deployed Google Apps Script `getGallery` hanya mengembalikan `idFoto`, `guestNama`, dan `totalLikes`, tanpa menyertakan `idKategori` atau `categoryLikes` rincian per kategori. Akibatnya, pemetaan kategori sebelumnya hanya dibuat acak secara lokal per perangkat lewat fungsi hash pseudo-random (baris 2049 & 3515), yang menghasilkan kategori acak yang saling bertentangan antar perangkat.
- **Penyebab Utama 3:** Pilihan suara per kategori saat tamu melakukan voting (`handleVotePhoto`) belum disimpan secara online ke cloud config, sehingga Device 2 tidak mengetahui foto mana yang mendapatkan suara di kategori apa.

### C. Semua Perintah Masih Disimpan di Local:
- **Penyebab:** Tindakan seperti hide/unhide foto, pemetaan kategori foto, dan filter kategori sebelumnya mengandalkan `localStorage` lokal tanpa sinkronisasi cloud terpusat.
- **Solusi:** Seluruh status visibilitas (`hidden_photos`), penghapusan foto (`deleted_photos`), kategori per event (`event_categories_${idEvent}`), pemetaan suara foto per kategori (`event_photo_category_votes_${idEvent}`), dan pengaturan bingkai (`event_frame_settings_${idEvent}`) dialihkan 100% menggunakan `adminUpdateGlobalConfig` di sheet `Pengaturan` Google Sheets sebagai **Single Source of Truth** mutlak.

---

## 2. RENCANA PERBAIKAN TEKNIS (SURGICAL IMPLEMENTATION PLAN)

### 1. Sinkronisasi Online Penuh Visibilitas Foto (Hide & Unhide):
- **Otoritas Cloud Mutlak (Overwrite):** Di `loadEventData()` dan `loadGallery()`, saat `res.globalConfig.hidden_photos` diterima:
  Langsung timpa `localStorage.setItem('snapevent_hidden_photos', JSON.stringify(serverHidden))` (dan cache event terkait) tanpa penggabungan (`merge`) dengan cache lokal lama.
- **Registry Single-Source:** `getHiddenPhotosSet()` hanya membaca `snapevent_hidden_photos` yang telah tersinkronkan dari server cloud.
- **Toggle Online Tanpa Error GAS:** Pada `adminTogglePhotoVisibility(idFoto)`:
  Hapus pemanggilan POST action `adminTogglePhotoVisibility` yang tidak dikenali GAS.
  Gunakan `callGasApiSafe('adminUpdateGlobalConfig', { updates: { hidden_photos: JSON.stringify(globalHidden) } })` yang terbukti 100% didukung backend dan langsung tersimpan di sheet `Pengaturan`.

### 2. Sinkronisasi Online Pemetaan Suara Foto per Kategori & Filter Presisi Galeri:
- **Cloud Vote Mapping:** Pada saat tamu memberikan voting (`handleVotePhoto`):
  Simpan peta suara foto-kategori ke `event_photo_category_votes_${targetId}` di Google Sheets via `adminUpdateGlobalConfig`.
- **Konsumsi Cloud Mapping:** Pada `loadGallery()` dan `loadEventData()`, baca `res.globalConfig[`event_photo_category_votes_${targetId}`]` dan sematkan `p.categoryLikes`, `p.idKategori`, dan `p.namaKategori` ke masing-masing objek foto.
- **Isolasi Filter Galeri (Tanpa Fallback Semua Foto):**
  Di `renderGallery()`:
  Jika pengguna memilih filter kategori (misal: `👑 Best Dressed Guest`), hanya tampilkan foto yang memiliki suara di kategori tersebut.
  Jika belum ada foto di kategori tersebut, tampilkan pemberitahuan elegan:
  `Belum ada foto yang mendapatkan suara di kategori "${namaKategori}". Jadilah yang pertama memberikan suara!`
  disertai tombol `[Lihat Semua Foto]` yang mengembalikan filter ke "Semua Foto".
- **Badge Kategori pada Kartu Galeri:**
  Sematkan badge elegan pada setiap kartu foto yang telah mendapatkan suara kategori (`👑 Nama Kategori`) agar pengguna dapat melihat dengan jelas kategori dari setiap foto.

### 3. Perlindungan Fitur Berjalan (Zero Regression):
- Pertahankan fungsi kamera live stream HP dengan switch depan/belakang dan zoom 1x-3x.
- Pertahankan aturan kuota voting tamu (2x per tamu), pencegahan voting ganda pada foto yang sama, dan kuota 1 vote per kategori.
- Pertahankan custom frame, modal slideshow ballroom, dan generator QR Code.

---

## 3. BERKAS TERDAMPAK
1. `app.js` (Otoritas cloud `hidden_photos` tanpa stale merge, sinkronisasi cloud `event_photo_category_votes`, isolasi filter kategori galeri + empty state ramah, badge kategori pada kartu foto).
2. `index.html` (Cache-busting script tag `app.js?v=2.2.5`).
3. `revisi.md` (Dokumentasi log perubahan dan instruksi pengujian).
================================================================================
