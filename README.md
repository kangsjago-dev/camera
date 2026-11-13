# SNAPEVENT - Disposable Event Camera & Live Gallery

Web App kamera sekali pakai (*disposable camera*) digital khusus acara pesta, pernikahan, dan gathering. Tamu dapat memotret langsung dengan filter retro dan custom frame acara, otomatis tersimpan ke Google Drive, bersaing dalam voting kategori, serta tampil di proyektor panggung (Live Slideshow).

---

## 📸 Fitur Utama (Sesuai Referensi Visual)

1. **Kamera Sekali Pakai Digital (Mobile-First):**
   - Akses via browser HP tanpa perlu instal aplikasi.
   - Kuota jepretan rol film terbatas per tamu (misal: 10 foto).
   - Pilihan filter analog: **RAW Asli**, **800T Cine (Gold Halation)**, **Warm Golden Hour**, **B&W Noir**.
   - Custom Frame otomatis: **✨ Gold Art-Deco** (mewah berornamen emas & tanggal), **📷 Classic Polaroid** (font tulisan tangan), **▪️ Minimalist Clean**.
   - Efek blitz kamera (*camera flash*) dan suara jepretan.

2. **Galeri & Poling Foto Interaktif:**
   - Grid foto responsif dengan sistem suka / like (ketat 1x per kategori).
   - Kategori voting dinamis (contoh: *Best Outfit, Pose Terheboh, Momen Romantis*).
   - **🏆 Podium Pemenang Voting (Hall of Fame):** Menampilkan juara foto terfavorit (Juara 1 Emas 🥇, Juara 2 Perak 🥈, Juara 3 Perunggu 🥉) berdasarkan like terbanyak.
   - **Mode Waktu Reveal:**
     - *Selama Acara:* Foto langsung muncul seketika di galeri.
     - *Setelah Acara:* Foto dikunci di rol rahasia dan diungkap serentak saat pesta selesai.

3. **Layar Proyektor Panggung (Live Venue Slideshow):**
   - Tampilan layar penuh (*Full Screen*) untuk dihubungkan ke LED TV / proyektor ballroom.
   - Transisi *Ken Burns* sinematik menampilkan foto-foto terbaru kiriman tamu beserta nama & ucapan.
   - Dilengkapi **QR Code nyata beresolusi tinggi** di pojok layar agar tamu di meja pesta bisa langsung scan dengan kamera ponsel untuk memotret.

4. **Penyimpanan Cloud Otomatis ke Google Drive:**
   - Semua foto yang dijepret tamu langsung masuk ke folder Google Drive penyelenggara acara (anti-CORS direct upload).
   - Google Sheets sebagai database ringan, aman, dan tanpa biaya langganan server (100% Gratis).

5. **Panel Pengelola Acara (Admin & Kru Multi-User):**
   - Kredensial login Username & Password (Default: `admin` / `admin123` atau `crew` / `crew123`).
   - Fitur **🔑 Ganti Password** mandiri bagi pengguna yang sedang login.
   - Formulir **+ Tambah Akun Pengguna** (Role: Administrator atau Operator Kru).
   - Alur pembuatan event baru yang bersih (`+ Buat Event Baru`) dengan ID otomatis `EVT-YYYYMM-XXX`.
   - Unggah **Bingkai Kustom (Multi-Frame)** dengan pilihan cakupan: *Semua Acara (Global)* atau *Khusus Acara Tertentu*.
   - Modal **📲 Link & QR** dengan tombol *Salin Tautan* dan *Unduh Gambar QR*.

---

## 🚀 Panduan Menjalankan & Memasang (Deployment)

### Langkah 1: Uji Coba Cepat di Komputer / HP
File `index.html` sudah siap pakai dan dilengkapi data demo:
1. Cukup klik ganda berkas `index.html` di komputer Anda, atau buka melalui browser (Chrome / Safari / Edge).
2. Anda bisa langsung mencoba fitur kamera, ganti filter, ganti bingkai, dan melihat galeri.

---

### Langkah 2: Pemasangan Backend Google Apps Script (Gratis & Terhubung Drive)

1. **Buat Google Sheets Baru:**
   - Buka [Google Sheets](https://sheets.new) di browser Anda.
   - Beri nama spreadsheet, misalnya: `SnapEvent Database`.

2. **Buka Editor Script:**
   - Di Google Sheets, klik menu **Extensions (Ekstensi)** > **Apps Script**.

3. **Salin Kode Backend:**
   - Di editor Apps Script, buat berkas script baru bernama `setup.gs`, lalu salin seluruh isi dari file [`setup.gs`](file:///c:/Users/Administrator/.gemini/antigravity-ide/project/camera/setup.gs) di repositori ini.
   - Buka berkas `Code.gs` bawaan (atau ganti namanya jadi `code.gs`), lalu salin seluruh isi dari file [`code.gs`](file:///c:/Users/Administrator/.gemini/antigravity-ide/project/camera/code.gs).

4. **Inisialisasi Database:**
   - Pada dropdown fungsi di bagian atas editor Apps Script, pilih fungsi **`inisialisasiDatabase`**.
   - Klik tombol **Run (Jalankan)**.
   - Berikan izin akses (*Review Permissions*) saat jendela pop-up Google meminta otorisasi (pilih akun Google Anda > *Advanced* > *Go to SnapEvent*).
   - Tunggu hingga proses selesai. Lembar kerja Google Sheets Anda akan otomatis terisi tab `DataEvent`, `DataFoto`, `DataKategoriVoting`, `DataVoting`, dan `DataPengaturanGlobal`.

5. **Deploy sebagai Web App:**
   - Klik tombol biru **Deploy** di kanan atas > **New deployment**.
   - Klik ikon gerigi di sebelah kiri > pilih **Web app**.
   - Masukkan konfigurasi berikut:
     * **Description:** `SnapEvent API v1.0`
     * **Execute as:** `Me (email Anda)`
     * **Who has access:** `Anyone (Siapa saja)` *(Penting agar tamu pesta bisa upload foto tanpa login Google)*.
   - Klik **Deploy**, lalu salin **Web app URL** yang muncul (berformat: `https://script.google.com/macros/s/.../exec`).

6. **Hubungkan Frontend ke Backend:**
   - Buka aplikasi `index.html` di browser Anda.
   - Klik ikon gerigi Admin di pojok kanan atas, masukkan **Username:** `admin` dan **Password:** `admin123`.
   - Buka tab **Pengaturan Global**.
   - Tempelkan URL Web App yang tadi disalin ke kolom **URL Backend Google Apps Script**.
   - Klik **Simpan Konfigurasi**.
   - Selesai! Sekarang semua foto yang dijepret tamu akan otomatis terkirim ke Google Drive Anda dan tercatat di Google Sheets.

---

### Langkah 3: Deploy Frontend ke Internet (Gratis via GitHub Pages / Vercel)
Agar tamu bisa membuka web app melalui ponsel masing-masing:
- **Opsi A (GitHub Pages - Sangat Disarankan):**
  1. Buat repository baru di GitHub (misal: `snapevent-camera`).
  2. Unggah 3 berkas utama: `index.html`, `style.css`, dan `app.js`.
  3. Buka tab **Settings** repositori > pilih menu **Pages** di bilah kiri.
  4. Pada bagian *Build and deployment*, pilih Branch: `main` / `root`, lalu klik **Save**.
  5. Dalam 1-2 menit, situs Anda langsung online di `https://username.github.io/snapevent-camera/`!
- **Opsi B (Vercel / Netlify):**
  Cukup seret (drag & drop) folder yang memuat `index.html`, `style.css`, dan `app.js` ke dashboard Vercel atau Netlify.
- Tautan web app Anda siap dibagikan ke tamu pesta atau dicetak menjadi QR Code di meja event!

---

## 🔒 Kredensial Login Bawaan (Default Accounts)
- **Akun Administrator:**
  * **Username:** `admin`
  * **Password:** `admin123`
- **Akun Operator Kru:**
  * **Username:** `crew`
  * **Password:** `crew123`
- *(Kredensial dan daftar akun operator dapat ditambah/diubah kapan saja melalui menu Admin > Pengaturan Global)*.

