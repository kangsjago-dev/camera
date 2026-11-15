# LOG REVISI & STATUS PERBAIKAN SISTEM (revisi.md)
# Projek: SnapEvent - Web App Disposable Camera & Live Event Gallery
================================================================================
STATUS: SUDAH DILAKSANAKAN & TERVERIFIKASI (v2.2.4)
AUTHOR: ZettBOT by Zettbos (System Architect & Mentor)
TANGGAL: 15 November 2026
================================================================================

## 1. AKAR MASALAH (ROOT CAUSE) PADA DEVICE LAIN BELUM BERUBAH
1. **Prioritas Penyimpanan Lokal di Device Lain Mengabaikan Update Cloud:**
   - *Penyebab:* Pada `loadEventData()`, sistem sebelumnya mendahulukan `localSavedCats` jika perangkat pernah menyimpan kategori di `localStorage` (`hasLocalSavedCats === true`). Ketika Admin mengubah kategori dan bingkai di Device A lalu menyimpannya ke cloud, Device B yang sudah pernah berkunjung tetap membaca cache lokal lamanya (yang berisi nama usang seperti `Best Picture` atau `Momen Terbaper`) dan menolak menimpa dengan data terbaru dari Google Sheets.
   - *Solusi ZettBOT:* Konfigurasi cloud Google Sheets (`cfgCats` dari `globalConfig` dan `res.categories` dari sheet `Kategori`) kini ditetapkan sebagai **SUMBER KEBENARAN OTORITATIF TERTINGGI (Single Source of Truth)**. Seluruh device lain otomatis menarik data cloud, membersihkan tombstone lama, memperbarui `localStorage`, dan mengaktifkan kategori yang sama persis dengan yang disimpan Admin.

2. **Desinkronisasi Acara Aktif pada Device Lain Tanpa URL Parameter:**
   - *Penyebab:* Ketika Device B membuka website tanpa parameter `?event=...`, `initApp()` sebelumnya memilih `STATE.events[0]` (yang berisi acara lama `EVT-202611-001` berstatus `INAKTIF`). Akibatnya, request `getEventDetails` gagal dan Device B tidak pernah tersinkron ke acara `EVT-202611-392`.
   - *Solusi ZettBOT:* `initApp()` dan `loadEventData()` kini secara otomatis mendeteksi acara `AKTIF` dari cloud (`res.globalConfig.active_event_id`). Jika URL tidak membawa event ID, sistem secara proaktif langsung mengarahkan dan menyinkronkan seluruh device ke acara global yang sedang aktif (`EVT-202611-392`).

3. **Sinkronisasi Real-Time Pengaturan Bingkai (Frame Policy):**
   - *Penyebab:* Mode bingkai Multi-Frame (`GOLD_DECO`, `POLAROID`, `MINIMAL`) yang disimpan Admin di cloud belum langsung dieksekusi ulang ke viewfinder kamera jika device lain tidak berpindah halaman.
   - *Solusi ZettBOT:* `applyActiveFrame(inferredLocked || STATE.activeFrame)` kini dieksekusi seketika saat data cloud tiba di `loadEventData()`, memperbarui container pilihan bingkai, badge kunci, dan overlay bingkai pada kamera live stream.

4. **Input Tanggal Acara Kosong (`mm / dd / yyyy`):**
   - *Penyebab:* Pada form edit admin, jika field tanggal acara sempat belum terisi dari string backend atau dibuka via tab switch, input tidak memiliki fallback tanggal aktif.
   - *Solusi ZettBOT:* Menambahkan pelindung multi-tier di `populateEditEventForm` dan listener tab switcher `create`: jika input tanggal kosong, sistem otomatis mengisinya dengan tanggal acara aktif atau tanggal hari ini dalam format standar ISO `YYYY-MM-DD`.

5. **Modal "Beri Suara / Like" Menggunakan Kategori Usang:**
   - *Penyebab:* `openVoteCategoryModal()` sebelumnya memanggil `loadEventCategories(STATE.activeEventId)` secara langsung yang sempat membaca storage lama (menghasilkan opsi `Momen Terbaper`).
   - *Solusi ZettBOT:* Modal voting kini memprioritaskan `STATE.activeCategories` yang telah disinkronkan dari cloud, menampilkan 3 kategori resmi:
     1. 👑 **Best Dressed Guest**
     2. 👑 **Best Outfit**
     3. 👑 **Pose Terheboh**

6. **Interval Heartbeat & Window Focus Listener:**
   - *Solusi ZettBOT:* Mempercepat background heartbeat menjadi 15 detik dan memasang listener `window.addEventListener('focus', ...)` sehingga begitu pengguna membuka atau membuka kembali tab browser di HP/laptop lain, seluruh pengaturan acara, bingkai, dan kategori langsung tersinkron seketika (0 delay).

================================================================================
## 2. FILE TERDAMPAK
1. `app.js` (Otoritas cloud config, multi-device auto active event, update modal vote, live sync bingkai, auto-fill tanggal acara, heartbeat 15s + focus listener)
2. `index.html` (Cache busting `app.js?v=2.2.4`)
3. `revisi.md` (Dokumentasi audit dan status penyelesaian v2.2.4)
================================================================================
