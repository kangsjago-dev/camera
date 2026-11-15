# RENCANA REVISI & DIAGNOSIS SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
VERSI TARGET: v2.3.1
STATUS: SELESAI DITERAPKAN (VERSION 2.3.1)
AUTHOR: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
TANGGAL: 16 November 2026
================================================================================

## 1. RINGKASAN TINDAKAN v2.3.1
1. **Konfigurasi Server Vercel Modern (`vercel.json`):**
   - Mengubah sintaks routing legacy `"routes"` menjadi standar modern `"rewrites"`.
   - Mengarahkan seluruh wildcard rute ke `/index.html` (SPA fallback) tanpa memblokir aset statis.
   - Mengamankan headers CORS (`Access-Control-Allow-Origin: *`) dan kontrol cache (`no-cache, no-store, must-revalidate`).

2. **Diagnosis & Solusi Domain Kustom `runway.my.id`:**
   - Hasil audit jaringan:
     - `https://camera-blush-theta.vercel.app` &rarr; Status 200 OK (Utuh 104 KB, berfungsi normal).
     - `https://runway.my.id` &rarr; Status 308 Redirect ke `https://www.runway.my.id/`.
     - `https://www.runway.my.id` &rarr; Status 404 NOT_FOUND di edge router Vercel (karena subdomain `www` belum didaftarkan di project Vercel).
   - Solusi:
     1. Gunakan link langsung `https://camera-blush-theta.vercel.app` untuk akses instan.
     2. Di Vercel Dashboard > Project `camera` > Settings > Domains: Hapus centang redirect ke `www` pada domain `runway.my.id` agar domain utama langsung aktif.

3. **Komitmen Zero-Regression:**
   - Seluruh logika kamera, frame selector, Google Drive upload, dan pengaturan backend GAS tetap dipertahankan 100% utuh tanpa perubahan.
