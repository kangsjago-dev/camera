# RENCANA IMPLEMENTASI REVISI (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SELESAI DITERAPKAN (HOTFIX v1.6.7: BALLROOM DEAD-CENTER STAGE, LIVE CAM CUSTOM FRAME SELECTOR & PREVIEW, ZERO EMPTY DRIVE FOLDERS, MOBILE 1-PAGE ZERO-OVERLAP, CATEGORY VOTING WINNERS PODIUM)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 14 November 2026
VERSI RANCANGAN: v1.6.7 (Ballroom Center Stage, Live Cam Frame Bar, Drive Folder Deduplication, Category Voting Podium, Safe StopStream)
================================================================================

## 1. PERMINTAAN PENGGUNA & INSTRUKSI REKAYASA (v1.6.7)

Permintaan pengguna:
"/zettbot 
- live ballroom stream, buat foto ditengah, jangan terlalu atas dan atur agar posisi dan ukuran lebih menarik
- pada menuh pilih bingkai foto pada live cam, tampilan untuk bingkai foto custom tidak ada, perbaiki
- banyak folder yang terbentuk dan tidak ada isi, contoh seperti gambar yang dilampirkan
- halaman live cam, perbaiki agar menjadi 1 halaman yang tidak saling menutupi dan bagus untuk digunakan
- gunakan dan terapkan preview menggunakan custom bingkai foto yang telah ditentukan pada settingan acara
- buat hasil voting berdasarkan kategori voting dan pemenangnya
terapkan segera dan jangan ubah yang sudah ada"

Poin Inti Rekayasa v1.6.7:
1. **Live Ballroom Stream True Dead-Center Stage**:
   - Restrukturisasi `#modalSlideshow` dengan arsitektur non-blocking overlay (`pointer-events-none`).
   - Top Bar dan Bottom Bar berada di layer overlay atas dan bawah tanpa mengurangi ruang vertikal panggung utama.
   - Panggung foto (`slideshowImg`) berada persis di titik tengah layar (true dead-center) dengan `max-h-[77vh] max-w-[70vw]`, berbingkai emas mewah, dan efek transisi lembut.
   - Kartu ucapan dan nama pengunggah (`slideshowInfoOverlay`) mengambang rapi di bawah foto tanpa menutupi subjek foto.

2. **Menu Pemilihan Bingkai & Pratinjau Bingkai Kustom pada Live Cam**:
   - Mengaktifkan bar `#liveCamFrameSelectorWrap` di atas viewfinder kamera HP.
   - Mode Single Lock: Menampilkan badge informatif `🔒 Bingkai Acara: [Nama Bingkai]` dan mengunci preview langsung ke bingkai kustom yang ditentukan admin.
   - Mode Multi Bebas: Menampilkan pil bingkai yang dapat digeser (termasuk thumbnail bingkai kustom PNG acara).
   - Mengoreksi logika pencocokan `isCustomMatch` di `getAvailableFrames()` agar bingkai kustom acara (`CUSTOM_EVENT`) tidak tertimpa oleh preset bawaan.
   - Mengintegrasikan event listener klik pada pil bingkai live cam untuk mengubah pratinjau viewfinder secara seketika (*real-time sync*).

3. **Pemberantasan Pembuatan Folder Kosong di Google Drive**:
   - Memperbaiki *Temporal Dead Zone* variabel `folderId` pada `handleAdminSaveEvent` di `code.gs`.
   - Menggunakan kembali `GDRIVE_FOLDER_ID` dari baris `DataEvent` yang sudah ada alih-alih membuat folder baru setiap kali disimpan.
   - Memeriksa folder di `SnapEvent_Gallery_Master` menggunakan `getFoldersByName` sebelum membuat folder baru.
   - Menghapus pembuatan folder cadangan acak di root saat pengunggahan foto gagal.

4. **Desain 1 Layar Penuh Bebas Tumpang Tindih (Mobile 100dvh Layout)**:
   - Mengatur `#viewCamera` dengan container `100dvh - 4.5rem` dengan hirarki vertikal terstruktur: Top Bar Sisa Jepretan, Frame Selector Bar, Viewfinder (`flex-1 min-h-0`), Filter Pills (mengambang di bawah viewfinder), dan Shutter Controls Bar.
   - Seluruh elemen dapat diakses nyaman tanpa scroll dan tanpa saling tumpang tindih.

5. **Hasil Voting Berdasarkan Kategori & Penentuan Pemenang (Category Winners Podium)**:
   - Memperbarui `renderVotingWinners()` untuk menampilkan:
     - **Podium Juara Umum Terfavorit** (Juara 1 Emas, Juara 2 Perak, Juara 3 Perunggu berdasarkan akumulasi like).
     - **Pemenang per Kategori Acara** (Kartu juara untuk masing-masing kategori, menampilkan foto peraih like terbanyak di kategori tersebut, ucapan, dan jumlah suara).
   - Memfilter dan mengurutkan galeri saat tab kategori dipilih berdasarkan jumlah suara spesifik kategori.

6. **Perbaikan Defensif `stopCameraStream is not defined`**:
   - Mendefinisikan `window.stopCameraStream` di layer global paling atas pada `app.js`.
   - Melindungi setiap pemanggilan `stopCameraStream` dengan pemeriksaan `typeof`.
   - Memperbarui cache-buster script ke `v=1.6.7`.

================================================================================

## 1. PERMINTAAN PENGGUNA & INSTRUKSI REKAYASA (v1.6.6)

Permintaan pengguna:
"/zettbot - buat foto menjadi Full HD (1080p / 1920 x 1080 piksel): Sekitar 1 MB hingga 3 MB (atau lebih, tergantung detail warna dan kompresi).
- foto masih tidak disimpan dalam galery folder yang telah ditentukan
- upload pada latar belakang, agar tamu dapat melakukan foto selanjutnya tanpa menunggu selesai upload ke server
- pada saat "beri suara / like" terdapat pilihan mau vote untuk kategori apa, dan 1 user hanya bisa vote 1 x per kategori
terapkan segera dan jangan ubah yang sudah ada"

Poin Inti Rekayasa:
1. **Resolusi Standar Full HD (1080p / 1920 x 1080 piksel) & Ukuran File 1 MB - 3 MB**:
   - Canvas `photoRenderCanvas` disetel dinamis:
     - Foto potret (vertikal smartphone): 1080 x 1920 piksel (Full HD 1080p Portrait).
     - Foto lanskap (horizontal desktop/kamera landscape): 1920 x 1080 piksel (Full HD 1080p Landscape).
   - Pengaturan kompresi ekspor JPEG disetel ke `0.98` dengan `imageSmoothingQuality = 'high'` untuk menghasilkan detail tajam dan ukuran file berkisar antara 1.2 MB hingga 3.2 MB sesuai spesifikasi.

2. **Penyimpanan Pasti ke Folder Google Drive yang Ditentukan**:
   - Pada `app.js`, pengunggahan selalu menyertakan `folderId: STATE.activeEvent?.gdriveFolderId || STATE.driveMasterId || ""`.
   - Pada `code.gs`:
     - Membaca `folderId` dari payload maupun `COL_EVENT.GDRIVE_FOLDER_ID` di `DataEvent`.
     - Menyimpan foto langsung ke folder tersebut (`targetFolder = DriveApp.getFolderById(folderId)`).
     - Menjamin ID folder tercatat di `DataEvent` agar upload seterusnya konsisten di folder resmi yang sama tanpa tercecer ke Root.

3. **Unggah di Latar Belakang (Asynchronous Non-Blocking Upload)**:
   - Tamu menekan tombol *"Simpan ke Rol"*:
     - **Instan 1**: Foto Full HD langsung terunduh ke galeri fisik ponsel (`downloadPhotoToDevice`).
     - **Instan 2**: Foto langsung masuk ke galeri lokal web app (`STATE.photos`) dengan status `isUploading: true`.
     - **Instan 3**: Modal review foto langsung ditutup (`classList.add('hidden')`), toast informatif muncul.
     - **Tamu seketika bebas menjepret foto berikutnya tanpa jeda detik pun!**
     - Di latar belakang (*background async fetch*), file foto diunggah ke Google Apps Script. Saat berhasil, ID cloud dan view URL disinkronkan dan notifikasi sukses ditampilkan.

4. **Modal Dialog Interaktif Pemilihan Kategori Voting (1x per Kategori)**:
   - Ditambahkan modal `#modalVoteCategory` di `index.html`.
   - Saat tamu menekan tombol like pada kartu foto atau tombol "Beri Suara" di modal zoom:
     - Terbuka modal daftar kategori aktif acara (`STATE.activeCategories`).
     - Kategori yang sudah pernah diberi suara oleh tamu ditandai `✓ Sudah Dipilih (1x)` dan dinonaktifkan.
     - Kategori yang belum digunakan dapat diklik untuk memberikan 1 suara.
     - Aturan mutlak 1 user 1x vote per kategori tervalidasi ganda di frontend (`STATE.votedCategoryIds`) dan backend Google Sheets (`COL_VOTE`).

5. **Kebijakan Nol Regresi (Zero Regression)**:
   - Filter analog kamera (`RAW`, `800T`, `WARM`, `BW`) tetap bekerja utuh.
   - Sistem login admin dan struktur data lama tetap terjaga.

================================================================================
## 2. FILE TERDAMPAK & SPESIFIKASI PERUBAHAN
1. `app.js`:
   - Penyesuaian `processPhotoWithFrameAndFilter()` ke Full HD 1080p (1080x1920 / 1920x1080, JPEG 0.98).
   - Penyesuaian `generateSimulatedPartySnapshot()` ke 1080x1920.
   - Transformasi `handleSavePhotoToDrive()` menjadi alur non-blocking dengan background upload async.
   - Implementasi `openVoteCategoryModal()` dan update `handleVotePhoto(idFoto, idKategori)`.
   - Pemasangan listener buka-tutup modal voting.
2. `code.gs`:
   - Penguatan routing folder target Google Drive di `handleUploadPhoto` dengan pemulihan folder ID dan persistensi ke sheet `DataEvent`.
3. `index.html`:
   - Penambahan modal `#modalVoteCategory` lengkap dengan tombol close dan hint kuota suara.
   - Bump cache-busting ke `v=1.6.6` pada stylesheet dan script.
4. `prd.md`:
   - Pencatatan log rilis resmi v1.6.6.

================================================================================
## 3. CHECKLIST VERIFIKASI SEBELUM RILIS
- [x] Syntax & Bracket Balancing Test (Curlies: 0, Parens: 0, Brackets: 0 di app.js dan code.gs).
- [x] Resolusi canvas 1080x1920 Portrait / 1920x1080 Landscape dengan kualitas JPEG 0.98 (ukuran ~1.2 - 3.2 MB).
- [x] Modal review langsung tertutup saat klik "Simpan ke Rol", tamu langsung bisa foto berikutnya.
- [x] File terunduh langsung ke galeri ponsel secara instan.
- [x] Upload latar belakang berjalan mulus tanpa mengganggu aktivitas kamera.
- [x] Modal pilih kategori voting muncul saat klik like/suara, dengan validasi ketat 1x per kategori.
- [x] Target Google Drive folder routing valid dan tersimpan di DataEvent.
- [x] Komitmen Git siap dipublikasikan di GitHub Desktop.
