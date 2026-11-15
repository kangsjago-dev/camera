# LOG REVISI & STATUS PERBAIKAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SUDAH DILAKSANAKAN & TERVERIFIKASI (v2.2.2)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 15 November 2026
================================================================================

## 1. AKAR MASALAH YANG DITEMUKAN & PENYELESAIAN
1. **Penyimpanan Acara Admin Tidak Berubah:**
   - *Penyebab:* Form admin sebelumnya hanya mengaktifkan acara jika ID acara yang diedit sama persis dengan `STATE.activeEventId` atau jika total acara hanya 1. Jika pengguna mengedit acara lain, acara yang aktif tidak diperbarui dan data di cloud sempat tertimpa pembacaan config lama.
   - *Solusi ZettBOT:* Pengeditan dan penyimpanan acara kini **secara tanpa syarat** langsung memperbarui `STATE.activeEvent`, `STATE.activeEventId`, dan `STATE.activeCategories`, disimpan permanen di `localStorage`, disinkronkan langsung via REST API ke Google Sheets & Google Apps Script (`adminSaveEvent` + `adminUpdateGlobalConfig`), dan seketika memperbarui antarmuka pengguna (`applyEventToUI`).

2. **Kategori Poling / Voting Selalu Berubah / Turun Menjadi 1 Kategori:**
   - *Penyebab:* Pada saat refresh, kategori sempat terisi 3 kategori lokal, namun jeda beberapa detik kemudian server cloud revalidation mengirim data usang (`cfgCats` dengan hanya 1 atau 2 kategori lama) yang menimpa kategori lokal.
   - *Solusi ZettBOT:* 
     * Proteksi penyimpanan lokal: jika kategori lokal memiliki minimal 3 kategori valid (`Best Dressed Guest`, `Best Outfit`, `Pose Terheboh`), data tersebut memiliki prioritas otoritatif dan terlindungi dari overwrite cache usang.
     * Normalisasi otomatis: seluruh nama usang seperti `Best Picture`, `Momen Terbaper`, `The Best Groupie`, `Paling Populer`, dan `Senyum Terhangat` secara otomatis dimigrasikan ke 3 standar resmi:
       1. 👑 **Best Dressed Guest**
       2. 👑 **Best Outfit**
       3. 👑 **Pose Terheboh**
     * Eliminasi duplikasi nama kategori dan jaminan minimal 3 kategori pada galeri tab maupun modal pemungutan suara (`modalVoteCategory`).

3. **Input Tanggal Acara Kosong (`mm / dd / yyyy`):**
   - *Penyebab:* Elemen `<input type="date">` pada form modal/edit sebelumnya tidak memiliki atribut value bawaan, dan parser tanggal sempat mengembalikan string kosong jika format string dari backend tidak terstandarisasi.
   - *Solusi ZettBOT:* Menetapkan nilai default `value="2026-11-15"` pada HTML dan memastikan `formatDateForInput()` selalu mengonversi tanggal ke format ISO `YYYY-MM-DD` yang valid untuk browser Chromium/Mobile, sehingga input tanggal tidak pernah lagi kosong.

4. **Koneksi Backend & Event Status Inaktif:**
   - *Penyebab:* Status acara aktif di database server sempat berada pada status `INAKTIF` sehingga memicu penolakan `"Event tidak ditemukan atau sudah tidak aktif"`.
   - *Solusi ZettBOT:* Acara utama telah disetel kembali menjadi `AKTIF` di Google Sheets, `callGasApiSafe` dioptimalkan agar aksi pembacaan data (`getEventDetails`, `getGallery`) langsung berjalan cepat via GET tanpa hambatan CORS atau delay POST.

================================================================================
## 2. FILE TERDAMPAK
1. `app.js` (Optimasi API dispatcher, normalisasi 3 kategori, proteksi overwrite lokal, aktivasi otomatis event simpan)
2. `index.html` (Perbaikan input tanggal acara, penambahan tombol ➕ Buat Acara, cache busting v2.2.2)
3. `revisi.md` (Dokumentasi audit dan status penyelesaian)
================================================================================


================================================================================
# PERBAIKAN ZETTBOT v4.1 - SESI 15 NOVEMBER 2026 (REVISI BUG PENGHAPUSAN KATEGORI)
================================================================================
## 1. AKAR MASALAH (ROOT CAUSE) KATEGORI DI-DELETE MASIH KEMBALI
- **Penyebab Utama:**
  Pada implementasi sebelumnya, terdapat pengecekan defensif `if (result.length < 3)` dan `if (finalCats.length < 3)` di beberapa fungsi inti (`loadEventCategories`, `loadEventData`, dan `applyEventToUI`). Ketika admin menghapus salah satu kategori melalui tombol silang `✕` (misal dari 3 menjadi 2 atau 1 kategori), sistem membaca jumlah kategori `< 3` dan secara otomatis "menghidupkan kembali" (resurrect) kategori yang baru saja dihapus dengan menariknya dari template bawaan atau config cloud lama.
  
## 2. SOLUSI & PERBAIKAN ARSITEKTUR ZETTBOT
1. **Penerapan Tombstone Registry Kategori Terhapus (`getDeletedCategoriesSet` & `recordDeletedCategory`):**
   - Saat admin menekan tombol silang `✕` pada baris kategori di form admin (`#categoryInputsContainer`), nama kategori yang dihapus langsung dicatat ke dalam registry persistent `snapevent_deleted_categories_{eventId}`.
   - Kategori yang berada di dalam registry ini diblokir secara permanen dari proses rendering tab galeri, modal voting, dan form edit, sehingga **tidak akan pernah muncul kembali**.
   - Perubahan langsung di-render secara reaktif ke UI (`applyEventToUI`, `renderGallery`) seketika tombol `✕` diklik.
2. **Dukungan Jumlah Kategori Dinamis (Bebas Custom 1, 2, 3, dst.):**
   - Menghapus paksaan `length < 3` di seluruh fungsi (`loadEventCategories`, `loadEventData`, `applyEventToUI`).
   - Sistem kini sepenuhnya menghormati jumlah kategori yang ditentukan oleh pengguna, baik 1 kategori, 2 kategori, maupun lebih.
3. **Penyelarasan Sinkronisasi Cloud (Google Apps Script):**
   - Saat form disimpan, kategori yang masih bertahan dikirim ke backend Google Apps Script (`adminSaveEvent` + `adminUpdateGlobalConfig`).
   - Pada Google Apps Script, baris kategori lama acara tersebut di sheet `Kategori` dihapus bersih dan digantikan hanya dengan kategori yang tersisa.
4. **Cache Busting & Deployment Otomatis:**
   - Script version diperbarui menjadi `app.js?v=2.2.3` pada `index.html` dan telah di-push serta live di Vercel Production (`https://camera-blush-theta.vercel.app`).
================================================================================
