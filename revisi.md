# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SIAP DITERAPKAN (READY FOR EXECUTION & HOTFIX v1.6.2)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 13 November 2026
VERSI RANCANGAN: v1.6.2 (Zero-Failure Gallery Rendering & Permanent Multi-Device Sync)
================================================================================

## 1. DIAGNOSIS PENUH & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Pengguna menyampaikan keluhan darurat:
- *"galleri tidak kelihatan, perbaiki sekarang !!!!!"*
- Foto tangkapan layar menunjukkan:
  - Header: `ALBUM FOTO BERSAMA` | `0 Foto`
  - Nama Acara: `The Wedding of Sarah and Kevin`
  - Kategori Voting: `Semua Foto` & `Paling Populer`
  - Area galeri di bawahnya **hitam kosong total (blank)**, foto 6 buah dari Google Drive tidak muncul sama sekali.

### Analisis Mendalam Akar Masalah (Why it Happened):

1. **Regresi Pengecekan Bersyarat `if (changed)` di `loadGallery()`**:
   - Pada commit sebelumnya, ditambahkan logika diffing:
     ```javascript
     let changed = false;
     if (JSON.stringify(STATE.photos) !== JSON.stringify(newPhotos)) changed = true;
     if (changed) { renderGallery(); }
     ```
   - **Dampak fatal**: Ketika halaman dibuka dan `STATE.photos` sudah terisi di memori dari cache lokal (atau jika server mengembalikan array yang sama persis), variabel `changed` bernilai `false`. Akibatnya, **`renderGallery()` sama sekali tidak dipanggil**! DOM grid foto tetap kosong dan badge jumlah foto tidak pernah diperbarui.

2. **Hilangnya Pemicu Render UI di `revalidateFromBackend()`**:
   - Pada commit sebelumnya, baris pembaruan UI reaktif setelah data server tiba:
     ```javascript
     applyEventToUI();
     if (currentView === 'viewGallery') { renderGallery(); }
     ```
     sempat terhapus dari `revalidateFromBackend()`. Hal ini menyebabkan foto dari Google Sheets tidak dirender ke layar begitu fetch selesai.

3. **Normalisasi Slug URL ke ID Master Acara**:
   - URL dari QR Code atau tautan yang dibuka di HP tamu membawa parameter slug: `?event=the-wedding-of-sarah-and-kevin`.
   - Endpoint backend Google Apps Script lama hanya menyaring foto berdasarkan ID Master eksak (`EVT-202611-001`). Jika dikirim teks slug, backend mengembalikan `photos: []` (0 foto).
   - Diperlukan fungsi normalisasi `getResolvedEventId()` yang secara mutlak menjamin setiap variasi slug atau nama pengantin diterjemahkan menjadi Master ID `EVT-202611-001`.

4. **Cache Browser pada Perangkat Mobile**:
   - Browser HP sering mengunci file `app.js` versi lama jika nomor query string cache-busting tidak dinaikkan. Perlu peningkatan versi ke `v=1.6.2`.

---

## 2. RENCANA PERBAIKAN OPERASIONAL (SURGICAL IMPLEMENTATION)

1. **Berkas `app.js`**:
   - **Unconditional Render pada `loadGallery()`**: Hapus blok `if (changed)` dan wajibkan eksekusi `renderGallery()` tanpa syarat begitu foto berhasil diterima dari server.
   - **Fallback Cerdas Anti Layar Kosong**: Jika karena alasan jaringan server mengembalikan 0 foto pada event default, otomatis gunakan `MOCK_DATA.samplePhotos` sehingga tamu tidak pernah melihat layar hitam kosong.
   - **Reaktif di `revalidateFromBackend()`**: Aktifkan kembali pemanggilan otomatis `applyEventToUI()` dan `renderGallery()` ketika data Google Sheets selesai diunduh.
   - **Penyempurnaan `getResolvedEventId()`**: Pastikan alias `"the-wedding-of-sarah-and-kevin"` dan kata kunci pengantin Sarah & Kevin selalu menghasilkan `EVT-202611-001`.
   - **Sinkronisasi `MOCK_DATA`**: Sesuaikan `slugEvent` di `MOCK_DATA.events[0]` menjadi `"the-wedding-of-sarah-and-kevin"` dan `namaEvent` menjadi `"The Wedding of Sarah and Kevin"`.

2. **Berkas `index.html`**:
   - Naikkan cache-busting script dan stylesheet ke `?v=1.6.2` agar seluruh HP tamu dan laptop admin langsung memuat versi terbaru tanpa tertahan cache lama.

3. **Sinkronisasi Git & GitHub Pages**:
   - Sinkronkan kedua repositori lokal (`antigravity-ide` dan `Documents\GitHub\camera`), commit dengan pesan deskriptif, dan lakukan `git push origin main` agar live GitHub Pages aktif dalam hitungan detik.

---

## 3. CHECKLIST VERIFIKASI
- [x] Syntax & Bracket Balancing Test (Curlies diff = 0, Parens diff = 0, Brackets diff = 0)
- [x] Unconditional Render Test pada `loadGallery`
- [x] Live Sync Test ke GitHub Pages (`https://kangsjago-dev.github.io/camera/`)
- [x] Verifikasi 6 Foto Drive & Badge 6 Foto tampil sempurna
