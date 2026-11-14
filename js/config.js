/**
 * ==============================================================================
 * SNAPEVENT: JS/CONFIG.JS
 * Global Configuration, State Management & Persistent Storage Defaults
 * ==============================================================================
 */

// Generator ID Tamu Unik (Local UUID Device Persistence)
function getOrCreateGuestId() {
  let id = localStorage.getItem('snapevent_guest_id');
  if (!id) {
    id = 'GUEST-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('snapevent_guest_id', id);
  }
  return id;
}

const GLOBAL_CONFIG = {
  // Folder Induk Google Drive Resmi (Fallback permanen untuk seluruh perangkat)
  DEFAULT_DRIVE_MASTER_ID: '12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw',
  DEFAULT_APP_TITLE: 'SnapEvent Enterprise Studio',
  DEFAULT_GAS_URL: 'https://script.google.com/macros/s/AKfycbwPGeqw4wQAZrqSEUGnrQ24xTA8jaQ7HnxnEw7dr9Wm92NXWvzD7XQNme34haCj1b9vuw/exec',
  OLD_DEFAULT_GAS_URL: 'https://script.google.com/macros/s/AKfycbxg-Owg7BrEqx4KHDI7UsLBX88ejLXcVxgQuSZNtz8d0rIJ_wCGVQFsOzpKGDO8w8cOrw/exec'
};

const STATE = {
  // Configuration & Custom Branding (Cloud Persistent)
  gasApiUrl: (localStorage.getItem('snapevent_gas_url') && localStorage.getItem('snapevent_gas_url').trim().startsWith('http') && localStorage.getItem('snapevent_gas_url').trim() !== GLOBAL_CONFIG.OLD_DEFAULT_GAS_URL) 
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

// Global Set untuk melacak foto yang sedang dalam antrean upload (Mencegah upload ganda/duplikat)
const IN_FLIGHT_PHOTO_UPLOADS = new Set();

// Global Hoisted Aliases: Mencegah 'fetchEventDetails is not defined' dan 'stopCameraStream is not defined'
window.fetchEventDetails = function() {
  if (typeof loadEventData === 'function') {
    return loadEventData();
  }
  return Promise.resolve();
};

window.stopCameraStream = function() {
  if (STATE && STATE.mediaStream) {
    try {
      STATE.mediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
    } catch (err) {
      console.warn("stopCameraStream warning:", err);
    }
    STATE.mediaStream = null;
  }
  const video = document.getElementById('cameraVideo');
  if (video) {
    try { video.srcObject = null; } catch(e) {}
  }
};

// Default Seed / Mock Data for Instant Browser & Offline Preview
const MOCK_DATA = {
  events: [
    {
      idEvent: "EVT-202611-001",
      namaEvent: "The Wedding of Sarah and Kevin",
      slugEvent: "the-wedding-of-sarah-and-kevin",
      tanggalEvent: "2026-11-20",
      hashtagEvent: "#SarahKevinEverAfter",
      maxFotoPerGuest: 10,
      maxVotePerGuest: 3,
      revealMode: "SEGERA",
      isRevealed: true,
      likeEnabled: true,
      publicVisible: true,
      activeCameraStyles: ["RAW", "800T", "WARM", "BW"],
      frameLockMode: "single",
      singleLockedFrame: "GOLD_DECO",
      activeFrames: ["GOLD_DECO"],
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
  samplePhotos: []
};
MOCK_DATA.event = MOCK_DATA.events[0];
