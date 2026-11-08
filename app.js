/**
 * ==============================================================================
 * SNAPEVENT: APP.JS
 * Universal Client Architecture for Event Disposable Camera & Live Gallery
 * ==============================================================================
 */

// --- 1. LOCAL STATE & IN-MEMORY CACHE ---
const STATE = {
  // Configuration & Custom Branding
  gasApiUrl: localStorage.getItem('snapevent_gas_url') || '',
  appTitle: localStorage.getItem('snapevent_app_title') || 'SnapEvent Studio',
  appLogoUrl: localStorage.getItem('snapevent_app_logo_url') || '',
  appPhone: localStorage.getItem('snapevent_app_phone') || '0812-3456-7890',
  appInstagram: localStorage.getItem('snapevent_app_instagram') || '@snapevent',
  adminUser: localStorage.getItem('snapevent_admin_user') || 'admin',
  adminPass: localStorage.getItem('snapevent_admin_pass') || 'admin123',
  adminPin: localStorage.getItem('snapevent_admin_pin') || '889900',
  userAccounts: JSON.parse(localStorage.getItem('snapevent_user_accounts') || '[{"user":"crew","pass":"crew123","role":"operator"}]'),
  currentUserRole: sessionStorage.getItem('snapevent_user_role') || 'guest',
  driveMasterId: localStorage.getItem('snapevent_drive_master_id') || '',
  customFrameImgObj: null,
  tempCustomFrameData: null,

  // Guest Profile
  guestId: getOrCreateGuestId(),
  guestNama: localStorage.getItem('snapevent_guest_nama') || '',

  // Active Event Context
  activeEventId: 'EVT-202611-001',
  activeEvent: null,
  activeCategories: [],

  // Camera & Canvas Selection
  activeFilter: '800T',
  activeFrame: 'GOLD_DECO',
  mediaStream: null,
  facingMode: 'environment', // 'environment' (back) or 'user' (front)
  rawCapturedImageObj: null, // Clean captured snapshot without frame for dynamic frame switching
  currentCapturedDataUrl: null,

  // Gallery & Photos Cache
  photos: [],
  votedPhotoIds: JSON.parse(localStorage.getItem('snapevent_voted_photos') || '[]'),
  votedCategoryIds: JSON.parse(localStorage.getItem('snapevent_voted_categories') || '[]'),
  activeGalleryFilter: 'ALL',

  // Slideshow State
  slideshowIndex: 0,
  slideshowTimer: null
};

function extractDriveFolderId(input) {
  if (!input) return "";
  const str = String(input).trim();
  const folderMatch = str.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return str;
}

// Default Seed / Mock Data for Instant Browser & Offline Preview
const MOCK_DATA = {
  event: {
    idEvent: "EVT-202611-001",
    namaEvent: "The Wedding of Sarah & Kevin",
    slugEvent: "sarah-kevin",
    tanggalEvent: "2026-11-20",
    hashtagEvent: "#SarahKevinEverAfter",
    maxFotoPerGuest: 10,
    maxVotePerGuest: 3,
    revealMode: "SEGERA", // "SEGERA" or "SETELAH"
    isRevealed: true,
    likeEnabled: true,
    publicVisible: true,
    activeCameraStyles: ["RAW", "800T", "WARM", "BW"],
    activeFrames: ["GOLD_DECO", "POLAROID", "MINIMAL"],
    gdriveFolderId: "",
    customFrameUrl: ""
  },
  categories: [
    { idKategori: "KAT-001", namaKategori: "Best Outfit", deskripsi: "Busana paling menawan malam ini", urutan: 1 },
    { idKategori: "KAT-002", namaKategori: "Pose Terheboh", deskripsi: "Gaya paling kocak dan seru", urutan: 2 },
    { idKategori: "KAT-003", namaKategori: "Momen Terbaper", deskripsi: "Momen paling romantis dan menyentuh", urutan: 3 }
  ],
  samplePhotos: [
    {
      idFoto: "FTO-DEMO-001",
      guestNama: "Sarah & Kevin",
      caption: "Momen terbaik malam ini bersama sahabat tercinta!",
      cameraStyle: "800T",
      frameStyle: "GOLD_DECO",
      gdriveViewUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80",
      totalLikes: 14,
      isFeatured: true,
      createdAt: "2026-11-08 19:15:00"
    },
    {
      idFoto: "FTO-DEMO-002",
      guestNama: "David L.",
      caption: "Keluarga besar groomsmen siap meriahkan pesta!",
      cameraStyle: "WARM",
      frameStyle: "POLAROID",
      gdriveViewUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80",
      totalLikes: 9,
      isFeatured: false,
      createdAt: "2026-11-08 19:30:00"
    },
    {
      idFoto: "FTO-DEMO-003",
      guestNama: "Clara",
      caption: "Cheers untuk cinta abadi!",
      cameraStyle: "BW",
      frameStyle: "MINIMAL",
      gdriveViewUrl: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=800&q=80",
      totalLikes: 7,
      isFeatured: false,
      createdAt: "2026-11-08 19:45:00"
    }
  ]
};

// --- 2. INITIALIZATION ON DOM READY ---
window.addEventListener('DOMContentLoaded', () => {
  initApp();
  bindEvents();
});

async function initApp() {
  // Periksa parameter URL (e.g. ?event=sarah-kevin&view=slideshow)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('event')) {
    STATE.activeEventId = urlParams.get('event');
  }

  // Muat data awal event dari API Google Apps Script atau Mock Data
  await loadEventData();

  // Cek Persistensi Sesi Admin (Anti-Keluar saat refresh F5!)
  if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
    showView('viewAdmin');
    renderAdminDashboard();
    return;
  }

  // Cek Identitas Tamu
  if (!STATE.guestNama) {
    showView('viewWelcome');
  } else {
    showView('viewCamera');
    updateRemainingQuotaDisplay();
  }

  if (urlParams.get('view') === 'slideshow') {
    openSlideshow();
  }
}

function getOrCreateGuestId() {
  let id = localStorage.getItem('snapevent_guest_id');
  if (!id) {
    id = 'GUEST-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('snapevent_guest_id', id);
  }
  return id;
}

// --- 3. DATA FETCHING (GAS API OR MOCK) ---
async function loadEventData() {
  if (STATE.gasApiUrl) {
    try {
      const resp = await fetch(`${STATE.gasApiUrl}?action=getEventDetails&eventId=${STATE.activeEventId}&guestId=${STATE.guestId}`);
      const res = await resp.json();
      if (res.status === 'success') {
        STATE.activeEvent = res.event;
        STATE.activeCategories = res.categories || [];

        if (res.globalConfig) {
          if (res.globalConfig.app_title) STATE.appTitle = res.globalConfig.app_title;
          if (res.globalConfig.app_logo_url) STATE.appLogoUrl = res.globalConfig.app_logo_url;
          if (res.globalConfig.app_phone) STATE.appPhone = res.globalConfig.app_phone;
          if (res.globalConfig.app_instagram) STATE.appInstagram = res.globalConfig.app_instagram;
          if (res.globalConfig.user_accounts) {
            try { STATE.userAccounts = JSON.parse(res.globalConfig.user_accounts); } catch (e) { }
          }
        }

        if (res.guestStats && res.guestStats.guestVotesMap) {
          const votedList = Object.keys(res.guestStats.guestVotesMap).filter(k => res.guestStats.guestVotesMap[k] > 0);
          STATE.votedCategoryIds = Array.from(new Set([...STATE.votedCategoryIds, ...votedList]));
          localStorage.setItem('snapevent_voted_categories', JSON.stringify(STATE.votedCategoryIds));
        }

        applyGlobalConfigToUI();
        applyEventToUI();
        await loadGallery();
        return;
      }
    } catch (e) {
      console.warn("Koneksi GAS API belum aktif, menggunakan mode demo:", e.message);
    }
  }

  // Fallback ke Mock Data
  STATE.activeEvent = MOCK_DATA.event;
  STATE.activeCategories = MOCK_DATA.categories;
  STATE.photos = [...MOCK_DATA.samplePhotos];
  applyGlobalConfigToUI();
  applyEventToUI();
  renderGallery();
}

async function loadGallery() {
  if (!STATE.gasApiUrl) return;
  try {
    const resp = await fetch(`${STATE.gasApiUrl}?action=getGallery&eventId=${STATE.activeEventId}&guestId=${STATE.guestId}`);
    const res = await resp.json();
    if (res.status === 'success') {
      STATE.photos = res.photos || [];
      STATE.votedPhotoIds = res.votedPhotoIds || [];
      renderGallery();
    } else if (res.status === 'locked') {
      document.getElementById('galleryLockedNotice').classList.remove('hidden');
      document.getElementById('galleryPhotoGrid').innerHTML = '';
    }
  } catch (e) {
    console.warn("Gagal memuat galeri GAS:", e.message);
  }
}

function applyGlobalConfigToUI() {
  if (STATE.appTitle) {
    const titleEl = document.getElementById('headerAppTitle');
    if (titleEl) titleEl.textContent = STATE.appTitle;
    document.title = `${STATE.appTitle} - Disposable Event Camera & Live Gallery`;
  }

  const logoImg = document.getElementById('headerCustomLogoImg');
  const defaultIcon = document.getElementById('headerDefaultLogoIcon');
  if (STATE.appLogoUrl) {
    if (logoImg) {
      logoImg.src = STATE.appLogoUrl;
      logoImg.classList.remove('hidden');
    }
    if (defaultIcon) defaultIcon.classList.add('hidden');
  } else {
    if (logoImg) logoImg.classList.add('hidden');
    if (defaultIcon) defaultIcon.classList.remove('hidden');
  }

  const btnContact = document.getElementById('btnHeaderContact');
  if (STATE.appPhone || STATE.appInstagram) {
    btnContact?.classList.remove('hidden');
    const phoneLink = document.getElementById('contactPhoneLink');
    if (phoneLink) {
      phoneLink.textContent = STATE.appPhone || 'Tidak ada';
      const cleanPhone = (STATE.appPhone || '').replace(/[^0-9]/g, '');
      phoneLink.href = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';
    }
    const igLink = document.getElementById('contactIgLink');
    if (igLink) {
      igLink.textContent = STATE.appInstagram || 'Tidak ada';
      const cleanIg = (STATE.appInstagram || '').replace('@', '');
      igLink.href = cleanIg ? `https://instagram.com/${cleanIg}` : '#';
    }
  } else {
    btnContact?.classList.add('hidden');
  }
}

function applyEventToUI() {
  const ev = STATE.activeEvent;
  if (!ev) return;

  document.getElementById('headerEventHashtag').textContent = ev.hashtagEvent || '#SnapEvent';
  document.getElementById('camEventBadge').textContent = ev.hashtagEvent || '#SnapEvent';
  document.getElementById('welcomeEventTitle').textContent = ev.namaEvent;
  document.getElementById('galleryEventTitle').textContent = ev.namaEvent;
  document.getElementById('galleryEventHashtag').textContent = ev.hashtagEvent;
  document.getElementById('slideshowTitle').textContent = ev.namaEvent;
  document.getElementById('slideshowHashtag').textContent = ev.hashtagEvent;

  document.getElementById('vfFrameBottomTitle').textContent = ev.namaEvent;
  document.getElementById('vfFrameBottomHashtag').textContent = ev.hashtagEvent;
  document.getElementById('vfFrameDate').textContent = ev.tanggalEvent || '20.11.2026';

  // Preload Custom Frame jika ada
  const frameData = ev.customFrameData || ev.customFrameUrl;
  if (frameData) {
    const cImg = new Image();
    cImg.crossOrigin = 'anonymous';
    cImg.src = frameData;
    cImg.onload = () => { STATE.customFrameImgObj = cImg; };
  } else {
    STATE.customFrameImgObj = null;
  }

  // Render Pilihan Frame di Viewfinder
  const frameContainer = document.getElementById('frameListContainer');
  let customFrameHtml = '';
  if (frameData) {
    customFrameHtml = `<button data-frame="CUSTOM" class="frame-pill shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${STATE.activeFrame === 'CUSTOM' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">✨ Frame Kustom Acara</button>`;
  }
  frameContainer.innerHTML = `
    <button data-frame="GOLD_DECO" class="frame-pill shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${STATE.activeFrame === 'GOLD_DECO' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">✨ Gold Deco</button>
    ${customFrameHtml}
    <button data-frame="POLAROID" class="frame-pill shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${STATE.activeFrame === 'POLAROID' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">📷 Polaroid</button>
    <button data-frame="MINIMAL" class="frame-pill shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${STATE.activeFrame === 'MINIMAL' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">▪️ Minimalist</button>
    <button data-frame="NONE" class="frame-pill shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${STATE.activeFrame === 'NONE' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">Tanpa Bingkai</button>
  `;

  // Render Kategori Voting di Galeri
  const catContainer = document.getElementById('galleryCategoryTabs');
  catContainer.innerHTML = `
    <button data-cat="ALL" class="cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brand-gold text-black border border-brand-gold transition shadow-sm">Semua Foto</button>
    <button data-cat="POPULAR" class="cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 text-zinc-300 border border-white/10 hover:border-brand-gold/50 transition">🔥 Paling Populer</button>
  `;

  STATE.activeCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.setAttribute('data-cat', cat.idKategori);
    btn.className = "cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 text-zinc-300 border border-white/10 hover:border-brand-gold/50 transition";
    btn.textContent = `👑 ${cat.namaKategori}`;
    catContainer.appendChild(btn);
  });
}

// --- 4. VIEW ROUTER & NAVIGATION ---
function showView(viewId) {
  ['viewWelcome', 'viewCamera', 'viewGallery', 'viewAdmin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');

  // Update Nav Buttons Active State
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('text-brand-gold');
    btn.classList.add('text-zinc-400');
  });

  if (viewId === 'viewCamera') {
    document.getElementById('navBtnCamera')?.classList.add('text-brand-gold');
    document.getElementById('navBtnCamera')?.classList.remove('text-zinc-400');
    // Disposable Camera Otomatis Terbuka saat layar kamera aktif
    if (!STATE.mediaStream) {
      startCameraStream();
    }
  } else if (viewId === 'viewGallery') {
    document.getElementById('navBtnGallery')?.classList.add('text-brand-gold');
    document.getElementById('navBtnGallery')?.classList.remove('text-zinc-400');
    renderGallery();
  }
}

// --- 5. CAMERA & CANVAS FRAME PROCESSING ---
function updateLiveCameraFilter() {
  const video = document.getElementById('cameraVideo');
  if (!video) return;
  video.classList.remove('filter-live-raw', 'filter-live-800t', 'filter-live-warm', 'filter-live-bw');
  const filterKey = (STATE.activeFilter || '800T').toLowerCase();
  video.classList.add(`filter-live-${filterKey}`);
}

async function startCameraStream() {
  const video = document.getElementById('cameraVideo');
  const standby = document.getElementById('cameraStandbyNotice');

  try {
    if (STATE.mediaStream) {
      STATE.mediaStream.getTracks().forEach(t => t.stop());
    }

    const constraints = {
      video: {
        facingMode: { ideal: STATE.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    STATE.mediaStream = stream;
    video.srcObject = stream;
    standby.classList.add('hidden');
    updateLiveCameraFilter();
  } catch (err) {
    console.warn("Live camera stream error (fallback to native file capture):", err.message);
    standby.classList.remove('hidden');
    showToast("Mode jepret langsung ponsel aktif", "info");
  }
}

function triggerNativeCamera() {
  const input = document.getElementById('nativeCameraInput');
  input.click();
}

function processPhotoWithFrameAndFilter(imgSource, overrideFrame) {
  const canvas = document.getElementById('photoRenderCanvas');
  const ctx = canvas.getContext('2d');

  // Simpan referensi gambar mentah agar user bisa mengganti bingkai sesuka hati di modal review
  STATE.rawCapturedImageObj = imgSource;

  // Aspect ratio 4:5 Portrait Standard
  canvas.width = 1080;
  canvas.height = 1350;

  // Ekstraksi dimensi riil (Krusial: HTMLVideoElement menggunakan videoWidth/videoHeight, bukan width/height!)
  const srcWidth = imgSource.videoWidth || imgSource.naturalWidth || imgSource.width || 1080;
  const srcHeight = imgSource.videoHeight || imgSource.naturalHeight || imgSource.height || 1350;
  const imgRatio = srcWidth / srcHeight;
  const targetRatio = canvas.width / canvas.height;
  let renderW, renderH, offsetX, offsetY;

  if (imgRatio > targetRatio) {
    renderH = canvas.height;
    renderW = canvas.height * imgRatio;
    offsetX = (canvas.width - renderW) / 2;
    offsetY = 0;
  } else {
    renderW = canvas.width;
    renderH = canvas.width / imgRatio;
    offsetX = 0;
    offsetY = (canvas.height - renderH) / 2;
  }

  ctx.drawImage(imgSource, offsetX, offsetY, renderW, renderH);

  // 2. Apply Vintage / Analog Filter Grading
  applyColorFilter(ctx, canvas.width, canvas.height, STATE.activeFilter);

  // 3. Render Selected Custom Frame & Hashtag
  const frameToUse = overrideFrame || STATE.activeFrame || 'GOLD_DECO';
  STATE.activeFrame = frameToUse;
  renderCustomFrameOverlay(ctx, canvas.width, canvas.height, frameToUse);

  // Tampilkan ke elemen <img> pratinjau agar pasti tampil tajam tanpa layar hitam
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  STATE.currentCapturedDataUrl = dataUrl;

  const reviewImg = document.getElementById('reviewPhotoImg');
  if (reviewImg) {
    reviewImg.src = dataUrl;
  }

  // Render Pilihan Frame Pasca-Foto di Modal Review
  renderReviewFramePills(frameToUse);

  document.getElementById('modalReviewPhoto').classList.remove('hidden');
}

function renderReviewFramePills(activeFrame) {
  const container = document.getElementById('reviewFrameListContainer');
  if (!container) return;

  const ev = STATE.activeEvent;
  const hasCustom = !!(ev && (ev.customFrameData || ev.customFrameUrl));

  let customHtml = '';
  if (hasCustom) {
    customHtml = `<button data-frame="CUSTOM" class="rev-frame-pill shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${activeFrame === 'CUSTOM' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">✨ Frame Acara</button>`;
  }

  container.innerHTML = `
    <button data-frame="GOLD_DECO" class="rev-frame-pill shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${activeFrame === 'GOLD_DECO' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">✨ Gold Deco</button>
    ${customHtml}
    <button data-frame="POLAROID" class="rev-frame-pill shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${activeFrame === 'POLAROID' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">📷 Polaroid</button>
    <button data-frame="MINIMAL" class="rev-frame-pill shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${activeFrame === 'MINIMAL' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">▪️ Minimalist</button>
    <button data-frame="NONE" class="rev-frame-pill shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${activeFrame === 'NONE' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">Tanpa Bingkai</button>
  `;

  const nameEl = document.getElementById('reviewActiveFrameName');
  if (nameEl) {
    nameEl.textContent = activeFrame === 'GOLD_DECO' ? '✨ GOLD DECO' : activeFrame === 'POLAROID' ? '📷 POLAROID' : activeFrame === 'MINIMAL' ? '▪️ MINIMALIST' : activeFrame === 'CUSTOM' ? '✨ FRAME ACARA' : 'TANPA BINGKAI';
  }
}

function applyColorFilter(ctx, w, h, filterName) {
  if (filterName === 'RAW') return;

  if (filterName === '800T') {
    // 800T Cine Warm Gold & Teal Halation tint
    ctx.fillStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.fillRect(0, 0, w, h);
    // Vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, w / 3, w / 2, h / 2, w / 1.2);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(15, 10, 5, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (filterName === 'WARM') {
    // Golden Hour Glow
    ctx.fillStyle = 'rgba(255, 160, 40, 0.12)';
    ctx.fillRect(0, 0, w, h);
  } else if (filterName === 'BW') {
    // Black and White Noir
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const c = v > 128 ? Math.min(255, v * 1.1) : Math.max(0, v * 0.9);
      d[i] = c; d[i + 1] = c; d[i + 2] = c;
    }
    ctx.putImageData(imgData, 0, 0);
  }
}

function renderCustomFrameOverlay(ctx, w, h, frameStyle) {
  const evName = STATE.activeEvent?.namaEvent || "The Wedding of Sarah & Kevin";
  const hashtag = STATE.activeEvent?.hashtagEvent || "#SarahKevinEverAfter";
  const dateStr = STATE.activeEvent?.tanggalEvent || "20.11.2026";

  if (frameStyle === 'GOLD_DECO') {
    // Luxury Double Border Gold Art Deco
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#D4AF37';
    ctx.strokeRect(30, 30, w - 60, h - 60);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#F3E5AB';
    ctx.strokeRect(48, 48, w - 96, h - 96);

    // Corner Ornaments
    drawDecoCorner(ctx, 48, 48);
    drawDecoCorner(ctx, w - 48, 48, true);
    drawDecoCorner(ctx, 48, h - 48, false, true);
    drawDecoCorner(ctx, w - 48, h - 48, true, true);

    // Bottom Banner Plaque
    ctx.fillStyle = 'rgba(12, 12, 16, 0.85)';
    ctx.fillRect(60, h - 180, w - 120, 115);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, h - 180, w - 120, 115);

    // Event Text
    ctx.fillStyle = '#F3E5AB';
    ctx.font = 'bold 36px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.fillText(evName, w / 2, h - 125);

    ctx.fillStyle = '#D4AF37';
    ctx.font = '22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${hashtag}  •  ${dateStr}`, w / 2, h - 85);

  } else if (frameStyle === 'POLAROID') {
    // Classic White Polaroid Border
    ctx.lineWidth = 35;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(0, 0, w, h);

    // Heavy Bottom White Chin
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, h - 230, w, 230);

    // Handwritten Text
    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 50px "Caveat", cursive';
    ctx.textAlign = 'center';
    ctx.fillText(evName, w / 2, h - 130);

    ctx.fillStyle = '#666666';
    ctx.font = '24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${hashtag} — ${dateStr}`, w / 2, h - 70);

  } else if (frameStyle === 'MINIMAL') {
    // Minimal Dark Border with Sleek Typography
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#121217';
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(20, h - 90, w - 40, 70);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${evName}  |  ${hashtag}`, w / 2, h - 45);

  } else if (frameStyle === 'CUSTOM') {
    // Custom PNG Overlay yang Diupload Admin
    if (STATE.customFrameImgObj && STATE.customFrameImgObj.complete) {
      ctx.drawImage(STATE.customFrameImgObj, 0, 0, w, h);
    } else {
      // Fallback Border Emas jika gambar masih proses loading
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#D4AF37';
      ctx.strokeRect(30, 30, w - 60, h - 60);

      ctx.fillStyle = 'rgba(12, 12, 16, 0.85)';
      ctx.fillRect(50, h - 140, w - 100, 90);
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, h - 140, w - 100, 90);

      ctx.fillStyle = '#F3E5AB';
      ctx.font = 'bold 30px "Playfair Display", serif';
      ctx.textAlign = 'center';
      ctx.fillText(evName, w / 2, h - 95);

      ctx.fillStyle = '#D4AF37';
      ctx.font = '18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${hashtag} • ${dateStr}`, w / 2, h - 65);
    }
  }
}

function drawDecoCorner(ctx, x, y, flipX = false, flipY = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 25);
  ctx.lineTo(25, 0);
  ctx.moveTo(5, 30);
  ctx.lineTo(30, 5);
  ctx.stroke();
  ctx.restore();
}

// Generator Snapshot Demo Pesta (Fallback saat pengujian di komputer tanpa webcam)
function generateSimulatedPartySnapshot() {
  const offCanvas = document.createElement('canvas');
  offCanvas.width = 1080;
  offCanvas.height = 1350;
  const offCtx = offCanvas.getContext('2d');

  // Gradient latar belakang suasana pesta
  const grad = offCtx.createLinearGradient(0, 0, 1080, 1350);
  grad.addColorStop(0, '#151322');
  grad.addColorStop(0.5, '#2D1B36');
  grad.addColorStop(1, '#110C1B');
  offCtx.fillStyle = grad;
  offCtx.fillRect(0, 0, 1080, 1350);

  // Efek Bokeh Cahaya Emas
  for (let i = 0; i < 30; i++) {
    const bx = Math.random() * 1080;
    const by = Math.random() * 1350;
    const br = 25 + Math.random() * 80;
    const bGrad = offCtx.createRadialGradient(bx, by, 0, bx, by, br);
    bGrad.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
    bGrad.addColorStop(0.7, 'rgba(212, 175, 55, 0.15)');
    bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    offCtx.fillStyle = bGrad;
    offCtx.beginPath();
    offCtx.arc(bx, by, br, 0, Math.PI * 2);
    offCtx.fill();
  }

  // Teks Momen Pesta
  offCtx.fillStyle = '#F3E5AB';
  offCtx.font = 'bold 44px "Playfair Display", serif';
  offCtx.textAlign = 'center';
  offCtx.fillText(STATE.activeEvent?.namaEvent || "SnapEvent Party", 540, 640);

  offCtx.fillStyle = '#E4E4E7';
  offCtx.font = '24px "Plus Jakarta Sans", sans-serif';
  offCtx.fillText(STATE.activeEvent?.hashtagEvent || "#MomenTerbaik", 540, 700);

  return offCanvas;
}

// --- 6. UPLOAD PHOTO (GAS API OR LOCAL MOCK) ---
async function handleSavePhotoToDrive() {
  const btn = document.getElementById('btnSaveToDrive');
  const btnText = document.getElementById('btnSaveText');
  const caption = document.getElementById('inputPhotoCaption').value.trim();

  btn.disabled = true;
  btnText.textContent = "Mengunggah...";

  try {
    const payload = {
      action: "uploadPhoto",
      eventId: STATE.activeEventId,
      guestId: STATE.guestId,
      guestNama: STATE.guestNama || "Tamu",
      caption: caption,
      cameraStyle: STATE.activeFilter,
      frameStyle: STATE.activeFrame,
      imageBase64: STATE.currentCapturedDataUrl
    };

    if (STATE.gasApiUrl) {
      const resp = await fetch(STATE.gasApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      const res = await resp.json();

      if (res.status === 'success') {
        showToast("Foto berhasil disimpan ke Google Drive!", "success");
        document.getElementById('modalReviewPhoto').classList.add('hidden');
        await loadGallery();
        showView('viewGallery');
      } else if (res.status === 'limit_reached') {
        showToast(res.message, "warning");
        document.getElementById('modalReviewPhoto').classList.add('hidden');
      } else {
        showToast(res.message || "Gagal mengunggah foto", "error");
      }
    } else {
      // Mock Upload Success
      const newPhoto = {
        idFoto: "FTO-LOCAL-" + Date.now(),
        guestNama: STATE.guestNama,
        caption: caption || "Momen seru!",
        cameraStyle: STATE.activeFilter,
        frameStyle: STATE.activeFrame,
        gdriveViewUrl: STATE.currentCapturedDataUrl,
        totalLikes: 0,
        isFeatured: false,
        createdAt: "Baru Saja"
      };
      STATE.photos.unshift(newPhoto);
      showToast("Foto berhasil disimpan ke Rol Acara!", "success");
      document.getElementById('modalReviewPhoto').classList.add('hidden');
      renderGallery();
      showView('viewGallery');
    }

    updateRemainingQuotaDisplay();
  } catch (err) {
    showToast("Terjadi kesalahan: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btnText.textContent = "Simpan ke Rol";
  }
}

// --- 7. VOTING / LIKE SYSTEM (MUTLAK 1X PER KATEGORI) ---
async function handleVotePhoto(idFoto, idKategori = '') {
  // Ambil kategori aktif atau kategori default
  const targetCat = idKategori || (STATE.activeCategories[0]?.idKategori || 'KAT-001');

  // Enforce 1 vote per category (Aturan Ketat)
  if (STATE.votedCategoryIds.includes(targetCat)) {
    showToast("Anda sudah memberikan voting pada kategori ini (Maksimal 1 kali voting per kategori)!", "warning");
    return;
  }

  if (STATE.votedPhotoIds.includes(idFoto)) {
    showToast("Anda sudah menyukai foto ini!", "warning");
    return;
  }

  try {
    if (STATE.gasApiUrl) {
      const payload = {
        action: "submitVote",
        eventId: STATE.activeEventId,
        idFoto: idFoto,
        idKategori: targetCat,
        guestId: STATE.guestId,
        guestNama: STATE.guestNama
      };

      const resp = await fetch(STATE.gasApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      const res = await resp.json();

      if (res.status === 'success') {
        STATE.votedPhotoIds.push(idFoto);
        STATE.votedCategoryIds.push(targetCat);
        localStorage.setItem('snapevent_voted_photos', JSON.stringify(STATE.votedPhotoIds));
        localStorage.setItem('snapevent_voted_categories', JSON.stringify(STATE.votedCategoryIds));

        showToast("Suara Anda berhasil dicatat! ❤️", "success");
        await loadGallery();
      } else {
        showToast(res.message, "warning");
      }
    } else {
      // Local Mock Vote
      STATE.votedPhotoIds.push(idFoto);
      STATE.votedCategoryIds.push(targetCat);
      localStorage.setItem('snapevent_voted_photos', JSON.stringify(STATE.votedPhotoIds));
      localStorage.setItem('snapevent_voted_categories', JSON.stringify(STATE.votedCategoryIds));

      const target = STATE.photos.find(p => p.idFoto === idFoto);
      if (target) target.totalLikes += 1;
      showToast("Suara Anda berhasil dicatat! ❤️", "success");
      renderGallery();
    }

    const zoomLikesCount = document.getElementById('zoomLikesCount');
    if (zoomLikesCount) {
      const currentLikes = (STATE.photos.find(p => p.idFoto === idFoto)?.totalLikes || 0);
      zoomLikesCount.textContent = `${currentLikes} Suka`;
    }
  } catch (e) {
    showToast("Gagal mencatat vote: " + e.message, "error");
  }
}

// --- 8. GALLERY RENDERING ---
function renderGallery() {
  const grid = document.getElementById('galleryPhotoGrid');
  const empty = document.getElementById('galleryEmptyNotice');
  const countBadge = document.getElementById('galleryPhotoCountBadge');

  let filtered = [...STATE.photos];

  if (STATE.activeGalleryFilter === 'POPULAR') {
    filtered.sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));
  }

  countBadge.textContent = `${filtered.length} Foto`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = '';

  filtered.forEach(photo => {
    const isVoted = STATE.votedPhotoIds.includes(photo.idFoto);
    const card = document.createElement('div');
    card.className = "group relative bg-brand-surfaceLight border border-brand-surfaceBorder rounded-xl overflow-hidden shadow-md flex flex-col justify-between";
    card.setAttribute('data-id', photo.idFoto);

    card.innerHTML = `
      <div class="relative w-full aspect-[4/5] bg-black overflow-hidden cursor-pointer img-click-zone">
        <img src="${photo.gdriveViewUrl}" alt="${photo.guestNama}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2.5">
          <span class="text-[11px] text-zinc-300 truncate">${photo.caption || photo.guestNama}</span>
        </div>
      </div>
      <div class="p-2.5 flex items-center justify-between bg-brand-surfaceLight border-t border-white/5">
        <div class="truncate pr-1">
          <div class="text-[11px] font-bold text-white truncate">${photo.guestNama}</div>
          <div class="text-[9px] text-zinc-400 uppercase">${photo.cameraStyle || '800T'}</div>
        </div>
        <button class="btn-like-photo flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isVoted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'} transition active:scale-90" data-id="${photo.idFoto}">
          <span>${isVoted ? '❤️' : '🤍'}</span>
          <span>${photo.totalLikes || 0}</span>
        </button>
      </div>
    `;

    card.querySelector('.img-click-zone').addEventListener('click', () => {
      openPhotoZoom(photo);
    });

    card.querySelector('.btn-like-photo').addEventListener('click', (e) => {
      e.stopPropagation();
      handleVotePhoto(photo.idFoto);
    });

    grid.appendChild(card);
  });
}

function openPhotoZoom(photo) {
  document.getElementById('zoomImg').src = photo.gdriveViewUrl;
  document.getElementById('zoomGuestNama').textContent = `Oleh: ${photo.guestNama}`;
  document.getElementById('zoomTime').textContent = photo.createdAt || 'Baru Saja';
  document.getElementById('zoomCaption').textContent = photo.caption ? `"${photo.caption}"` : '';
  document.getElementById('zoomLikesCount').textContent = `${photo.totalLikes || 0} Suka`;

  const btnVote = document.getElementById('btnZoomVote');
  btnVote.onclick = () => handleVotePhoto(photo.idFoto);

  const btnDl = document.getElementById('btnZoomDownload');
  btnDl.onclick = () => {
    const a = document.createElement('a');
    a.href = photo.gdriveViewUrl;
    a.download = `SnapEvent_${photo.idFoto}.jpg`;
    a.target = '_blank';
    a.click();
  };

  document.getElementById('modalZoomPhoto').classList.remove('hidden');
}

// --- 9. LIVE SLIDESHOW ENGINE ---
function openSlideshow() {
  const modal = document.getElementById('modalSlideshow');
  modal.classList.remove('hidden');

  if (STATE.photos.length === 0) {
    document.getElementById('slideshowEmptyMsg').classList.remove('hidden');
    document.getElementById('slideshowImg').classList.add('hidden');
    return;
  }

  document.getElementById('slideshowEmptyMsg').classList.add('hidden');
  document.getElementById('slideshowImg').classList.remove('hidden');

  STATE.slideshowIndex = 0;
  showSlideshowPhoto();

  if (STATE.slideshowTimer) clearInterval(STATE.slideshowTimer);
  STATE.slideshowTimer = setInterval(() => {
    STATE.slideshowIndex = (STATE.slideshowIndex + 1) % STATE.photos.length;
    showSlideshowPhoto();
  }, 6000);
}

function showSlideshowPhoto() {
  if (STATE.photos.length === 0) return;
  const img = document.getElementById('slideshowImg');
  const p = STATE.photos[STATE.slideshowIndex];

  img.style.opacity = '0';
  setTimeout(() => {
    img.src = p.gdriveViewUrl;
    img.onload = () => {
      img.style.opacity = '1';
    };

    // Update Uploader, Pesan & Waktu di Layar Proyektor
    const uploaderBadge = document.getElementById('slideshowUploaderBadge');
    if (uploaderBadge) {
      uploaderBadge.textContent = 'Oleh: ' + (p.guestNama || 'Tamu');
    }
    const captionText = document.getElementById('slideshowCaptionText');
    if (captionText) {
      captionText.textContent = p.caption ? `"${p.caption}"` : '"Momen seru bersama para sahabat!"';
    }
    const timeBadge = document.getElementById('slideshowTimeBadge');
    if (timeBadge) {
      timeBadge.textContent = p.createdAt || 'Baru Saja';
    }
  }, 500);
}

function closeSlideshow() {
  document.getElementById('modalSlideshow').classList.add('hidden');
  if (STATE.slideshowTimer) clearInterval(STATE.slideshowTimer);
}

// --- 10. ADMIN DASHBOARD & CONTROLS ---
function openAdminPanel() {
  // Jika sesi admin sudah aktif, langsung buka tanpa prompt login
  if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
    showView('viewAdmin');
    renderAdminDashboard();
    return;
  }
  const modal = document.getElementById('modalAdminPin');
  modal.classList.remove('hidden');
  document.getElementById('inputAdminUser').value = '';
  document.getElementById('inputAdminPass').value = '';
}

async function verifyAdminLogin() {
  const user = document.getElementById('inputAdminUser').value.trim();
  const pass = document.getElementById('inputAdminPass').value.trim();

  if (!user || !pass) {
    showToast("Masukkan Username dan Password Admin!", "warning");
    return;
  }

  // Verifikasi via GAS API jika terpasang
  if (STATE.gasApiUrl) {
    try {
      const resp = await fetch(STATE.gasApiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'adminLogin', username: user, password: pass })
      });
      const res = await resp.json();
      if (res.status === 'success') {
        sessionStorage.setItem('snapevent_admin_session', 'true');
        document.getElementById('modalAdminPin').classList.add('hidden');
        showView('viewAdmin');
        renderAdminDashboard();
        showToast("Selamat datang, Admin!", "success");
        return;
      } else {
        showToast(res.message || "Username atau Password salah!", "error");
        return;
      }
    } catch (e) {
      console.warn("Validasi GAS error, fallback ke lokal:", e.message);
    }
  }

  // Fallback Kredensial Lokal (Admin atau Operator Kru Tambahan)
  const matchedOperator = Array.isArray(STATE.userAccounts) && STATE.userAccounts.find(a => a.user === user && a.pass === pass);
  if ((user === STATE.adminUser && pass === STATE.adminPass) || matchedOperator) {
    sessionStorage.setItem('snapevent_admin_session', 'true');
    STATE.currentUserRole = matchedOperator ? (matchedOperator.role || 'operator') : 'admin';
    sessionStorage.setItem('snapevent_user_role', STATE.currentUserRole);
    document.getElementById('modalAdminPin').classList.add('hidden');
    showView('viewAdmin');
    renderAdminDashboard();
    showToast(`Selamat datang, ${matchedOperator ? 'Operator/Kru' : 'Administrator'}!`, "success");
  } else {
    showToast("Username atau Password login salah!", "error");
  }
}

function renderAdminDashboard() {
  document.getElementById('admMetricEvents').textContent = "1";
  document.getElementById('admMetricPhotos').textContent = STATE.photos.length;

  const totalVotes = STATE.photos.reduce((acc, p) => acc + (p.totalLikes || 0), 0);
  document.getElementById('admMetricVotes').textContent = totalVotes;

  const ev = STATE.activeEvent || MOCK_DATA.event;
  const listContainer = document.getElementById('adminEventListContainer');
  const driveFolderText = ev.gdriveFolderId ? `Drive: ${ev.gdriveFolderId}` : 'Drive: Otomatis';
  const frameText = (ev.customFrameData || ev.customFrameUrl) ? '✨ Custom Frame PNG Aktif' : 'Default Frames';

  listContainer.innerHTML = `
    <div class="bg-brand-surfaceLight border border-brand-surfaceBorder rounded-2xl p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] font-bold text-brand-gold uppercase tracking-widest">${ev.idEvent}</span>
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${ev.isRevealed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
          ${ev.isRevealed ? 'Galeri Terbuka' : 'Galeri Ditahan'}
        </span>
      </div>
      <h4 class="font-serif text-base font-bold text-white mb-1">${ev.namaEvent}</h4>
      <p class="text-xs text-zinc-400 mb-2">${ev.hashtagEvent} • Kuota: ${ev.maxFotoPerGuest} Foto / Tamu</p>
      <div class="flex items-center gap-2 text-[11px] text-zinc-400 mb-3">
        <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10">${driveFolderText}</span>
        <span class="px-2 py-0.5 rounded bg-brand-gold/10 text-brand-gold border border-brand-gold/20">${frameText}</span>
      </div>
      
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
        <button id="admBtnEditEvent" class="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold text-center transition">
          ✏️ Edit Acara
        </button>
        <button id="admBtnToggleReveal" class="py-2 px-3 rounded-xl ${ev.isRevealed ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'} text-xs font-semibold text-center transition">
          ${ev.isRevealed ? '🔒 Kunci Galeri' : '🔓 Buka Galeri'}
        </button>
        <button id="admBtnSlideshow" class="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold text-center transition">
          📺 Proyektor
        </button>
        <button id="admBtnShareQr" class="py-2 px-3 rounded-xl gold-gradient-bg text-black text-xs font-bold text-center transition">
          📲 Link & QR
        </button>
      </div>
    </div>
  `;

  // Bind Event Card Actions
  document.getElementById('admBtnEditEvent').addEventListener('click', () => {
    populateEditEventForm(ev);
    switchAdminTab('create');
  });

  document.getElementById('admBtnToggleReveal').addEventListener('click', () => {
    ev.isRevealed = !ev.isRevealed;
    showToast(ev.isRevealed ? "Galeri resmi dibuka untuk semua tamu!" : "Galeri ditutup kembali.", "info");
    renderAdminDashboard();
  });

  document.getElementById('admBtnSlideshow').addEventListener('click', openSlideshow);
  document.getElementById('admBtnShareQr').addEventListener('click', () => {
    const link = window.location.href.split('?')[0] + `?event=${ev.slugEvent || ev.idEvent}`;
    navigator.clipboard?.writeText(link);
    showToast("Tautan acara berhasil disalin ke clipboard!", "success");
  });

  // Config Form Values
  if (document.getElementById('cfgGasUrl')) document.getElementById('cfgGasUrl').value = STATE.gasApiUrl;
  if (document.getElementById('cfgAppTitle')) document.getElementById('cfgAppTitle').value = STATE.appTitle;
  if (document.getElementById('cfgAppLogoUrl')) document.getElementById('cfgAppLogoUrl').value = STATE.appLogoUrl;
  if (document.getElementById('cfgAppPhone')) document.getElementById('cfgAppPhone').value = STATE.appPhone;
  if (document.getElementById('cfgAppInstagram')) document.getElementById('cfgAppInstagram').value = STATE.appInstagram;
  if (document.getElementById('cfgAdminUser')) document.getElementById('cfgAdminUser').value = STATE.adminUser;
  if (document.getElementById('cfgAdminPass')) document.getElementById('cfgAdminPass').value = STATE.adminPass;
  if (document.getElementById('cfgDriveMasterId')) document.getElementById('cfgDriveMasterId').value = STATE.driveMasterId;

  // Render User Accounts List
  renderUserAccountsList();

  // Render Leaderboard
  renderLeaderboard();
}

function renderUserAccountsList() {
  const container = document.getElementById('userAccountsContainer');
  if (!container) return;
  container.innerHTML = '';
  if (!Array.isArray(STATE.userAccounts) || STATE.userAccounts.length === 0) {
    container.innerHTML = '<p class="text-[11px] text-zinc-500 italic py-1">Belum ada akun kru/operator tambahan.</p>';
    return;
  }
  STATE.userAccounts.forEach((acc, index) => {
    const row = document.createElement('div');
    row.className = "flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-xs";
    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-zinc-400 font-bold">${index + 1}</span>
        <div>
          <span class="font-bold text-white">${acc.user}</span>
          <span class="text-[10px] text-zinc-400 ml-1.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">${acc.role || 'operator'}</span>
        </div>
      </div>
      <button type="button" class="btn-del-user text-red-400 hover:text-red-300 p-1 text-xs" data-idx="${index}" title="Hapus User">✕</button>
    `;
    row.querySelector('.btn-del-user').onclick = () => {
      STATE.userAccounts.splice(index, 1);
      localStorage.setItem('snapevent_user_accounts', JSON.stringify(STATE.userAccounts));
      renderUserAccountsList();
      showToast("Akun operator dihapus.", "info");
    };
    container.appendChild(row);
  });
}

function renderLeaderboard() {
  const container = document.getElementById('adminLeaderboardList');
  const sorted = [...STATE.photos].sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));

  if (sorted.length === 0) {
    container.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">Belum ada foto yang divote.</p>';
    return;
  }

  container.innerHTML = '';
  sorted.slice(0, 5).forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = "flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5";
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-400 text-black' : idx === 1 ? 'bg-zinc-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-zinc-400'}">
          ${idx + 1}
        </span>
        <img src="${p.gdriveViewUrl}" class="w-10 h-10 rounded-lg object-cover" />
        <div>
          <div class="text-xs font-bold text-white">${p.guestNama}</div>
          <div class="text-[10px] text-zinc-400 truncate max-w-[150px]">${p.caption || 'Tanpa keterangan'}</div>
        </div>
      </div>
      <div class="text-xs font-bold text-brand-gold">
        ❤️ ${p.totalLikes || 0}
      </div>
    `;
    container.appendChild(row);
  });
}

function populateEditEventForm(ev) {
  document.getElementById('formEventTitle').textContent = "Edit Detail Acara";
  document.getElementById('formEventId').value = ev.idEvent;
  document.getElementById('formEventNama').value = ev.namaEvent;
  document.getElementById('formEventHashtag').value = ev.hashtagEvent;
  document.getElementById('formEventTanggal').value = ev.tanggalEvent || '';
  document.getElementById('formEventMaxFoto').value = ev.maxFotoPerGuest;
  document.getElementById('formEventMaxVote').value = ev.maxVotePerGuest;
  document.getElementById('formEventDriveFolder').value = ev.gdriveFolderId || '';

  // Custom Frame Preview
  const frameData = ev.customFrameData || ev.customFrameUrl;
  const previewBox = document.getElementById('customFramePreviewBox');
  const previewImg = document.getElementById('customFramePreviewImg');
  const btnRemove = document.getElementById('btnRemoveCustomFrame');

  if (frameData) {
    previewImg.src = frameData;
    previewBox.classList.remove('hidden');
    btnRemove.classList.remove('hidden');
    STATE.tempCustomFrameData = frameData;
  } else {
    previewBox.classList.add('hidden');
    btnRemove.classList.add('hidden');
    STATE.tempCustomFrameData = null;
  }
  document.getElementById('formEventCustomFrame').value = '';

  const radios = document.getElementsByName('revealModeRadio');
  radios.forEach(r => { r.checked = (r.value === ev.revealMode); });

  document.getElementById('formCheckLike').checked = ev.likeEnabled !== false;
  document.getElementById('formCheckVisibility').checked = ev.publicVisible !== false;

  renderCategoryInputRows(STATE.activeCategories);
}

function renderCategoryInputRows(cats) {
  const container = document.getElementById('categoryInputsContainer');
  container.innerHTML = '';
  const list = cats && cats.length > 0 ? cats : [
    { namaKategori: "Best Outfit" },
    { namaKategori: "Pose Terheboh" }
  ];

  list.forEach((c) => {
    const row = document.createElement('div');
    row.className = "flex items-center gap-2";
    row.innerHTML = `
      <input type="text" value="${c.namaKategori}" class="cat-input flex-1 bg-[#111116] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-gold outline-none" placeholder="Nama Kategori (misal: Best Outfit)" />
      <button type="button" class="btn-remove-cat p-2 text-zinc-400 hover:text-red-400 text-xs">✕</button>
    `;
    row.querySelector('.btn-remove-cat').onclick = () => row.remove();
    container.appendChild(row);
  });
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.adm-tab').forEach(b => {
    b.classList.remove('bg-brand-gold', 'text-black');
    b.classList.add('bg-white/5', 'text-zinc-300');
  });
  const activeBtn = document.querySelector(`[data-admintab="${tabName}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-white/5', 'text-zinc-300');
    activeBtn.classList.add('bg-brand-gold', 'text-black');
  }

  ['adminTabEvents', 'adminTabCreate', 'adminTabLeaderboard', 'adminTabSettings'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  if (tabName === 'events') document.getElementById('adminTabEvents').classList.remove('hidden');
  if (tabName === 'create') document.getElementById('adminTabCreate').classList.remove('hidden');
  if (tabName === 'leaderboard') document.getElementById('adminTabLeaderboard').classList.remove('hidden');
  if (tabName === 'settings') document.getElementById('adminTabSettings').classList.remove('hidden');
}

function saveAdminEventForm() {
  const nama = document.getElementById('formEventNama').value.trim();
  const hashtag = document.getElementById('formEventHashtag').value.trim();
  const tanggal = document.getElementById('formEventTanggal').value;
  const maxFoto = parseInt(document.getElementById('formEventMaxFoto').value, 10) || 10;
  const maxVote = parseInt(document.getElementById('formEventMaxVote').value, 10) || 1;
  const driveFolder = extractDriveFolderId(document.getElementById('formEventDriveFolder').value.trim());

  let revealMode = 'SEGERA';
  document.getElementsByName('revealModeRadio').forEach(r => {
    if (r.checked) revealMode = r.value;
  });

  const likeEnabled = document.getElementById('formCheckLike').checked;
  const publicVisible = document.getElementById('formCheckVisibility').checked;

  const catInputs = document.querySelectorAll('.cat-input');
  const cats = [];
  catInputs.forEach((inp, idx) => {
    const val = inp.value.trim();
    if (val) cats.push({ idKategori: `KAT-${idx + 1}`, namaKategori: val, urutan: idx + 1 });
  });

  const customFrameData = STATE.tempCustomFrameData || (STATE.activeEvent ? (STATE.activeEvent.customFrameData || STATE.activeEvent.customFrameUrl) : null);

  STATE.activeEvent = {
    idEvent: document.getElementById('formEventId').value || 'EVT-' + Date.now(),
    namaEvent: nama,
    slugEvent: nama.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    tanggalEvent: tanggal,
    hashtagEvent: hashtag,
    maxFotoPerGuest: maxFoto,
    maxVotePerGuest: maxVote,
    revealMode: revealMode,
    isRevealed: (revealMode === 'SEGERA'),
    likeEnabled: likeEnabled,
    publicVisible: publicVisible,
    gdriveFolderId: driveFolder,
    customFrameData: customFrameData,
    customFrameUrl: customFrameData || ''
  };

  STATE.activeCategories = cats;

  // Sinkronisasi ke Backend GAS jika ada
  if (STATE.gasApiUrl) {
    fetch(STATE.gasApiUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'adminSaveEvent',
        idEvent: STATE.activeEvent.idEvent,
        namaEvent: nama,
        slugEvent: STATE.activeEvent.slugEvent,
        tanggalEvent: tanggal,
        hashtagEvent: hashtag,
        maxFotoPerGuest: maxFoto,
        maxVotePerGuest: maxVote,
        revealMode: revealMode,
        isRevealed: STATE.activeEvent.isRevealed,
        likeEnabled: likeEnabled,
        publicVisible: publicVisible,
        gdriveFolderId: driveFolder,
        customFrameUrl: customFrameData || '',
        categories: cats
      })
    }).catch(err => console.warn("Sinkronisasi GAS warn:", err.message));
  }

  applyEventToUI();
  showToast("Acara & Bingkai berhasil disimpan!", "success");
  switchAdminTab('events');
  renderAdminDashboard();
}

function updateRemainingQuotaDisplay() {
  const max = STATE.activeEvent?.maxFotoPerGuest || 10;
  const guestUploadedCount = STATE.photos.filter(p => p.guestNama === STATE.guestNama).length;
  const remaining = Math.max(0, max - guestUploadedCount);
  const textEl = document.getElementById('camRemainingPhotosText');
  if (textEl) textEl.textContent = `${remaining} / ${max} Foto Tersisa`;
}

// --- 11. BIND ALL EVENT LISTENERS ---
function bindEvents() {
  // Welcome View Guest Name Submit
  document.getElementById('btnStartCamera').addEventListener('click', () => {
    const name = document.getElementById('inputGuestName').value.trim();
    if (!name) {
      showToast("Masukkan nama panggilanmu terlebih dahulu!", "warning");
      return;
    }
    STATE.guestNama = name;
    localStorage.setItem('snapevent_guest_nama', name);
    showView('viewCamera');
    startCameraStream();
  });

  // Navigation Bar Buttons
  document.getElementById('navBtnCamera').addEventListener('click', () => {
    showView('viewCamera');
    if (!STATE.mediaStream) startCameraStream();
  });
  document.getElementById('navBtnGallery').addEventListener('click', () => {
    showView('viewGallery');
  });
  document.getElementById('navBtnEventInfo').addEventListener('click', () => {
    showToast(`Tamu: ${STATE.guestNama || 'Tamu'} (${STATE.guestId})`, "info");
  });

  // Shutter Action
  document.getElementById('btnShutter').addEventListener('click', () => {
    triggerCameraShutter();
  });

  // Live Video Trigger & Native File Fallback
  document.getElementById('btnInitStream').addEventListener('click', startCameraStream);
  document.getElementById('btnOpenGalleryUpload').addEventListener('click', triggerNativeCamera);

  // Handle Native File Capture
  document.getElementById('nativeCameraInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => processPhotoWithFrameAndFilter(img);
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Switch Camera Lens (Front/Back)
  document.getElementById('btnSwitchCamera').addEventListener('click', () => {
    STATE.facingMode = (STATE.facingMode === 'environment') ? 'user' : 'environment';
    startCameraStream();
  });

  // Filter Selector Pills (Event Delegation)
  document.getElementById('filterListContainer').addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.remove('bg-brand-gold', 'text-black');
      p.classList.add('bg-white/5', 'text-zinc-300');
    });
    pill.classList.remove('bg-white/5', 'text-zinc-300');
    pill.classList.add('bg-brand-gold', 'text-black');
    STATE.activeFilter = pill.getAttribute('data-filter');
    document.getElementById('activeFilterName').textContent = pill.textContent.trim().toUpperCase();
    document.getElementById('vfFrameTopLeft').textContent = `SNAPEVENT ${STATE.activeFilter}`;
    updateLiveCameraFilter();
  });

  // Review Frame Selector Pills (Pilih Bingkai Pasca-Foto)
  document.getElementById('reviewFrameListContainer')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.rev-frame-pill');
    if (!pill || !STATE.rawCapturedImageObj) return;
    const chosenFrame = pill.getAttribute('data-frame');
    processPhotoWithFrameAndFilter(STATE.rawCapturedImageObj, chosenFrame);
  });

  // Contact Modal Buttons
  document.getElementById('btnHeaderContact')?.addEventListener('click', () => {
    document.getElementById('modalContactInfo')?.classList.remove('hidden');
  });
  document.getElementById('btnCloseContact')?.addEventListener('click', () => {
    document.getElementById('modalContactInfo')?.classList.add('hidden');
  });

  // Tambah Baris Akun User / Kru
  document.getElementById('btnAddUserAccountRow')?.addEventListener('click', () => {
    const username = prompt("Masukkan Username Kru / Operator Baru:");
    if (!username) return;
    const password = prompt("Masukkan Password untuk " + username + ":");
    if (!password) return;

    if (!Array.isArray(STATE.userAccounts)) STATE.userAccounts = [];
    STATE.userAccounts.push({ user: username.trim(), pass: password.trim(), role: 'operator' });
    localStorage.setItem('snapevent_user_accounts', JSON.stringify(STATE.userAccounts));
    renderUserAccountsList();
    showToast(`Akun operator '${username}' berhasil ditambahkan!`, "success");
  });

  // Frame Selector Pills (Event Delegation)
  document.getElementById('frameListContainer').addEventListener('click', (e) => {
    const pill = e.target.closest('.frame-pill');
    if (!pill) return;
    document.querySelectorAll('.frame-pill').forEach(p => {
      p.classList.remove('bg-brand-gold', 'text-black');
      p.classList.add('bg-white/5', 'text-zinc-300');
    });
    pill.classList.remove('bg-white/5', 'text-zinc-300');
    pill.classList.add('bg-brand-gold', 'text-black');
    STATE.activeFrame = pill.getAttribute('data-frame');
    document.getElementById('activeFrameName').textContent = pill.textContent.trim().toUpperCase();
  });

  // Photo Review Modal Buttons
  document.getElementById('btnRetakePhoto').addEventListener('click', () => {
    document.getElementById('modalReviewPhoto').classList.add('hidden');
  });
  document.getElementById('btnSaveToDrive').addEventListener('click', handleSavePhotoToDrive);

  // Gallery Category Tabs (Event Delegation)
  document.getElementById('galleryCategoryTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    document.querySelectorAll('.cat-tab').forEach(t => {
      t.classList.remove('bg-brand-gold', 'text-black');
      t.classList.add('bg-white/5', 'text-zinc-300');
    });
    tab.classList.remove('bg-white/5', 'text-zinc-300');
    tab.classList.add('bg-brand-gold', 'text-black');
    STATE.activeGalleryFilter = tab.getAttribute('data-cat');
    renderGallery();
  });

  // Slideshow Controls
  document.getElementById('btnOpenSlideshow').addEventListener('click', openSlideshow);
  document.getElementById('btnCloseSlideshow').addEventListener('click', closeSlideshow);

  // Admin Login & Navigation
  document.getElementById('btnOpenAdmin').addEventListener('click', openAdminPanel);
  document.getElementById('btnCancelAdminPin').addEventListener('click', () => {
    document.getElementById('modalAdminPin').classList.add('hidden');
  });
  document.getElementById('btnSubmitAdminPin').addEventListener('click', verifyAdminLogin);
  document.getElementById('btnAdminLogout').addEventListener('click', () => {
    sessionStorage.removeItem('snapevent_admin_session');
    showView('viewCamera');
    showToast("Anda telah keluar dari panel Admin.", "info");
  });

  // Admin Tab Switchers
  document.querySelectorAll('.adm-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchAdminTab(btn.getAttribute('data-admintab'));
    });
  });

  // Custom Frame File Upload
  document.getElementById('formEventCustomFrame').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      STATE.tempCustomFrameData = dataUrl;
      document.getElementById('customFramePreviewImg').src = dataUrl;
      document.getElementById('customFramePreviewBox').classList.remove('hidden');
      document.getElementById('btnRemoveCustomFrame').classList.remove('hidden');
      showToast("Bingkai kustom PNG berhasil diunggah!", "info");
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btnRemoveCustomFrame').addEventListener('click', () => {
    STATE.tempCustomFrameData = null;
    document.getElementById('formEventCustomFrame').value = '';
    document.getElementById('customFramePreviewBox').classList.add('hidden');
    document.getElementById('btnRemoveCustomFrame').classList.add('hidden');
    if (STATE.activeEvent) {
      STATE.activeEvent.customFrameData = null;
      STATE.activeEvent.customFrameUrl = '';
    }
    showToast("Bingkai kustom dihapus.", "info");
  });

  // Admin Event Form Save
  document.getElementById('formSaveEvent').addEventListener('submit', (e) => {
    e.preventDefault();
    saveAdminEventForm();
  });

  document.getElementById('btnAddCategoryRow').addEventListener('click', () => {
    const container = document.getElementById('categoryInputsContainer');
    const row = document.createElement('div');
    row.className = "flex items-center gap-2";
    row.innerHTML = `
      <input type="text" class="cat-input flex-1 bg-[#111116] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-gold outline-none" placeholder="Nama Kategori Baru" />
      <button type="button" class="btn-remove-cat p-2 text-zinc-400 hover:text-red-400 text-xs">✕</button>
    `;
    row.querySelector('.btn-remove-cat').onclick = () => row.remove();
    container.appendChild(row);
  });

  document.getElementById('btnCancelEditEvent').addEventListener('click', () => {
    switchAdminTab('events');
  });

  // Global Settings Form Save
  document.getElementById('formGlobalSettings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('cfgGasUrl').value.trim();
    const appTitle = document.getElementById('cfgAppTitle').value.trim() || 'SnapEvent Studio';
    const appLogoUrl = document.getElementById('cfgAppLogoUrl').value.trim();
    const appPhone = document.getElementById('cfgAppPhone').value.trim();
    const appInstagram = document.getElementById('cfgAppInstagram').value.trim();
    const user = document.getElementById('cfgAdminUser').value.trim() || 'admin';
    const pass = document.getElementById('cfgAdminPass').value.trim() || 'admin123';
    const driveMaster = extractDriveFolderId(document.getElementById('cfgDriveMasterId').value.trim());

    STATE.gasApiUrl = url;
    STATE.appTitle = appTitle;
    STATE.appLogoUrl = appLogoUrl;
    STATE.appPhone = appPhone;
    STATE.appInstagram = appInstagram;
    STATE.adminUser = user;
    STATE.adminPass = pass;
    STATE.driveMasterId = driveMaster;

    localStorage.setItem('snapevent_gas_url', url);
    localStorage.setItem('snapevent_app_title', appTitle);
    localStorage.setItem('snapevent_app_logo_url', appLogoUrl);
    localStorage.setItem('snapevent_app_phone', appPhone);
    localStorage.setItem('snapevent_app_instagram', appInstagram);
    localStorage.setItem('snapevent_admin_user', user);
    localStorage.setItem('snapevent_admin_pass', pass);
    localStorage.setItem('snapevent_drive_master_id', driveMaster);

    // Sinkronisasi ke Backend GAS jika URL aktif
    if (url) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'adminUpdateGlobalConfig',
            updates: {
              app_title: appTitle,
              app_logo_url: appLogoUrl,
              app_phone: appPhone,
              app_instagram: appInstagram,
              admin_user: user,
              admin_pass: pass,
              master_drive_folder_id: driveMaster,
              user_accounts: JSON.stringify(STATE.userAccounts)
            }
          })
        });
      } catch (err) {
        console.warn("Sync global config error:", err.message);
      }
    }

    applyGlobalConfigToUI();
    showToast("Pengaturan global & branding berhasil disimpan!", "success");
    loadEventData();
  });

  document.getElementById('btnResetDemoData').addEventListener('click', () => {
    localStorage.removeItem('snapevent_gas_url');
    localStorage.removeItem('snapevent_admin_user');
    localStorage.removeItem('snapevent_admin_pass');
    STATE.gasApiUrl = '';
    STATE.adminUser = 'admin';
    STATE.adminPass = 'admin123';
    STATE.photos = [...MOCK_DATA.samplePhotos];
    showToast("Reset ke mode demo berhasil!", "info");
    renderAdminDashboard();
    renderGallery();
  });

  // Zoom Modal Close
  document.getElementById('btnCloseZoom').addEventListener('click', () => {
    document.getElementById('modalZoomPhoto').classList.add('hidden');
  });

  document.getElementById('btnEmptyGoCamera').addEventListener('click', () => {
    showView('viewCamera');
  });
}

function triggerCameraShutter() {
  // Flash Animation
  const flash = document.getElementById('flashOverlay');
  flash.classList.remove('flash-anim');
  void flash.offsetWidth; // Trigger reflow
  flash.classList.add('flash-anim');

  const video = document.getElementById('cameraVideo');
  // Cek apakah live video stream sudah aktif dan memiliki frame riil
  if (STATE.mediaStream && video && video.readyState >= 2 && video.videoWidth > 0) {
    processPhotoWithFrameAndFilter(video);
  } else {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      triggerNativeCamera();
    } else {
      // Pada desktop/laptop tanpa webcam, buat snapshot demo pesta beresolusi tinggi agar tidak layar hitam
      const simulated = generateSimulatedPartySnapshot();
      processPhotoWithFrameAndFilter(simulated);
    }
  }
}

// --- 12. TOAST NOTIFICATION HELPER ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');

  const colors = {
    success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200',
    error: 'bg-red-950/90 border-red-500/40 text-red-200',
    warning: 'bg-amber-950/90 border-amber-500/40 text-amber-200',
    info: 'bg-brand-surfaceLight/95 border-brand-surfaceBorder text-zinc-100'
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-xs font-medium shadow-2xl backdrop-blur-md transition-all duration-300 transform -translate-y-2 opacity-0 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'warning' ? '⚠️' : type === 'error' ? '✕' : 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('-translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

