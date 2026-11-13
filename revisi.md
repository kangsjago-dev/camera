# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (HOTFIX v1.6.4: FRAME SETTINGS IMMEDIATE PREVIEW & SYNC)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.6.4 (Immediate Designated Frame Preview & Strict Frame Synchronization)
================================================================================

## 1. DIAGNOSIS PENUH & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Pengguna meminta:
- "/zettbot preview frame langsung menampilkan settingan frame yang telah ditentukan, jangan tampilkan yang lainnya, buat menjadi sync, jangan ubah apapun apabila tidak dibutuhkan"
- Foto tangkapan layar ponsel menunjukkan viewfinder kamera masih memuat bingkai bawaan default `GOLD_DECO`, dan teks built-in overlay menumpuk.

### Analisis Mendalam Akar Masalah (Why it Happened):
1. **Inisialisasi Frame di `STATE.activeFrame` Default Hardcoded ke `GOLD_DECO`**:
   - Saat aplikasi pertama kali dimuat di HP tamu, `STATE.activeFrame` terisi `GOLD_DECO`.
   - Ketika `loadEventData()` mengambil event dari server, objek `activeFrames` dari Google Sheets (`{"mode":"single","locked":"CUSTOM_EVENT","frames":["CUSTOM_EVENT"]}`) tidak ter-unpack dengan benar karena berbentuk objek bukan array.
   - Akibatnya, sistem mundur ke fallback default (`GOLD_DECO`).

2. **Overlay Custom PNG Masih Menampilkan Teks Built-in**:
   - Di fungsi `applyActiveFrame()`, saat bingkai kustom PNG aktif, overlay teks bawaan (`viewfinderFrameOverlay`) tidak di-`hidden` sepenuhnya sehingga teks hashtag dan tanggal masih menumpuk di atas bingkai kustom.

3. **Bingkai yang Tidak Dipilih Masih Muncul di Pilihan**:
   - Fungsi `getAvailableFrames()` belum memfilter secara ketat bingkai yang tidak dicentang admin pada mode Bebas Pilih (Multi-Frame).

## 2. PERBAIKAN OPERASIONAL YANG DITERAPKAN (HOTFIX v1.6.4)
1. **Unpacking Objek Kebijakan Bingkai Real-Time di `loadEventData()`**:
   - Mendukung format respon Google Apps Script baik berupa objek (`{ mode, locked, frames }`) maupun array.
   - Variabel `frameLockMode`, `singleLockedFrame`, dan `activeFrames` langsung tervalidasi dan tersinkronisasi seketika.

2. **Preview Frame Langsung Menampilkan Settingan Resmi Acara**:
   - Begitu data acara termuat (atau saat membuka kamera), sistem langsung mencocokkan `STATE.activeFrame` dengan bingkai yang telah ditentukan oleh admin (`availFrames[0].id` atau `singleLockedFrame`).
   - Kamera langsung menampilkan bingkai tersebut tanpa perlu klik manual.

3. **Penyaringan Ketat ("Jangan Tampilkan yang Lainnya")**:
   - Pada mode Single Lock: Hanya 1 bingkai terkunci yang dikembalikan. Tombol pergantian bingkai otomatis terkunci / disembunyikan.
   - Pada mode Multi-Frame: HANYA bingkai yang dicentang admin (`activeFrames`) yang dikembalikan dan ditampilkan di tombol review. Seluruh bingkai yang tidak dicentang otomatis disembunyikan total.

4. **Tampilan Bersih Custom PNG di Viewfinder**:
   - Saat bingkai kustom PNG aktif, built-in text overlay otomatis di-`hidden` 100% sehingga tampilan jernih sesuai desain PNG acara.

5. **Pembaruan Kolom di `code.gs`**:
   - Memperbaiki pembacaan kolom spreadsheet dari 16 ke 17 kolom agar kolom `CUSTOM_FRAME_URL` selalu terbaca sempurna.

6. **Cache-Busting**:
   - Menaikkan versi script dan stylesheet ke `v=1.6.4` di `index.html`.

## 3. CHECKLIST VERIFIKASI
- [x] Syntax & Bracket Balancing Test (Curlies: 0, Parens: 0, Brackets: 0 di app.js dan code.gs)
- [x] Unpacking objek frame dari backend GAS teruji
- [x] Viewfinder preview langsung sync ke bingkai resmi yang ditentukan
- [x] Bingkai yang tidak dicentang admin tidak ditampilkan sama sekali
- [x] Komitmen Git siap di-push di GitHub Desktop
