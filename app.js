/**
 * ==============================================================================
 * SNAPEVENT: APP.JS
 * Universal Client Architecture for Event Disposable Camera & Live Gallery
 * ==============================================================================
 */

// --- 1. GLOBAL DEFAULTS & LOCAL STATE ---
const GLOBAL_CONFIG = {
  // Folder Induk Google Drive Resmi (Fallback permanen untuk seluruh perangkat)
  DEFAULT_DRIVE_MASTER_ID: '12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw',
  DEFAULT_APP_TITLE: 'SnapEvent Enterprise Studio',
  DEFAULT_GAS_URL: 'https://script.google.com/macros/s/AKfycbxg-Owg7BrEqx4KHDI7UsLBX88ejLXcVxgQuSZNtz8d0rIJ_wCGVQFsOzpKGDO8w8cOrw/exec'
};

const STATE = {
  // Configuration & Custom Branding (Cloud Persistent)
  gasApiUrl: (localStorage.getItem('snapevent_gas_url') && localStorage.getItem('snapevent_gas_url').trim().startsWith('http')) 
    ? localStorage.getItem('snapevent_gas_url').trim() 
    : GLOBAL_CONFIG.DEFAULT_GAS_URL,
  appTitle: localStorage.getItem('snapevent_app_title') || GLOBAL_CONFIG.DEFAULT_APP_TITLE,
  appLogoUrl: localStorage.getItem('snapevent_app_logo_url') || '',
  appPhone: localStorage.getItem('snapevent_app_phone') || '0812-3456-7890',
  appInstagram: localStorage.getItem('snapevent_app_instagram') || '@snapevent',
  adminUser: localStorage.getItem('snapevent_admin_user') || 'admin',
  adminPass: localStorage.getItem('snapevent_admin_pass') || 'admin123',
  adminPin: localStorage.getItem('snapevent_admin_pin') || '889900',
  userAccounts: JSON.parse(localStorage.getItem('snapevent_user_accounts') || '[{"user":"crew","pass":"crew123","role":"operator"}]'),
  currentUserRole: sessionStorage.getItem('snapevent_user_role') || 'guest',
  currentUsername: sessionStorage.getItem('snapevent_user_name') || 'admin',
  driveMasterId: localStorage.getItem('snapevent_drive_master_id') || GLOBAL_CONFIG.DEFAULT_DRIVE_MASTER_ID,
  customFrameImgObj: null,
  tempCustomFrameData: null,
  customFrames: JSON.parse(localStorage.getItem('snapevent_custom_frames') || '[]'),
  events: JSON.parse(localStorage.getItem('snapevent_events') || '[]'),
  metrics: JSON.parse(localStorage.getItem('snapevent_metrics') || '{"totalEvents":5,"totalPhotos":13,"totalVotes":8}'),

  // Guest Profile
  guestId: getOrCreateGuestId(),
  guestNama: localStorage.getItem('snapevent_guest_nama') || '',

  // Active Event Context
  activeEventId: localStorage.getItem('snapevent_active_event_id') || 'EVT-202611-001',
  activeEvent: null,
  activeCategories: [],

  // Camera & Canvas Selection
  activeFilter: '800T',
  activeFrame: 'GOLD_DECO',
  mediaStream: null,
  facingMode: 'environment', // 'environment' (back) or 'user' (front)
  rawCapturedImageObj: null, // Clean captured snapshot without frame for dynamic frame switching
  currentCapturedDataUrl: null,

  // Gallery & Photos Cache (Isolasi Mandiri per Event)
  photos: [],
  votedPhotoIds: [],
  votedCategoryIds: [],
  activeGalleryFilter: 'ALL',

  // Slideshow State
  slideshowIndex: 0,
  slideshowTimer: null
};

// --- DATA ISOLATION HELPERS PER EVENT ---
function getEventPhotosKey(eventId) {
  return 'snapevent_photos_' + (eventId || STATE.activeEventId || 'EVT-202611-001');
}

function getEventVotedPhotosKey(eventId) {
  return 'snapevent_voted_photos_' + (eventId || STATE.activeEventId || 'EVT-202611-001');
}

function getEventVotedCategoriesKey(eventId) {
  return 'snapevent_voted_categories_' + (eventId || STATE.activeEventId || 'EVT-202611-001');
}

function loadEventPhotos(eventId) {
  const id = eventId || STATE.activeEventId || 'EVT-202611-001';
  const key = getEventPhotosKey(id);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      STATE.photos = JSON.parse(raw);
    } else {
      // Migrasi atau fallback ke mock data sample jika event default demo
      const legacy = JSON.parse(localStorage.getItem('snapevent_local_photos') || '[]');
      if (id === MOCK_DATA.event.idEvent || id === 'EVT-202611-001') {
        if (legacy.length > 0) {
          STATE.photos = legacy;
        } else {
          STATE.photos = [...MOCK_DATA.samplePhotos];
        }
        localStorage.setItem(key, JSON.stringify(STATE.photos));
      } else {
        STATE.photos = [];
      }
    }
  } catch (e) {
    STATE.photos = [];
  }
}

function saveEventPhotos(eventId) {
  const id = eventId || STATE.activeEventId || 'EVT-202611-001';
  try {
    localStorage.setItem(getEventPhotosKey(id), JSON.stringify(STATE.photos.slice(0, 100)));
  } catch (e) {
    console.warn("Penyimpanan foto penuh / error:", e);
  }
}

function loadEventVotes(eventId) {
  const id = eventId || STATE.activeEventId || 'EVT-202611-001';
  try {
    STATE.votedPhotoIds = JSON.parse(localStorage.getItem(getEventVotedPhotosKey(id)) || '[]');
    STATE.votedCategoryIds = JSON.parse(localStorage.getItem(getEventVotedCategoriesKey(id)) || '[]');
  } catch (e) {
    STATE.votedPhotoIds = [];
    STATE.votedCategoryIds = [];
  }
}

function saveEventVotes(eventId) {
  const id = eventId || STATE.activeEventId || 'EVT-202611-001';
  localStorage.setItem(getEventVotedPhotosKey(id), JSON.stringify(STATE.votedPhotoIds));
  localStorage.setItem(getEventVotedCategoriesKey(id), JSON.stringify(STATE.votedCategoryIds));
}

function extractDriveFolderId(input) {
  if (!input) return "";
  const str = String(input).trim();
  const folderMatch = str.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return str;
}

function getEventShareUrl(eventId) {
  const id = eventId || STATE.activeEventId || 'EVT-202611-001';
  const loc = window.location;
  const base = `${loc.protocol}//${loc.host}${loc.pathname}`;
  let shareUrl = `${base}?event=${encodeURIComponent(id)}`;
  if (STATE.gasApiUrl) {
    shareUrl += `&gas=${encodeURIComponent(STATE.gasApiUrl)}`;
  }
  return shareUrl;
}

function getQrImageUrl(text, size = 300) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(text)}`;
}

function getAvailableFrames() {
  const allFrames = [
    { id: 'GOLD_DECO', name: '✨ Gold Deco', type: 'builtin' },
    { id: 'POLAROID', name: '📷 Polaroid', type: 'builtin' },
    { id: 'MINIMAL', name: '▪️ Minimalist', type: 'builtin' },
    { id: 'NONE', name: 'Tanpa Bingkai', type: 'builtin' }
  ];

  if (Array.isArray(STATE.customFrames)) {
    STATE.customFrames.forEach(cf => {
      if (cf.scope === 'global' || cf.eventId === STATE.activeEventId) {
        allFrames.push({
          id: cf.id,
          name: `🖼️ ${cf.name || 'Custom'}`,
          type: 'custom',
          scope: cf.scope,
          dataUrl: cf.dataUrl
        });
      }
    });
  }

  const activeCustomData = STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl;
  if (activeCustomData && !allFrames.some(f => f.dataUrl === activeCustomData)) {
    allFrames.push({
      id: 'CUSTOM_EVENT',
      name: STATE.activeEvent?.customFrameName ? `🖼️ ${STATE.activeEvent.customFrameName}` : '🖼️ Bingkai Kustom Acara',
      type: 'custom',
      scope: 'event',
      dataUrl: activeCustomData
    });
  }

  // KEBIJAKAN BINGKAI ACARA (FRAME POLICY)
  const ev = STATE.activeEvent;
  if (ev) {
    // Mode Single Frame Lock: Hanya kembalikan 1 bingkai terkunci (termasuk custom frame)
    if (ev.frameLockMode === 'single') {
      const lockedId = ev.singleLockedFrame || (Array.isArray(ev.activeFrames) && ev.activeFrames[0]) || 'GOLD_DECO';
      const single = allFrames.find(f => f.id === lockedId || (f.type === 'custom' && (lockedId === 'CUSTOM_EVENT' || lockedId === 'CUSTOM' || lockedId === 'frame_legacy_event')));
      return [single || allFrames[0]];
    }

    // Mode Multi-Frame: Saring dan urutkan PERSIS sesuai urutan yang disusun admin (Drag & Drop)
    if (Array.isArray(ev.activeFrames) && ev.activeFrames.length > 0) {
      const ordered = [];
      ev.activeFrames.forEach(frameId => {
        const match = allFrames.find(f => f.id === frameId || (f.type === 'custom' && (frameId === 'CUSTOM_EVENT' || frameId === 'CUSTOM' || frameId === 'frame_legacy_event')));
        if (match && !ordered.some(o => o.id === match.id)) {
          ordered.push(match);
        }
      });
      // Sertakan bingkai kustom yang mungkin belum terdaftar di array
      allFrames.forEach(f => {
        if (!ordered.some(o => o.id === f.id)) {
          if (f.type === 'custom' && (f.eventId === ev.idEvent || f.scope === 'event' || f.scope === 'global')) {
            if (ev.activeFrames.includes(f.id) || ev.activeFrames.includes('CUSTOM_EVENT') || ev.activeFrames.includes('CUSTOM')) {
              ordered.push(f);
            }
          }
        }
      });
      if (ordered.length > 0) return ordered;
    }
  }

  return allFrames;
}

// --- GUEST IDENTITY & SESSION RESET HELPERS ---
function updateGuestIdentityUI() {
  const hasName = Boolean(STATE.guestNama && STATE.guestNama.trim());
  const guestName = hasName ? STATE.guestNama.trim() : '';

  // Box Info Identitas di Halaman Profil / Tulis Nama (viewWelcome)
  const infoBox = document.getElementById('activeGuestInfoBox');
  const nameText = document.getElementById('activeGuestNameText');
  const inputGuest = document.getElementById('inputGuestName');
  const btnStart = document.getElementById('btnStartCamera');

  if (infoBox) {
    if (hasName) {
      infoBox.classList.remove('hidden');
      if (nameText) nameText.textContent = guestName;
    } else {
      infoBox.classList.add('hidden');
    }
  }

  if (inputGuest && hasName && (!inputGuest.value || !inputGuest.value.trim())) {
    inputGuest.value = guestName;
  }

  if (btnStart) {
    const textSpan = btnStart.querySelector('span');
    if (textSpan) {
      textSpan.textContent = hasName ? 'Buka Kamera Acara' : 'Simpan & Buka Kamera Acara';
    }
  }

  // Badge Tamu di Layar Kamera (Header View Camera)
  const camBadge = document.getElementById('camGuestNameDisplay');
  if (camBadge) {
    camBadge.textContent = hasName ? guestName : 'Tamu';
  }
}

function resetGuestNameSession() {
  STATE.guestNama = '';
  localStorage.removeItem('snapevent_guest_nama');
  sessionStorage.removeItem('snapevent_current_view');

  const inputGuest = document.getElementById('inputGuestName');
  if (inputGuest) {
    inputGuest.value = '';
    inputGuest.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30');
  }
  const warnEl = document.getElementById('guestNameWarning');
  if (warnEl) warnEl.classList.add('hidden');

  stopCameraStream();
  updateGuestIdentityUI();
  updateRemainingQuotaDisplay();
  updateGuestIdentityUI();
  showView('viewWelcome');
  showToast('Sesi nama berhasil direset! Silakan masukkan nama baru.', 'info');
  setTimeout(() => {
    if (inputGuest) inputGuest.focus();
  }, 250);
}

// Default Seed / Mock Data for Instant Browser & Offline Preview (5 Complete Events)
const MOCK_DATA = {
  events: [
    {
      idEvent: "EVT-202611-001",
      namaEvent: "The Wedding of Sarah & Kevin",
      slugEvent: "sarah-kevin",
      tanggalEvent: "2026-11-20",
      hashtagEvent: "#SarahKevinEverAfter",
      maxFotoPerGuest: 10,
      maxVotePerGuest: 3,
      revealMode: "SEGERA",
      isRevealed: true,
      likeEnabled: true,
      publicVisible: true,
      activeCameraStyles: ["RAW", "800T", "WARM", "BW"],
      frameLockMode: "multi",
      singleLockedFrame: "GOLD_DECO",
      activeFrames: ["GOLD_DECO", "POLAROID", "MINIMAL"],
      gdriveFolderId: "",
      statusEvent: "AKTIF",
      customFrameUrl: ""
    },
    {
      idEvent: "EVT-202611-392",
      namaEvent: "The Wedding of Hans & Yurike",
      slugEvent: "hans-yurike",
      tanggalEvent: "2026-11-25",
      hashtagEvent: "#Hans&Yurike",
      maxFotoPerGuest: 5,
      maxVotePerGuest: 3,
      revealMode: "SEGERA",
      isRevealed: true,
      likeEnabled: true,
      publicVisible: true,
      activeCameraStyles: ["RAW", "800T", "WARM", "BW"],
      frameLockMode: "single",
      singleLockedFrame: "POLAROID",
      activeFrames: ["POLAROID"],
      gdriveFolderId: "1FZoLfd0fczTX2N6y-xAI-G4KgVDnEfQk",
      statusEvent: "INAKTIF",
      customFrameUrl: ""
    },
    {
      idEvent: "EVT-202612-105",
      namaEvent: "Annual Gala Dinner PT Nusantara Tech",
      slugEvent: "nusantara-gala-2026",
      tanggalEvent: "2026-12-15",
      hashtagEvent: "#NusantaraGala2026",
      maxFotoPerGuest: 8,
      maxVotePerGuest: 2,
      revealMode: "SETELAH",
      isRevealed: false,
      likeEnabled: true,
      publicVisible: true,
      activeCameraStyles: ["RAW", "800T", "BW"],
      frameLockMode: "multi",
      singleLockedFrame: "MINIMAL",
      activeFrames: ["MINIMAL", "POLAROID"],
      gdriveFolderId: "",
      statusEvent: "INAKTIF",
      customFrameUrl: ""
    },
    {
      idEvent: "EVT-202612-210",
      namaEvent: "Clarissa's Sweet 17: Enchanted Forest",
      slugEvent: "clarissa-sweet-17",
      tanggalEvent: "2026-12-28",
      hashtagEvent: "#ClarissaSweet17",
      maxFotoPerGuest: 12,
      maxVotePerGuest: 3,
      revealMode: "SEGERA",
      isRevealed: true,
      likeEnabled: true,
      publicVisible: true,
      activeCameraStyles: ["RAW", "800T", "WARM"],
      frameLockMode: "multi",
      singleLockedFrame: "GOLD_DECO",
      activeFrames: ["GOLD_DECO", "POLAROID"],
      gdriveFolderId: "",
      statusEvent: "INAKTIF",
      customFrameUrl: ""
    },
    {
      idEvent: "EVT-202701-015",
      namaEvent: "Alumni Homecoming SMAN 1 Angkatan 2016",
      slugEvent: "reuni-smansa-2016",
      tanggalEvent: "2027-01-10",
      hashtagEvent: "#Smansa16Reunited",
      maxFotoPerGuest: 15,
      maxVotePerGuest: 5,
      revealMode: "SEGERA",
      isRevealed: true,
      likeEnabled: true,
      publicVisible: true,
      activeCameraStyles: ["RAW", "800T", "WARM", "BW"],
      frameLockMode: "multi",
      singleLockedFrame: "GOLD_DECO",
      activeFrames: ["GOLD_DECO", "POLAROID", "MINIMAL", "NONE"],
      gdriveFolderId: "",
      statusEvent: "INAKTIF",
      customFrameUrl: ""
    }
  ],
  event: {
    idEvent: "EVT-202611-001",
    namaEvent: "The Wedding of Sarah & Kevin",
    slugEvent: "sarah-kevin",
    tanggalEvent: "2026-11-20",
    hashtagEvent: "#SarahKevinEverAfter",
    maxFotoPerGuest: 10,
    maxVotePerGuest: 3,
    revealMode: "SEGERA",
    isRevealed: true,
    likeEnabled: true,
    publicVisible: true,
    activeCameraStyles: ["RAW", "800T", "WARM", "BW"],
    frameLockMode: "multi",
    singleLockedFrame: "GOLD_DECO",
    activeFrames: ["GOLD_DECO", "POLAROID", "MINIMAL"],
    gdriveFolderId: "",
    statusEvent: "AKTIF",
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
  // 0. Deteksi Parameter URL Cloud Bridge (?gas=... & ?event=...) atau Gunakan Default Cloud Deployment
  const urlParams = new URLSearchParams(window.location.search);
  const gasFromUrl = urlParams.get('gas');
  if (gasFromUrl && gasFromUrl.trim().startsWith('http')) {
    STATE.gasApiUrl = decodeURIComponent(gasFromUrl.trim());
    localStorage.setItem('snapevent_gas_url', STATE.gasApiUrl);
  } else if (!localStorage.getItem('snapevent_gas_url') || !localStorage.getItem('snapevent_gas_url').trim().startsWith('http')) {
    STATE.gasApiUrl = GLOBAL_CONFIG.DEFAULT_GAS_URL;
    localStorage.setItem('snapevent_gas_url', STATE.gasApiUrl);
  }

  // Pastikan koleksi events terinisialisasi dengan 5 event master lengkap
  if (!Array.isArray(STATE.events) || STATE.events.length < 5) {
    const existingIds = new Set((STATE.events || []).map(e => e.idEvent));
    const merged = [...(STATE.events || [])];
    MOCK_DATA.events.forEach(mockEvt => {
      if (!existingIds.has(mockEvt.idEvent)) {
        merged.push(mockEvt);
        existingIds.add(mockEvt.idEvent);
      }
    });
    STATE.events = merged;
    localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
  }

  // Tentukan event aktif saat ini
  const savedActiveId = localStorage.getItem('snapevent_active_event_id');
  if (savedActiveId && STATE.events.some(e => e.idEvent === savedActiveId)) {
    STATE.activeEventId = savedActiveId;
  } else {
    STATE.activeEventId = STATE.events[0].idEvent;
    localStorage.setItem('snapevent_active_event_id', STATE.activeEventId);
  }

  STATE.activeEvent = STATE.events.find(e => e.idEvent === STATE.activeEventId) || STATE.events[0];

  // Periksa parameter URL (e.g. ?event=sarah-kevin&view=slideshow)
  const requestedEvent = urlParams.get('event');

  // GERBANG KEAMANAN ACARA: Jika URL membawa parameter event dan event tersebut TIDAK aktif
  if (requestedEvent) {
    const isMatchActive = (requestedEvent === STATE.activeEvent.idEvent) || 
                          (STATE.activeEvent.slugEvent && requestedEvent.toLowerCase() === STATE.activeEvent.slugEvent.toLowerCase());
    
    if (!isMatchActive) {
      // Jika sesi admin sedang aktif, admin tetap boleh masuk
      if (sessionStorage.getItem('snapevent_admin_session') !== 'true') {
        const closedTitle = document.getElementById('closedEventTitle');
        if (closedTitle) closedTitle.textContent = "Acara Ini Sedang Tidak Aktif";
        const closedDesc = document.getElementById('closedEventDesc');
        if (closedDesc) {
          closedDesc.textContent = `Tautan acara "${requestedEvent}" telah selesai atau belum dimulai. Hanya acara yang berstatus aktif yang dapat diakses oleh publik.`;
        }
        showView('viewEventClosed');
        return;
      }
    }
  }

  // Muat data foto & voting terisolasi untuk event aktif
  loadEventPhotos(STATE.activeEventId);
  loadEventVotes(STATE.activeEventId);

  // Muat data awal event dari API Google Apps Script atau Mock Data
  await loadEventData();

  // Cek Persistensi Sesi Admin (Anti-Keluar saat refresh F5!)
  if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
    showView('viewAdmin');
    renderAdminDashboard();
    syncEventsFromBackend(false);
    return;
  }

  // GERBANG WAJIB IDENTITAS TAMU: Sebelum menggunakan kamera wajib isi nama dulu!
  if (!STATE.guestNama || !STATE.guestNama.trim()) {
    showView('viewWelcome');
  } else {
    const savedView = sessionStorage.getItem('snapevent_current_view') || 'viewCamera';
    showView(savedView);
  }
  updateRemainingQuotaDisplay();
  updateGuestIdentityUI();
  syncEventsFromBackend(false);

  // Cek Persistensi Slideshow atau Parameter URL
  if (urlParams.get('view') === 'slideshow' || sessionStorage.getItem('snapevent_slideshow_active') === 'true') {
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

// --- 3. DATA FETCHING (GAS API OR MOCK) & EVENT ACTIVATION ---
async function loadEventData() {
  if (STATE.gasApiUrl) {
    try {
      const resp = await fetch(`${STATE.gasApiUrl}?action=getEventDetails&eventId=${STATE.activeEventId}&guestId=${STATE.guestId}`);
      const res = await resp.json();
      if (res.status === 'success') {
        STATE.activeEvent = res.event;
        STATE.activeCategories = res.categories || [];

        if (res.metrics) {
          STATE.metrics = res.metrics;
          localStorage.setItem('snapevent_metrics', JSON.stringify(STATE.metrics));
        }

        // Sinkronkan seluruh event jika backend mengembalikan allEvents
        if (Array.isArray(res.allEvents) && res.allEvents.length > 0) {
          STATE.events = res.allEvents;
          localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
        } else {
          syncEventsFromBackend(false);
        }

        if (res.globalConfig) {
          if (res.globalConfig.master_drive_folder_id) {
            STATE.driveMasterId = res.globalConfig.master_drive_folder_id;
            localStorage.setItem('snapevent_drive_master_id', STATE.driveMasterId);
          }
          if (res.globalConfig.app_title) {
            STATE.appTitle = res.globalConfig.app_title;
            localStorage.setItem('snapevent_app_title', STATE.appTitle);
          }
          if (res.globalConfig.app_logo_url) {
            STATE.appLogoUrl = res.globalConfig.app_logo_url;
            localStorage.setItem('snapevent_app_logo_url', STATE.appLogoUrl);
          }
          if (res.globalConfig.app_phone) {
            STATE.appPhone = res.globalConfig.app_phone;
            localStorage.setItem('snapevent_app_phone', STATE.appPhone);
          }
          if (res.globalConfig.app_instagram) {
            STATE.appInstagram = res.globalConfig.app_instagram;
            localStorage.setItem('snapevent_app_instagram', STATE.appInstagram);
          }
          if (res.globalConfig.admin_user) {
            STATE.adminUser = res.globalConfig.admin_user;
            localStorage.setItem('snapevent_admin_user', STATE.adminUser);
          }
          if (res.globalConfig.admin_pass) {
            STATE.adminPass = res.globalConfig.admin_pass;
            localStorage.setItem('snapevent_admin_pass', STATE.adminPass);
          }
          if (res.globalConfig.user_accounts) {
            try {
              STATE.userAccounts = JSON.parse(res.globalConfig.user_accounts);
              localStorage.setItem('snapevent_user_accounts', JSON.stringify(STATE.userAccounts));
            } catch (e) { }
          }
        }

        if (res.guestStats && res.guestStats.guestVotesMap) {
          const votedList = Object.keys(res.guestStats.guestVotesMap).filter(k => res.guestStats.guestVotesMap[k] > 0);
          STATE.votedCategoryIds = Array.from(new Set([...STATE.votedCategoryIds, ...votedList]));
          saveEventVotes(STATE.activeEventId);
        }

        applyGlobalConfigToUI();
        applyEventToUI();
        await loadGallery();
        return;
      } else if (res.status === 'inactive') {
        if (sessionStorage.getItem('snapevent_admin_session') !== 'true') {
          showView('viewEventClosed');
          return;
        }
      }
    } catch (e) {
      console.warn("Koneksi GAS API belum aktif, menggunakan mode demo:", e.message);
    }
  }

  // Fallback ke Koleksi Acara Lokal (Isolasi Mandiri per Acara)
  STATE.activeEvent = (STATE.events && STATE.events.find(e => e.idEvent === STATE.activeEventId)) || MOCK_DATA.event;
  STATE.activeCategories = (STATE.activeEvent && STATE.activeEvent.categories) || MOCK_DATA.categories;
  loadEventPhotos(STATE.activeEventId);
  applyGlobalConfigToUI();
  applyEventToUI();
  renderGallery();
}

function activateEvent(idEvent) {
  if (!idEvent) return;
  STATE.activeEventId = idEvent;
  localStorage.setItem('snapevent_active_event_id', idEvent);

  const ev = (STATE.events && STATE.events.find(e => e.idEvent === idEvent)) || 
             (idEvent === MOCK_DATA.event.idEvent ? MOCK_DATA.event : null);
  if (ev) {
    STATE.activeEvent = ev;
  }

  // RESET SESI TAMU: Website direset untuk ketikkan nama seperti pada tampilan awal (Screen 1)
  STATE.guestNama = '';
  localStorage.removeItem('snapevent_guest_nama');
  sessionStorage.removeItem('snapevent_current_view');
  const inputGuest = document.getElementById('inputGuestName');
  if (inputGuest) inputGuest.value = '';

  // LOAD ISOLATED DATA: Galeri & Voting khusus event ini
  loadEventPhotos(idEvent);
  loadEventVotes(idEvent);

  applyEventToUI();
  renderGallery();
  renderAdminDashboard();

  showToast(`Acara "${ev ? ev.namaEvent : idEvent}" sekarang AKTIF! Sesi tamu telah direset ke awal.`, 'success');

  // Background sync ke GAS jika dikonfigurasi
  if (STATE.gasApiUrl) {
    fetch(STATE.gasApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'adminSetActiveEvent',
        idEvent: idEvent
      })
    }).catch(err => console.warn("GAS setActiveEvent error:", err.message));
  }
}

async function syncEventsFromBackend(showToastNotice = false) {
  if (!STATE.gasApiUrl) {
    if (showToastNotice) {
      const enteredUrl = prompt(
        "URL Google Apps Script belum dikonfigurasi.\n\nSilakan masukkan URL Web App hasil Deploy Google Apps Script Anda (berakhiran /exec):",
        ""
      );
      if (enteredUrl && enteredUrl.trim().startsWith("http")) {
        STATE.gasApiUrl = enteredUrl.trim();
        localStorage.setItem('snapevent_gas_url', STATE.gasApiUrl);
        const inputEl = document.getElementById('cfgGasUrl');
        if (inputEl) inputEl.value = STATE.gasApiUrl;
        showToast("URL GAS berhasil disimpan! Melakukan sinkronisasi...", "info");
      } else {
        switchAdminTab('settings');
        const inputEl = document.getElementById('cfgGasUrl');
        if (inputEl) {
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputEl.classList.add('ring-2', 'ring-amber-400');
          setTimeout(() => inputEl.classList.remove('ring-2', 'ring-amber-400'), 4000);
        }
        showToast("Silakan masukkan URL Web App GAS pada tab Pengaturan Global lalu simpan.", "warning");
        return;
      }
    } else {
      return;
    }
  }

  const btnText = document.getElementById('btnSyncEventsText');
  const badge = document.getElementById('admSyncStatusBadge');
  if (btnText) btnText.textContent = "⏳ Mengunduh...";
  if (badge) {
    badge.textContent = "Sinkronisasi...";
    badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 animate-pulse";
  }

  try {
    // 1. Coba panggil action=getAllEvents terlebih dahulu
    let resp = await fetch(`${STATE.gasApiUrl}?action=getAllEvents`);
    let res = null;
    try {
      res = await resp.json();
    } catch (parseErr) { }

    // 2. Fallback jika backend user belum di-redeploy (gunakan getInitialData)
    if (!res || res.status !== 'success' || !Array.isArray(res.events)) {
      resp = await fetch(`${STATE.gasApiUrl}?action=getInitialData`);
      try {
        res = await resp.json();
      } catch (parseErr) { }
    }

    if (res && res.status === 'success' && Array.isArray(res.events) && res.events.length > 0) {
      STATE.events = res.events;
      localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));

      // Simpan metrik riil Google Sheets (Total Event, Foto, dan Suara)
      if (res.metrics) {
        STATE.metrics = res.metrics;
      } else {
        STATE.metrics = {
          totalEvents: res.totalEvents || res.events.length,
          totalPhotos: res.totalPhotos || (STATE.metrics ? STATE.metrics.totalPhotos : 0),
          totalVotes: res.totalVotes || (STATE.metrics ? STATE.metrics.totalVotes : 0)
        };
      }
      localStorage.setItem('snapevent_metrics', JSON.stringify(STATE.metrics));

      // Sinkronkan event aktif
      const matchedActive = STATE.events.find(e => e.idEvent === STATE.activeEventId);
      if (matchedActive) {
        STATE.activeEvent = matchedActive;
      } else {
        const activeFromGas = STATE.events.find(e => e.statusEvent === 'AKTIF');
        if (activeFromGas) {
          STATE.activeEventId = activeFromGas.idEvent;
          STATE.activeEvent = activeFromGas;
          localStorage.setItem('snapevent_active_event_id', activeFromGas.idEvent);
        }
      }

      if (res.globalConfig) {
        if (res.globalConfig.master_drive_folder_id) {
          STATE.driveMasterId = res.globalConfig.master_drive_folder_id;
          localStorage.setItem('snapevent_drive_master_id', STATE.driveMasterId);
        }
        if (res.globalConfig.app_title) {
          STATE.appTitle = res.globalConfig.app_title;
          localStorage.setItem('snapevent_app_title', STATE.appTitle);
        }
        if (res.globalConfig.app_logo_url) {
          STATE.appLogoUrl = res.globalConfig.app_logo_url;
          localStorage.setItem('snapevent_app_logo_url', STATE.appLogoUrl);
        }
        if (res.globalConfig.app_phone) {
          STATE.appPhone = res.globalConfig.app_phone;
          localStorage.setItem('snapevent_app_phone', STATE.appPhone);
        }
        if (res.globalConfig.app_instagram) {
          STATE.appInstagram = res.globalConfig.app_instagram;
          localStorage.setItem('snapevent_app_instagram', STATE.appInstagram);
        }
        if (res.globalConfig.admin_user) {
          STATE.adminUser = res.globalConfig.admin_user;
          localStorage.setItem('snapevent_admin_user', STATE.adminUser);
        }
        if (res.globalConfig.admin_pass) {
          STATE.adminPass = res.globalConfig.admin_pass;
          localStorage.setItem('snapevent_admin_pass', STATE.adminPass);
        }
        if (res.globalConfig.user_accounts) {
          try {
            STATE.userAccounts = JSON.parse(res.globalConfig.user_accounts);
            localStorage.setItem('snapevent_user_accounts', JSON.stringify(STATE.userAccounts));
          } catch (e) { }
        }
        applyGlobalConfigToUI();
      }

      // Muat foto galeri aktif dari Google Sheets agar foto & voting selalu sinkron di seluruh perangkat
      await loadGallery();

      applyEventToUI();
      renderAdminDashboard();

      const pCount = (STATE.metrics && typeof STATE.metrics.totalPhotos === 'number') ? STATE.metrics.totalPhotos : STATE.photos.length;
      const vCount = (STATE.metrics && typeof STATE.metrics.totalVotes === 'number') ? STATE.metrics.totalVotes : 0;

      if (badge) {
        badge.textContent = `Tersinkron (${STATE.events.length} Event, ${pCount} Foto, ${vCount} Suara)`;
        badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30";
      }
      if (showToastNotice) {
        showToast(`Sinkronisasi sukses! ${STATE.events.length} event & ${pCount} foto tersinkron dari Google Sheets.`, "success");
      }
    } else {
      if (badge) {
        badge.textContent = "Tersambung (0 Event)";
        badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 font-semibold border border-white/10";
      }
      if (showToastNotice) showToast("Tersambung ke GAS, namun data sheet Event belum ditemukan.", "info");
    }
  } catch (err) {
    console.warn("Gagal sinkronisasi data event dari GAS:", err.message);
    if (badge) {
      badge.textContent = "Gagal Sync";
      badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30";
    }
    if (showToastNotice) {
      showToast("Gagal sinkronisasi dari GAS: " + err.message, "error");
    }
  } finally {
    if (btnText) btnText.textContent = "🔄 Sinkronkan Data GAS";
  }
}

async function loadGallery() {
  if (!STATE.gasApiUrl) return;
  try {
    const resp = await fetch(`${STATE.gasApiUrl}?action=getGallery&eventId=${STATE.activeEventId}&guestId=${STATE.guestId}`);
    const res = await resp.json();
    if (res && res.status === 'success') {
      const serverPhotos = Array.isArray(res.photos) ? res.photos : [];
      const serverIds = new Set(serverPhotos.map(p => p.idFoto));

      // Pertahankan foto lokal pending yang belum sempat terunggah ke Drive (Zero Data Loss)
      const pendingLocalPhotos = (STATE.photos || []).filter(p => 
        p && p.gdriveViewUrl && (
          p.gdriveViewUrl.startsWith('data:') || 
          (p.idFoto && p.idFoto.startsWith('FTO-') && !serverIds.has(p.idFoto))
        )
      );

      // Gabungkan: foto lokal yang baru diambil di HP tetap tampil di depan, disusul seluruh foto server
      STATE.photos = [...pendingLocalPhotos, ...serverPhotos];
      STATE.votedPhotoIds = res.votedPhotoIds || [];
      saveEventPhotos(STATE.activeEventId);
      renderGallery();

      // Unggah otomatis di background untuk foto lokal pending agar foto dari HP Ilham / Tamu langsung tersinkronkan
      if (pendingLocalPhotos.length > 0) {
        autoUploadPendingPhotos(pendingLocalPhotos);
      }
    } else if (res && res.status === 'locked') {
      document.getElementById('galleryLockedNotice')?.classList.remove('hidden');
      const grid = document.getElementById('galleryPhotoGrid');
      if (grid) grid.innerHTML = '';
    }
  } catch (e) {
    console.warn("Gagal memuat galeri GAS:", e.message);
  }
}

async function autoUploadPendingPhotos(pendingList) {
  if (!STATE.gasApiUrl || !Array.isArray(pendingList) || pendingList.length === 0) return;
  for (const photo of pendingList) {
    if (!photo.gdriveViewUrl || !photo.gdriveViewUrl.startsWith('data:')) continue;
    try {
      const payload = {
        action: "uploadPhoto",
        eventId: photo.eventId || STATE.activeEventId,
        guestId: photo.guestId || STATE.guestId,
        guestNama: photo.guestNama || "Tamu",
        caption: photo.caption || "Momen seru!",
        cameraStyle: photo.cameraStyle || "RAW",
        frameStyle: photo.frameStyle || "POLAROID",
        imageBase64: photo.gdriveViewUrl
      };
      const resp = await fetch(STATE.gasApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const res = await resp.json();
      if (res && res.status === 'success') {
        if (res.idFoto) photo.idFoto = res.idFoto;
        if (res.viewUrl) photo.gdriveViewUrl = res.viewUrl;
        saveEventPhotos(STATE.activeEventId);
        renderGallery();
      }
    } catch (err) {
      console.warn("Auto-sync background upload error untuk foto:", photo.idFoto, err.message);
    }
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

  // Set bingkai aktif sesuai kebijakan frame acara
  if (ev.frameLockMode === 'single') {
    const lockedFrame = ev.singleLockedFrame || (Array.isArray(ev.activeFrames) && ev.activeFrames[0]) || 'GOLD_DECO';
    applyActiveFrame(lockedFrame);
  } else if (Array.isArray(ev.activeFrames) && ev.activeFrames.length > 0 && !ev.activeFrames.includes(STATE.activeFrame)) {
    applyActiveFrame(ev.activeFrames[0]);
  }

  updateGuestIdentityUI();
}

// --- 4. VIEW ROUTER & NAVIGATION ---
function showView(viewId) {
  // GERBANG WAJIB IDENTITAS TAMU: Sebelum menggunakan kamera wajib isi nama dulu!
  if (viewId === 'viewCamera') {
    if (!STATE.guestNama || !STATE.guestNama.trim()) {
      showToast("Silakan masukkan nama panggilan Anda terlebih dahulu untuk membuka kamera!", "warning");
      showView('viewWelcome');
      const inputEl = document.getElementById('inputGuestName');
      if (inputEl) {
        inputEl.focus();
        inputEl.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30');
      }
      const warnEl = document.getElementById('guestNameWarning');
      if (warnEl) warnEl.classList.remove('hidden');
      return;
    }
  }

  // Hide all views first
  ['viewWelcome', 'viewCamera', 'viewGallery', 'viewAdmin', 'viewEventClosed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');

  const bottomNav = document.getElementById('bottomNavBar');

  // Gerbang Acara Inaktif: Sembunyikan navigasi bawah & hentikan stream kamera
  if (viewId === 'viewEventClosed') {
    if (bottomNav) bottomNav.classList.add('hidden');
    stopCameraStream();
    return;
  }

  // Tampilkan navigasi bawah untuk tamu (Kamera, Galeri, dan Profil Tamu/Tulis Nama)
  // Hanya disembunyikan pada panel Admin
  if (viewId === 'viewAdmin') {
    if (bottomNav) bottomNav.classList.add('hidden');
  } else {
    if (bottomNav) bottomNav.classList.remove('hidden');
  }

  // Persistensi halaman yang sedang aktif agar saat refresh (F5) tetap di halaman ini
  sessionStorage.setItem('snapevent_current_view', viewId);

  // Update Nav Buttons Active State
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('text-brand-gold');
    btn.classList.add('text-zinc-400');
  });

  if (viewId === 'viewCamera') {
    document.getElementById('navBtnCamera')?.classList.add('text-brand-gold');
    document.getElementById('navBtnCamera')?.classList.remove('text-zinc-400');
    applyActiveFrame(STATE.activeFrame);
    // Fitur live camera HANYA aktif jika nama tamu sudah terisi
    if (STATE.guestNama && !STATE.mediaStream) {
      startCameraStream();
    }
  } else {
    // Matikan stream kamera saat di luar layar kamera untuk hemat baterai
    stopCameraStream();

    if (viewId === 'viewGallery') {
      document.getElementById('navBtnGallery')?.classList.add('text-brand-gold');
      document.getElementById('navBtnGallery')?.classList.remove('text-zinc-400');
      renderGallery();
    } else if (viewId === 'viewWelcome') {
      document.getElementById('navBtnEventInfo')?.classList.add('text-brand-gold');
      document.getElementById('navBtnEventInfo')?.classList.remove('text-zinc-400');
      // Sinkronkan input nama dengan profil tamu yang sudah tersimpan
      const inputGuest = document.getElementById('inputGuestName');
      if (inputGuest && STATE.guestNama) {
        inputGuest.value = STATE.guestNama;
      }
    }
  }

  updateGuestIdentityUI();
}

function applyActiveFrame(frameId) {
  STATE.activeFrame = frameId;
  const frames = getAvailableFrames();
  const selected = frames.find(f => f.id === frameId) || frames[0];
  
  // Update badge & hint
  const badgeEl = document.getElementById('vfActiveFrameBadge');
  if (badgeEl) badgeEl.textContent = selected.name;
  
  const activeFrameNameEl = document.getElementById('activeFrameName');
  if (activeFrameNameEl) activeFrameNameEl.textContent = selected.name.toUpperCase();
  
  const customImgEl = document.getElementById('vfCustomFrameImg');
  const builtInOverlayEl = document.getElementById('viewfinderFrameOverlay');
  
  if (selected.type === 'custom' && selected.dataUrl) {
    if (customImgEl) {
      customImgEl.src = selected.dataUrl;
      customImgEl.classList.remove('hidden');
    }
    if (builtInOverlayEl) {
      builtInOverlayEl.classList.remove('hidden');
      const tl = document.getElementById('vfFrameTopLeft');
      const bt = document.getElementById('vfFrameBottomTitle');
      if (tl) tl.textContent = '';
      if (bt) bt.textContent = '';
    }
  } else {
    if (customImgEl) customImgEl.classList.add('hidden');
    if (builtInOverlayEl) {
      if (selected.id === 'NONE') {
        builtInOverlayEl.classList.add('hidden');
      } else {
        builtInOverlayEl.classList.remove('hidden');
        const tl = document.getElementById('vfFrameTopLeft');
        const bt = document.getElementById('vfFrameBottomTitle');
        if (tl) tl.textContent = `SNAPEVENT ${STATE.activeFilter}`;
        if (bt) bt.textContent = STATE.activeEvent ? STATE.activeEvent.namaEvent : 'Our Event';
      }
    }
  }
}

function cycleNextFrame() {
  const frames = getAvailableFrames();
  let idx = frames.findIndex(f => f.id === STATE.activeFrame);
  if (idx === -1) idx = 0;
  const nextIdx = (idx + 1) % frames.length;
  applyActiveFrame(frames[nextIdx].id);
  showToast(`Bingkai: ${frames[nextIdx].name}`, 'info');
}

function cyclePrevFrame() {
  const frames = getAvailableFrames();
  let idx = frames.findIndex(f => f.id === STATE.activeFrame);
  if (idx === -1) idx = 0;
  const prevIdx = (idx - 1 + frames.length) % frames.length;
  applyActiveFrame(frames[prevIdx].id);
  showToast(`Bingkai: ${frames[prevIdx].name}`, 'info');
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
  let frameToUse = overrideFrame || STATE.activeFrame || 'GOLD_DECO';
  if (STATE.activeEvent && STATE.activeEvent.frameLockMode === 'single') {
    frameToUse = STATE.activeEvent.singleLockedFrame || (Array.isArray(STATE.activeEvent.activeFrames) && STATE.activeEvent.activeFrames[0]) || 'GOLD_DECO';
  }
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
  const selectorWrap = document.getElementById('reviewFrameSelectorContainer');
  const singleNotice = document.getElementById('reviewSingleFrameNotice');
  const singleBadge = document.getElementById('reviewSingleFrameBadge');

  const frames = getAvailableFrames();
  const isSingleLocked = Boolean(STATE.activeEvent && STATE.activeEvent.frameLockMode === 'single');

  if (isSingleLocked) {
    if (selectorWrap) selectorWrap.classList.add('hidden');
    if (singleNotice) {
      singleNotice.classList.remove('hidden');
      if (singleBadge) {
        const lockedObj = frames[0];
        singleBadge.textContent = lockedObj ? lockedObj.name : 'Bingkai Resmi Acara';
      }
    }
    return;
  } else {
    if (selectorWrap) selectorWrap.classList.remove('hidden');
    if (singleNotice) singleNotice.classList.add('hidden');
  }

  if (!container) return;

  container.innerHTML = frames.map(f => `
    <button data-frame="${f.id}" class="rev-frame-pill shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${activeFrame === f.id ? 'bg-brand-gold text-black border-brand-gold shadow-sm' : 'bg-white/5 text-zinc-300 border-white/10 hover:border-brand-gold/50'} border transition">
      ${f.name}
    </button>
  `).join('');

  const nameEl = document.getElementById('reviewActiveFrameName');
  if (nameEl) {
    const activeObj = frames.find(f => f.id === activeFrame) || frames[0];
    nameEl.textContent = (activeObj.name || activeFrame).toUpperCase();
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

  } else if (frameStyle !== 'NONE') {
    // Custom PNG Overlay (Global / Event / Multi-Frame / Single Lock)
    const customObj = Array.isArray(STATE.customFrames) ? STATE.customFrames.find(f => f.id === frameStyle) : null;
    let dataUrl = customObj ? customObj.dataUrl : null;
    if (!dataUrl) {
      dataUrl = STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl || STATE.tempCustomFrameData;
    }

    if (dataUrl) {
      const frameImg = new Image();
      frameImg.src = dataUrl;
      if (frameImg.complete && frameImg.naturalWidth > 0) {
        ctx.drawImage(frameImg, 0, 0, w, h);
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
    } else if (STATE.customFrameImgObj && STATE.customFrameImgObj.complete) {
      ctx.drawImage(STATE.customFrameImgObj, 0, 0, w, h);
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

// --- 6. UPLOAD PHOTO (SIMPAN KE GALERI & GOOGLE DRIVE) ---
async function handleSavePhotoToDrive() {
  const btn = document.getElementById('btnSaveToDrive');
  const btnText = document.getElementById('btnSaveText');
  const caption = document.getElementById('inputPhotoCaption').value.trim();

  // Pastikan ada nama tamu saat menyimpan foto ke Drive & Galeri (Camera-First Friendly Fallback)
  if (!STATE.guestNama || !STATE.guestNama.trim()) {
    const promptedName = window.prompt("Masukkan Nama Panggilan Anda agar tercatat di foto & voting acara:", "");
    if (promptedName && promptedName.trim()) {
      STATE.guestNama = promptedName.trim();
      localStorage.setItem('snapevent_guest_nama', STATE.guestNama);
      const nameInputEl = document.getElementById('inputGuestName');
      if (nameInputEl) nameInputEl.value = STATE.guestNama;
    } else {
      // Fallback nama ramah otomatis agar tamu tetap bisa menyimpan foto seketika
      STATE.guestNama = `Tamu-${STATE.guestId ? STATE.guestId.slice(-4) : Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('snapevent_guest_nama', STATE.guestNama);
    }
  }

  btn.disabled = true;
  btnText.textContent = "Menyimpan...";

  try {
    // 1. Buat object foto seketika agar langsung tampil di Galeri Acara tanpa delay
    const localPhotoId = "FTO-" + Date.now();
    const newPhoto = {
      idFoto: localPhotoId,
      eventId: STATE.activeEventId,
      guestId: STATE.guestId,
      guestNama: STATE.guestNama || "Tamu",
      caption: caption || "Momen seru!",
      cameraStyle: STATE.activeFilter,
      frameStyle: STATE.activeFrame,
      gdriveViewUrl: STATE.currentCapturedDataUrl,
      totalLikes: 0,
      isFeatured: false,
      createdAt: "Baru Saja"
    };

    // Tambahkan foto ke urutan terdepan daftar foto
    STATE.photos.unshift(newPhoto);

    // Backup ke localStorage terisolasi per event agar foto tetap aman saat offline maupun refresh
    saveEventPhotos(STATE.activeEventId);

    // Segera tutup modal review dan tampilkan galeri dengan foto baru
    document.getElementById('modalReviewPhoto').classList.add('hidden');
    renderGallery();
    showView('viewGallery');
    updateRemainingQuotaDisplay();
  updateGuestIdentityUI();

    // 2. Unggah ke Google Drive (jika API backend GAS dikonfigurasi)
    if (STATE.gasApiUrl) {
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

      try {
        const resp = await fetch(STATE.gasApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload)
        });
        const res = await resp.json();

        if (res.status === 'success') {
          if (res.idFoto) newPhoto.idFoto = res.idFoto;
          if (res.viewUrl) newPhoto.gdriveViewUrl = res.viewUrl;
          if (res.photo?.idFoto) newPhoto.idFoto = res.photo.idFoto;
          if (res.photo?.gdriveViewUrl) newPhoto.gdriveViewUrl = res.photo.gdriveViewUrl;
          saveEventPhotos(STATE.activeEventId);
          showToast("✅ Foto berhasil disimpan ke Galeri & Google Drive!", "success");
          renderGallery();
          // Muat ulang galeri cloud agar foto langsung tersinkronkan ke seluruh perangkat
          loadGallery();
        } else if (res.status === 'limit_reached') {
          showToast(res.message || "Batas kuota foto acara telah tercapai.", "warning");
        } else {
          showToast("⚠️ Foto tersimpan di HP: " + (res.message || "Sinkronisasi Drive tertunda"), "warning");
        }
      } catch (uploadErr) {
        console.warn("Upload Google Drive background error:", uploadErr);
        showToast("⚠️ Foto tersimpan di HP, gagal upload ke Drive: " + uploadErr.message, "error");
      }
    } else {
      showToast("Foto tersimpan di HP! (URL GAS belum terpasang untuk Drive)", "info");
    }
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
        saveEventVotes(STATE.activeEventId);

        showToast("Suara Anda berhasil dicatat! ❤️", "success");
        await loadGallery();
      } else {
        showToast(res.message, "warning");
      }
    } else {
      // Local Mock Vote
      STATE.votedPhotoIds.push(idFoto);
      STATE.votedCategoryIds.push(targetCat);
      saveEventVotes(STATE.activeEventId);

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

// --- 8. GALLERY RENDERING & VOTING WINNERS PODIUM ---
function renderGallery() {
  const grid = document.getElementById('galleryPhotoGrid');
  const empty = document.getElementById('galleryEmptyNotice');
  const countBadge = document.getElementById('galleryPhotoCountBadge');
  const winnersContainer = document.getElementById('galleryWinnersContainer');

  if (STATE.activeGalleryFilter === 'WINNERS') {
    if (grid) grid.classList.add('hidden');
    renderVotingWinners();
    return;
  }

  if (winnersContainer) winnersContainer.classList.add('hidden');
  if (grid) grid.classList.remove('hidden');

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

function renderVotingWinners() {
  const container = document.getElementById('galleryWinnersContainer');
  const podium = document.getElementById('galleryWinnersPodium');
  const countBadge = document.getElementById('galleryPhotoCountBadge');
  const empty = document.getElementById('galleryEmptyNotice');

  if (!container || !podium) return;

  container.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');
  podium.innerHTML = '';

  const sorted = [...STATE.photos].sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));
  if (countBadge) countBadge.textContent = `${sorted.length} Foto Pilihan`;

  if (sorted.length === 0 || (sorted[0].totalLikes || 0) === 0) {
    podium.innerHTML = `
      <div class="p-8 text-center bg-brand-surfaceLight border border-white/10 rounded-2xl">
        <div class="text-4xl mb-2">🏆</div>
        <p class="text-sm font-bold text-white mb-1">Belum Ada Suara Terdaftar</p>
        <p class="text-xs text-zinc-400">Jadilah yang pertama memberikan like pada foto favorit di tab 'Semua Foto'!</p>
      </div>
    `;
    return;
  }

  const p1 = sorted[0];
  const p2 = sorted.length > 1 ? sorted[1] : null;
  const p3 = sorted.length > 2 ? sorted[2] : null;

  let podiumHtml = `
    <!-- Juara 1 Emas (Champion) -->
    <div class="podium-card-gold winner-podium-card rounded-2xl p-4 text-center flex flex-col items-center cursor-pointer select-none" data-idx="0" title="Klik untuk memperbesar foto Juara 1">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold text-black text-xs font-bold uppercase tracking-wider mb-2 shadow-md">
        <span>🥇 Juara 1 (Emas)</span>
      </div>
      <div class="w-36 h-44 rounded-xl overflow-hidden bg-black mb-2.5 border-2 border-brand-gold/70 shadow-xl">
        <img src="${p1.gdriveViewUrl}" alt="${p1.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300" />
      </div>
      <h4 class="font-bold text-sm text-white">${p1.guestNama}</h4>
      <p class="text-xs text-zinc-300 italic truncate max-w-[220px] mb-2">"${p1.caption || 'Tanpa ucapan'}"</p>
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold border border-brand-gold/40">
        <span>❤️</span>
        <span>${p1.totalLikes || 0} Suka</span>
      </div>
      <span class="text-[10px] text-brand-gold/70 mt-1.5 font-medium">🔍 Klik untuk perbesar</span>
    </div>
  `;

  if (p2) {
    podiumHtml += `
      <!-- Juara 2 Perak -->
      <div class="podium-card-silver winner-podium-card rounded-2xl p-4 text-center flex flex-col items-center cursor-pointer select-none" data-idx="1" title="Klik untuk memperbesar foto Juara 2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-300 text-black text-xs font-bold uppercase tracking-wider mb-2 shadow-md">
          <span>🥈 Juara 2 (Perak)</span>
        </div>
        <div class="w-32 h-40 rounded-xl overflow-hidden bg-black mb-2.5 border-2 border-zinc-300/70 shadow-lg">
          <img src="${p2.gdriveViewUrl}" alt="${p2.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300" />
        </div>
        <h4 class="font-bold text-sm text-white">${p2.guestNama}</h4>
        <p class="text-xs text-zinc-300 italic truncate max-w-[200px] mb-2">"${p2.caption || 'Tanpa ucapan'}"</p>
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-zinc-200 text-xs font-bold border border-white/20">
          <span>❤️</span>
          <span>${p2.totalLikes || 0} Suka</span>
        </div>
        <span class="text-[10px] text-zinc-400 mt-1.5 font-medium">🔍 Klik untuk perbesar</span>
      </div>
    `;
  }

  if (p3) {
    podiumHtml += `
      <!-- Juara 3 Perunggu -->
      <div class="podium-card-bronze winner-podium-card rounded-2xl p-4 text-center flex flex-col items-center cursor-pointer select-none" data-idx="2" title="Klik untuk memperbesar foto Juara 3">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-700 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-md">
          <span>🥉 Juara 3 (Perunggu)</span>
        </div>
        <div class="w-32 h-40 rounded-xl overflow-hidden bg-black mb-2.5 border-2 border-amber-600/70 shadow-lg">
          <img src="${p3.gdriveViewUrl}" alt="${p3.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300" />
        </div>
        <h4 class="font-bold text-sm text-white">${p3.guestNama}</h4>
        <p class="text-xs text-zinc-300 italic truncate max-w-[200px] mb-2">"${p3.caption || 'Tanpa ucapan'}"</p>
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-600/20 text-amber-300 text-xs font-bold border border-amber-600/40">
          <span>❤️</span>
          <span>${p3.totalLikes || 0} Suka</span>
        </div>
        <span class="text-[10px] text-amber-300/70 mt-1.5 font-medium">🔍 Klik untuk perbesar</span>
      </div>
    `;
  }

  podium.innerHTML = podiumHtml;

  podium.querySelectorAll('.winner-podium-card').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      if (sorted[idx]) openPhotoZoom(sorted[idx]);
    });
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
  sessionStorage.setItem('snapevent_slideshow_active', 'true');

  const ev = STATE.activeEvent || (STATE.events && STATE.events.find(e => e.idEvent === STATE.activeEventId)) || MOCK_DATA.event;
  if (ev) {
    const titleEl = document.getElementById('slideshowTitle');
    if (titleEl) titleEl.textContent = ev.namaEvent;
    const hashEl = document.getElementById('slideshowHashtag');
    if (hashEl) hashEl.textContent = ev.hashtagEvent;
  }

  // Generate & Inject Real Scannable Ultra-Sharp QR Code for Ballroom Projector Screen (500px)
  const qrImg = document.getElementById('slideshowQrImg');
  if (qrImg) {
    const eventUrl = getEventShareUrl(STATE.activeEventId);
    qrImg.src = getQrImageUrl(eventUrl, 500);
  }

  if (STATE.photos.length === 0) {
    document.getElementById('slideshowEmptyMsg').classList.remove('hidden');
    document.getElementById('slideshowImg').classList.add('hidden');
    const backdrop = document.getElementById('slideshowBackdropImg');
    if (backdrop) backdrop.classList.add('hidden');
    return;
  }

  document.getElementById('slideshowEmptyMsg').classList.add('hidden');
  document.getElementById('slideshowImg').classList.remove('hidden');
  const backdrop = document.getElementById('slideshowBackdropImg');
  if (backdrop) backdrop.classList.remove('hidden');

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
  const backdrop = document.getElementById('slideshowBackdropImg');
  const p = STATE.photos[STATE.slideshowIndex];

  img.style.opacity = '0';
  if (backdrop) backdrop.style.opacity = '0';

  setTimeout(() => {
    img.src = p.gdriveViewUrl;
    if (backdrop) backdrop.src = p.gdriveViewUrl;

    img.onload = () => {
      img.style.opacity = '1';
      if (backdrop) backdrop.style.opacity = '0.35';
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
  sessionStorage.removeItem('snapevent_slideshow_active');
  if (STATE.slideshowTimer) clearInterval(STATE.slideshowTimer);
}

// --- 10. ADMIN DASHBOARD & CONTROLS ---
function openAdminPanel() {
  // Jika sesi admin sudah aktif, langsung buka tanpa prompt login
  if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
    showView('viewAdmin');
    renderAdminDashboard();
    syncEventsFromBackend(false);
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
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'adminLogin', username: user, password: pass })
      });
      const res = await resp.json();
      if (res.status === 'success') {
        sessionStorage.setItem('snapevent_admin_session', 'true');
        document.getElementById('modalAdminPin').classList.add('hidden');
        showView('viewAdmin');
        renderAdminDashboard();
        syncEventsFromBackend(false);
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
    syncEventsFromBackend(false);
    showToast(`Selamat datang, ${matchedOperator ? 'Operator/Kru' : 'Administrator'}!`, "success");
  } else {
    showToast("Username atau Password login salah!", "error");
  }
}

function openShareQrModal(eventObj) {
  const ev = eventObj || STATE.activeEvent || MOCK_DATA.event;
  const modal = document.getElementById('modalShareQr');
  if (!modal) return;

  const titleEl = document.getElementById('shareQrEventTitle');
  const hashtagEl = document.getElementById('shareQrEventHashtag');
  const imgEl = document.getElementById('shareQrImg');
  const urlInput = document.getElementById('shareQrUrlInput');

  if (titleEl) titleEl.textContent = ev.namaEvent;
  if (hashtagEl) hashtagEl.textContent = ev.hashtagEvent;

  const eventUrl = getEventShareUrl(ev.idEvent);
  const qrUrl = getQrImageUrl(eventUrl, 300);

  if (imgEl) imgEl.src = qrUrl;
  if (urlInput) urlInput.value = eventUrl;

  modal.classList.remove('hidden');
}

function renderCustomFramesList() {
  const container = document.getElementById('customFramesListContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(STATE.customFrames) || STATE.customFrames.length === 0) {
    container.innerHTML = '<p class="text-[10px] text-zinc-500 italic py-1">Belum ada bingkai kustom tersimpan.</p>';
    return;
  }

  STATE.customFrames.forEach((cf, idx) => {
    const row = document.createElement('div');
    row.className = "flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-xs";
    const scopeLabel = cf.scope === 'global' ? 'Semua Acara (Global)' : 'Khusus Acara Ini';
    const scopeColor = cf.scope === 'global' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-blue-300 border-blue-500/30 bg-blue-500/10';

    row.innerHTML = `
      <div class="flex items-center gap-2 overflow-hidden">
        <img src="${cf.dataUrl}" class="w-8 h-10 object-contain rounded bg-zinc-900 border border-white/10 shrink-0" alt="Frame" />
        <div class="truncate">
          <div class="font-bold text-white truncate text-[11px]">${cf.name || 'Bingkai ' + (idx + 1)}</div>
          <span class="text-[9px] px-1.5 py-0.5 rounded border ${scopeColor}">${scopeLabel}</span>
        </div>
      </div>
      <button type="button" class="btn-del-frame text-red-400 hover:text-red-300 p-1 text-xs shrink-0" data-idx="${idx}" title="Hapus Bingkai">✕</button>
    `;

    row.querySelector('.btn-del-frame').onclick = () => {
      STATE.customFrames.splice(idx, 1);
      localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
      renderCustomFramesList();
      applyActiveFrame(STATE.activeFrame);
      showToast("Bingkai kustom dihapus.", "info");
    };

    container.appendChild(row);
  });
}

function getAllAdminCandidateFrames(eventObj) {
  const frames = [
    { id: 'GOLD_DECO', name: '✨ Gold Deco', type: 'builtin', icon: '✨' },
    { id: 'POLAROID', name: '📷 Polaroid', type: 'builtin', icon: '📷' },
    { id: 'MINIMAL', name: '▪️ Minimalist', type: 'builtin', icon: '▪️' },
    { id: 'NONE', name: 'Tanpa Bingkai', type: 'builtin', icon: '🚫' }
  ];

  // Custom frame yang baru diunggah di form atau tersimpan di event ini
  const eventCustomData = STATE.tempCustomFrameData || eventObj?.customFrameData || eventObj?.customFrameUrl;
  if (eventCustomData) {
    frames.push({
      id: 'CUSTOM_EVENT',
      name: eventObj?.customFrameName ? `🖼️ ${eventObj.customFrameName}` : '🖼️ Bingkai Kustom Acara (Custom PNG)',
      type: 'custom',
      scope: 'event',
      dataUrl: eventCustomData,
      icon: '🖼️'
    });
  }

  // Custom frames tersimpan di koleksi (global atau spesifik event)
  if (Array.isArray(STATE.customFrames)) {
    STATE.customFrames.forEach(cf => {
      if (!frames.some(f => f.id === cf.id || (cf.dataUrl && f.dataUrl === cf.dataUrl))) {
        frames.push({
          id: cf.id,
          name: `🖼️ ${cf.name || 'Bingkai Kustom'} (${cf.scope === 'global' ? 'Global' : 'Acara'})`,
          type: 'custom',
          scope: cf.scope,
          dataUrl: cf.dataUrl,
          icon: '🖼️'
        });
      }
    });
  }

  return frames;
}

function renderAdminFrameSettings(eventObj) {
  const container = document.getElementById('adminFrameSortableList');
  const singleSelect = document.getElementById('formEventSingleFrameSelect');
  if (!container && !singleSelect) return;

  const candidateFrames = getAllAdminCandidateFrames(eventObj);

  // Tentukan urutan aktif awal
  let activeOrder = [];
  if (eventObj && Array.isArray(eventObj.activeFrames) && eventObj.activeFrames.length > 0) {
    activeOrder = [...eventObj.activeFrames];
  } else {
    activeOrder = ['GOLD_DECO', 'POLAROID', 'MINIMAL'];
    if (candidateFrames.some(f => f.id === 'CUSTOM_EVENT')) {
      activeOrder.unshift('CUSTOM_EVENT');
    }
  }

  // Urutkan candidateFrames: yang ada di activeOrder disusun terlebih dahulu sesuai indexnya
  const sortedFrames = [];
  activeOrder.forEach(id => {
    const found = candidateFrames.find(f => f.id === id || (f.type === 'custom' && (id === 'CUSTOM_EVENT' || id === 'CUSTOM')));
    if (found && !sortedFrames.some(s => s.id === found.id)) {
      sortedFrames.push(found);
    }
  });
  candidateFrames.forEach(f => {
    if (!sortedFrames.some(s => s.id === f.id)) {
      sortedFrames.push(f);
    }
  });

  // 1. Render Dropdown Single Frame Lock (Termasuk Custom Frame PNG)
  if (singleSelect) {
    const currentLocked = eventObj?.singleLockedFrame || sortedFrames[0]?.id || 'GOLD_DECO';
    singleSelect.innerHTML = sortedFrames.map(f => `
      <option value="${f.id}" ${f.id === currentLocked ? 'selected' : ''}>
        ${f.name}
      </option>
    `).join('');
  }

  // 2. Render Drag & Drop Sortable List
  if (container) {
    container.innerHTML = '';
    sortedFrames.forEach((frame) => {
      const isChecked = activeOrder.includes(frame.id) || (frame.id === 'CUSTOM_EVENT' && !eventObj) || (frame.id !== 'NONE' && !eventObj);
      const row = document.createElement('div');
      row.className = "frame-sortable-item flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-[#111116] border border-white/10 hover:border-brand-gold/40 transition select-none group";
      row.setAttribute('draggable', 'true');
      row.setAttribute('data-frame-id', frame.id);

      const previewHtml = frame.dataUrl 
        ? `<img src="${frame.dataUrl}" class="w-7 h-9 object-contain rounded bg-zinc-900 border border-white/10 shrink-0" alt="Frame" />`
        : `<span class="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm shrink-0">${frame.icon || '🖼️'}</span>`;

      row.innerHTML = `
        <div class="flex items-center gap-2.5 overflow-hidden flex-1">
          <span class="drag-handle text-zinc-500 group-hover:text-brand-gold text-lg cursor-grab active:cursor-grabbing px-1 shrink-0" title="Geser untuk atur urutan">⠿</span>
          <input type="checkbox" value="${frame.id}" class="adm-frame-check text-brand-gold rounded cursor-pointer w-4 h-4 shrink-0" ${isChecked ? 'checked' : ''} />
          ${previewHtml}
          <div class="truncate">
            <span class="text-xs font-semibold text-zinc-200 block truncate">${frame.name}</span>
            <span class="text-[9px] text-zinc-400 font-mono">${frame.type === 'custom' ? 'Bingkai Kustom PNG' : 'Bingkai Bawaan'}</span>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" class="btn-frame-up p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-brand-gold text-xs font-bold transition" title="Naikkan urutan">▲</button>
          <button type="button" class="btn-frame-down p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-brand-gold text-xs font-bold transition" title="Turunkan urutan">▼</button>
        </div>
      `;

      // Tombol panah naik / turun (Sangat ramah sentuhan layar HP)
      row.querySelector('.btn-frame-up').addEventListener('click', (e) => {
        e.stopPropagation();
        const prev = row.previousElementSibling;
        if (prev) {
          container.insertBefore(row, prev);
          syncFrameSettingsFromDOM();
        }
      });

      row.querySelector('.btn-frame-down').addEventListener('click', (e) => {
        e.stopPropagation();
        const next = row.nextElementSibling;
        if (next) {
          container.insertBefore(next, row);
          syncFrameSettingsFromDOM();
        }
      });

      // Drag & Drop HTML5 Events
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', frame.id);
        row.classList.add('opacity-40', 'border-brand-gold', 'scale-[0.98]');
        window._draggedFrameItem = row;
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('opacity-40', 'border-brand-gold', 'scale-[0.98]');
        window._draggedFrameItem = null;
        document.querySelectorAll('.frame-sortable-item').forEach(el => el.classList.remove('border-brand-gold', 'bg-white/5'));
        syncFrameSettingsFromDOM();
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const dragged = window._draggedFrameItem;
        if (!dragged || dragged === row) return;

        const rect = row.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        container.insertBefore(dragged, next ? row.nextSibling : row);
      });

      container.appendChild(row);
    });
  }
}

function syncFrameSettingsFromDOM() {
  const items = document.querySelectorAll('#adminFrameSortableList .frame-sortable-item');
  const singleSelect = document.getElementById('formEventSingleFrameSelect');
  if (singleSelect) {
    const currentVal = singleSelect.value;
    const options = [];
    items.forEach(it => {
      const id = it.getAttribute('data-frame-id');
      const name = it.querySelector('.text-zinc-200')?.textContent || id;
      options.push(`<option value="${id}" ${id === currentVal ? 'selected' : ''}>${name}</option>`);
    });
    if (options.length > 0) {
      singleSelect.innerHTML = options.join('');
    }
  }
}

function resetCreateEventForm() {
  const d = new Date();
  const yearMonth = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = String(Math.floor(Math.random() * 900) + 100);
  const newId = `EVT-${yearMonth}-${randomSuffix}`;

  document.getElementById('formEventTitle').textContent = "Buat Acara Baru";
  document.getElementById('formEventId').value = newId;
  document.getElementById('formEventNama').value = "";
  document.getElementById('formEventHashtag').value = "";
  document.getElementById('formEventTanggal').value = d.toISOString().split('T')[0];
  document.getElementById('formEventMaxFoto').value = "10";
  document.getElementById('formEventMaxVote').value = "3";
  document.getElementById('formEventDriveFolder').value = "";
  document.getElementById('formEventFrameName').value = "";

  const radSegera = document.querySelector('input[name="revealModeRadio"][value="SEGERA"]');
  if (radSegera) radSegera.checked = true;
  document.getElementById('formCheckLike').checked = true;
  document.getElementById('formCheckVisibility').checked = true;

  // Reset Frame Policy Controls
  const radMulti = document.querySelector('input[name="frameLockModeRadio"][value="multi"]');
  if (radMulti) radMulti.checked = true;
  document.getElementById('containerSingleFrameLock')?.classList.add('hidden');
  document.getElementById('containerMultiFrameSelection')?.classList.remove('hidden');
  renderAdminFrameSettings(null);

  renderCategoryInputRows([
    { namaKategori: "Busana Terbaik" },
    { namaKategori: "Momen Romantis" },
    { namaKategori: "Pose Terlucu" }
  ]);

  STATE.tempCustomFrameData = null;
  document.getElementById('formEventCustomFrame').value = '';
  document.getElementById('customFramePreviewBox').classList.add('hidden');
  document.getElementById('btnRemoveCustomFrame').classList.add('hidden');
  renderCustomFramesList();
}

function renderAdminDashboard() {
  const allEvents = (Array.isArray(STATE.events) && STATE.events.length > 0) 
    ? STATE.events 
    : ((Array.isArray(MOCK_DATA.events) && MOCK_DATA.events.length > 0) ? MOCK_DATA.events : [MOCK_DATA.event]);

  const totalEvtCount = (STATE.metrics && typeof STATE.metrics.totalEvents === 'number') 
    ? STATE.metrics.totalEvents 
    : allEvents.length;
    
  const totalPhotoCount = (STATE.metrics && typeof STATE.metrics.totalPhotos === 'number') 
    ? STATE.metrics.totalPhotos 
    : (STATE.photos ? STATE.photos.length : 0);
    
  const calcLikes = (STATE.photos || []).reduce((acc, p) => acc + (p.totalLikes || 0), 0);
  const totalVoteCount = (STATE.metrics && typeof STATE.metrics.totalVotes === 'number') 
    ? STATE.metrics.totalVotes 
    : calcLikes;

  const metricEvtEl = document.getElementById('admMetricEvents');
  const metricPhotoEl = document.getElementById('admMetricPhotos');
  const metricVoteEl = document.getElementById('admMetricVotes');
  if (metricEvtEl) metricEvtEl.textContent = totalEvtCount;
  if (metricPhotoEl) metricPhotoEl.textContent = totalPhotoCount;
  if (metricVoteEl) metricVoteEl.textContent = totalVoteCount;

  const badge = document.getElementById('admSyncStatusBadge');
  if (badge && !badge.textContent.includes('Mengunduh')) {
    badge.textContent = `Tersinkron (${totalEvtCount} Event, ${totalPhotoCount} Foto)`;
    badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30";
  }

  const listContainer = document.getElementById('adminEventListContainer');
  listContainer.innerHTML = '';

  allEvents.forEach(ev => {
    const driveFolderText = ev.gdriveFolderId ? `Drive: ${ev.gdriveFolderId}` : 'Drive: Otomatis';
    const hasCustom = !!(ev.customFrameData || ev.customFrameUrl || (Array.isArray(STATE.customFrames) && STATE.customFrames.some(f => f.eventId === ev.idEvent || f.scope === 'global')));
    const frameText = hasCustom ? '✨ Multi-Frame Aktif' : 'Default Frames';
    const isActive = ev.idEvent === STATE.activeEventId;

    const card = document.createElement('div');
    card.className = `bg-brand-surfaceLight border ${isActive ? 'border-brand-gold/60 ring-1 ring-brand-gold/30' : 'border-brand-surfaceBorder'} rounded-2xl p-4 transition shadow-md`;
    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-bold text-brand-gold uppercase tracking-widest">${ev.idEvent}</span>
          ${isActive 
            ? '<span class="text-[9px] bg-brand-gold text-black font-extrabold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">🌟 Sedang Berlangsung (Aktif)</span>' 
            : `<button class="btn-activate-event text-[9px] bg-brand-gold/15 hover:bg-brand-gold text-brand-gold hover:text-black font-bold px-2.5 py-0.5 rounded-full border border-brand-gold/50 transition flex items-center gap-1">⭐ Aktifkan Event Ini</button>`
          }
        </div>
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${ev.isRevealed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
          ${ev.isRevealed ? 'Galeri Terbuka' : 'Galeri Ditahan'}
        </span>
      </div>
      <h4 class="font-serif text-base font-bold text-white mb-1">${ev.namaEvent}</h4>
      <p class="text-xs text-zinc-400 mb-2">${ev.hashtagEvent || '#SnapEvent'} • Kuota: ${ev.maxFotoPerGuest || 10} Foto / Tamu</p>
      <div class="flex items-center gap-2 text-[11px] text-zinc-400 mb-3 flex-wrap">
        <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10">${driveFolderText}</span>
        <span class="px-2 py-0.5 rounded bg-brand-gold/10 text-brand-gold border border-brand-gold/20">${frameText}</span>
      </div>
      
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
        <button class="btn-edit-event py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold text-center transition">
          ✏️ Edit Acara
        </button>
        <button class="btn-toggle-reveal py-2 px-3 rounded-xl ${ev.isRevealed ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'} text-xs font-semibold text-center transition">
          ${ev.isRevealed ? '🔒 Kunci' : '🔓 Buka'}
        </button>
        <button class="btn-open-slideshow py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold text-center transition">
          📺 Proyektor
        </button>
        <button class="btn-share-qr py-2 px-3 rounded-xl gold-gradient-bg text-black text-xs font-bold text-center transition">
          📲 Link & QR
        </button>
      </div>
    `;

    const btnActivate = card.querySelector('.btn-activate-event');
    if (btnActivate) {
      btnActivate.addEventListener('click', () => {
        activateEvent(ev.idEvent);
      });
    }

    card.querySelector('.btn-edit-event').addEventListener('click', () => {
      populateEditEventForm(ev);
      switchAdminTab('create');
    });

    card.querySelector('.btn-toggle-reveal').addEventListener('click', async () => {
      ev.isRevealed = !ev.isRevealed;
      localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
      showToast(ev.isRevealed ? "Galeri resmi dibuka untuk semua tamu!" : "Galeri ditutup kembali.", "info");
      renderAdminDashboard();

      if (STATE.gasApiUrl) {
        try {
          await fetch(STATE.gasApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'adminToggleReveal',
              idEvent: ev.idEvent,
              isRevealed: ev.isRevealed
            })
          });
        } catch (err) {
          console.warn("GAS reveal sync warn:", err.message);
        }
      }
    });

    card.querySelector('.btn-open-slideshow').addEventListener('click', () => {
      STATE.activeEventId = ev.idEvent;
      STATE.activeEvent = ev;
      openSlideshow();
    });

    card.querySelector('.btn-share-qr').addEventListener('click', () => {
      openShareQrModal(ev);
    });

    listContainer.appendChild(card);
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

  // Render User Accounts List & Frames List
  renderUserAccountsList();
  renderCustomFramesList();

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

  // Populate Frame Policy Controls
  const isSingle = (ev.frameLockMode === 'single');
  const radSingle = document.querySelector('input[name="frameLockModeRadio"][value="single"]');
  const radMulti = document.querySelector('input[name="frameLockModeRadio"][value="multi"]');
  if (isSingle && radSingle) radSingle.checked = true;
  else if (radMulti) radMulti.checked = true;

  const containerSingle = document.getElementById('containerSingleFrameLock');
  const containerMulti = document.getElementById('containerMultiFrameSelection');
  if (containerSingle) containerSingle.classList.toggle('hidden', !isSingle);
  if (containerMulti) containerMulti.classList.toggle('hidden', isSingle);

  const singleSelect = document.getElementById('formEventSingleFrameSelect');
  renderAdminFrameSettings(ev);

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

  let frameLockMode = 'multi';
  document.getElementsByName('frameLockModeRadio').forEach(r => {
    if (r.checked) frameLockMode = r.value;
  });

  const singleLockedFrame = document.getElementById('formEventSingleFrameSelect')?.value || 'GOLD_DECO';
  let activeFrames = [];
  if (frameLockMode === 'single') {
    activeFrames = [singleLockedFrame];
  } else {
    document.querySelectorAll('#adminFrameSortableList .frame-sortable-item').forEach(item => {
      const chk = item.querySelector('.adm-frame-check');
      if (chk && chk.checked) activeFrames.push(chk.value);
    });
    if (activeFrames.length === 0) {
      document.querySelectorAll('.adm-frame-check').forEach(chk => {
        if (chk.checked) activeFrames.push(chk.value);
      });
    }
    if (activeFrames.length === 0) activeFrames = ['GOLD_DECO', 'POLAROID', 'MINIMAL'];
  }

  const targetEventId = document.getElementById('formEventId').value || 'EVT-' + Date.now();
  const existingEv = (STATE.events && STATE.events.find(e => e.idEvent === targetEventId)) || {};

  const savedEvent = Object.assign({}, existingEv, {
    idEvent: targetEventId,
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
    frameLockMode: frameLockMode,
    singleLockedFrame: singleLockedFrame,
    activeFrames: activeFrames,
    customFrameData: customFrameData,
    customFrameUrl: customFrameData || '',
    categories: cats
  });

  // Simpan Bingkai Kustom Baru jika ada unggahan
  if (STATE.tempCustomFrameData) {
    const scope = document.getElementById('formEventFrameScope')?.value || 'event';
    const frameName = document.getElementById('formEventFrameName')?.value.trim() || `${nama} Frame`;
    const newFrameObj = {
      id: 'frame_' + Date.now(),
      name: frameName,
      scope: scope,
      eventId: savedEvent.idEvent,
      dataUrl: STATE.tempCustomFrameData
    };
    if (!Array.isArray(STATE.customFrames)) STATE.customFrames = [];
    STATE.customFrames.unshift(newFrameObj);
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
    STATE.tempCustomFrameData = null;
  }

  // Update Koleksi Acara Global (Multi-Event Management)
  if (!Array.isArray(STATE.events)) STATE.events = [];
  const existingIdx = STATE.events.findIndex(e => e.idEvent === savedEvent.idEvent);
  if (existingIdx >= 0) {
    STATE.events[existingIdx] = savedEvent;
  } else {
    STATE.events.unshift(savedEvent);
  }
  localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));

  // Jika yang diedit adalah event aktif (atau satu-satunya event), perbarui STATE.activeEvent
  if (savedEvent.idEvent === STATE.activeEventId || STATE.events.length === 1) {
    STATE.activeEventId = savedEvent.idEvent;
    STATE.activeEvent = savedEvent;
    STATE.activeCategories = cats;
    applyEventToUI();
  }

  // Sinkronisasi ke Backend GAS jika ada
  if (STATE.gasApiUrl) {
    fetch(STATE.gasApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'adminSaveEvent',
        idEvent: savedEvent.idEvent,
        namaEvent: nama,
        slugEvent: savedEvent.slugEvent,
        tanggalEvent: tanggal,
        hashtagEvent: hashtag,
        maxFotoPerGuest: maxFoto,
        maxVotePerGuest: maxVote,
        revealMode: revealMode,
        isRevealed: savedEvent.isRevealed,
        likeEnabled: likeEnabled,
        publicVisible: publicVisible,
        gdriveFolderId: driveFolder,
        frameLockMode: frameLockMode,
        singleLockedFrame: singleLockedFrame,
        activeFrames: activeFrames,
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

// Uji Koneksi Langsung ke Backend Google Apps Script
async function testGasConnection() {
  const inputEl = document.getElementById('cfgGasUrl');
  const url = (inputEl ? inputEl.value.trim() : '') || STATE.gasApiUrl;
  if (!url) {
    showToast("Masukkan URL Web App Google Apps Script terlebih dahulu!", "warning");
    if (inputEl) inputEl.focus();
    return;
  }

  showToast("Menguji koneksi ke Google Apps Script...", "info");
  try {
    const resp = await fetch(`${url}?action=ping`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const res = await resp.json();
    if (res.status === 'success') {
      STATE.gasApiUrl = url;
      localStorage.setItem('snapevent_gas_url', url);
      showToast("✅ Berhasil! Google Apps Script Online & Sinkronisasi Aktif.", "success");
      await loadEventData();
    } else {
      showToast("⚠️ Respon server: " + (res.message || "Gagal sinkron"), "warning");
    }
  } catch (err) {
    console.error("Test GAS connection error:", err);
    showToast("❌ Gagal terhubung ke GAS. Pastikan saat deploy Web App dipilih 'Who has access: Anyone'!", "error");
  }
}

// --- 11. BIND ALL EVENT LISTENERS ---
function bindEvents() {
  // Tombol Uji Koneksi & Sinkronisasi GAS
  document.getElementById('btnTestGasConnection')?.addEventListener('click', testGasConnection);
  // Welcome View Guest Name Submit (MANDATORY GATE)
  document.getElementById('btnStartCamera').addEventListener('click', () => {
    const nameInput = document.getElementById('inputGuestName');
    const name = nameInput.value.trim();
    const warnEl = document.getElementById('guestNameWarning');

    if (!name) {
      showToast("Nama Panggilan wajib diisi untuk membuka kamera!", "warning");
      nameInput.focus();
      nameInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30');
      if (warnEl) warnEl.classList.remove('hidden');
      return;
    }

    nameInput.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30');
    if (warnEl) warnEl.classList.add('hidden');
    STATE.guestNama = name;
    localStorage.setItem('snapevent_guest_nama', name);
    updateGuestIdentityUI();
    showView('viewCamera');
    startCameraStream();
    showToast(`Halo ${name}, selamat memotret!`, "success");
  });

  // Tombol Reset / Ganti Nama Tamu di viewWelcome
  document.getElementById('btnResetGuestName')?.addEventListener('click', () => {
    if (confirm("Reset identitas nama Anda? Anda dapat mengetik nama baru setelah ini.")) {
      resetGuestNameSession();
    }
  });

  // Tombol Badge Nama di Status Bar Kamera untuk Ganti Nama
  document.getElementById('btnCamChangeGuest')?.addEventListener('click', () => {
    showView('viewWelcome');
    showToast("Silakan ganti nama Anda atau klik tombol Reset Nama Tamu.", "info");
    const inputGuest = document.getElementById('inputGuestName');
    if (inputGuest) {
      setTimeout(() => inputGuest.focus(), 250);
    }
  });

  // Switcher Radio Mode Kebijakan Bingkai (Multi-Frame vs Single Lock) di Panel Admin
  document.querySelectorAll('input[name="frameLockModeRadio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isSingle = (e.target.value === 'single');
      const containerSingle = document.getElementById('containerSingleFrameLock');
      const containerMulti = document.getElementById('containerMultiFrameSelection');
      if (containerSingle) containerSingle.classList.toggle('hidden', !isSingle);
      if (containerMulti) containerMulti.classList.toggle('hidden', isSingle);
    });
  });

  // Hapus tanda error ketika tamu mulai mengetik namanya
  document.getElementById('inputGuestName')?.addEventListener('input', () => {
    document.getElementById('inputGuestName')?.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30');
    document.getElementById('guestNameWarning')?.classList.add('hidden');
  });

  // Navigation Bar Buttons (Kamera, Galeri, dan Profil Tamu / Tulis Nama)
  document.getElementById('navBtnCamera').addEventListener('click', () => {
    if (!STATE.guestNama || !STATE.guestNama.trim()) {
      showToast("Silakan masukkan nama panggilan Anda terlebih dahulu untuk membuka kamera!", "warning");
      showView('viewWelcome');
      const inputEl = document.getElementById('inputGuestName');
      if (inputEl) {
        inputEl.focus();
        inputEl.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30');
      }
      const warnEl = document.getElementById('guestNameWarning');
      if (warnEl) warnEl.classList.remove('hidden');
      return;
    }
    showView('viewCamera');
  });
  document.getElementById('navBtnGallery').addEventListener('click', () => {
    showView('viewGallery');
  });
  document.getElementById('navBtnEventInfo').addEventListener('click', () => {
    showView('viewWelcome');
  });

  // Akses Cepat Galeri & Voting dari Halaman Tulis Nama (viewWelcome)
  document.getElementById('btnWelcomeGoGallery')?.addEventListener('click', () => {
    showView('viewGallery');
  });

  // Shutter Action
  document.getElementById('btnShutter').addEventListener('click', () => {
    triggerCameraShutter();
  });

  // Live Video Trigger & Native File Fallback
  document.getElementById('btnInitStream')?.addEventListener('click', startCameraStream);

  // Tombol Buka Galeri HP di Samping Tombol Shutter
  const btnOpenGallery = document.getElementById('btnOpenGalleryUpload');
  const galleryInput = document.getElementById('galleryUploadInput');
  if (btnOpenGallery && galleryInput) {
    btnOpenGallery.addEventListener('click', () => {
      galleryInput.click();
    });
    galleryInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          processPhotoWithFrameAndFilter(img);
          galleryInput.value = ''; // Reset input agar foto yang sama dapat dipilih kembali jika diinginkan
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle Native Camera Fallback
  document.getElementById('nativeCameraInput')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
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

  // Tambah Akun Pengguna / Operator Kru (Buka Modal Terstruktur)
  document.getElementById('btnAddUserAccountRow')?.addEventListener('click', () => {
    document.getElementById('modalAddUserAccount')?.classList.remove('hidden');
  });
  document.getElementById('btnCancelAddUserModal')?.addEventListener('click', () => {
    document.getElementById('modalAddUserAccount')?.classList.add('hidden');
  });

  document.getElementById('formAddUserAccount')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('inputNewUserUsername').value.trim();
    const p = document.getElementById('inputNewUserPassword').value.trim();
    const r = document.getElementById('selectNewUserRole').value;

    if (!u || !p) {
      showToast("Username dan password tidak boleh kosong!", "warning");
      return;
    }
    if (p.length < 4) {
      showToast("Password akun minimal 4 karakter!", "warning");
      return;
    }

    if (!Array.isArray(STATE.userAccounts)) STATE.userAccounts = [];
    STATE.userAccounts.push({ user: u, pass: p, role: r });
    localStorage.setItem('snapevent_user_accounts', JSON.stringify(STATE.userAccounts));
    renderUserAccountsList();
    document.getElementById('modalAddUserAccount').classList.add('hidden');
    document.getElementById('formAddUserAccount').reset();
    showToast(`Akun '${u}' (${r}) berhasil ditambahkan!`, "success");

    // Sinkronisasi akun ke backend Google Sheets jika GAS terhubung
    if (STATE.gasApiUrl) {
      fetch(STATE.gasApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'adminUpdateGlobalConfig',
          updates: { user_accounts: JSON.stringify(STATE.userAccounts) }
        })
      }).catch(err => console.warn("Sync users warn:", err.message));
    }
  });

  // Ganti Password Akun Pengguna (Buka & Submit Modal)
  document.getElementById('btnOpenChangePassword')?.addEventListener('click', () => {
    document.getElementById('modalChangePassword')?.classList.remove('hidden');
  });
  document.getElementById('btnCancelChangePassword')?.addEventListener('click', () => {
    document.getElementById('modalChangePassword')?.classList.add('hidden');
  });

  document.getElementById('formChangePassword')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const oldP = document.getElementById('inputOldPassword').value.trim();
    const newP1 = document.getElementById('inputNewPassword1').value.trim();
    const newP2 = document.getElementById('inputNewPassword2').value.trim();

    if (newP1 !== newP2) {
      showToast("Konfirmasi password baru tidak cocok!", "error");
      return;
    }
    if (newP1.length < 4) {
      showToast("Password baru minimal 4 karakter!", "warning");
      return;
    }

    const curUser = STATE.currentUsername || 'admin';
    let verified = false;

    if (curUser === STATE.adminUser) {
      if (oldP === STATE.adminPass) {
        verified = true;
        STATE.adminPass = newP1;
        localStorage.setItem('snapevent_admin_pass', newP1);
        if (document.getElementById('cfgAdminPass')) document.getElementById('cfgAdminPass').value = newP1;
      }
    } else {
      const match = Array.isArray(STATE.userAccounts) && STATE.userAccounts.find(a => a.user === curUser);
      if (match && match.pass === oldP) {
        verified = true;
        match.pass = newP1;
        localStorage.setItem('snapevent_user_accounts', JSON.stringify(STATE.userAccounts));
      }
    }

    if (!verified) {
      showToast("Password lama yang Anda masukkan salah!", "error");
      return;
    }

    // Sync ke GAS jika ada
    if (STATE.gasApiUrl) {
      const updates = curUser === STATE.adminUser 
        ? { admin_pass: newP1 } 
        : { user_accounts: JSON.stringify(STATE.userAccounts) };
      fetch(STATE.gasApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'adminUpdateGlobalConfig', updates })
      }).catch(err => console.warn("Sync pass warn:", err.message));
    }

    document.getElementById('modalChangePassword').classList.add('hidden');
    document.getElementById('formChangePassword').reset();
    showToast("Password berhasil diperbarui!", "success");
  });

  // Modal Share QR Handlers
  document.getElementById('btnCloseShareQr')?.addEventListener('click', () => {
    document.getElementById('modalShareQr')?.classList.add('hidden');
  });

  document.getElementById('btnCopyShareUrl')?.addEventListener('click', () => {
    const val = document.getElementById('shareQrUrlInput')?.value;
    if (val) {
      navigator.clipboard?.writeText(val);
      showToast("Tautan acara berhasil disalin ke clipboard!", "success");
    }
  });

  document.getElementById('btnDownloadQrCode')?.addEventListener('click', () => {
    const img = document.getElementById('shareQrImg');
    if (img && img.src) {
      const a = document.createElement('a');
      a.href = img.src;
      a.download = `SnapEvent_QR_${STATE.activeEventId || 'Acara'}.png`;
      a.target = '_blank';
      a.click();
      showToast("Mengunduh gambar QR Code acara...", "info");
    }
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

  // Tombol Bagikan Acara pada Layar Mobile Slideshow (Web Share API / Modal QR Fallback)
  document.getElementById('btnSlideshowMobileShare')?.addEventListener('click', async () => {
    const shareUrl = getEventShareUrl(STATE.activeEventId);
    const eventName = STATE.activeEvent?.namaEvent || STATE.appTitle || "SnapEvent";
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventName,
          text: `Ayo abadikan dan tonton foto momen seru di ${eventName}!`,
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          openShareQrModal();
        }
      }
    } else {
      openShareQrModal();
    }
  });

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

  // Tombol Gerbang Acara Inaktif -> Buka Acara yang Sedang Berlangsung
  document.getElementById('btnGoActiveEvent')?.addEventListener('click', () => {
    window.location.href = window.location.pathname;
  });

  // Tombol Sinkronisasi Data Events dari Backend Google Apps Script
  document.getElementById('btnSyncEventsBackend')?.addEventListener('click', () => {
    syncEventsFromBackend(true);
  });

  // Admin Tab Switchers (+ Buat Event Baru Handler)
  document.querySelectorAll('.adm-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-admintab');
      if (tab === 'create') {
        resetCreateEventForm();
      }
      switchAdminTab(tab);
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

      const targetEventId = document.getElementById('formEventId')?.value;
      const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
      renderAdminFrameSettings(currentEv);

      showToast("Bingkai kustom PNG berhasil diunggah dan masuk ke daftar pilihan!", "info");
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
    const targetEventId = document.getElementById('formEventId')?.value;
    const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
    renderAdminFrameSettings(currentEv);
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

    applyGlobalConfigToUI();

    // Sinkronisasi ke Backend GAS jika URL aktif
    if (url) {
      showToast("Menyimpan ke Google Sheets & database cloud...", "info");
      try {
        const resp = await fetch(url, {
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
        const res = await resp.json().catch(() => null);
        if (res && res.status === 'success') {
          showToast("✅ Berhasil! Pengaturan tersimpan ke Google Sheets & aktif untuk seluruh perangkat.", "success");
        } else {
          showToast("✅ Pengaturan tersimpan lokal & dikirim ke Google Sheets.", "success");
        }
      } catch (err) {
        console.warn("Sync global config error:", err.message);
        showToast("⚠️ Tersimpan lokal, namun gagal sync ke Google Sheets: " + err.message + ". Pastikan deployment GAS disetel 'Who has access: Anyone'.", "error");
      }
    } else {
      // Jika URL kosong, BERIKAN PERINGATAN JELAS agar pengguna tahu kenapa di tempat lain tidak berubah!
      const inputEl = document.getElementById('cfgGasUrl');
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEl.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => inputEl.classList.remove('ring-2', 'ring-amber-400'), 5000);
      }
      showToast("⚠️ PERHATIAN: Pengaturan HANYA tersimpan di browser ini! Agar tersimpan ke Google Sheets & berubah di perangkat lain, masukkan URL Web App GAS pada kolom yang ditandai.", "warning");
    }

    loadEventData();
  });

  document.getElementById('btnResetDemoData').addEventListener('click', () => {
    localStorage.removeItem('snapevent_gas_url');
    localStorage.removeItem('snapevent_admin_user');
    localStorage.removeItem('snapevent_admin_pass');
    STATE.gasApiUrl = GLOBAL_CONFIG.DEFAULT_GAS_URL;
    localStorage.setItem('snapevent_gas_url', STATE.gasApiUrl);
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

// --- 9. REALTIME CLOUD HEARTBEAT (OMNI-DEVICE AUTO-SYNC) ---
// Melakukan sinkronisasi halus di latar belakang setiap 45 detik agar layar proyektor
// dan HP tamu selalu mendapatkan pengaturan & acara aktif terbaru dari Google Sheets.
setInterval(() => {
  if (STATE.gasApiUrl && !document.hidden) {
    loadEventData();
  }
}, 45000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && STATE.gasApiUrl) {
    loadEventData();
  }
});

