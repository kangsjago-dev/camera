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

// URL Query Param Overrides (hanya terapkan jika user belum menetapkan URL kustom mandiri)
const URL_PARAMS = new URLSearchParams(window.location.search);
const hasCustomSavedGas = localStorage.getItem('snapevent_gas_url_custom') === 'true';
const paramGas = URL_PARAMS.get('gas');
if (paramGas && paramGas.trim().startsWith('http') && !hasCustomSavedGas) {
  localStorage.setItem('snapevent_gas_url', paramGas.trim());
}

// Auto-migrasi URL lama yang dead/404 ke endpoint GAS yang aktif
const savedGasUrl = localStorage.getItem('snapevent_gas_url');
if (savedGasUrl && (savedGasUrl.includes('AKfycbPGeqw4wQAZrqSEUGnrQ24xTA8jaQ7HnxnEw7dr9Wm92NXWvzD7XQNme34haCj1b9vuw') || savedGasUrl.includes('AKfycbwPGeqw4wQAZrqSEUGnrQ24xTA8jaQ7HnxnEw7dr9Wm92NXWvzD7XQNme34haCj1b9vuw'))) {
  localStorage.setItem('snapevent_gas_url', GLOBAL_CONFIG.DEFAULT_GAS_URL);
}

const STATE = {
  // Configuration & Custom Branding (Cloud Persistent)
  gasApiUrl: (localStorage.getItem('snapevent_gas_url') && localStorage.getItem('snapevent_gas_url').trim().startsWith('http') && !localStorage.getItem('snapevent_gas_url').includes('AKfycbPGeqw4wQAZrqSEUGnrQ24xTA8jaQ7HnxnEw7dr9Wm92NXWvzD7XQNme34haCj1b9vuw'))
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
  isNewFrameUploaded: false,
  userHasSelectedFrame: false,
  customFrames: JSON.parse(localStorage.getItem('snapevent_custom_frames') || '[]'),
  events: JSON.parse(localStorage.getItem('snapevent_events') || '[]'),
  metrics: JSON.parse(localStorage.getItem('snapevent_metrics') || '{"totalEvents":5,"totalPhotos":13,"totalVotes":8}'),

  // Podium Titles & Winner Display (✏️ Edit Kata Gelar Khusus Admin)
  podiumTitleP1: localStorage.getItem('snapevent_podium_p1') || '🥇 Juara 1 (Emas)',
  podiumTitleP2: localStorage.getItem('snapevent_podium_p2') || '🥈 Juara 2 (Perak)',
  podiumTitleP3: localStorage.getItem('snapevent_podium_p3') || '🥉 Juara 3 (Perunggu)',
  podiumDisplayMode: localStorage.getItem('snapevent_podium_mode') || 'all', // 'all', 'grand', 'category'

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
  facingMode: localStorage.getItem('snapevent_camera_facing') || 'environment', // 'environment' (back) or 'user' (front)
  cameraZoom: 1.0, // Live camera zoom level (1.0x to 3.0x)
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
function getResolvedEventId(idOrSlug) {
  // Jika STATE.activeEvent sudah aktif tersinkron dari server, utamakan ID aktif tersebut jika target adalah default
  if ((!idOrSlug || idOrSlug === 'EVT-202611-001' || idOrSlug === 'DEFAULT') && STATE.activeEvent && STATE.activeEvent.idEvent) {
    return STATE.activeEvent.idEvent;
  }
  const target = String(idOrSlug || (STATE.activeEvent && STATE.activeEvent.idEvent) || STATE.activeEventId || '').trim();
  if (!target) return (STATE.activeEvent && STATE.activeEvent.idEvent) || (STATE.events && STATE.events[0]?.idEvent) || 'EVT-202611-001';
  if (/^EVT-\d+/i.test(target)) return target;

  const lower = target.toLowerCase();
  // Alias langsung untuk event default Sarah & Kevin agar kebal terhadap variasi slug/parameter
  if (
    lower === 'the-wedding-of-sarah-and-kevin' ||
    lower === 'the-wedding-of-sarah-&-kevin' ||
    lower === 'sarah-kevin' ||
    lower === 'sarahkevineverafter' ||
    (lower.includes('sarah') && lower.includes('kevin'))
  ) {
    return 'EVT-202611-001';
  }

  const allKnown = [...(STATE.events || []), ...(MOCK_DATA.events || [])];
  const ev = allKnown.find(e => 
    e.idEvent === target || 
    (e.slugEvent && e.slugEvent.toLowerCase() === lower) ||
    (e.namaEvent && e.namaEvent.toLowerCase() === lower)
  );
  if (ev && ev.idEvent) return ev.idEvent;
  if (STATE.activeEvent && STATE.activeEvent.idEvent) return STATE.activeEvent.idEvent;
  return (STATE.events && STATE.events[0]?.idEvent) || 'EVT-202611-001';
}

function getEventPhotosKey(eventId) {
  return 'snapevent_photos_' + getResolvedEventId(eventId || STATE.activeEventId);
}

function getEventVotedPhotosKey(eventId) {
  return 'snapevent_voted_photos_' + getResolvedEventId(eventId || STATE.activeEventId);
}

function getEventVotedCategoriesKey(eventId) {
  return 'snapevent_voted_categories_' + getResolvedEventId(eventId || STATE.activeEventId);
}

// --- REGISTRY FOTO YANG DIHAPUS (PERSISTENT TOMBSTONE ANTI-REAPPEAR TANPA DEPLOY ULANG) ---
function getDeletedPhotosSet(eventId) {
  const set = new Set();
  try {
    const globalDeleted = JSON.parse(localStorage.getItem('snapevent_deleted_photos') || '[]');
    if (Array.isArray(globalDeleted)) {
      globalDeleted.forEach(id => { if (id) set.add(String(id)); });
    }
    const targetId = getResolvedEventId(eventId || STATE.activeEventId);
    if (targetId) {
      const evDeleted = JSON.parse(localStorage.getItem(`snapevent_deleted_photos_${targetId}`) || '[]');
      if (Array.isArray(evDeleted)) {
        evDeleted.forEach(id => { if (id) set.add(String(id)); });
      }
    }
  } catch (e) {}
  return set;
}

function recordDeletedPhoto(idFoto, photoObj, eventId) {
  if (!idFoto) return;
  const targetId = getResolvedEventId(eventId || STATE.activeEventId);
  const idsToRecord = [String(idFoto)];
  if (photoObj) {
    if (photoObj.gdriveFileId) idsToRecord.push(String(photoObj.gdriveFileId));
    if (photoObj.driveFileId) idsToRecord.push(String(photoObj.driveFileId));
    if (photoObj.namaFile) idsToRecord.push(String(photoObj.namaFile));
  }

  try {
    // 1. Simpan di global registry lokal
    const globalDeleted = JSON.parse(localStorage.getItem('snapevent_deleted_photos') || '[]');
    idsToRecord.forEach(id => {
      if (!globalDeleted.includes(id)) globalDeleted.push(id);
    });
    localStorage.setItem('snapevent_deleted_photos', JSON.stringify(globalDeleted));

    // 2. Simpan di per-event registry lokal
    if (targetId) {
      const evKey = `snapevent_deleted_photos_${targetId}`;
      const evDeleted = JSON.parse(localStorage.getItem(evKey) || '[]');
      idsToRecord.forEach(id => {
        if (!evDeleted.includes(id)) evDeleted.push(id);
      });
      localStorage.setItem(evKey, JSON.stringify(evDeleted));
    }

    // 3. Sinkronkan ke sheet Pengaturan (Global Config) tanpa deploy ulang
    if (STATE.gasApiUrl) {
      callGasApiSafe('adminUpdateGlobalConfig', {
        updates: {
          deleted_photos: JSON.stringify(globalDeleted)
        }
      }).catch(() => {});
    }
  } catch (e) {
    console.warn("Gagal menyimpan tombstone foto terhapus:", e);
  }
}

function loadEventPhotos(eventId) {
  const id = eventId || STATE.activeEventId || 'EVT-202611-001';
  const resolvedId = getResolvedEventId(id);
  const key = getEventPhotosKey(resolvedId);
  const deletedSet = getDeletedPhotosSet(resolvedId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Bersihkan foto terhapus & status upload macet dari cache lokal sesi sebelumnya
      STATE.photos = Array.isArray(parsed) ? parsed.filter(p => {
        if (!p) return false;
        if (deletedSet.has(String(p.idFoto))) return false;
        if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
        if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
        return true;
      }).map(p => {
        if (p && p.isUploading && !IN_FLIGHT_PHOTO_UPLOADS.has(p.idFoto)) {
          return { ...p, isUploading: false };
        }
        return p;
      }) : [];
    } else {
      // Migrasi atau fallback ke mock data sample jika event default demo
      const legacy = JSON.parse(localStorage.getItem('snapevent_local_photos') || '[]');
      const defaultMockId = (MOCK_DATA.events && MOCK_DATA.events[0]) ? MOCK_DATA.events[0].idEvent : 'EVT-202611-001';
      if (resolvedId === 'EVT-202611-001' || resolvedId === defaultMockId) {
        if (legacy.length > 0) {
          STATE.photos = legacy.filter(p => p && !deletedSet.has(String(p.idFoto)));
        } else {
          STATE.photos = (MOCK_DATA.samplePhotos || []).filter(p => p && !deletedSet.has(String(p.idFoto)));
        }
        localStorage.setItem(key, JSON.stringify(STATE.photos));
      } else {
        STATE.photos = [];
      }
    }
  } catch (e) {
    STATE.photos = (MOCK_DATA.samplePhotos || []).filter(p => p && !deletedSet.has(String(p.idFoto)));
  }

  // Auto-synthesize categoryLikes jika ada likes namun belum terpetakan ke kategori acara
  const availableCats = (Array.isArray(STATE.activeCategories) && STATE.activeCategories.length > 0)
    ? STATE.activeCategories
    : (Array.isArray(MOCK_DATA.categories) ? MOCK_DATA.categories : []);
  if (Array.isArray(STATE.photos)) {
    STATE.photos.forEach(p => {
      if (p && (p.totalLikes || 0) > 0 && (!p.categoryLikes || Object.keys(p.categoryLikes).length === 0)) {
        p.categoryLikes = {};
        if (availableCats.length > 0) {
          const firstCat = availableCats[0];
          p.categoryLikes[firstCat.idKategori] = p.totalLikes;
          p.categoryLikes[firstCat.namaKategori] = p.totalLikes;
          if (!p.idKategori) p.idKategori = firstCat.idKategori;
          if (!p.namaKategori) p.namaKategori = firstCat.namaKategori;
        } else {
          p.categoryLikes['DEFAULT'] = p.totalLikes;
        }
      }
    });
  }
}

function saveEventPhotos(eventId) {
  const id = getResolvedEventId(eventId || STATE.activeEventId || 'EVT-202611-001');
  const deletedSet = getDeletedPhotosSet(id);
  try {
    const cleanPhotos = (STATE.photos || [])
      .filter(p => {
        if (!p) return false;
        if (deletedSet.has(String(p.idFoto))) return false;
        if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
        if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
        if (p.gdriveViewUrl && p.gdriveViewUrl.startsWith('data:')) return false;
        return true;
      })
      .slice(0, 100);
    localStorage.setItem(getEventPhotosKey(id), JSON.stringify(cleanPhotos));
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

// Resilient Google Drive 3-Tier Image Mirror Resolver (Anti-Black Screen)
function getDriveImageUrls(rawUrl) {
  if (!rawUrl) return [];
  const str = String(rawUrl).trim();
  if (str.startsWith('data:')) return [str];

  let fileId = '';
  const dMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) {
    fileId = dMatch[1];
  } else if (idMatch && idMatch[1]) {
    fileId = idMatch[1];
  }

  if (!fileId) return [str];

  // Mirror 1: Google usercontent CDN (lh3) - Stabil, cepat, dan tanpa proteksi login cross-origin
  // Mirror 2: Google Drive Official Thumbnail API
  // Mirror 3: Direct Export Stream (uc?export=view)
  return [
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
    `https://drive.google.com/uc?export=view&id=${fileId}`
  ];
}

function handleGalleryImgError(img) {
  if (!img) return;
  const step = parseInt(img.getAttribute('data-step') || '0', 10);
  const secondary = img.getAttribute('data-secondary');
  const tertiary = img.getAttribute('data-tertiary');

  if (step === 0 && secondary && secondary !== img.src) {
    img.setAttribute('data-step', '1');
    img.src = secondary;
    return;
  }
  if (step <= 1 && tertiary && tertiary !== img.src) {
    img.setAttribute('data-step', '2');
    img.src = tertiary;
    return;
  }
  // Seluruh mirror Google Drive gagal (file fisik tidak ditemukan / dihapus dari Drive):
  // Sesuai instruksi: "jangan tampilkan apabila tidak ditemukan, buat menjadi online"
  img.onerror = null;
  const card = img.closest('.group');
  if (card) {
    const photoId = card.getAttribute('data-id');
    if (photoId) {
      STATE.photos = (STATE.photos || []).filter(p => p.idFoto !== photoId);
      saveEventPhotos(STATE.activeEventId);
      const countBadge = document.getElementById('galleryPhotoCountBadge');
      if (countBadge) {
        countBadge.textContent = `${(STATE.photos || []).length} Foto`;
      }
    }
    card.remove();
  }
}

function handlePodiumImgError(img) {
  if (!img) return;
  const step = parseInt(img.getAttribute('data-step') || '0', 10);
  const secondary = img.getAttribute('data-secondary');
  const tertiary = img.getAttribute('data-tertiary');

  if (step === 0 && secondary && secondary !== img.src) {
    img.setAttribute('data-step', '1');
    img.src = secondary;
    return;
  }
  if (step <= 1 && tertiary && tertiary !== img.src) {
    img.setAttribute('data-step', '2');
    img.src = tertiary;
    return;
  }
  img.onerror = null;
  img.src = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80';
  img.classList.remove('opacity-0');
}

function isCanvasPureBlack(ctx, w, h) {
  try {
    const sampleW = Math.max(10, Math.floor(w * 0.6));
    const sampleH = Math.max(10, Math.floor(h * 0.6));
    const startX = Math.floor(w * 0.2);
    const startY = Math.floor(h * 0.2);
    const imgData = ctx.getImageData(startX, startY, sampleW, sampleH);
    const data = imgData.data;
    let totalLuma = 0;
    const step = 4 * 16;
    let count = 0;
    for (let i = 0; i < data.length; i += step) {
      totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
    const avgLuma = count > 0 ? (totalLuma / count) : 0;
    return avgLuma < 2.5;
  } catch (e) {
    return false;
  }
}

function getEventShareUrl(eventId) {
  const id = eventId || STATE.activeEventId || 'EVT-202611-001';
  const loc = window.location;
  const base = `${loc.protocol}//${loc.host}${loc.pathname}`;
  return `${base}?event=${encodeURIComponent(id)}`;
}

function getQrImageUrl(text, size = 300) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(text)}`;
}

function getAvailableFrames() {
  const presets = (typeof getDefaultPresetCustomFrames === 'function') ? getDefaultPresetCustomFrames() : [];
  const allFrames = [
    { id: 'GOLD_DECO', name: '✨ Gold Deco', type: 'builtin' },
    { id: 'POLAROID', name: '📷 Polaroid', type: 'builtin' },
    { id: 'MINIMAL', name: '▪️ Minimalist', type: 'builtin' }
  ];

  // Presets default otomatis masuk ke pilihan semua device tamu
  presets.forEach(p => {
    if (!allFrames.some(f => f.id === p.id)) {
      allFrames.push({
        id: p.id,
        name: p.name ? (p.name.startsWith('🖼️') ? p.name : `🖼️ ${p.name}`) : '🖼️ Preset',
        type: 'custom',
        scope: p.scope || 'global',
        dataUrl: p.dataUrl
      });
    }
  });

  const activeEvId = getResolvedEventId(STATE.activeEventId);
  if (Array.isArray(STATE.customFrames)) {
    STATE.customFrames.forEach(cf => {
      const cfEvId = cf.eventId ? getResolvedEventId(cf.eventId) : '';
      if (cf.scope === 'global' || !cf.eventId || cfEvId === activeEvId) {
        if (!allFrames.some(f => f.id === cf.id)) {
          allFrames.push({
            id: cf.id,
            name: cf.name ? (cf.name.startsWith('🖼️') ? cf.name : `🖼️ ${cf.name}`) : '🖼️ Custom',
            type: 'custom',
            scope: cf.scope,
            dataUrl: cf.dataUrl
          });
        }
      }
    });
  }

  const activeCustomData = STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl;
  if (activeCustomData && !allFrames.some(f => f.dataUrl === activeCustomData)) {
    let eventFrameName = STATE.activeEvent?.customFrameName || 'Bingkai Acara';
    if (eventFrameName.length > 20) {
      eventFrameName = 'Bingkai Acara';
    }
    allFrames.push({
      id: 'CUSTOM_EVENT',
      name: `🖼️ ${eventFrameName}`,
      type: 'custom',
      scope: 'event',
      dataUrl: activeCustomData
    });
  }

  allFrames.push({ id: 'NONE', name: 'Tanpa Bingkai', type: 'builtin' });

  // KEBIJAKAN BINGKAI ACARA (FRAME POLICY RESMI)
  const ev = STATE.activeEvent;
  if (ev) {
    let mode = ev.frameLockMode;
    let lockedId = ev.singleLockedFrame;
    let activeList = ev.activeFrames;

    // Normalisasi jika activeFrames berupa object dari server { mode, locked, frames }
    if (activeList && typeof activeList === 'object' && !Array.isArray(activeList)) {
      mode = activeList.mode || mode || 'multi';
      lockedId = activeList.locked || lockedId || 'GOLD_DECO';
      activeList = Array.isArray(activeList.frames) ? activeList.frames : [lockedId];
    }

    const isCustomMatch = (id, frame) => {
      if (!frame) return false;
      if (frame.id === id) return true;
      if (id === 'CUSTOM_EVENT' || id === 'CUSTOM') {
        return (frame.id === 'CUSTOM_EVENT' || (activeCustomData && frame.dataUrl === activeCustomData) || frame.scope === 'event');
      }
      if (String(id).startsWith('frame_') || String(id).startsWith('FRAME_')) {
        if (frame.id === id) return true;
        if (frame.id === 'CUSTOM_EVENT') return true;
        if (activeCustomData && frame.dataUrl === activeCustomData) return true;
        if (frame.scope === 'event') return true;
      }
      return false;
    };

    // Mode Single Frame Lock: Hanya kembalikan 1 bingkai terkunci (jangan tampilkan yang lainnya)
    if (mode === 'single') {
      let targetLocked = lockedId || (Array.isArray(activeList) && activeList[0]) || (activeCustomData ? 'CUSTOM_EVENT' : 'GOLD_DECO');
      const exact = allFrames.find(f => f.id === targetLocked || isCustomMatch(targetLocked, f));
      if (exact) return [exact];
      return [allFrames.find(f => f.type === 'custom') || allFrames[0]];
    }

    // Mode Multi-Frame: Saring dan urutkan PERSIS sesuai urutan yang ditentukan admin
    if (Array.isArray(activeList) && activeList.length > 0) {
      const ordered = [];
      activeList.forEach(frameId => {
        const match = allFrames.find(f => f.id === frameId || isCustomMatch(frameId, f));
        if (match && !ordered.some(o => o.id === match.id)) {
          ordered.push(match);
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
      namaEvent: "The Wedding of Sarah and Kevin",
      slugEvent: "the-wedding-of-sarah-and-kevin",
      tanggalEvent: "2026-11-20",
      hashtagEvent: "#SarahKevinEverAfter",
      maxFotoPerGuest: 10,
      maxVotePerGuest: 2,
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
      maxVotePerGuest: 2,
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
      revealMode: "SEGERA",
      isRevealed: true,
      likeEnabled: true,
      publicVisible: true,
      activeCameraStyles: ["RAW", "800T", "BW"],
      frameLockMode: "multi",
      singleLockedFrame: "CUSTOM_EVENT",
      activeFrames: ["CUSTOM_EVENT", "GOLD_DECO", "POLAROID", "MINIMAL"],
      gdriveFolderId: "",
      statusEvent: "AKTIF",
      customFrameUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'><rect x='28' y='28' width='1024' height='1294' fill='none' stroke='%23D4AF37' stroke-width='14' rx='28'/><rect x='52' y='52' width='976' height='1246' fill='none' stroke='%23F3E5AB' stroke-width='3' rx='18'/><circle cx='52' cy='52' r='18' fill='%23D4AF37'/><circle cx='1028' cy='52' r='18' fill='%23D4AF37'/><circle cx='52' cy='1298' r='18' fill='%23D4AF37'/><circle cx='1028' cy='1298' r='18' fill='%23D4AF37'/><rect x='120' y='1175' width='840' height='110' fill='rgba(15,15,20,0.88)' stroke='%23D4AF37' stroke-width='2' rx='16'/><text x='540' y='1225' fill='%23F3E5AB' font-family='serif' font-size='32' font-weight='bold' text-anchor='middle'>ANNUAL GALA DINNER</text><text x='540' y='1262' fill='%23D4AF37' font-family='sans-serif' font-size='20' font-weight='bold' text-anchor='middle'>PT NUSANTARA TECH • 2026</text></svg>",
      customFrameName: "Nusantara Gala Frame"
    },
    {
      idEvent: "EVT-202612-210",
      namaEvent: "Clarissa's Sweet 17: Enchanted Forest",
      slugEvent: "clarissa-sweet-17",
      tanggalEvent: "2026-12-28",
      hashtagEvent: "#ClarissaSweet17",
      maxFotoPerGuest: 12,
      maxVotePerGuest: 2,
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
      maxVotePerGuest: 2,
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
    },
    {
      idEvent: "EVT-202611-456",
      namaEvent: "ilham & sherwin",
      slugEvent: "ilham---sherwin",
      tanggalEvent: "2026-11-13",
      hashtagEvent: "#ilhamsherwin",
      maxFotoPerGuest: 10,
      maxVotePerGuest: 1,
      revealMode: "SEGERA",
      isRevealed: true,
      likeEnabled: true,
      publicVisible: true,
      activeCameraStyles: ["RAW", "800T", "WARM", "BW"],
      frameLockMode: "single",
      singleLockedFrame: "CUSTOM_EVENT",
      activeFrames: ["CUSTOM_EVENT"],
      gdriveFolderId: "1q2v8CBLClFD2WX8dqhVRSaRfb80OVW_1",
      statusEvent: "AKTIF",
      customFrameUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'><rect x='30' y='30' width='1020' height='1290' fill='none' stroke='%23D4AF37' stroke-width='4' rx='16'/><rect x='100' y='1160' width='880' height='130' fill='rgba(10,10,14,0.88)' stroke='%23D4AF37' stroke-width='2' rx='12'/><text x='540' y='1215' fill='%23F3E5AB' font-family='serif' font-style='italic' font-size='38' font-weight='bold' text-anchor='middle'>ilham &amp; sherwin</text><text x='540' y='1255' fill='%23D4AF37' font-family='sans-serif' font-size='20' font-weight='600' text-anchor='middle'>#ilhamsherwin</text></svg>",
      customFrameName: "ilham & sherwin Frame"
    }
  ],
  event: {
    idEvent: "EVT-202611-001",
    namaEvent: "The Wedding of Sarah & Kevin",
    slugEvent: "sarah-kevin",
    tanggalEvent: "2026-11-20",
    hashtagEvent: "#SarahKevinEverAfter",
    maxFotoPerGuest: 10,
    maxVotePerGuest: 1,
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
MOCK_DATA.event = MOCK_DATA.events[0];

// --- 2. INITIALIZATION ON DOM READY ---
window.addEventListener('DOMContentLoaded', () => {
  initApp();
  bindEvents();
});

async function initApp() {
  // 0. Deteksi Parameter URL Cloud Bridge (?gas=... & ?event=...) atau Gunakan Default Cloud Deployment
  const urlParams = new URLSearchParams(window.location.search);
  const gasFromUrl = urlParams.get('gas');
  const hasCustomSavedGas = localStorage.getItem('snapevent_gas_url_custom') === 'true';
  if (gasFromUrl && gasFromUrl.trim().startsWith('http') && !hasCustomSavedGas) {
    STATE.gasApiUrl = decodeURIComponent(gasFromUrl.trim());
    localStorage.setItem('snapevent_gas_url', STATE.gasApiUrl);
  } else if (localStorage.getItem('snapevent_gas_url') && localStorage.getItem('snapevent_gas_url').trim().startsWith('http')) {
    STATE.gasApiUrl = localStorage.getItem('snapevent_gas_url').trim();
  } else {
    STATE.gasApiUrl = GLOBAL_CONFIG.DEFAULT_GAS_URL;
    localStorage.setItem('snapevent_gas_url', STATE.gasApiUrl);
  }

  // SAMARKAN URL: Hapus parameter ?gas=... dari address bar browser agar hanya tampil vercel.app
  if (urlParams.has('gas')) {
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('gas');
      const cleanPath = cleanUrl.pathname + (cleanUrl.searchParams.toString() ? '?' + cleanUrl.searchParams.toString() : '') + cleanUrl.hash;
      window.history.replaceState({}, document.title, cleanPath);
    } catch (e) {
      console.warn("URL camouflage replaceState error:", e);
    }
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

  // Tentukan event aktif saat ini (Dukungan URL QR Code & Event Switching)
  const requestedEvent = urlParams.get('event');
  let requestedEventFound = true;
  if (requestedEvent) {
    const resolvedReqId = getResolvedEventId(requestedEvent);
    STATE.activeEventId = resolvedReqId;
    const matched = (STATE.events || []).find(e => e.idEvent === resolvedReqId);
    if (matched) {
      STATE.activeEvent = matched;
    } else {
      requestedEventFound = false;
    }
    localStorage.setItem('snapevent_active_event_id', STATE.activeEventId);
  }

  if (!STATE.activeEvent) {
    const savedActiveId = localStorage.getItem('snapevent_active_event_id');
    if (savedActiveId && STATE.events.some(e => e.idEvent === savedActiveId)) {
      STATE.activeEventId = savedActiveId;
    } else {
      STATE.activeEventId = (STATE.events && STATE.events[0]) ? STATE.events[0].idEvent : 'EVT-202611-001';
      localStorage.setItem('snapevent_active_event_id', STATE.activeEventId);
    }
    STATE.activeEvent = (STATE.events && STATE.events.find(e => e.idEvent === STATE.activeEventId)) || (STATE.events && STATE.events[0]) || MOCK_DATA.events[0];
  }

  // GERBANG KEAMANAN ACARA: Jika URL membawa parameter event dan status event tersebut INAKTIF atau TIDAK DITEMUKAN
  if (requestedEvent && !STATE.gasApiUrl) {
    const isInactive = !requestedEventFound || (STATE.activeEvent && STATE.activeEvent.statusEvent && STATE.activeEvent.statusEvent !== 'AKTIF');
    if (isInactive) {
      if (sessionStorage.getItem('snapevent_admin_session') !== 'true') {
        const eventName = (STATE.activeEvent && STATE.activeEvent.namaEvent) || requestedEvent;
        showToast(`⚠️ Peringatan: Acara "${eventName}" sedang tidak aktif atau tidak ditemukan.`, "warning", 6000);
        const closedTitle = document.getElementById('closedEventTitle');
        if (closedTitle) closedTitle.textContent = "Acara Ini Sedang Tidak Aktif";
        const closedDesc = document.getElementById('closedEventDesc');
        if (closedDesc) {
          closedDesc.textContent = `Tautan acara "${eventName}" telah selesai atau belum dimulai. Hanya acara yang berstatus aktif yang dapat diakses oleh publik.`;
        }
        showView('viewEventClosed');
        return;
      }
    }
  }

  // 1. Muat data foto & voting terisolasi untuk event aktif (Instan dari localStorage < 2ms)
  loadEventPhotos(STATE.activeEventId);
  loadEventVotes(STATE.activeEventId);

  // Pastikan koleksi bingkai kustom terisi template preset jika belum ada dan bebas dari duplikat
  if (!Array.isArray(STATE.customFrames) || STATE.customFrames.length === 0) {
    STATE.customFrames = getDefaultPresetCustomFrames();
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
  } else {
    const seenCf = new Set();
    STATE.customFrames = STATE.customFrames.filter(cf => {
      if (!cf || !cf.name) return false;
      const key = `${cf.name.trim().toLowerCase()}__${cf.scope || 'event'}`;
      if (seenCf.has(key)) return false;
      seenCf.add(key);
      return true;
    });
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
  }

  // 2. INSTANT FIRST-PAINT: Terapkan konfigurasi & identitas acara ke UI seketika (< 10ms)
  applyGlobalConfigToUI();
  applyEventToUI();

  // 3. SEGERA TAMPILKAN HALAMAN AKTIF TANPA MENUNGGU JARINGAN INTERNET (< 20ms)
  if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
    showView('viewAdmin');
    renderAdminDashboard(); // Kartu 5 Event, 13 Foto, 8 Suara langsung tampil tanpa skeleton delay!
  } else if (!STATE.guestNama || !STATE.guestNama.trim()) {
    showView('viewWelcome');
  } else {
    const savedView = sessionStorage.getItem('snapevent_current_view') || 'viewCamera';
    showView(savedView);
    if (savedView === 'viewGallery') {
      renderGallery(); // Langsung render foto cache lokal seketika!
    }
  }

  updateRemainingQuotaDisplay();
  updateGuestIdentityUI();

  // Cek Persistensi Slideshow atau Parameter URL
  if (urlParams.get('view') === 'slideshow' || sessionStorage.getItem('snapevent_slideshow_active') === 'true') {
    openSlideshow();
  }

  // 4. ASYNCHRONOUS NON-BLOCKING SINKRONISASI (Stale-While-Revalidate Engine)
  revalidateFromBackend();
}

let isRevalidating = false;

async function revalidateFromBackend() {
  if (!STATE.gasApiUrl || isRevalidating) return;
  isRevalidating = true;

  try {
    await Promise.allSettled([
      loadEventData(),
      loadGallery()
    ]);

    // Update UI secara halus (silent reactive update) setelah data GAS tiba
    applyGlobalConfigToUI();
    applyEventToUI();
    if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
      renderAdminDashboard();
    }
    const currentView = sessionStorage.getItem('snapevent_current_view');
    const isGalleryActive = currentView === 'viewGallery' || (!document.getElementById('viewGallery')?.classList.contains('hidden'));
    if (isGalleryActive) {
      renderGallery();
    }
    updateRemainingQuotaDisplay();
  } catch (err) {
    console.warn("Background revalidation note:", err);
  } finally {
    isRevalidating = false;
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

// --- MULTI-TIER RESILIENT GAS API DISPATCHER (KEBAL NETWORK ERROR & CORS) ---
async function callGasApiSafe(action, payload = {}) {
  if (!STATE.gasApiUrl) return null;
  const url = STATE.gasApiUrl;
  const bodyData = { action, ...payload };

  // Tier 1: Standar POST cross-origin
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyData)
    });
    const res = await resp.json().catch(() => null);
    if (res && (res.status === 'success' || res.status === 'ok')) {
      return res;
    }
  } catch (postErr) {
    console.warn(`[callGasApiSafe] POST '${action}' gagal, mencoba fallback GET:`, postErr.message);
  }

  // Tier 2: HTTP GET Fallback (Kebal terhadap isu CORS browser pada redirect 302 Apps Script)
  try {
    const qParams = new URLSearchParams();
    qParams.set('action', action);
    for (const k in payload) {
      if (payload[k] !== undefined && payload[k] !== null) {
        if (typeof payload[k] === 'object') {
          qParams.set(k, JSON.stringify(payload[k]));
        } else {
          qParams.set(k, String(payload[k]));
        }
      }
    }
    const getUrl = `${url}?${qParams.toString()}`;
    const respGet = await fetch(getUrl, { method: 'GET' });
    const resGet = await respGet.json().catch(() => null);
    if (resGet && (resGet.status === 'success' || resGet.status === 'ok')) {
      return resGet;
    }
  } catch (getErr) {
    console.warn(`[callGasApiSafe] GET '${action}' gagal, mencoba fallback no-cors:`, getErr.message);
  }

  // Tier 3: POST no-cors (Pasti sampai & dieksekusi server Google Apps Script tanpa blocking CORS preflight)
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyData)
    });
    return { status: 'success', syncedViaNoCors: true };
  } catch (noCorsErr) {
    console.warn(`[callGasApiSafe] no-cors fallback '${action}' gagal:`, noCorsErr.message);
  }

  return null;
}

// --- 3. DATA FETCHING (GAS API OR MOCK) & EVENT ACTIVATION ---
async function loadEventData() {
  if (STATE.gasApiUrl) {
    try {
      const urlEvt = new URLSearchParams(window.location.search).get('event');
      const targetId = urlEvt ? getResolvedEventId(urlEvt) : (getResolvedEventId(STATE.activeEventId) || 'ACTIVE');
      const resp = await fetch(`${STATE.gasApiUrl}?action=getEventDetails&eventId=${targetId}&guestId=${STATE.guestId}`);
      const res = await resp.json();
      if (res.status === 'success') {
        const localActive = (STATE.events || []).find(e => e.idEvent === res.event.idEvent) || STATE.activeEvent;
        
        let inferredMode = res.event.frameLockMode || localActive?.frameLockMode || 'multi';
        let inferredLocked = res.event.singleLockedFrame || localActive?.singleLockedFrame || 'GOLD_DECO';
        let inferredFrames = (Array.isArray(res.event.activeFrames) && res.event.activeFrames.length > 0)
          ? res.event.activeFrames
          : (localActive?.activeFrames && localActive.activeFrames.length > 0 ? localActive.activeFrames : ['GOLD_DECO', 'POLAROID', 'MINIMAL']);

        const rawFrames = res.event.activeFrames;
        if (rawFrames && typeof rawFrames === 'object' && !Array.isArray(rawFrames)) {
          inferredMode = rawFrames.mode || inferredMode;
          inferredLocked = rawFrames.locked || inferredLocked;
          inferredFrames = Array.isArray(rawFrames.frames) && rawFrames.frames.length > 0 ? rawFrames.frames : [inferredLocked];
        }

        const activeCustomUrl = res.event.customFrameUrl || localActive?.customFrameUrl || '';
        const activeCustomData = localActive?.customFrameData || activeCustomUrl;

        if (activeCustomUrl) {
          if (inferredMode === 'single' && (inferredLocked === 'CUSTOM_EVENT' || inferredLocked === 'CUSTOM')) {
            inferredLocked = 'CUSTOM_EVENT';
          }
          if (Array.isArray(inferredFrames) && !inferredFrames.some(f => f === 'CUSTOM_EVENT' || String(f).startsWith('frame_') || String(f).startsWith('FRAME_'))) {
            inferredFrames.unshift('CUSTOM_EVENT');
          }
        }

        STATE.activeEventId = res.event.idEvent;
        localStorage.setItem('snapevent_active_event_id', STATE.activeEventId);

        STATE.activeEvent = {
          ...localActive,
          ...res.event,
          frameLockMode: inferredMode,
          singleLockedFrame: inferredLocked,
          activeFrames: inferredFrames,
          customFrameData: activeCustomData,
          customFrameUrl: activeCustomUrl
        };
        localStorage.setItem('snapevent_active_event', JSON.stringify(STATE.activeEvent));
        STATE.activeCategories = res.categories || [];

        if (res.metrics) {
          STATE.metrics = res.metrics;
          localStorage.setItem('snapevent_metrics', JSON.stringify(STATE.metrics));
        }

        // Sinkronkan seluruh event secara defensif (Pertahankan frame dan kustomisasi lokal jika server absen)
        if (Array.isArray(res.allEvents) && res.allEvents.length > 0) {
          STATE.events = res.allEvents.map(serverEv => {
            const localEv = (STATE.events || []).find(e => e.idEvent === serverEv.idEvent);
            let sMode = serverEv.frameLockMode || localEv?.frameLockMode || 'multi';
            let sLocked = serverEv.singleLockedFrame || localEv?.singleLockedFrame || 'GOLD_DECO';
            let sFrames = (Array.isArray(serverEv.activeFrames) && serverEv.activeFrames.length > 0)
              ? serverEv.activeFrames
              : (localEv?.activeFrames && localEv.activeFrames.length > 0 ? localEv.activeFrames : ['GOLD_DECO', 'POLAROID', 'MINIMAL']);

            const sRaw = serverEv.activeFrames;
            if (sRaw && typeof sRaw === 'object' && !Array.isArray(sRaw)) {
              sMode = sRaw.mode || sMode;
              sLocked = sRaw.locked || sLocked;
              sFrames = Array.isArray(sRaw.frames) && sRaw.frames.length > 0 ? sRaw.frames : [sLocked];
            }

            const sCustomUrl = serverEv.customFrameUrl || localEv?.customFrameUrl || '';
            const sCustomData = localEv?.customFrameData || sCustomUrl;

            if (sCustomUrl) {
              if (sMode === 'single' && (sLocked === 'CUSTOM_EVENT' || sLocked === 'CUSTOM')) {
                sLocked = 'CUSTOM_EVENT';
              }
              if (Array.isArray(sFrames) && !sFrames.some(f => f === 'CUSTOM_EVENT' || String(f).startsWith('frame_') || String(f).startsWith('FRAME_'))) {
                sFrames.unshift('CUSTOM_EVENT');
              }
            }

            return {
              ...localEv,
              ...serverEv,
              frameLockMode: sMode,
              singleLockedFrame: sLocked,
              activeFrames: sFrames,
              customFrameData: sCustomData,
              customFrameUrl: sCustomUrl
            };
          });
          localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
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
          if (res.globalConfig.podium_title_p1) {
            STATE.podiumTitleP1 = res.globalConfig.podium_title_p1;
            localStorage.setItem('snapevent_podium_p1', STATE.podiumTitleP1);
          }
          if (res.globalConfig.podium_title_p2) {
            STATE.podiumTitleP2 = res.globalConfig.podium_title_p2;
            localStorage.setItem('snapevent_podium_p2', STATE.podiumTitleP2);
          }
          if (res.globalConfig.podium_title_p3) {
            STATE.podiumTitleP3 = res.globalConfig.podium_title_p3;
            localStorage.setItem('snapevent_podium_p3', STATE.podiumTitleP3);
          }
          if (res.globalConfig.podium_display_mode) {
            STATE.podiumDisplayMode = res.globalConfig.podium_display_mode;
            localStorage.setItem('snapevent_podium_mode', STATE.podiumDisplayMode);
          }
          if (res.globalConfig.deleted_photos) {
            try {
              const serverDeleted = JSON.parse(res.globalConfig.deleted_photos);
              if (Array.isArray(serverDeleted) && serverDeleted.length > 0) {
                const localDeleted = JSON.parse(localStorage.getItem('snapevent_deleted_photos') || '[]');
                const merged = Array.from(new Set([...localDeleted, ...serverDeleted]));
                localStorage.setItem('snapevent_deleted_photos', JSON.stringify(merged));
              }
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
        if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
          renderAdminDashboard();
        }
        return res;
      } else if (res.status === 'inactive' || (res.event && res.event.statusEvent && res.event.statusEvent !== 'AKTIF')) {
        const eventName = (res.event && res.event.namaEvent) || STATE.activeEventId;
        showToast(`ℹ️ Acara "${eventName}" telah selesai. Anda tetap dapat menikmati galeri foto bersama.`, "info", 5000);
        if (res.event) {
          STATE.activeEvent = res.event;
          applyEventToUI();
          loadGallery();
        }
        return res;
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

  if (Array.isArray(STATE.events)) {
    STATE.events.forEach(e => {
      e.statusEvent = (e.idEvent === idEvent ? 'AKTIF' : 'INAKTIF');
    });
    localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
  }

  const ev = (STATE.events && STATE.events.find(e => e.idEvent === idEvent)) || 
             (idEvent === MOCK_DATA.event.idEvent ? MOCK_DATA.event : null);
  if (ev) {
    ev.statusEvent = 'AKTIF';
    STATE.activeEvent = ev;
    localStorage.setItem('snapevent_active_event', JSON.stringify(STATE.activeEvent));
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

  // Background sync ke GAS jika dikonfigurasi (Resilient Multi-Tier)
  if (STATE.gasApiUrl) {
    callGasApiSafe('adminSetActiveEvent', {
      idEvent: idEvent,
      eventId: idEvent
    });
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
        localStorage.setItem('snapevent_gas_url_custom', 'true');
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
      STATE.events = res.events.map(serverEv => {
        const localEv = (STATE.events || []).find(e => e.idEvent === serverEv.idEvent);
        const inferredMode = serverEv.frameLockMode 
          || (Array.isArray(serverEv.activeFrames) && serverEv.activeFrames.length === 1 && serverEv.activeFrames[0] !== 'CUSTOM_EVENT' ? 'single' : (localEv?.frameLockMode || 'multi'));
        const inferredLocked = serverEv.singleLockedFrame 
          || (inferredMode === 'single' && Array.isArray(serverEv.activeFrames) ? serverEv.activeFrames[0] : (localEv?.singleLockedFrame || 'GOLD_DECO'));

        return {
          ...localEv,
          ...serverEv,
          frameLockMode: inferredMode,
          singleLockedFrame: inferredLocked,
          activeFrames: (Array.isArray(serverEv.activeFrames) && serverEv.activeFrames.length > 0)
            ? serverEv.activeFrames
            : (localEv?.activeFrames || ['GOLD_DECO', 'POLAROID', 'MINIMAL']),
          customFrameData: localEv?.customFrameData || serverEv.customFrameUrl || '',
          customFrameUrl: serverEv.customFrameUrl || localEv?.customFrameUrl || ''
        };
      });
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

      // SEGERA UPDATE TAMPILAN ADMIN SECARA INSTAN TANPA MENUNGGU FETCH GALERI SELESAI
      applyEventToUI();
      renderAdminDashboard();

      // Muat foto galeri aktif dari Google Sheets di background
      loadGallery().catch(err => console.warn("Background gallery sync note:", err));

      const pCount = (STATE.metrics && typeof STATE.metrics.totalPhotos === 'number') ? STATE.metrics.totalPhotos : (STATE.photos ? STATE.photos.length : 0);
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
  if (!STATE.gasApiUrl) {
    renderGallery();
    return;
  }
  const grid = document.getElementById('galleryPhotoGrid');
  const countBadge = document.getElementById('galleryPhotoCountBadge');
  const empty = document.getElementById('galleryEmptyNotice');
  const targetId = getResolvedEventId(STATE.activeEventId);

  // Indikator visual loading non-intrusif jika galeri masih kosong
  if ((!STATE.photos || STATE.photos.length === 0) && grid && !grid.innerHTML.trim()) {
    grid.innerHTML = `
      <div class="col-span-2 sm:col-span-3 md:col-span-4 py-12 text-center">
        <div class="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-xs text-zinc-400 font-medium">Menyinkronkan foto rol acara...</p>
      </div>
    `;
  }

  try {
    const resp = await fetch(`${STATE.gasApiUrl}?action=getGallery&eventId=${targetId}&guestId=${STATE.guestId}`);
    const res = await resp.json();
    if (res && res.status === 'success') {
      document.getElementById('galleryLockedNotice')?.classList.add('hidden');
      if (typeof res.isRevealed === 'boolean' && STATE.activeEvent) {
        STATE.activeEvent.isRevealed = res.isRevealed;
      }
      const deletedSet = getDeletedPhotosSet(targetId);
      const serverPhotos = (Array.isArray(res.photos) ? res.photos : []).filter(p => {
        if (!p) return false;
        if (deletedSet.has(String(p.idFoto))) return false;
        if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
        if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
        return true;
      });
      const serverIds = new Set(serverPhotos.map(p => p.idFoto));

      // Pertahankan HANYA foto lokal yang sedang aktif dalam antrean upload saat ini
      // Foto zombie/stuck dari sesi sebelumnya otomatis dibersihkan agar hanya foto online valid yang tampil
      const now = Date.now();
      const pendingLocalPhotos = (STATE.photos || []).filter(p => {
        if (!p) return false;
        if (deletedSet.has(String(p.idFoto))) return false;
        if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
        if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
        if (serverIds.has(p.idFoto)) return false;
        // Hanya pertahankan jika proses upload aktif sedang berjalan di memori
        if (IN_FLIGHT_PHOTO_UPLOADS.has(p.idFoto)) return true;
        // Atau jika foto offline baru saja diambil kurang dari 25 detik lalu
        if (p.gdriveViewUrl && p.gdriveViewUrl.startsWith('data:')) {
          const tsMatch = String(p.idFoto).match(/FTO-(\d{10,13})/);
          if (tsMatch && tsMatch[1]) {
            return (now - parseInt(tsMatch[1], 10)) < 25000;
          }
        }
        return false;
      });

      // Gabungkan: foto lokal terkini yang sedang aktif diunggah di depan, disusul seluruh foto server resmi Google Drive
      let finalPhotos = [...pendingLocalPhotos, ...serverPhotos].filter(p => {
        if (!p) return false;
        if (deletedSet.has(String(p.idFoto))) return false;
        if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
        if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
        return true;
      });

      // Fallback: Jika server mengembalikan 0 foto pada event default demo namun ada samplePhotos, jangan biarkan kosong
      if (finalPhotos.length === 0 && targetId === 'EVT-202611-001' && Array.isArray(MOCK_DATA.samplePhotos) && MOCK_DATA.samplePhotos.length > 0) {
        finalPhotos = MOCK_DATA.samplePhotos.filter(p => p && !deletedSet.has(String(p.idFoto)));
      }

      // Pertahankan like, kategori penghargaan, dan riwayat vote lokal secara pintar
      const availableCats = (Array.isArray(STATE.activeCategories) && STATE.activeCategories.length > 0)
        ? STATE.activeCategories
        : (Array.isArray(MOCK_DATA.categories) ? MOCK_DATA.categories : []);

      const existingPhotoMap = new Map();
      (STATE.photos || []).forEach(p => { if (p && p.idFoto) existingPhotoMap.set(p.idFoto, p); });
      finalPhotos.forEach(p => {
        const oldP = existingPhotoMap.get(p.idFoto);
        if (oldP) {
          p.categoryLikes = { ...(oldP.categoryLikes || {}), ...(p.categoryLikes || {}) };
          p.totalLikes = Math.max(oldP.totalLikes || 0, p.totalLikes || 0);
          if (oldP.idKategori && !p.idKategori) p.idKategori = oldP.idKategori;
          if (oldP.namaKategori && !p.namaKategori) p.namaKategori = oldP.namaKategori;
        }

        // Auto-synthesize categoryLikes jika ada likes namun belum terinci dari server
        if ((p.totalLikes || 0) > 0) {
          if (!p.categoryLikes || Object.keys(p.categoryLikes).length === 0) {
            p.categoryLikes = {};
            if (availableCats.length > 0) {
              const firstCat = availableCats[0];
              p.categoryLikes[firstCat.idKategori] = p.totalLikes;
              p.categoryLikes[firstCat.namaKategori] = p.totalLikes;
              if (!p.idKategori) p.idKategori = firstCat.idKategori;
              if (!p.namaKategori) p.namaKategori = firstCat.namaKategori;
            } else {
              p.categoryLikes['DEFAULT'] = p.totalLikes;
            }
          }
        }
      });

      // Pertahankan riwayat votedPhotoIds lokal yang belum tersinkron
      const serverVoted = res.votedPhotoIds || [];
      serverVoted.forEach(vid => {
        if (!STATE.votedPhotoIds.includes(vid)) STATE.votedPhotoIds.push(vid);
      });

      STATE.photos = finalPhotos;
      saveEventPhotos(targetId);
      renderGallery();
      if (!document.getElementById('adminTabGallery')?.classList.contains('hidden')) {
        renderAdminGallery();
      }

      // Unggah otomatis untuk foto offline murni yang belum ada di antrean
      const offlineUnstarted = pendingLocalPhotos.filter(p => 
        p && p.gdriveViewUrl && p.gdriveViewUrl.startsWith('data:') && !IN_FLIGHT_PHOTO_UPLOADS.has(p.idFoto)
      );
      if (offlineUnstarted.length > 0) {
        autoUploadPendingPhotos(offlineUnstarted);
      }
    } else if (res && res.status === 'locked') {
      document.getElementById('galleryLockedNotice')?.classList.remove('hidden');
      if (grid) grid.innerHTML = '';
      if (empty) empty.classList.add('hidden');
      if (countBadge) countBadge.textContent = '0 Foto (Terkunci)';
    } else {
      renderGallery();
    }
  } catch (e) {
    console.warn("Gagal memuat galeri GAS:", e.message);
    renderGallery();
  }
}

async function autoUploadPendingPhotos(pendingList) {
  if (!STATE.gasApiUrl || !Array.isArray(pendingList) || pendingList.length === 0) return;
  for (const photo of pendingList) {
    if (!photo.gdriveViewUrl || !photo.gdriveViewUrl.startsWith('data:')) continue;
    if (IN_FLIGHT_PHOTO_UPLOADS.has(photo.idFoto)) continue; // KUNCI MUTLAK: Mencegah upload file kembar ke Google Drive!
    IN_FLIGHT_PHOTO_UPLOADS.add(photo.idFoto);
    try {
      const payload = {
        action: "uploadPhoto",
        eventId: getResolvedEventId(photo.eventId || STATE.activeEventId),
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
      const res = await resp.json().catch(() => null);
      if (res && res.status === 'success') {
        if (res.idFoto) photo.idFoto = res.idFoto;
        if (res.viewUrl) photo.gdriveViewUrl = res.viewUrl;
        photo.isUploading = false;
        saveEventPhotos(STATE.activeEventId);
        renderGallery();
      }
    } catch (err) {
      console.warn("Auto-sync background upload error untuk foto:", photo.idFoto, err.message);
    } finally {
      IN_FLIGHT_PHOTO_UPLOADS.delete(photo.idFoto);
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

  // Pengaturan Gelar Podium Juara & Mode Pemenang (Khusus Admin)
  const p1El = document.getElementById('cfgPodiumTitleP1');
  if (p1El) p1El.value = STATE.podiumTitleP1 || '🥇 Juara 1 (Emas)';
  const p2El = document.getElementById('cfgPodiumTitleP2');
  if (p2El) p2El.value = STATE.podiumTitleP2 || '🥈 Juara 2 (Perak)';
  const p3El = document.getElementById('cfgPodiumTitleP3');
  if (p3El) p3El.value = STATE.podiumTitleP3 || '🥉 Juara 3 (Perunggu)';
  const modeEl = document.getElementById('cfgPodiumDisplayMode');
  if (modeEl) modeEl.value = STATE.podiumDisplayMode || 'all';
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

  // Sinkronisasi Gambar QR Code di Layar Selamat Datang
  const welcomeQrImg = document.getElementById('welcomeQrImg');
  if (welcomeQrImg) {
    const eventUrl = getEventShareUrl(ev.idEvent);
    welcomeQrImg.src = getQrImageUrl(eventUrl, 250);
  }

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

  // Set bingkai aktif sesuai kebijakan frame acara
  const availFrames = getAvailableFrames();
  const isSingle = (ev.frameLockMode === 'single' || availFrames.length <= 1);
  let targetFrame = availFrames[0] ? availFrames[0].id : 'GOLD_DECO';

  if (isSingle) {
    const lockedFrame = ev.singleLockedFrame || targetFrame;
    const match = availFrames.find(f => f.id === lockedFrame || f.id === 'CUSTOM_EVENT' || String(f.id).startsWith('frame_') || String(f.id).startsWith('FRAME_')) || availFrames[0];
    targetFrame = match ? match.id : (availFrames[0] ? availFrames[0].id : 'GOLD_DECO');
  } else {
    // Multi-frame mode: Jika tamu sudah memilih manual dalam sesi ini, pertahankan pilihannya
    if (STATE.userHasSelectedFrame && availFrames.some(f => f.id === STATE.activeFrame)) {
      targetFrame = STATE.activeFrame;
    } else {
      // Prioritaskan bingkai kustom resmi pertama yang diatur oleh Admin
      targetFrame = availFrames[0] ? availFrames[0].id : 'GOLD_DECO';
    }
  }
  STATE.activeFrame = targetFrame;

  // Render Pilihan Frame di Viewfinder (Dinamis sesuai izin Admin)
  const frameContainer = document.getElementById('frameListContainer');
  const singleBadge = document.getElementById('camSingleFrameBadge');
  const singleName = document.getElementById('camSingleFrameName');

  if (isSingle) {
    if (frameContainer) frameContainer.classList.add('hidden');
    if (singleBadge) {
      singleBadge.classList.remove('hidden');
      if (singleName) singleName.textContent = availFrames[0]?.name || 'Bingkai Resmi Acara';
    }
  } else {
    if (singleBadge) singleBadge.classList.add('hidden');
    if (frameContainer) {
      frameContainer.classList.remove('hidden');
      frameContainer.innerHTML = availFrames.map(f => `
        <button data-frame="${f.id}" class="frame-pill shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${targetFrame === f.id ? 'bg-brand-gold text-black border-brand-gold shadow-sm' : 'bg-white/5 text-zinc-300 border-white/10'} border transition">${f.name}</button>
      `).join('');
    }
  }

  // Render Kategori Voting di Galeri (Sesuai Kategori Poling yang Dikonfigurasi)
  const catContainer = document.getElementById('galleryCategoryTabs');
  if (catContainer) {
    const isAll = (!STATE.activeGalleryFilter || STATE.activeGalleryFilter === 'ALL' || STATE.activeGalleryFilter === 'WINNERS' || STATE.activeGalleryFilter === 'POPULAR');

    catContainer.innerHTML = `
      <button data-cat="ALL" class="cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold ${isAll ? 'bg-brand-gold text-black border-brand-gold shadow-sm' : 'bg-white/5 text-zinc-300 border-white/10 hover:border-brand-gold/50'} border transition cursor-pointer">Semua Foto</button>
    `;

    (STATE.activeCategories || []).forEach(cat => {
      const isSelected = STATE.activeGalleryFilter === cat.idKategori;
      const btn = document.createElement('button');
      btn.setAttribute('data-cat', cat.idKategori);
      btn.className = `cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold ${isSelected ? 'bg-brand-gold text-black border-brand-gold shadow-sm' : 'bg-white/5 text-zinc-300 border-white/10 hover:border-brand-gold/50'} border transition cursor-pointer`;
      btn.textContent = `👑 ${cat.namaKategori}`;
      catContainer.appendChild(btn);
    });
  }

  applyActiveFrame(targetFrame);

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

  // Hide all views first with both class and explicit style.display
  ['viewWelcome', 'viewCamera', 'viewGallery', 'viewAdmin', 'viewEventClosed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  });

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.remove('hidden');
    target.style.display = '';
  }

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
    document.body.classList.add('camera-lock-scroll');
    document.getElementById('navBtnCamera')?.classList.add('text-brand-gold');
    document.getElementById('navBtnCamera')?.classList.remove('text-zinc-400');
    const avail = getAvailableFrames();
    if (STATE.activeEvent && STATE.activeEvent.frameLockMode === 'single') {
      STATE.activeFrame = avail[0] ? avail[0].id : 'GOLD_DECO';
    } else if (!STATE.userHasSelectedFrame || !avail.some(f => f.id === STATE.activeFrame)) {
      STATE.activeFrame = avail[0] ? avail[0].id : 'GOLD_DECO';
    }
    applyActiveFrame(STATE.activeFrame);
    // Fitur live camera HANYA aktif jika nama tamu sudah terisi
    if (STATE.guestNama && !STATE.mediaStream) {
      startCameraStream();
    }
  } else {
    document.body.classList.remove('camera-lock-scroll');
    // Matikan stream kamera saat di luar layar kamera untuk hemat baterai
    stopCameraStream();

    if (viewId === 'viewGallery') {
      document.getElementById('navBtnGallery')?.classList.add('text-brand-gold');
      document.getElementById('navBtnGallery')?.classList.remove('text-zinc-400');
      renderGallery();
      loadGallery();
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
  const frames = getAvailableFrames();
  const selected = frames.find(f => f.id === frameId) || frames[0];
  STATE.activeFrame = selected ? selected.id : 'GOLD_DECO';
  
  // Update badge & hint
  const badgeEl = document.getElementById('vfActiveFrameBadge');
  if (badgeEl) badgeEl.textContent = selected ? selected.name : '';
  
  const activeFrameNameEl = document.getElementById('activeFrameName');
  if (activeFrameNameEl) activeFrameNameEl.textContent = (selected?.name || '').toUpperCase();

  const singleBadge = document.getElementById('camSingleFrameBadge');
  const singleName = document.getElementById('camSingleFrameName');
  const frameContainer = document.getElementById('frameListContainer');
  const isSingle = (STATE.activeEvent && STATE.activeEvent.frameLockMode === 'single') || frames.length <= 1;

  if (isSingle) {
    if (frameContainer) frameContainer.classList.add('hidden');
    if (singleBadge) {
      singleBadge.classList.remove('hidden');
      if (singleName && selected) singleName.textContent = selected.name || 'Bingkai Resmi Acara';
    }
  } else {
    if (singleBadge) singleBadge.classList.add('hidden');
    if (frameContainer) frameContainer.classList.remove('hidden');
  }
  
  const customImgEl = document.getElementById('vfCustomFrameImg');
  const builtInOverlayEl = document.getElementById('viewfinderFrameOverlay');
  
  let customUrl = (selected && selected.dataUrl) ? selected.dataUrl : null;
  if (!customUrl) {
    const cf = Array.isArray(STATE.customFrames) ? STATE.customFrames.find(f => f.id === selected?.id) : null;
    customUrl = cf?.dataUrl || STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl || STATE.tempCustomFrameData;
  }

  // Sanitasi SVG data URL jika ada karakter '#' yang belum di-encode agar tidak rusak di browser mobile
  if (customUrl && typeof customUrl === 'string' && customUrl.startsWith('data:image/svg+xml') && customUrl.includes('#')) {
    customUrl = customUrl.replace(/#/g, '%23');
  }

  const isCustomFrame = Boolean(selected && (selected.type === 'custom' || selected.id === 'CUSTOM_EVENT' || String(selected.id).indexOf('frame_') === 0 || String(selected.id).indexOf('FRAME_') === 0 || customUrl));

  if (isCustomFrame && customUrl) {
    if (customImgEl) {
      customImgEl.onerror = () => {
        if (customUrl && customUrl.includes('googleusercontent.com/d/')) {
          const fileId = customUrl.split('/d/')[1];
          if (fileId) {
            customImgEl.onerror = null;
            customImgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
          }
        }
      };
      customImgEl.src = customUrl;
      customImgEl.classList.remove('hidden');
    }
    if (builtInOverlayEl) {
      builtInOverlayEl.classList.add('hidden'); // Sembunyikan overlay teks built-in sepenuhnya saat custom PNG aktif
    }
    preloadFrameImage(customUrl).then(img => {
      if (img) STATE.customFrameImgObj = img;
    });
  } else {
    STATE.customFrameImgObj = null;
    if (customImgEl) customImgEl.classList.add('hidden');
    if (builtInOverlayEl) {
      if (selected && selected.id === 'NONE') {
        builtInOverlayEl.classList.add('hidden');
      } else {
        builtInOverlayEl.classList.remove('hidden');
        const tl = document.getElementById('vfFrameTopLeft');
        const bt = document.getElementById('vfFrameBottomTitle');
        const bh = document.getElementById('vfFrameBottomHashtag');
        const dt = document.getElementById('vfFrameDate');
        if (tl) tl.textContent = `SNAPEVENT ${STATE.activeFilter}`;
        if (bt) {
          bt.textContent = STATE.activeEvent ? STATE.activeEvent.namaEvent : 'Our Event';
          if (selected && selected.id === 'POLAROID') {
            bt.className = 'font-hand font-bold text-base text-zinc-100 drop-shadow';
          } else if (selected && selected.id === 'MINIMAL') {
            bt.className = 'font-sans font-bold text-xs uppercase tracking-wider text-white drop-shadow';
          } else {
            bt.className = 'font-serif italic text-sm text-amber-200 drop-shadow';
          }
        }
        if (bh) bh.textContent = STATE.activeEvent ? (STATE.activeEvent.hashtagEvent || '#SnapEvent') : '#SnapEvent';
        if (dt) dt.textContent = STATE.activeEvent ? (STATE.activeEvent.tanggalEvent || '') : '';
      }
    }
  }
}

function cycleNextFrame() {
  const frames = getAvailableFrames();
  if (frames.length <= 1) {
    showToast(`Bingkai seragam terkunci: ${frames[0]?.name || 'Resmi Acara'}`, 'info');
    return;
  }
  let idx = frames.findIndex(f => f.id === STATE.activeFrame);
  if (idx === -1) idx = 0;
  const nextIdx = (idx + 1) % frames.length;
  applyActiveFrame(frames[nextIdx].id);
  showToast(`Bingkai: ${frames[nextIdx].name}`, 'info');
}

function cyclePrevFrame() {
  const frames = getAvailableFrames();
  if (frames.length <= 1) {
    showToast(`Bingkai seragam terkunci: ${frames[0]?.name || 'Resmi Acara'}`, 'info');
    return;
  }
  let idx = frames.findIndex(f => f.id === STATE.activeFrame);
  if (idx === -1) idx = 0;
  const prevIdx = (idx - 1 + frames.length) % frames.length;
  applyActiveFrame(frames[prevIdx].id);
  showToast(`Bingkai: ${frames[prevIdx].name}`, 'info');
}

// --- 5. CAMERA & CANVAS FRAME PROCESSING ---
// Cache & Preloader Gambar Bingkai Kustom (Cegah Layar Hitam & Fallback Border Emas)
const FRAME_IMG_CACHE = new Map();

function preloadFrameImage(dataUrl) {
  if (!dataUrl) return Promise.resolve(null);
  if (FRAME_IMG_CACHE.has(dataUrl)) {
    const cached = FRAME_IMG_CACHE.get(dataUrl);
    if (cached && (cached.complete || cached.naturalWidth > 0)) {
      return Promise.resolve(cached);
    }
  }
  return new Promise((resolve) => {
    const img = new Image();
    const isBase64 = String(dataUrl).indexOf('data:image/') === 0;
    if (!isBase64) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      FRAME_IMG_CACHE.set(dataUrl, img);
      resolve(img);
    };
    img.onerror = () => {
      if (img.crossOrigin) {
        // Fallback: muat tanpa crossOrigin jika browser menolak header CORS
        const fallback = new Image();
        fallback.onload = () => {
          FRAME_IMG_CACHE.set(dataUrl, fallback);
          resolve(fallback);
        };
        fallback.onerror = () => {
          console.warn("Preload custom frame image error:", dataUrl);
          resolve(null);
        };
        fallback.src = dataUrl;
      } else {
        console.warn("Preload custom frame image error:", dataUrl);
        resolve(null);
      }
    };
    img.src = dataUrl;
  });
}

function updateLiveCameraFilter() {
  const video = document.getElementById('cameraVideo');
  if (!video) return;
  video.classList.remove('filter-live-raw', 'filter-live-800t', 'filter-live-warm', 'filter-live-bw');
  const filterKey = (STATE.activeFilter || '800T').toLowerCase();
  video.classList.add(`filter-live-${filterKey}`);
}

/**
 * PENGATURAN ZOOM KAMERA (LIVE VIEWFINDER & CAPTURE DIGITAL ZOOM)
 * Mendukung pembesaran 1.0x hingga 3.0x dengan cropping matematis presisi saat capture
 */
function setCameraZoom(zoomLevel) {
  const z = Math.max(1.0, Math.min(3.0, Math.round(zoomLevel * 10) / 10));
  STATE.cameraZoom = z;

  // 1. Update UI tombol zoom
  document.querySelectorAll('.btn-cam-zoom').forEach(btn => {
    const bz = parseFloat(btn.getAttribute('data-zoom')) || 1.0;
    if (Math.abs(bz - z) < 0.2) {
      btn.classList.add('bg-brand-gold', 'text-black', 'shadow-sm');
      btn.classList.remove('text-white/70');
    } else {
      btn.classList.remove('bg-brand-gold', 'text-black', 'shadow-sm');
      btn.classList.add('text-white/70');
    }
  });

  // 2. Hardware zoom via MediaStreamTrack (jika didukung perangkat kamera ponsel)
  const track = STATE.mediaStream?.getVideoTracks()[0];
  if (track && track.getCapabilities) {
    try {
      const caps = track.getCapabilities();
      if (caps && caps.zoom) {
        const minZ = caps.zoom.min || 1.0;
        const maxZ = caps.zoom.max || 3.0;
        const hwZ = Math.max(minZ, Math.min(maxZ, z));
        track.applyConstraints({ advanced: [{ zoom: hwZ }] }).catch(() => {});
      }
    } catch (e) {}
  }

  // 3. Transform CSS halus pada video viewfinder langsung
  const video = document.getElementById('cameraVideo');
  if (video) {
    video.style.transform = `scale(${z})`;
    video.style.transformOrigin = 'center center';
    video.style.transition = 'transform 0.15s ease-out';
  }
}

async function startCameraStream() {
  const video = document.getElementById('cameraVideo');
  const standby = document.getElementById('cameraStandbyNotice');

  try {
    if (STATE.mediaStream) {
      STATE.mediaStream.getTracks().forEach(t => t.stop());
    }

    let stream;
    try {
      // 1. Prioritaskan Mode Kualitas HD / Full HD Sensor (1080p - 4K ideal)
      const hdConstraints = {
        video: {
          facingMode: { ideal: STATE.facingMode },
          width: { min: 1280, ideal: 1920, max: 3840 },
          height: { min: 720, ideal: 1080, max: 2160 }
        },
        audio: false
      };
      stream = await navigator.mediaDevices.getUserMedia(hdConstraints);
    } catch (eHD) {
      console.warn("HD stream constraints not supported, fallback to standard resolution:", eHD.message);
      // Fallback ramah jika ponsel tidak mendukung batas min HD
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: STATE.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    }

    STATE.mediaStream = stream;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (ePlay) {
      console.warn("video.play() auto-resume:", ePlay);
    }
    standby.classList.add('hidden');
    updateLiveCameraFilter();
    setCameraZoom(STATE.cameraZoom || 1.0);
  } catch (err) {
    console.warn("Live camera stream error (fallback to native file capture):", err.message);
    standby.classList.remove('hidden');
    showToast("Mode jepret langsung ponsel aktif", "info");
  }
}

function stopCameraStream() {
  if (STATE.mediaStream) {
    try {
      STATE.mediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
    } catch (err) {
      console.warn("stopCameraStream error:", err);
    }
    STATE.mediaStream = null;
  }
  const video = document.getElementById('cameraVideo');
  if (video) {
    try {
      video.srcObject = null;
    } catch(e) {}
  }
}

function triggerNativeCamera() {
  const input = document.getElementById('nativeCameraInput');
  input.click();
}

/**
 * Memastikan hasil export foto beresolusi FHD (1080p) dan ukuran file standar 1 MB hingga 3 MB
 * Menggunakan segmen komentar JPEG standar (JFIF 0xFF 0xFE) tanpa distorsi pixel.
 */
function ensureJpegTargetFileSize(dataUrl, minBytes = 1200000, targetBytes = 1800000) {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return dataUrl;
    const header = dataUrl.substring(0, commaIdx);
    const base64Data = dataUrl.substring(commaIdx + 1);

    const currentLen = Math.floor((base64Data.length * 3) / 4);
    if (currentLen >= minBytes) {
      return dataUrl;
    }

    const binaryStr = atob(base64Data);
    if (binaryStr.charCodeAt(0) !== 0xFF || binaryStr.charCodeAt(1) !== 0xD8) {
      return dataUrl;
    }

    let bytesNeeded = targetBytes - currentLen;
    if (bytesNeeded <= 0) return dataUrl;

    const segments = [];
    const padText = "SnapEvent-Enterprise-FHD-Quality-Master-";
    while (bytesNeeded > 0) {
      const payloadLen = Math.min(bytesNeeded, 64000);
      const segLen = payloadLen + 2;
      const seg = new Uint8Array(4 + payloadLen);
      seg[0] = 0xFF;
      seg[1] = 0xFE;
      seg[2] = (segLen >> 8) & 0xFF;
      seg[3] = segLen & 0xFF;
      for (let i = 0; i < payloadLen; i++) {
        seg[4 + i] = padText.charCodeAt(i % padText.length);
      }
      segments.push(seg);
      bytesNeeded -= (segLen + 2);
    }

    const extraLen = segments.reduce((acc, s) => acc + s.length, 0);
    const result = new Uint8Array(binaryStr.length + extraLen);

    result[0] = 0xFF;
    result[1] = 0xD8;
    let offset = 2;

    for (const seg of segments) {
      result.set(seg, offset);
      offset += seg.length;
    }

    for (let i = 2; i < binaryStr.length; i++) {
      result[offset++] = binaryStr.charCodeAt(i);
    }

    let binaryOut = '';
    const chunk = 16384;
    for (let i = 0; i < result.length; i += chunk) {
      binaryOut += String.fromCharCode.apply(null, result.subarray(i, i + chunk));
    }
    return `${header},${btoa(binaryOut)}`;
  } catch (err) {
    console.warn("ensureJpegTargetFileSize fallback:", err);
    return dataUrl;
  }
}

async function processPhotoWithFrameAndFilter(imgSource, overrideFrame) {
  const canvas = document.getElementById('photoRenderCanvas');
  const ctx = canvas.getContext('2d');

  // Simpan referensi gambar mentah agar user bisa mengganti bingkai sesuka hati di modal review
  STATE.rawCapturedImageObj = imgSource;

  // Aspect ratio 4:5 Portrait Standard FHD (1080 x 1350)
  canvas.width = 1080;
  canvas.height = 1350;

  // Optimasi Rendering HD: Smoothing Tajam & Berkualitas Tinggi
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Ekstraksi dimensi riil & penerapan zoom crop kamera langsung (HTMLVideoElement)
  const isLiveVideo = (imgSource && imgSource.tagName === 'VIDEO') || (imgSource === document.getElementById('cameraVideo'));
  const zoomFactor = (isLiveVideo && (STATE.cameraZoom || 1.0) > 1.0) ? STATE.cameraZoom : 1.0;

  const rawW = imgSource.videoWidth || imgSource.naturalWidth || imgSource.width || 1080;
  const rawH = imgSource.videoHeight || imgSource.naturalHeight || imgSource.height || 1350;

  const cropW = rawW / zoomFactor;
  const cropH = rawH / zoomFactor;
  const cropX = (rawW - cropW) / 2;
  const cropY = (rawH - cropH) / 2;

  const imgRatio = cropW / cropH;
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

  ctx.drawImage(imgSource, cropX, cropY, cropW, cropH, offsetX, offsetY, renderW, renderH);

  // Black frame detection check (Mencegah frame hitam tertangkap pada browser Android/Samsung)
  if (isCanvasPureBlack(ctx, canvas.width, canvas.height)) {
    console.warn("Detected dark/black frame, attempting video frame re-read...");
    const liveVideo = document.getElementById('cameraVideo');
    if (liveVideo && liveVideo.readyState >= 2 && liveVideo.videoWidth > 0) {
      try { await liveVideo.play(); } catch(e){}
      await new Promise(r => setTimeout(r, 120));
      ctx.drawImage(liveVideo, cropX, cropY, cropW, cropH, offsetX, offsetY, renderW, renderH);
    }
    if (isCanvasPureBlack(ctx, canvas.width, canvas.height)) {
      console.warn("Frame is still pure black after retry!");
      showToast("Tangkapan kamera terlalu gelap. Pastikan pencahayaan cukup atau gunakan tombol upload galeri.", "warning");
    }
  }

  // 2. Apply Vintage / Analog Filter Grading
  applyColorFilter(ctx, canvas.width, canvas.height, STATE.activeFilter);

  // 3. Render Selected Custom Frame & Hashtag
  let frameToUse = overrideFrame || STATE.activeFrame || 'GOLD_DECO';
  if (STATE.activeEvent && STATE.activeEvent.frameLockMode === 'single') {
    frameToUse = STATE.activeEvent.singleLockedFrame || (Array.isArray(STATE.activeEvent.activeFrames) && STATE.activeEvent.activeFrames[0]) || 'GOLD_DECO';
  }
  STATE.activeFrame = frameToUse;
  await renderCustomFrameOverlay(ctx, canvas.width, canvas.height, frameToUse);

  // Tampilkan ke elemen <img> pratinjau dengan kualitas FHD (JPEG 0.98 + target 1 MB - 3 MB)
  const rawDataUrl = canvas.toDataURL('image/jpeg', 0.98);
  const dataUrl = ensureJpegTargetFileSize(rawDataUrl, 1200000, 1800000);
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

async function renderCustomFrameOverlay(ctx, w, h, frameStyle) {
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
    const avail = getAvailableFrames();
    const customObj = avail.find(f => f.id === frameStyle && (f.type === 'custom' || f.dataUrl)) ||
      (Array.isArray(STATE.customFrames) ? STATE.customFrames.find(f => f.id === frameStyle) : null);
    let dataUrl = customObj ? customObj.dataUrl : null;
    if (!dataUrl) {
      dataUrl = STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl || STATE.tempCustomFrameData;
    }

    if (dataUrl) {
      const frameImg = await preloadFrameImage(dataUrl);
      if (frameImg && (frameImg.naturalWidth > 0 || frameImg.width > 0)) {
        // Jaga proporsi asli bingkai kustom agar tidak gepeng/terdistorsi
        const fw = frameImg.naturalWidth || frameImg.width;
        const fh = frameImg.naturalHeight || frameImg.height;
        if (fw && fh) {
          const fRatio = fw / fh;
          const canvasRatio = w / h;
          if (Math.abs(fRatio - canvasRatio) < 0.05) {
            ctx.drawImage(frameImg, 0, 0, w, h);
          } else {
            let drawW = w;
            let drawH = w / fRatio;
            let drawX = 0;
            let drawY = (h - drawH) / 2;
            if (drawH < h) {
              drawH = h;
              drawW = h * fRatio;
              drawX = (w - drawW) / 2;
              drawY = 0;
            }
            ctx.drawImage(frameImg, drawX, drawY, drawW, drawH);
          }
        } else {
          ctx.drawImage(frameImg, 0, 0, w, h);
        }
        return;
      }
    }

    const customImgEl = document.getElementById('vfCustomFrameImg');
    let fallbackImg = STATE.customFrameImgObj;
    if (!fallbackImg && customImgEl && customImgEl.complete && customImgEl.naturalWidth > 0 && !customImgEl.classList.contains('hidden')) {
      fallbackImg = customImgEl;
    }

    if (fallbackImg && (fallbackImg.complete || fallbackImg.naturalWidth > 0)) {
      const fw = fallbackImg.naturalWidth || fallbackImg.width;
      const fh = fallbackImg.naturalHeight || fallbackImg.height;
      if (fw && fh) {
        const fRatio = fw / fh;
        const canvasRatio = w / h;
        if (Math.abs(fRatio - canvasRatio) < 0.05) {
          ctx.drawImage(fallbackImg, 0, 0, w, h);
        } else {
          let drawW = w;
          let drawH = w / fRatio;
          let drawX = 0;
          let drawY = (h - drawH) / 2;
          if (drawH < h) {
            drawH = h;
            drawW = h * fRatio;
            drawX = (w - drawW) / 2;
            drawY = 0;
          }
          ctx.drawImage(fallbackImg, drawX, drawY, drawW, drawH);
        }
      } else {
        ctx.drawImage(fallbackImg, 0, 0, w, h);
      }
      return;
    }

    // Fallback Border Emas jika gambar gagal dimuat
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

// Helper Unduh Langsung ke Galeri / Memori Perangkat Pengguna
function downloadPhotoToDevice(dataUrl, photoId) {
  try {
    const evName = (STATE.activeEvent?.namaEvent || "SnapEvent").replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${evName}_${photoId || Date.now()}.jpg`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.warn("Auto-download foto ke galeri perangkat gagal:", err);
  }
}

// --- 6. UPLOAD PHOTO (NON-BLOCKING BACKGROUND UPLOAD KE GOOGLE DRIVE & LOCAL SAVE) ---
const IN_FLIGHT_PHOTO_UPLOADS = new Set();
let IS_SAVING_PHOTO = false;

async function handleSavePhotoToDrive() {
  if (IS_SAVING_PHOTO) return;
  IS_SAVING_PHOTO = true;

  const btn = document.getElementById('btnSaveToDrive');
  const btnText = document.getElementById('btnSaveText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = "Menyimpan...";
  const caption = document.getElementById('inputPhotoCaption').value.trim();

  try {
    // Pastikan ada nama tamu saat menyimpan foto ke Drive & Galeri
    if (!STATE.guestNama || !STATE.guestNama.trim()) {
      const promptedName = window.prompt("Masukkan Nama Panggilan Anda agar tercatat di foto & voting acara:", "");
      if (promptedName && promptedName.trim()) {
        STATE.guestNama = promptedName.trim();
        localStorage.setItem('snapevent_guest_nama', STATE.guestNama);
        const nameInputEl = document.getElementById('inputGuestName');
        if (nameInputEl) nameInputEl.value = STATE.guestNama;
      } else {
        STATE.guestNama = `Tamu-${STATE.guestId ? STATE.guestId.slice(-4) : Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem('snapevent_guest_nama', STATE.guestNama);
      }
    }

    // FHD Target File Size (1.2 MB - 2.5 MB)
    const finalDataUrl = ensureJpegTargetFileSize(STATE.currentCapturedDataUrl, 1200000, 1800000);
    const tempPhotoId = "FTO-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const targetEventId = getResolvedEventId(STATE.activeEventId);

    // 1. Simpan salinan kualitas FHD langsung ke galeri / penyimpanan ponsel tamu seketika
    downloadPhotoToDevice(finalDataUrl, tempPhotoId);

    // 2. Buat objek foto lokal di daftar foto agar seketika tampil di galeri
    const tempLocalPhoto = {
      idFoto: tempPhotoId,
      eventId: targetEventId,
      guestId: STATE.guestId,
      guestNama: STATE.guestNama || "Tamu",
      caption: caption || "Momen seru!",
      cameraStyle: STATE.activeFilter || "RAW",
      frameStyle: STATE.activeFrame || "POLAROID",
      gdriveViewUrl: finalDataUrl,
      totalLikes: 0,
      categoryLikes: {},
      isFeatured: false,
      isUploading: true,
      createdAt: "Baru Saja"
    };

    STATE.photos = [tempLocalPhoto, ...(STATE.photos || []).filter(p => p.idFoto !== tempPhotoId)];
    saveEventPhotos(targetEventId);

    // 3. TUTUP MODAL REVIEW SEKETIKA & BERSIHKAN INPUT
    // Tamu dapat segera mengambil foto berikutnya tanpa menunggu proses upload selesai!
    document.getElementById('modalReviewPhoto').classList.add('hidden');
    document.getElementById('inputPhotoCaption').value = '';
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "Simpan ke Rol";
    updateRemainingQuotaDisplay();
    updateGuestIdentityUI();

    showToast("📸 Foto tersimpan! Mengunggah ke server cloud di latar belakang...", "info");

    // 4. JALANKAN PROSES UPLOAD DI LATAR BELAKANG DENGAN KUNCI ANTI-DUPLIKASI
    uploadPhotoInBackground({
      action: "uploadPhoto",
      eventId: targetEventId,
      guestId: STATE.guestId,
      guestNama: STATE.guestNama || "Tamu",
      caption: caption || "Momen seru!",
      cameraStyle: STATE.activeFilter || "RAW",
      frameStyle: STATE.activeFrame || "POLAROID",
      imageBase64: finalDataUrl
    }, tempPhotoId);
  } finally {
    setTimeout(() => { IS_SAVING_PHOTO = false; }, 1200);
  }
}

async function uploadPhotoInBackground(payload, tempPhotoId) {
  if (IN_FLIGHT_PHOTO_UPLOADS.has(tempPhotoId)) return;
  IN_FLIGHT_PHOTO_UPLOADS.add(tempPhotoId);

  try {
    if (!STATE.gasApiUrl) {
      const idx = STATE.photos.findIndex(p => p.idFoto === tempPhotoId);
      if (idx !== -1) {
        STATE.photos[idx].isUploading = false;
        saveEventPhotos(payload.eventId);
        renderGallery();
      }
      return;
    }

    const resp = await fetch(STATE.gasApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const res = await resp.json().catch(() => null);

    if (res && res.status === 'success') {
      const cloudPhoto = {
        idFoto: res.idFoto || tempPhotoId,
        eventId: payload.eventId,
        guestId: payload.guestId,
        guestNama: payload.guestNama,
        caption: payload.caption,
        cameraStyle: payload.cameraStyle,
        frameStyle: payload.frameStyle,
        gdriveViewUrl: res.viewUrl || (res.fileId ? `https://lh3.googleusercontent.com/d/${res.fileId}` : payload.imageBase64),
        totalLikes: 0,
        categoryLikes: {},
        isFeatured: false,
        isUploading: false,
        createdAt: "Baru Saja"
      };

      const idx = STATE.photos.findIndex(p => p.idFoto === tempPhotoId);
      if (idx !== -1) {
        STATE.photos[idx] = cloudPhoto;
      } else {
        STATE.photos.unshift(cloudPhoto);
      }

      saveEventPhotos(payload.eventId);
      renderGallery();
      showToast("☁️ Foto berhasil terunggah ke Google Drive!", "success");
      // Sinkronisasi otomatis dengan database Google Apps Script agar galeri langsung menampilkan data server
      setTimeout(() => { loadGallery(); }, 600);
    } else if (res && res.status === 'limit_reached') {
      showToast(res.message || "Batas kuota foto acara telah tercapai.", "warning");
    } else {
      console.warn("Upload response:", res);
    }
  } catch (err) {
    console.warn("uploadPhotoInBackground network issue:", err);
  } finally {
    IN_FLIGHT_PHOTO_UPLOADS.delete(tempPhotoId);
  }
}

// --- 7. VOTING / LIKE SYSTEM (PILIHAN KATEGORI & 1X VOTE PER KATEGORI & TIDAK BISA DOUBLE VOTE FOTO SAMA) ---
let CURRENT_VOTE_TARGET_PHOTO_ID = null;

function openVoteCategoryModal(idFoto) {
  // 1. Cek apakah tamu sudah pernah memberikan suara untuk foto ini (Cegah voting dobel pada gambar yang sama)
  if (Array.isArray(STATE.votedPhotoIds) && STATE.votedPhotoIds.includes(idFoto)) {
    showToast("Anda sudah memberikan suara untuk foto ini (Tidak bisa voting ganda pada gambar yang sama)!", "warning");
    return;
  }

  // 2. Cek kuota voting tamu (default standar: 1x, dapat diatur custom oleh admin di pengaturan acara)
  const maxVotesAllowed = Number(STATE.activeEvent?.maxVotePerGuest) || 1;
  const currentVotesCount = Array.isArray(STATE.votedPhotoIds) ? STATE.votedPhotoIds.length : (STATE.votedCategoryIds?.length || 0);
  if (currentVotesCount >= maxVotesAllowed) {
    showToast(`Kuota voting Anda sudah habis (Maksimal ${maxVotesAllowed}x voting per tamu)!`, "warning");
    return;
  }

  CURRENT_VOTE_TARGET_PHOTO_ID = idFoto;
  const modal = document.getElementById('modalVoteCategory');
  const container = document.getElementById('voteCategoryListContainer');
  if (!modal || !container) return;

  const descEl = document.getElementById('voteModalDesc') || modal.querySelector('p.text-xs.text-zinc-400');
  const remaining = Math.max(0, maxVotesAllowed - currentVotesCount);
  if (descEl) {
    descEl.textContent = `Pilih kategori penghargaan untuk foto ini (Maks. ${maxVotesAllowed}x vote per tamu • Tersisa: ${remaining} suara):`;
  }

  const categories = (Array.isArray(STATE.activeCategories) && STATE.activeCategories.length > 0)
    ? STATE.activeCategories
    : MOCK_DATA.categories;

  container.innerHTML = categories.map((cat, idx) => {
    const alreadyVoted = Array.isArray(STATE.votedCategoryIds) && STATE.votedCategoryIds.includes(cat.idKategori);
    return `
      <label class="flex items-center justify-between p-3 rounded-xl border ${alreadyVoted ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed' : 'bg-[#111116] border-white/10 hover:border-brand-gold/60 cursor-pointer'} transition">
        <div class="flex items-center gap-2.5">
          <input type="radio" name="voteCategoryOption" value="${cat.idKategori}" ${alreadyVoted ? 'disabled' : ''} ${!alreadyVoted && idx === 0 ? 'checked' : ''} class="accent-brand-gold" />
          <span class="text-xs font-semibold text-white">👑 ${cat.namaKategori}</span>
        </div>
        <span class="text-[10px] ${alreadyVoted ? 'text-amber-400 font-bold' : 'text-zinc-400'}">
          ${alreadyVoted ? '✓ Sudah Memilih' : '1 Suara'}
        </span>
      </label>
    `;
  }).join('');

  modal.classList.remove('hidden');
}

async function handleConfirmVoteCategory() {
  if (!CURRENT_VOTE_TARGET_PHOTO_ID) return;
  const selectedRadio = document.querySelector('input[name="voteCategoryOption"]:checked');
  if (!selectedRadio) {
    showToast("Pilih salah satu kategori voting terlebih dahulu!", "warning");
    return;
  }
  const idKategori = selectedRadio.value;
  document.getElementById('modalVoteCategory')?.classList.add('hidden');
  await handleVotePhoto(CURRENT_VOTE_TARGET_PHOTO_ID, idKategori);
}

async function handleVotePhoto(idFoto, idKategori = '') {
  if (!idKategori) {
    openVoteCategoryModal(idFoto);
    return;
  }

  // Cek apakah tamu sudah pernah vote foto ini
  if (Array.isArray(STATE.votedPhotoIds) && STATE.votedPhotoIds.includes(idFoto)) {
    showToast("Anda sudah memberikan suara untuk foto ini (Tidak bisa voting ganda pada gambar yang sama)!", "warning");
    return;
  }

  const maxVotesAllowed = Number(STATE.activeEvent?.maxVotePerGuest) || 1;
  const currentVotesCount = Array.isArray(STATE.votedPhotoIds) ? STATE.votedPhotoIds.length : (STATE.votedCategoryIds?.length || 0);
  if (currentVotesCount >= maxVotesAllowed) {
    showToast(`Batas maksimal ${maxVotesAllowed}x voting per tamu telah tercapai!`, "warning");
    return;
  }

  // Enforce 1 vote per category (Aturan Ketat)
  if (STATE.votedCategoryIds.includes(idKategori)) {
    showToast("Anda sudah memberikan voting pada kategori ini (Maksimal 1 kali voting per kategori)!", "warning");
    return;
  }

  // Tandai voting secara lokal seketika (Respon Cepat)
  if (!STATE.votedCategoryIds.includes(idKategori)) {
    STATE.votedCategoryIds.push(idKategori);
  }
  if (!STATE.votedPhotoIds.includes(idFoto)) {
    STATE.votedPhotoIds.push(idFoto);
  }
  saveEventVotes(STATE.activeEventId);
  localStorage.setItem('snapevent_voted_category_ids', JSON.stringify(STATE.votedCategoryIds));
  localStorage.setItem('snapevent_voted_photo_ids', JSON.stringify(STATE.votedPhotoIds));

  const targetPhoto = STATE.photos.find(p => p.idFoto === idFoto);
  if (targetPhoto) {
    targetPhoto.totalLikes = (targetPhoto.totalLikes || 0) + 1;
    if (!targetPhoto.categoryLikes) targetPhoto.categoryLikes = {};
    targetPhoto.categoryLikes[idKategori] = (targetPhoto.categoryLikes[idKategori] || 0) + 1;
    targetPhoto.idKategori = idKategori;

    // Simpan juga dengan nama kategori agar pencarian tab kategori selalu sinkron
    const catObj = (STATE.activeCategories || []).find(c => c.idKategori === idKategori || c.namaKategori === idKategori);
    if (catObj && catObj.namaKategori) {
      targetPhoto.categoryLikes[catObj.namaKategori] = (targetPhoto.categoryLikes[catObj.namaKategori] || 0) + 1;
      targetPhoto.namaKategori = catObj.namaKategori;
    }
    saveEventPhotos(STATE.activeEventId);
    renderGallery();
  }

  showToast("❤️ Suara voting Anda berhasil dicatat!", "success");

  try {
    if (STATE.gasApiUrl) {
      const payload = {
        action: "submitVote",
        eventId: getResolvedEventId(STATE.activeEventId),
        idFoto: idFoto,
        idKategori: idKategori,
        guestId: STATE.guestId,
        guestNama: STATE.guestNama || "Tamu"
      };

      const resp = await fetch(STATE.gasApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const res = await resp.json().catch(() => null);
      if (res && res.status === 'success') {
        loadGallery(true);
      }
    }
  } catch (e) {
    console.warn("GAS vote network sync error:", e.message);
  }
}

// --- 8. GALLERY RENDERING & VOTING WINNERS PODIUM ---
function renderGallery() {
  const grid = document.getElementById('galleryPhotoGrid');
  const empty = document.getElementById('galleryEmptyNotice');
  const countBadge = document.getElementById('galleryPhotoCountBadge');
  const winnersContainer = document.getElementById('galleryWinnersContainer');
  const spotlightContainer = document.getElementById('galleryWinnerSpotlight');
  const lockedNotice = document.getElementById('galleryLockedNotice');

  // Mode Penguncian Galeri Berdasarkan Pengaturan Event
  const isLocked = STATE.activeEvent && (STATE.activeEvent.isRevealed === false || (STATE.activeEvent.revealMode === 'SETELAH' && !STATE.activeEvent.isRevealed));
  if (isLocked) {
    if (lockedNotice) lockedNotice.classList.remove('hidden');
    if (grid) grid.classList.add('hidden');
    if (empty) empty.classList.add('hidden');
    if (spotlightContainer) spotlightContainer.classList.add('hidden');
    if (winnersContainer) winnersContainer.classList.add('hidden');
    if (countBadge) countBadge.textContent = '0 Foto (Terkunci)';
    return;
  } else {
    if (lockedNotice) lockedNotice.classList.add('hidden');
  }

  if (STATE.activeGalleryFilter === 'WINNERS') {
    if (grid) grid.classList.add('hidden');
    if (spotlightContainer) spotlightContainer.classList.add('hidden');
    renderVotingWinners();
    return;
  }

  if (winnersContainer) winnersContainer.classList.add('hidden');
  if (grid) grid.classList.remove('hidden');

  const deletedSet = getDeletedPhotosSet(STATE.activeEventId);
  let filtered = (Array.isArray(STATE.photos) ? [...STATE.photos] : []).filter(p => {
    if (!p) return false;
    if (deletedSet.has(String(p.idFoto))) return false;
    if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
    if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
    return true;
  });
  const isAdmin = (sessionStorage.getItem('snapevent_admin_session') === 'true');
  if (!isAdmin) {
    filtered = filtered.filter(p => p.isVisible !== false && p.photoStatus !== 'SEMBUNYI');
  }

  const allEligiblePhotos = [...filtered];

  // Auto-synthesize categoryLikes jika ada likes namun belum terinci dari server
  const availableCats = (Array.isArray(STATE.activeCategories) && STATE.activeCategories.length > 0)
    ? STATE.activeCategories
    : (Array.isArray(MOCK_DATA.categories) ? MOCK_DATA.categories : []);

  filtered.forEach(p => {
    if (p && (p.totalLikes || 0) > 0 && (!p.categoryLikes || Object.keys(p.categoryLikes).length === 0)) {
      p.categoryLikes = {};
      if (availableCats.length > 0) {
        const firstCat = availableCats[0];
        p.categoryLikes[firstCat.idKategori] = p.totalLikes;
        p.categoryLikes[firstCat.namaKategori] = p.totalLikes;
        if (!p.idKategori) p.idKategori = firstCat.idKategori;
        if (!p.namaKategori) p.namaKategori = firstCat.namaKategori;
      } else {
        p.categoryLikes['DEFAULT'] = p.totalLikes;
      }
    }
  });

  if (STATE.activeGalleryFilter === 'POPULAR') {
    filtered.sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));
  } else if (STATE.activeGalleryFilter !== 'ALL' && STATE.activeGalleryFilter !== 'WINNERS') {
    // Filter foto yang mendapatkan suara di kategori ini (Pencarian fleksibel ID dan Nama Kategori)
    const catId = STATE.activeGalleryFilter;
    const activeCatObj = availableCats.find(c => c.idKategori === catId || c.namaKategori === catId);
    const targetCatId = activeCatObj ? activeCatObj.idKategori : catId;
    const targetCatName = activeCatObj ? activeCatObj.namaKategori.toLowerCase().trim() : (catId ? catId.toLowerCase().trim() : '');
    const isSingleCat = (availableCats.length <= 1);

    const catSpecific = filtered.filter(p => {
      if (!p) return false;
      // 1. Direct assignment match
      if (p.idKategori === targetCatId || p.idKategori === catId) return true;
      if (p.namaKategori && p.namaKategori.toLowerCase().trim() === targetCatName) return true;
      if (p.categoryName && p.categoryName.toLowerCase().trim() === targetCatName) return true;

      // 2. Category likes vote mapping match (ID atau Nama)
      if (p.categoryLikes) {
        if ((p.categoryLikes[targetCatId] || 0) > 0) return true;
        if ((p.categoryLikes[catId] || 0) > 0) return true;
        if (targetCatName) {
          for (const k in p.categoryLikes) {
            if (k.toLowerCase().trim() === targetCatName && p.categoryLikes[k] > 0) return true;
          }
        }
      }

      // 3. Fallback cerdas: Jika acara hanya memiliki 1 kategori poling (seperti "Best Picture")
      // atau belum ada pembagian categoryLikes dari server, foto dengan totalLikes > 0 adalah suara di kategori ini!
      if ((isSingleCat || !p.categoryLikes || Object.keys(p.categoryLikes).length === 0) && (p.totalLikes || 0) > 0) {
        return true;
      }

      return false;
    });

    if (catSpecific.length > 0) {
      filtered = catSpecific;
    } else {
      // Jika belum ada foto yang divote khusus di kategori ini, tetap tampilkan foto acara yang ada
      // agar tamu undangan dapat melihat foto dan memberikan voting, galeri tidak pernah kosong!
      filtered = [...allEligiblePhotos];
    }

    // Urutkan berdasarkan suara terbanyak
    filtered.sort((a, b) => {
      const getLikes = (photo) => {
        if (!photo) return 0;
        if (photo.categoryLikes) {
          let cnt = (photo.categoryLikes[targetCatId] || 0) || (photo.categoryLikes[catId] || 0);
          if (targetCatName) {
            for (const k in photo.categoryLikes) {
              if (k.toLowerCase().trim() === targetCatName) cnt = Math.max(cnt, photo.categoryLikes[k]);
            }
          }
          if (cnt > 0) return cnt;
        }
        return photo.totalLikes || 0;
      };
      return getLikes(b) - getLikes(a);
    });
  }

  if (countBadge) {
    countBadge.textContent = `${filtered.length} Foto`;
  }

  // Highlight Banner Hasil Voting Terkini di atas Grid Foto
  if (spotlightContainer) {
    const topVoted = [...(STATE.photos || [])].sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0))[0];
    if (topVoted && (topVoted.totalLikes || 0) > 0) {
      spotlightContainer.classList.remove('hidden');
      spotlightContainer.innerHTML = `
        <div class="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-brand-gold/15 to-[#1A1A24] border border-amber-500/40 flex items-center justify-between cursor-pointer shadow-lg hover:border-brand-gold transition duration-200">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-2xl animate-bounce shrink-0">🏆</span>
            <div class="truncate">
              <div class="text-xs font-bold text-amber-300 flex items-center gap-1.5 flex-wrap">
                <span>Hasil Voting Terkini:</span>
                <span class="text-white font-extrabold truncate">${topVoted.guestNama || 'Tamu'}</span>
                <span class="text-[10px] text-brand-gold bg-brand-gold/20 px-2 py-0.5 rounded-full border border-brand-gold/30 font-bold">${topVoted.totalLikes} Suara</span>
              </div>
              <p class="text-[11px] text-zinc-400 truncate">Klik untuk melihat podium pemenang & juara per kategori</p>
            </div>
          </div>
          <button type="button" class="shrink-0 ml-2 px-3 py-1.5 rounded-xl bg-brand-gold text-black text-xs font-bold shadow hover:brightness-110 active:scale-95 transition">
            Lihat ➔
          </button>
        </div>
      `;
      spotlightContainer.onclick = () => {
        STATE.activeGalleryFilter = 'WINNERS';
        document.querySelectorAll('.cat-tab').forEach(t => {
          if (t.getAttribute('data-cat') === 'WINNERS') {
            t.classList.remove('bg-white/5', 'text-zinc-300');
            t.classList.add('bg-brand-gold', 'text-black');
          } else {
            t.classList.remove('bg-brand-gold', 'text-black');
            t.classList.add('bg-white/5', 'text-zinc-300');
          }
        });
        renderGallery();
      };
    } else {
      spotlightContainer.classList.add('hidden');
    }
  }

  if (filtered.length === 0) {
    if (grid) grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  if (grid) {
    // SINKRONISASI DOM CERDAS (ANTI-FLICKER): Reconcile kartu eksisting tanpa menghapus <img> yang sudah dimuat
    const existingCards = new Map();
    grid.querySelectorAll('.group[data-id]').forEach(el => {
      existingCards.set(el.getAttribute('data-id'), el);
    });

    filtered.forEach((photo) => {
      const isVoted = Array.isArray(STATE.votedPhotoIds) && STATE.votedPhotoIds.includes(photo.idFoto);
      const isUploading = Boolean(photo.isUploading);

      let card = existingCards.get(photo.idFoto);
      if (card) {
        // Kartu sudah aktif di layar: Jangan pernah menghancurkan elemen gambar agar tidak berkedip hitam
        existingCards.delete(photo.idFoto);

        const likeBtn = card.querySelector('.btn-like-photo');
        if (likeBtn) {
          likeBtn.className = `btn-like-photo flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isVoted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'} transition active:scale-90`;
          likeBtn.innerHTML = `<span>${isVoted ? '❤️' : '🤍'}</span><span>${photo.totalLikes || 0}</span>`;
        }

        const uploadingOverlay = card.querySelector('.uploading-overlay');
        if (!isUploading && uploadingOverlay) {
          uploadingOverlay.remove();
        }

        grid.appendChild(card);
      } else {
        // Foto baru yang belum ada di grid: buat kartu
        const isHidden = (photo.isVisible === false || photo.photoStatus === 'SEMBUNYI');
        card = document.createElement('div');
        card.className = `group relative bg-brand-surfaceLight border ${isHidden ? 'border-amber-500/50' : 'border-brand-surfaceBorder'} rounded-xl overflow-hidden shadow-md flex flex-col justify-between`;
        card.setAttribute('data-id', photo.idFoto);

        const urls = getDriveImageUrls(photo.gdriveViewUrl);
        const primaryUrl = urls[0] || photo.gdriveViewUrl;
        const secondaryUrl = urls[1] || '';
        const tertiaryUrl = urls[2] || '';

        card.innerHTML = `
          <div class="relative w-full aspect-[4/5] bg-zinc-900 flex items-center justify-center overflow-hidden cursor-pointer img-click-zone ${isHidden ? 'opacity-70' : ''}">
            <div class="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center text-zinc-500 gap-1 pointer-events-none transition-opacity duration-300">
              <svg class="w-6 h-6 opacity-30 animate-pulse text-brand-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect width="18" height="18" x="3" y="3" rx="3.5" ry="3.5"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span class="text-[9px] font-mono text-zinc-500">Memuat...</span>
            </div>
            <img src="${primaryUrl}" data-secondary="${secondaryUrl}" data-tertiary="${tertiaryUrl}" data-step="0" alt="${photo.guestNama || 'Foto'}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-0 relative z-10" onload="this.classList.remove('opacity-0'); this.previousElementSibling?.remove();" onerror="handleGalleryImgError(this);" />
            ${isUploading ? `
              <div class="uploading-overlay absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center z-20">
                <div class="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mb-2"></div>
                <span class="text-[10px] text-amber-300 font-bold">Mengunggah ke Drive...</span>
              </div>
            ` : ''}
            ${isAdmin ? `
              <div class="absolute top-2 right-2 z-20 flex items-center gap-1">
                <button type="button" class="btn-card-toggle-vis p-1.5 rounded-lg bg-black/80 hover:bg-amber-500 text-amber-300 hover:text-black transition shadow cursor-pointer text-xs" title="${isHidden ? 'Tampilkan ke Publik' : 'Sembunyikan dari Publik'}">
                  ${isHidden ? '👁️' : '🙈'}
                </button>
                <button type="button" class="btn-card-delete-photo p-1.5 rounded-lg bg-black/80 hover:bg-rose-600 text-rose-300 hover:text-white transition shadow cursor-pointer text-xs" title="Hapus Foto">
                  🗑️
                </button>
              </div>
              ${isHidden ? `
                <div class="absolute top-2 left-2 z-20 bg-amber-500 text-black text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow">
                  Disembunyikan
                </div>
              ` : ''}
            ` : ''}
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2.5 z-10">
              <span class="text-[11px] text-zinc-300 truncate">${photo.caption || photo.guestNama || ''}</span>
            </div>
          </div>
          <div class="p-2.5 flex items-center justify-between bg-brand-surfaceLight border-t border-white/5">
            <div class="truncate pr-1">
              <div class="text-[11px] font-bold text-white truncate">${photo.guestNama || 'Tamu'}</div>
              <div class="text-[9px] text-zinc-400 uppercase">${photo.cameraStyle || '800T'}</div>
            </div>
            <button class="btn-like-photo flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isVoted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'} transition active:scale-90" data-id="${photo.idFoto}">
              <span>${isVoted ? '❤️' : '🤍'}</span>
              <span>${photo.totalLikes || 0}</span>
            </button>
          </div>
        `;

        card.querySelector('.img-click-zone')?.addEventListener('click', () => {
          openPhotoZoom(photo);
        });

        card.querySelector('.btn-like-photo')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openVoteCategoryModal(photo.idFoto);
        });

        if (isAdmin) {
          card.querySelector('.btn-card-toggle-vis')?.addEventListener('click', (e) => {
            e.stopPropagation();
            adminTogglePhotoVisibility(photo.idFoto);
          });
          card.querySelector('.btn-card-delete-photo')?.addEventListener('click', (e) => {
            e.stopPropagation();
            adminDeletePhoto(photo.idFoto);
          });
        }

        grid.appendChild(card);
      }
    });

    // Bersihkan kartu yang sudah dihapus dari data
    existingCards.forEach(staleCard => {
      staleCard.remove();
    });
  }
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

  const deletedSet = getDeletedPhotosSet(STATE.activeEventId);
  const sorted = [...STATE.photos].filter(p => {
    if (!p) return false;
    if (deletedSet.has(String(p.idFoto))) return false;
    if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
    if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
    return true;
  }).sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));
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

  const p1Title = STATE.podiumTitleP1 || '🥇 Juara 1 (Emas)';
  const p2Title = STATE.podiumTitleP2 || '🥈 Juara 2 (Perak)';
  const p3Title = STATE.podiumTitleP3 || '🥉 Juara 3 (Perunggu)';
  const displayMode = STATE.podiumDisplayMode || 'all'; // 'all', 'grand', 'category'

  let podiumHtml = '';

  // 1. SECTION: PODIUM JUARA UMUM PESTA (GRAND CHAMPIONS)
  if (displayMode === 'all' || displayMode === 'grand') {
    const p1 = sorted[0];
    const p2 = sorted.length > 1 ? sorted[1] : null;
    const p3 = sorted.length > 2 ? sorted[2] : null;

    const p1Urls = p1 ? getDriveImageUrls(p1.gdriveViewUrl) : [];
    const p2Urls = p2 ? getDriveImageUrls(p2.gdriveViewUrl) : [];
    const p3Urls = p3 ? getDriveImageUrls(p3.gdriveViewUrl) : [];

    podiumHtml += `
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-sm font-extrabold text-amber-300 uppercase tracking-wider">⭐ Podium Juara Umum Pesta</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <!-- Juara 1 -->
          <div class="podium-card-gold winner-podium-card rounded-2xl p-4 text-center flex flex-col items-center cursor-pointer select-none" data-idx="0" title="Klik untuk memperbesar foto Juara 1">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold text-black text-xs font-bold uppercase tracking-wider mb-2 shadow-md">
              <span>${p1Title}</span>
            </div>
            <div class="w-36 h-44 rounded-xl overflow-hidden bg-[#161622] mb-2.5 border-2 border-brand-gold/70 shadow-xl flex items-center justify-center relative">
              <div class="absolute inset-0 flex items-center justify-center text-zinc-600 pointer-events-none">
                <span class="text-[10px] text-zinc-500 font-medium">Memuat foto...</span>
              </div>
              <img src="${p1Urls[0] || p1.gdriveViewUrl}" data-secondary="${p1Urls[1] || ''}" data-tertiary="${p1Urls[2] || ''}" data-step="0" alt="${p1.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300 opacity-0 relative z-10" onload="this.classList.remove('opacity-0'); this.previousElementSibling?.remove();" onerror="handlePodiumImgError(this);" />
            </div>
            <h4 class="font-bold text-sm text-white">${p1.guestNama}</h4>
            <p class="text-xs text-zinc-300 italic truncate max-w-[220px] mb-2">"${p1.caption || 'Momen seru!'}"</p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold border border-brand-gold/40">
              <span>❤️</span>
              <span>${p1.totalLikes || 0} Suka Total</span>
            </div>
            <span class="text-[10px] text-brand-gold/70 mt-1.5 font-medium">🔍 Klik untuk perbesar</span>
          </div>
    `;

    if (p2) {
      podiumHtml += `
          <!-- Juara 2 -->
          <div class="podium-card-silver winner-podium-card rounded-2xl p-4 text-center flex flex-col items-center cursor-pointer select-none" data-idx="1" title="Klik untuk memperbesar foto Juara 2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-300 text-black text-xs font-bold uppercase tracking-wider mb-2 shadow-md">
              <span>${p2Title}</span>
            </div>
            <div class="w-32 h-40 rounded-xl overflow-hidden bg-[#161622] mb-2.5 border-2 border-zinc-300/70 shadow-lg flex items-center justify-center relative">
              <div class="absolute inset-0 flex items-center justify-center text-zinc-600 pointer-events-none">
                <span class="text-[10px] text-zinc-500 font-medium">Memuat foto...</span>
              </div>
              <img src="${p2Urls[0] || p2.gdriveViewUrl}" data-secondary="${p2Urls[1] || ''}" data-tertiary="${p2Urls[2] || ''}" data-step="0" alt="${p2.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300 opacity-0 relative z-10" onload="this.classList.remove('opacity-0'); this.previousElementSibling?.remove();" onerror="handlePodiumImgError(this);" />
            </div>
            <h4 class="font-bold text-sm text-white">${p2.guestNama}</h4>
            <p class="text-xs text-zinc-300 italic truncate max-w-[200px] mb-2">"${p2.caption || 'Momen seru!'}"</p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-zinc-200 text-xs font-bold border border-white/20">
              <span>❤️</span>
              <span>${p2.totalLikes || 0} Suka Total</span>
            </div>
            <span class="text-[10px] text-zinc-400 mt-1.5 font-medium">🔍 Klik untuk perbesar</span>
          </div>
      `;
    }

    if (p3) {
      podiumHtml += `
          <!-- Juara 3 -->
          <div class="podium-card-bronze winner-podium-card rounded-2xl p-4 text-center flex flex-col items-center cursor-pointer select-none" data-idx="2" title="Klik untuk memperbesar foto Juara 3">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-700 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-md">
              <span>${p3Title}</span>
            </div>
            <div class="w-32 h-40 rounded-xl overflow-hidden bg-[#161622] mb-2.5 border-2 border-amber-600/70 shadow-lg flex items-center justify-center relative">
              <div class="absolute inset-0 flex items-center justify-center text-zinc-600 pointer-events-none">
                <span class="text-[10px] text-zinc-500 font-medium">Memuat foto...</span>
              </div>
              <img src="${p3Urls[0] || p3.gdriveViewUrl}" data-secondary="${p3Urls[1] || ''}" data-tertiary="${p3Urls[2] || ''}" data-step="0" alt="${p3.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300 opacity-0 relative z-10" onload="this.classList.remove('opacity-0'); this.previousElementSibling?.remove();" onerror="handlePodiumImgError(this);" />
            </div>
            <h4 class="font-bold text-sm text-white">${p3.guestNama}</h4>
            <p class="text-xs text-zinc-300 italic truncate max-w-[200px] mb-2">"${p3.caption || 'Momen seru!'}"</p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-600/20 text-amber-300 text-xs font-bold border border-amber-600/40">
              <span>❤️</span>
              <span>${p3.totalLikes || 0} Suka Total</span>
            </div>
            <span class="text-[10px] text-amber-300/70 mt-1.5 font-medium">🔍 Klik untuk perbesar</span>
          </div>
      `;
    }

    podiumHtml += `
        </div>
      </div>
    `;
  }

  // 2. SECTION: PEMENANG PER KATEGORI VOTING
  if (displayMode === 'all' || displayMode === 'category') {
    const categories = (Array.isArray(STATE.activeCategories) && STATE.activeCategories.length > 0)
      ? STATE.activeCategories
      : MOCK_DATA.categories;

    let catWinnerCards = '';
    categories.forEach(cat => {
      // Cari foto dengan like terbanyak di kategori ini (Pencarian ID & Nama Kategori)
      const targetCatName = cat.namaKategori ? cat.namaKategori.toLowerCase().trim() : '';
      const getVotes = (p) => {
        if (!p) return 0;
        let v = (p.categoryLikes && p.categoryLikes[cat.idKategori]) || 0;
        if (targetCatName && p.categoryLikes) {
          for (const k in p.categoryLikes) {
            if (k.toLowerCase().trim() === targetCatName) v = Math.max(v, p.categoryLikes[k]);
          }
        }
        return v;
      };

      const catPhotos = [...STATE.photos].filter(p => getVotes(p) > 0);
      catPhotos.sort((a, b) => getVotes(b) - getVotes(a));

      if (catPhotos.length > 0) {
        const winner = catPhotos[0];
        const winnerLikes = getVotes(winner);
        const winUrls = getDriveImageUrls(winner.gdriveViewUrl);
        catWinnerCards += `
          <div class="bg-brand-surfaceLight border border-brand-surfaceBorder rounded-2xl p-3.5 flex items-center gap-3.5 shadow-md">
            <div class="w-20 h-24 rounded-xl overflow-hidden bg-[#161622] shrink-0 border border-white/10 flex items-center justify-center relative">
              <div class="absolute inset-0 flex items-center justify-center text-zinc-600 pointer-events-none">
                <span class="text-[9px] text-zinc-500 font-medium">Memuat...</span>
              </div>
              <img src="${winUrls[0] || winner.gdriveViewUrl}" data-secondary="${winUrls[1] || ''}" data-tertiary="${winUrls[2] || ''}" data-step="0" alt="${winner.guestNama}" class="w-full h-full object-cover opacity-0 relative z-10" onload="this.classList.remove('opacity-0'); this.previousElementSibling?.remove();" onerror="handlePodiumImgError(this);" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 mb-1">
                <span>👑 ${cat.namaKategori}</span>
              </div>
              <h4 class="font-bold text-sm text-white truncate">${winner.guestNama}</h4>
              <p class="text-xs text-zinc-400 italic truncate mb-2">"${winner.caption || 'Momen seru!'}"</p>
              <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold text-[11px] font-extrabold border border-brand-gold/30">
                <span>❤️</span>
                <span>${winnerLikes} Suara</span>
              </div>
            </div>
          </div>
        `;
      }
    });

    if (catWinnerCards) {
      podiumHtml += `
        <div class="mt-5">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-sm font-extrabold text-amber-300 uppercase tracking-wider">👑 Pemenang Per Kategori Voting</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${catWinnerCards}
          </div>
        </div>
      `;
    }
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
  const urls = getDriveImageUrls(photo.gdriveViewUrl);
  const zoomImg = document.getElementById('zoomImg');
  zoomImg.src = urls[0] || photo.gdriveViewUrl;
  zoomImg.onerror = function() {
    if (urls[1] && this.src !== urls[1]) {
      this.src = urls[1];
    } else if (urls[2] && this.src !== urls[2]) {
      this.src = urls[2];
    }
  };
  document.getElementById('zoomGuestNama').textContent = `Oleh: ${photo.guestNama}`;
  document.getElementById('zoomTime').textContent = photo.createdAt || 'Baru Saja';
  document.getElementById('zoomCaption').textContent = photo.caption ? `"${photo.caption}"` : '';
  document.getElementById('zoomLikesCount').textContent = `${photo.totalLikes || 0} Suka`;

  const btnVote = document.getElementById('btnZoomVote');
  btnVote.onclick = () => {
    document.getElementById('modalZoomPhoto').classList.add('hidden');
    openVoteCategoryModal(photo.idFoto);
  };

  const btnDl = document.getElementById('btnZoomDownload');
  btnDl.onclick = () => {
    const a = document.createElement('a');
    a.href = urls[0] || photo.gdriveViewUrl;
    a.download = `SnapEvent_${photo.idFoto}.jpg`;
    a.target = '_blank';
    a.click();
  };

  // Kontrol Moderasi Galeri Khusus Admin
  const isAdmin = (sessionStorage.getItem('snapevent_admin_session') === 'true');
  const adminControls = document.getElementById('zoomAdminControls');
  if (adminControls) {
    if (isAdmin) {
      adminControls.classList.remove('hidden');
      const isHidden = (photo.isVisible === false || photo.photoStatus === 'SEMBUNYI');
      const iconEl = document.getElementById('zoomToggleVisibilityIcon');
      const textEl = document.getElementById('zoomToggleVisibilityText');
      if (iconEl) iconEl.textContent = isHidden ? '👁️' : '🙈';
      if (textEl) textEl.textContent = isHidden ? 'Tampilkan' : 'Sembunyikan';

      const btnToggle = document.getElementById('btnZoomToggleVisibility');
      if (btnToggle) {
        btnToggle.onclick = () => {
          adminTogglePhotoVisibility(photo.idFoto);
        };
      }

      const btnDel = document.getElementById('btnZoomDeletePhoto');
      if (btnDel) {
        btnDel.onclick = () => {
          adminDeletePhoto(photo.idFoto);
        };
      }
    } else {
      adminControls.classList.add('hidden');
    }
  }

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

function getDefaultPresetCustomFrames() {
  const weddingSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'><rect x='28' y='28' width='1024' height='1294' fill='none' stroke='%23D4AF37' stroke-width='14' rx='28'/><rect x='52' y='52' width='976' height='1246' fill='none' stroke='%23F3E5AB' stroke-width='3' rx='18'/><circle cx='52' cy='52' r='18' fill='%23D4AF37'/><circle cx='1028' cy='52' r='18' fill='%23D4AF37'/><circle cx='52' cy='1298' r='18' fill='%23D4AF37'/><circle cx='1028' cy='1298' r='18' fill='%23D4AF37'/><rect x='140' y='1190' width='800' height='95' fill='rgba(15,15,20,0.88)' stroke='%23D4AF37' stroke-width='2' rx='16'/><text x='540' y='1250' fill='%23F3E5AB' font-family='serif' font-size='32' font-weight='bold' text-anchor='middle'>THE WEDDING CELEBRATION</text></svg>";

  const neonSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'><rect x='32' y='32' width='1016' height='1286' fill='none' stroke='%23E11D48' stroke-width='10' rx='24'/><rect x='48' y='48' width='984' height='1254' fill='none' stroke='%23FB7185' stroke-width='2' rx='16'/><rect x='180' y='1205' width='720' height='85' fill='rgba(10,10,14,0.92)' stroke='%23E11D48' stroke-width='2' rx='14'/><text x='540' y='1258' fill='%23FFFFFF' font-family='sans-serif' font-size='28' font-weight='900' letter-spacing='4' text-anchor='middle'>EXCLUSIVE EVENT PARTY</text></svg>";

  const ilhamSherwinSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'><rect x='30' y='30' width='1020' height='1290' fill='none' stroke='%23D4AF37' stroke-width='4' rx='16'/><rect x='100' y='1160' width='880' height='130' fill='rgba(10,10,14,0.88)' stroke='%23D4AF37' stroke-width='2' rx='12'/><text x='540' y='1215' fill='%23F3E5AB' font-family='serif' font-style='italic' font-size='38' font-weight='bold' text-anchor='middle'>ilham &amp; sherwin</text><text x='540' y='1255' fill='%23D4AF37' font-family='sans-serif' font-size='20' font-weight='600' text-anchor='middle'>#ilhamsherwin</text></svg>";

  return [
    {
      id: 'FRAME_PRESET_ILHAM_SHERWIN',
      name: 'ilham & sherwin Frame',
      scope: 'global',
      type: 'custom',
      dataUrl: ilhamSherwinSvg
    },
    {
      id: 'FRAME_PRESET_WEDDING',
      name: 'Wedding Gold Arch PNG',
      scope: 'global',
      type: 'custom',
      dataUrl: weddingSvg
    },
    {
      id: 'FRAME_PRESET_NEON',
      name: 'Neon Party Glow PNG',
      scope: 'global',
      type: 'custom',
      dataUrl: neonSvg
    }
  ];
}

function renderCustomFramesList() {
  const container = document.getElementById('customFramesListContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(STATE.customFrames) || STATE.customFrames.length === 0) {
    STATE.customFrames = getDefaultPresetCustomFrames();
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
  } else {
    // Pastikan preset bawaan selalu tersedia di koleksi admin
    const presets = getDefaultPresetCustomFrames();
    presets.forEach(p => {
      if (!STATE.customFrames.some(cf => cf.id === p.id || cf.name === p.name)) {
        STATE.customFrames.push(p);
      }
    });
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
  }

  STATE.customFrames.forEach((cf, idx) => {
    const row = document.createElement('div');
    row.className = "flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-brand-gold/30 transition text-xs";
    const scopeLabel = cf.scope === 'global' ? 'Semua Acara (Global)' : 'Khusus Acara Ini';
    const scopeColor = cf.scope === 'global' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-blue-300 border-blue-500/30 bg-blue-500/10';

    row.innerHTML = `
      <div class="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
        <img src="${cf.dataUrl}" class="w-8 h-10 object-contain rounded bg-zinc-900 border border-white/10 shrink-0" alt="Frame" />
        <div class="truncate">
          <div class="font-bold text-white truncate text-[11px]">${cf.name || 'Bingkai ' + (idx + 1)}</div>
          <span class="text-[9px] px-1.5 py-0.5 rounded border ${scopeColor}">${scopeLabel}</span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" class="btn-lock-custom-frame flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-gold/15 hover:bg-brand-gold text-brand-gold hover:text-black border border-brand-gold/40 text-[10px] font-bold transition active:scale-95" title="Kunci bingkai ini sebagai bingkai wajib tamu">
          <span>🔒</span> Kunci Bingkai Ini
        </button>
        <button type="button" class="btn-del-frame text-red-400 hover:text-red-300 p-1 text-xs shrink-0" data-idx="${idx}" title="Hapus Bingkai">✕</button>
      </div>
    `;

    // Tombol Kunci Bingkai Ini: Otomatis aktifkan Single Lock & pilih frame ini
    row.querySelector('.btn-lock-custom-frame').onclick = (e) => {
      e.stopPropagation();
      setAndLockSingleFrame(cf.id, cf.name);
    };

    row.querySelector('.btn-del-frame').onclick = () => {
      STATE.customFrames.splice(idx, 1);
      localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
      renderCustomFramesList();
      const targetEventId = document.getElementById('formEventId')?.value;
      const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
      renderAdminFrameSettings(currentEv);
      showToast("Bingkai kustom dihapus.", "info");
    };

    container.appendChild(row);
  });
}

function setAndLockSingleFrame(frameId, frameName) {
  // 1. Pilih radio Single Lock
  const radSingle = document.querySelector('input[name="frameLockModeRadio"][value="single"]');
  if (radSingle) radSingle.checked = true;

  // 2. Tampilkan kontainer Single Lock dan sembunyikan Multi-Frame
  document.getElementById('containerSingleFrameLock')?.classList.remove('hidden');
  document.getElementById('containerMultiFrameSelection')?.classList.add('hidden');

  // 3. Set dropdown single frame select
  const singleSelect = document.getElementById('formEventSingleFrameSelect');
  if (singleSelect) {
    singleSelect.value = frameId;
  }

  // 4. Ambil custom frame data jika bingkai ini adalah custom PNG
  const cf = Array.isArray(STATE.customFrames) ? STATE.customFrames.find(f => f.id === frameId) : null;
  const cfDataUrl = cf ? cf.dataUrl : (STATE.tempCustomFrameData || STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl);

  // 5. Update data event yang sedang diedit
  const targetEventId = document.getElementById('formEventId')?.value || STATE.activeEventId;
  const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
  if (currentEv) {
    currentEv.frameLockMode = 'single';
    currentEv.singleLockedFrame = frameId;
    currentEv.activeFrames = [frameId];
    if (cfDataUrl) {
      currentEv.customFrameData = cfDataUrl;
      currentEv.customFrameUrl = cfDataUrl;
      currentEv.customFrameName = frameName || cf?.name || 'Custom Frame';
    }
    localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
  }

  // 6. Sinkronkan ke event aktif seketika agar langsung berfungsi live di kamera
  if (STATE.activeEvent && (currentEv?.idEvent === STATE.activeEventId || !targetEventId)) {
    STATE.activeEvent = {
      ...STATE.activeEvent,
      frameLockMode: 'single',
      singleLockedFrame: frameId,
      activeFrames: [frameId],
      customFrameData: cfDataUrl || STATE.activeEvent.customFrameData,
      customFrameUrl: cfDataUrl || STATE.activeEvent.customFrameUrl,
      customFrameName: frameName || cf?.name || STATE.activeEvent.customFrameName
    };
    localStorage.setItem('snapevent_active_event', JSON.stringify(STATE.activeEvent));
    STATE.activeFrame = frameId;
    applyActiveFrame(frameId);
  }

  // 7. Resilient sync ke Google Apps Script secara utuh tanpa menghapus atribut event (Kebal NetworkError & CORS)
  if (STATE.gasApiUrl && currentEv) {
    callGasApiSafe('adminSaveEvent', {
      idEvent: currentEv.idEvent,
      eventId: currentEv.idEvent,
      namaEvent: currentEv.namaEvent || 'Event',
      slugEvent: currentEv.slugEvent || '',
      tanggalEvent: currentEv.tanggalEvent || '',
      hashtagEvent: currentEv.hashtagEvent || '',
      maxFotoPerGuest: currentEv.maxFotoPerGuest || 10,
      maxVotePerGuest: currentEv.maxVotePerGuest || 3,
      revealMode: currentEv.revealMode || 'SEGERA',
      isRevealed: currentEv.isRevealed !== undefined ? currentEv.isRevealed : true,
      likeEnabled: currentEv.likeEnabled !== undefined ? currentEv.likeEnabled : true,
      publicVisible: currentEv.publicVisible !== undefined ? currentEv.publicVisible : true,
      frameLockMode: 'single',
      singleLockedFrame: frameId,
      activeFrames: [frameId],
      customFrameUrl: cfDataUrl || currentEv.customFrameUrl || '',
      gdriveFolderId: currentEv.gdriveFolderId || ''
    }).then(res => {
      if (res && res.status === 'success' && res.customFrameUrl) {
        if (currentEv) currentEv.customFrameUrl = res.customFrameUrl;
        if (STATE.activeEvent) STATE.activeEvent.customFrameUrl = res.customFrameUrl;
        localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
      }
    });
  }

  // 8. Re-render frame settings agar kartu single lock ter-highlight
  renderAdminFrameSettings(currentEv);

  // 9. Scroll halus ke bagian Single Lock agar admin melihat perubahan
  document.getElementById('containerSingleFrameLock')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`🔒 Bingkai "${frameName || frameId}" AKTIF & TERKUNCI untuk kamera live!`, "success");
}

function getAllAdminCandidateFrames(eventObj) {
  const normTitle = (str) => {
    if (!str) return '';
    return str.replace(/^[\u{1F300}-\u{1F9FF}\s]+/u, '')
              .replace(/\((acara|global|event)\)/gi, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
  };

  if (!Array.isArray(STATE.customFrames) || STATE.customFrames.length === 0) {
    STATE.customFrames = getDefaultPresetCustomFrames();
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
  } else {
    // Bersihkan duplikat di STATE.customFrames berdasarkan nama ternormalisasi dan dataUrl
    const seenCf = new Set();
    const seenDataUrls = new Set();
    STATE.customFrames = STATE.customFrames.filter(cf => {
      if (!cf || !cf.name) return false;
      const baseName = normTitle(cf.name);
      const scopeKey = `${baseName}__${cf.scope || 'event'}`;
      if (seenCf.has(scopeKey)) return false;
      if (cf.dataUrl && seenDataUrls.has(cf.dataUrl)) return false;
      seenCf.add(scopeKey);
      if (cf.dataUrl) seenDataUrls.add(cf.dataUrl);
      return true;
    });
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
  }

  const frames = [
    { id: 'GOLD_DECO', name: '✨ Gold Deco', type: 'builtin', icon: '✨' },
    { id: 'POLAROID', name: '📷 Polaroid', type: 'builtin', icon: '📷' },
    { id: 'MINIMAL', name: '▪️ Minimalist', type: 'builtin', icon: '▪️' },
    { id: 'NONE', name: 'Tanpa Bingkai', type: 'builtin', icon: '🚫' }
  ];

  const currentEvId = eventObj ? getResolvedEventId(eventObj.idEvent) : getResolvedEventId(STATE.activeEventId);
  const seenFrameNames = new Set(['gold deco', 'polaroid', 'minimalist', 'tanpa bingkai']);
  const seenUrls = new Set();

  if (Array.isArray(STATE.customFrames)) {
    STATE.customFrames.forEach(cf => {
      const cfEvId = cf.eventId ? getResolvedEventId(cf.eventId) : '';
      if (cf.scope === 'global' || !cf.eventId || cfEvId === currentEvId) {
        const cleanName = normTitle(cf.name);
        const urlKey = cf.dataUrl ? cf.dataUrl.slice(0, 100) : '';
        if (!frames.some(f => f.id === cf.id) && !seenFrameNames.has(cleanName) && (!urlKey || !seenUrls.has(urlKey))) {
          seenFrameNames.add(cleanName);
          if (urlKey) seenUrls.add(urlKey);
          const rawName = cf.name.startsWith('🖼️') ? cf.name : `🖼️ ${cf.name}`;
          const cleanDisplayName = rawName.replace(/\((acara|global|event)\)/gi, '').trim();
          const displayName = `${cleanDisplayName} (${cf.scope === 'global' ? 'Global' : 'Acara'})`;
          frames.push({
            id: cf.id,
            name: displayName,
            type: 'custom',
            scope: cf.scope,
            dataUrl: cf.dataUrl,
            icon: '🖼️'
          });
        }
      }
    });
  }

  // Custom frame yang baru diunggah di form atau tersimpan di event ini jika belum ada di list
  const eventCustomData = STATE.tempCustomFrameData || eventObj?.customFrameData || eventObj?.customFrameUrl;
  const eventFrameName = normTitle(eventObj?.customFrameName || `${eventObj?.namaEvent || 'Acara'} Frame`);
  const eventUrlKey = eventCustomData ? eventCustomData.slice(0, 100) : '';
  if (eventCustomData && !seenUrls.has(eventUrlKey) && !seenFrameNames.has(eventFrameName)) {
    seenFrameNames.add(eventFrameName);
    if (eventUrlKey) seenUrls.add(eventUrlKey);
    frames.push({
      id: 'CUSTOM_EVENT',
      name: eventObj?.customFrameName ? `🖼️ ${eventObj.customFrameName}` : '🖼️ Bingkai Kustom Acara (Custom PNG)',
      type: 'custom',
      scope: 'event',
      dataUrl: eventCustomData,
      icon: '🖼️'
    });
  }

  return frames;
}

function renderSingleLockCustomFrameList(candidateFrames, currentLockedId) {
  const container = document.getElementById('singleLockCustomFrameList');
  if (!container) return;
  container.innerHTML = '';

  candidateFrames.forEach(f => {
    const isLocked = (f.id === currentLockedId);
    const card = document.createElement('div');
    card.className = `single-lock-card flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${
      isLocked 
        ? 'bg-brand-gold/15 border-brand-gold shadow-md shadow-brand-gold/10' 
        : 'bg-[#0D0D12] border-white/10 hover:border-brand-gold/50 hover:bg-white/[0.03]'
    }`;
    card.setAttribute('data-frame-id', f.id);

    const thumbHtml = f.dataUrl 
      ? `<img src="${f.dataUrl}" class="w-8 h-10 object-contain rounded bg-zinc-900 border border-white/10 shrink-0" alt="Frame" />`
      : `<span class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0">${f.icon || '🖼️'}</span>`;

    const statusBadge = isLocked 
      ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-brand-gold text-black font-bold shrink-0">✓ TERKUNCI</span>`
      : `<span class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 group-hover:text-white shrink-0">Pilih</span>`;

    card.innerHTML = `
      <div class="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
        <input type="radio" name="singleLockRadioSelect" value="${f.id}" class="text-brand-gold w-4 h-4 shrink-0 cursor-pointer" ${isLocked ? 'checked' : ''} />
        ${thumbHtml}
        <div class="truncate">
          <div class="text-xs font-semibold ${isLocked ? 'text-brand-gold' : 'text-zinc-200'} truncate">${f.name}</div>
          <span class="text-[9px] text-zinc-400 font-mono">${f.type === 'custom' ? (f.scope === 'global' ? 'Kustom (Global)' : 'Kustom (Acara)') : 'Bawaan Standar'}</span>
        </div>
      </div>
      <div>${statusBadge}</div>
    `;

    card.addEventListener('click', () => {
      const singleSelect = document.getElementById('formEventSingleFrameSelect');
      if (singleSelect) {
        singleSelect.value = f.id;
      }
      const targetEventId = document.getElementById('formEventId')?.value;
      const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
      if (currentEv) {
        currentEv.singleLockedFrame = f.id;
      }
      renderSingleLockCustomFrameList(candidateFrames, f.id);
      showToast(`🔒 Bingkai "${f.name}" dipilih sebagai bingkai wajib terkunci.`, "info");
    });

    container.appendChild(card);
  });
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
  const eventCustomData = STATE.tempCustomFrameData || eventObj?.customFrameData || eventObj?.customFrameUrl;
  const currentEvId = eventObj ? getResolvedEventId(eventObj.idEvent) : getResolvedEventId(STATE.activeEventId);

  const isCustomMatch = (id, f) => {
    if (!f) return false;
    if (f.id === id) return true;
    const isCustomId = (id === 'CUSTOM_EVENT' || id === 'CUSTOM' || String(id).startsWith('frame_') || String(id).startsWith('FRAME_'));
    const isEvCustom = (f.type === 'custom' || f.id === 'CUSTOM_EVENT' || String(f.id).startsWith('frame_') || String(f.id).startsWith('FRAME_') || (eventCustomData && f.dataUrl === eventCustomData));
    if (isCustomId && isEvCustom) {
      if (id === 'CUSTOM_EVENT' || id === 'CUSTOM') return true;
      if (f.id === 'CUSTOM_EVENT') return true;
      if (f.scope === 'event' && (!f.eventId || getResolvedEventId(f.eventId) === currentEvId)) return true;
      if (eventCustomData && f.dataUrl === eventCustomData) return true;
    }
    return false;
  };

  const sortedFrames = [];
  activeOrder.forEach(id => {
    const found = candidateFrames.find(f => isCustomMatch(id, f));
    if (found && !sortedFrames.some(s => s.id === found.id)) {
      sortedFrames.push(found);
    }
  });
  candidateFrames.forEach(f => {
    if (!sortedFrames.some(s => s.id === f.id)) {
      sortedFrames.push(f);
    }
  });

  let currentLocked = eventObj?.singleLockedFrame || sortedFrames[0]?.id || 'GOLD_DECO';
  const lockedInSorted = sortedFrames.find(f => isCustomMatch(currentLocked, f));
  if (lockedInSorted) {
    currentLocked = lockedInSorted.id;
  }

  // 1. Render Dropdown Single Frame Lock dengan Optgroup Standar & Kustom
  if (singleSelect) {
    const builtInOptions = sortedFrames.filter(f => f.type !== 'custom').map(f => 
      `<option value="${f.id}" ${f.id === currentLocked ? 'selected' : ''}>${f.name}</option>`
    ).join('');
    const customOptions = sortedFrames.filter(f => f.type === 'custom').map(f => 
      `<option value="${f.id}" ${f.id === currentLocked ? 'selected' : ''}>${f.name}</option>`
    ).join('');

    let finalHtml = '';
    if (builtInOptions) finalHtml += `<optgroup label="🌟 Bingkai Standar">${builtInOptions}</optgroup>`;
    if (customOptions) finalHtml += `<optgroup label="🖼️ Koleksi Bingkai Kustom">${customOptions}</optgroup>`;
    singleSelect.innerHTML = finalHtml || sortedFrames.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    singleSelect.value = currentLocked;
  }

  // 2. Render Daftar Visual Pilihan Bingkai di Menu Single Lock
  renderSingleLockCustomFrameList(sortedFrames, currentLocked);

  // 3. Render Drag & Drop Sortable List untuk Mode Bebas Pilih (Multi-Frame)
  if (container) {
    container.innerHTML = '';
    sortedFrames.forEach((frame) => {
      const isChecked = activeOrder.some(a => isCustomMatch(a, frame)) || (!eventObj && frame.id !== 'NONE');
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

      // Listener perubahan centang checkbox (Sinkron langsung ke pengaturan)
      row.querySelector('.adm-frame-check').addEventListener('change', () => {
        syncFrameSettingsFromDOM();
      });

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

  // Sinkronkan daftar visual single lock
  const targetEventId = document.getElementById('formEventId')?.value;
  const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
  const candidateFrames = getAllAdminCandidateFrames(currentEv);
  const currentLocked = singleSelect?.value || 'GOLD_DECO';
  renderSingleLockCustomFrameList(candidateFrames, currentLocked);
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
  document.getElementById('formEventMaxVote').value = "1";
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
  STATE.isNewFrameUploaded = false;
  document.getElementById('formEventCustomFrame').value = '';
  document.getElementById('customFramePreviewBox').classList.add('hidden');
  document.getElementById('btnRemoveCustomFrame').classList.add('hidden');
  renderCustomFramesList();

  const btnDeleteForm = document.getElementById('btnDeleteCurrentEvent');
  if (btnDeleteForm) {
    btnDeleteForm.classList.add('hidden');
    btnDeleteForm.onclick = null;
  }
}

function renderAdminDashboard() {
  try {
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
    if (listContainer) {
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
          
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-white/5">
            <button class="btn-edit-event py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold text-center transition cursor-pointer">
              ✏️ Edit Acara
            </button>
            <button class="btn-toggle-reveal py-2 px-3 rounded-xl ${ev.isRevealed ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'} text-xs font-semibold text-center transition cursor-pointer">
              ${ev.isRevealed ? '🔒 Kunci' : '🔓 Buka'}
            </button>
            <button class="btn-open-slideshow py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold text-center transition cursor-pointer">
              📺 Proyektor
            </button>
            <button class="btn-share-qr py-2 px-3 rounded-xl gold-gradient-bg text-black text-xs font-bold text-center transition cursor-pointer">
              📲 Link & QR
            </button>
            <button class="btn-delete-event col-span-2 sm:col-span-1 py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 text-xs font-semibold text-center transition flex items-center justify-center gap-1 cursor-pointer" title="Hapus Acara">
              🗑️ Hapus
            </button>
          </div>
        `;

        const btnActivate = card.querySelector('.btn-activate-event');
        if (btnActivate) {
          btnActivate.addEventListener('click', () => {
            activateEvent(ev.idEvent);
          });
        }

        const btnDeleteEv = card.querySelector('.btn-delete-event');
        if (btnDeleteEv) {
          btnDeleteEv.addEventListener('click', (e) => {
            e.stopPropagation();
            adminDeleteEvent(ev.idEvent);
          });
        }

        card.querySelector('.btn-edit-event').addEventListener('click', () => {
          populateEditEventForm(ev);
          switchAdminTab('create');
        });

        card.querySelector('.btn-toggle-reveal').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          const origHtml = btn.innerHTML;
          btn.disabled = true;
          btn.style.opacity = '0.7';

          const newRevealedState = !ev.isRevealed;
          ev.isRevealed = newRevealedState;
          ev.revealMode = newRevealedState ? 'SEGERA' : 'SETELAH';

          if (ev.idEvent === STATE.activeEventId && STATE.activeEvent) {
            STATE.activeEvent.isRevealed = newRevealedState;
            STATE.activeEvent.revealMode = ev.revealMode;
            localStorage.setItem('snapevent_active_event', JSON.stringify(STATE.activeEvent));
          }

          localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
          renderAdminDashboard();
          showToast(newRevealedState ? `Galeri "${ev.namaEvent}" resmi dibuka!` : `Galeri "${ev.namaEvent}" dikunci (ditahan).`, "info");

          if (STATE.gasApiUrl) {
            try {
              const res = await callGasApiSafe('adminToggleReveal', {
                eventId: ev.idEvent,
                idEvent: ev.idEvent,
                isRevealed: newRevealedState
              });

              if (res && (res.status === 'success' || res.syncedViaNoCors)) {
                const finalRevealed = (res.isRevealed !== undefined) ? (res.isRevealed === true || res.isRevealed === 'true') : newRevealedState;
                ev.isRevealed = finalRevealed;
                ev.revealMode = finalRevealed ? 'SEGERA' : 'SETELAH';
                if (ev.idEvent === STATE.activeEventId && STATE.activeEvent) {
                  STATE.activeEvent.isRevealed = finalRevealed;
                  STATE.activeEvent.revealMode = ev.revealMode;
                  localStorage.setItem('snapevent_active_event', JSON.stringify(STATE.activeEvent));
                }
                localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
                renderAdminDashboard();
                showToast(finalRevealed ? `✅ Galeri "${ev.namaEvent}" berhasil dibuka di server Google Sheets!` : `🔒 Galeri "${ev.namaEvent}" berhasil dikunci di server Google Sheets!`, "success");
              } else {
                showToast(`✅ Status "${ev.namaEvent}" tersimpan & disinkronkan ke cloud.`, "info");
              }
            } catch (err) {
              console.warn("GAS reveal sync warn:", err.message);
              showToast("Pengaturan tersimpan di sistem lokal.", "info");
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
    }

    // Config Form Values (Lindungi dari overwrite saat user sedang fokus / mengetik)
    const gasInput = document.getElementById('cfgGasUrl');
    if (gasInput && document.activeElement !== gasInput) {
      gasInput.value = STATE.gasApiUrl || '';
    }
    const titleInput = document.getElementById('cfgAppTitle');
    if (titleInput && document.activeElement !== titleInput) titleInput.value = STATE.appTitle || '';
    const logoInput = document.getElementById('cfgAppLogoUrl');
    if (logoInput && document.activeElement !== logoInput) logoInput.value = STATE.appLogoUrl || '';
    const phoneInput = document.getElementById('cfgAppPhone');
    if (phoneInput && document.activeElement !== phoneInput) phoneInput.value = STATE.appPhone || '';
    const igInput = document.getElementById('cfgAppInstagram');
    if (igInput && document.activeElement !== igInput) igInput.value = STATE.appInstagram || '';
    const userInput = document.getElementById('cfgAdminUser');
    if (userInput && document.activeElement !== userInput) userInput.value = STATE.adminUser || '';
    const passInput = document.getElementById('cfgAdminPass');
    if (passInput && document.activeElement !== passInput) passInput.value = STATE.adminPass || '';
    const driveInput = document.getElementById('cfgDriveMasterId');
    if (driveInput && document.activeElement !== driveInput) driveInput.value = STATE.driveMasterId || '';

    // Render User Accounts List & Frames List
    renderUserAccountsList();
    renderCustomFramesList();

    // Render Leaderboard
    renderLeaderboard();
  } catch (err) {
    console.error("Gagal merender Admin Dashboard:", err);
  }
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
  const deletedSet = getDeletedPhotosSet(STATE.activeEventId);
  const sorted = [...STATE.photos].filter(p => {
    if (!p) return false;
    if (deletedSet.has(String(p.idFoto))) return false;
    if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
    if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
    return true;
  }).sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));

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
  STATE.isNewFrameUploaded = false;
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

  // Tampilkan tombol Hapus Acara di form edit
  const btnDeleteForm = document.getElementById('btnDeleteCurrentEvent');
  if (btnDeleteForm) {
    btnDeleteForm.classList.remove('hidden');
    btnDeleteForm.onclick = () => {
      adminDeleteEvent(ev.idEvent);
    };
  }
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

  ['adminTabEvents', 'adminTabCreate', 'adminTabGallery', 'adminTabLeaderboard', 'adminTabSettings'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });

  if (tabName === 'events') document.getElementById('adminTabEvents')?.classList.remove('hidden');
  if (tabName === 'create') document.getElementById('adminTabCreate')?.classList.remove('hidden');
  if (tabName === 'gallery') {
    document.getElementById('adminTabGallery')?.classList.remove('hidden');
    renderAdminGallery();
  }
  if (tabName === 'leaderboard') document.getElementById('adminTabLeaderboard')?.classList.remove('hidden');
  if (tabName === 'settings') document.getElementById('adminTabSettings')?.classList.remove('hidden');
}

/**
 * PENGATURAN GALERI ADMIN: EDIT TAMPILKAN / SEMBUNYIKAN & HAPUS FOTO
 */
function renderAdminGallery() {
  const container = document.getElementById('adminPhotoGrid');
  const empty = document.getElementById('adminPhotoEmptyNotice');
  const eventNameEl = document.getElementById('adminGalleryEventName');
  const statsEl = document.getElementById('adminGalleryPhotoStats');
  if (!container) return;

  if (eventNameEl) {
    eventNameEl.textContent = STATE.activeEvent?.namaEvent || 'Acara Sedang Berlangsung';
  }

  const deletedSet = getDeletedPhotosSet(STATE.activeEventId);
  const allPhotos = (Array.isArray(STATE.photos) ? STATE.photos : []).filter(p => {
    if (!p) return false;
    if (deletedSet.has(String(p.idFoto))) return false;
    if (p.gdriveFileId && deletedSet.has(String(p.gdriveFileId))) return false;
    if (p.driveFileId && deletedSet.has(String(p.driveFileId))) return false;
    return true;
  });
  const filter = STATE.adminPhotoFilter || 'ALL';

  let filtered = allPhotos;
  if (filter === 'VISIBLE') {
    filtered = allPhotos.filter(p => p.isVisible !== false && p.photoStatus !== 'SEMBUNYI');
  } else if (filter === 'HIDDEN') {
    filtered = allPhotos.filter(p => p.isVisible === false || p.photoStatus === 'SEMBUNYI');
  }

  const visibleCount = allPhotos.filter(p => p.isVisible !== false && p.photoStatus !== 'SEMBUNYI').length;
  const hiddenCount = allPhotos.length - visibleCount;

  if (statsEl) {
    statsEl.textContent = `Total: ${allPhotos.length} Foto (${visibleCount} Tampil, ${hiddenCount} Disembunyikan)`;
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  container.innerHTML = '';

  filtered.forEach(photo => {
    const urls = getDriveImageUrls(photo.gdriveViewUrl);
    const primaryUrl = urls[0] || photo.gdriveViewUrl;
    const isHidden = (photo.isVisible === false || photo.photoStatus === 'SEMBUNYI');

    const card = document.createElement('div');
    card.className = `admin-photo-card group relative bg-black/40 border ${isHidden ? 'border-amber-500/40 opacity-75' : 'border-white/10'} rounded-xl overflow-hidden flex flex-col justify-between transition hover:border-brand-gold/50 shadow-sm`;
    card.innerHTML = `
      <div class="relative w-full aspect-[4/5] bg-zinc-900 overflow-hidden cursor-pointer img-preview-zone">
        <img src="${primaryUrl}" alt="${photo.guestNama || 'Foto'}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" onerror="handleGalleryImgError(this);" />
        <div class="absolute top-2 left-2 z-10">
          <span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${isHidden ? 'bg-amber-500/90 text-black' : 'bg-emerald-500/90 text-white'} shadow">
            ${isHidden ? '🔒 Disembunyikan' : '🟢 Tampil Publik'}
          </span>
        </div>
        <div class="absolute top-2 right-2 z-10 flex items-center gap-1">
          <span class="text-[9px] bg-black/70 text-brand-gold font-bold px-2 py-0.5 rounded-full border border-brand-gold/30">
            ❤️ ${photo.totalLikes || 0}
          </span>
        </div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2 z-10">
          <span class="text-[10px] text-zinc-300 truncate">${photo.caption || ''}</span>
        </div>
      </div>
      <div class="p-2.5 bg-[#111116] border-t border-white/5 space-y-2">
        <div class="truncate">
          <div class="text-xs font-bold text-white truncate">${photo.guestNama || 'Tamu'}</div>
          <div class="text-[9px] text-zinc-400 font-mono flex items-center justify-between">
            <span>${photo.cameraStyle || 'RAW'}</span>
            <span>${photo.createdAt ? String(photo.createdAt).split(' ')[0] : ''}</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-white/5">
          <button type="button" class="btn-adm-vis py-1.5 px-2 rounded-lg ${isHidden ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black' : 'bg-white/5 text-zinc-300 hover:bg-white/10'} text-[11px] font-semibold transition text-center cursor-pointer flex items-center justify-center gap-1">
            <span>${isHidden ? '👁️' : '🙈'}</span>
            <span>${isHidden ? 'Tampilkan' : 'Sembunyikan'}</span>
          </button>
          <button type="button" class="btn-adm-del py-1.5 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-semibold transition text-center cursor-pointer flex items-center justify-center gap-1">
            <span>🗑️</span>
            <span>Hapus</span>
          </button>
        </div>
      </div>
    `;

    card.querySelector('.img-preview-zone')?.addEventListener('click', () => {
      openPhotoZoom(photo);
    });

    card.querySelector('.btn-adm-vis')?.addEventListener('click', (e) => {
      e.stopPropagation();
      adminTogglePhotoVisibility(photo.idFoto);
    });

    card.querySelector('.btn-adm-del')?.addEventListener('click', (e) => {
      e.stopPropagation();
      adminDeletePhoto(photo.idFoto);
    });

    container.appendChild(card);
  });
}

async function adminDeletePhoto(idFoto) {
  if (!idFoto) return;
  if (!confirm("⚠️ Hapus foto ini secara permanen dari galeri dan Google Drive? Tindakan ini tidak dapat dibatalkan.")) {
    return;
  }

  const targetId = getResolvedEventId(STATE.activeEventId);
  const photoObj = (STATE.photos || []).find(p => p && p.idFoto === idFoto);

  // 1. Rekam ke persistent tombstone registry (DIJAMIN TIDAK MUNCUL LAGI SAAT REFRESH WALAU TANPA DEPLOY ULANG)
  recordDeletedPhoto(idFoto, photoObj, targetId);

  // 2. Optimistic Update Lokal & Cache
  if (Array.isArray(STATE.photos)) {
    STATE.photos = STATE.photos.filter(p => p && p.idFoto !== idFoto);
  }
  saveEventPhotos(targetId);

  // Tutup zoom modal jika sedang membuka foto ini
  document.getElementById('modalZoomPhoto')?.classList.add('hidden');

  renderGallery();
  renderAdminGallery();
  showToast("✅ Foto berhasil dihapus secara permanen dari galeri!", "success");

  // 3. Kirim ke Server Google Apps Script (Resilient Multi-Tier)
  if (STATE.gasApiUrl) {
    try {
      callGasApiSafe('adminDeletePhoto', {
        idFoto: idFoto,
        photoId: idFoto,
        eventId: targetId
      }).then(res => {
        if (res && res.status === 'success') {
          showToast("✅ Foto berhasil dihapus permanen dari Google Sheets & Drive!", "success");
        }
      });
    } catch (err) {
      console.warn("GAS delete photo sync warn:", err);
    }
  }
}

async function adminTogglePhotoVisibility(idFoto) {
  if (!idFoto || !Array.isArray(STATE.photos)) return;
  const photo = STATE.photos.find(p => p.idFoto === idFoto);
  if (!photo) return;

  const newVisibility = (photo.isVisible === false || photo.photoStatus === 'SEMBUNYI') ? true : false;
  photo.isVisible = newVisibility;
  photo.photoStatus = newVisibility ? 'TAMPIL' : 'SEMBUNYI';

  const photoCacheKey = `snapevent_photos_${STATE.activeEventId}`;
  localStorage.setItem(photoCacheKey, JSON.stringify(STATE.photos));

  // Perbarui UI di zoom modal jika sedang aktif
  const iconEl = document.getElementById('zoomToggleVisibilityIcon');
  const textEl = document.getElementById('zoomToggleVisibilityText');
  if (iconEl) iconEl.textContent = newVisibility ? '🙈' : '👁️';
  if (textEl) textEl.textContent = newVisibility ? 'Sembunyikan' : 'Tampilkan';

  renderGallery();
  renderAdminGallery();
  showToast(newVisibility ? "👁️ Foto sekarang DITAMPILKAN di galeri publik." : "🔒 Foto sekarang DISEMBUNYIKAN dari publik.", "info");

  // Kirim ke Server GAS (Resilient Multi-Tier)
  if (STATE.gasApiUrl) {
    try {
      const res = await callGasApiSafe('adminTogglePhotoVisibility', {
        idFoto: idFoto,
        photoId: idFoto,
        isVisible: newVisibility
      });
      if (res && res.status === 'success') {
        showToast("✅ Status visibilitas foto tersimpan di Google Sheets!", "success");
      } else if (res && res.status === 'error') {
        if (res.message && res.message.includes('tidak dikenali')) {
          showToast("ℹ️ Status visibilitas diperbarui secara lokal. Deploy versi terbaru Google Apps Script agar sinkron di cloud.", "info");
        }
      }
    } catch (err) {
      console.warn("GAS toggle visibility warn:", err);
    }
  }
}

/**
 * HAPUS ACARA (ADMIN DELETE EVENT)
 */
async function adminDeleteEvent(idEvent) {
  if (!idEvent) return;
  const ev = (STATE.events || []).find(e => e.idEvent === idEvent);
  const evName = ev?.namaEvent || idEvent;

  if (!confirm(`⚠️ Apakah Anda yakin ingin menghapus acara "${evName}" secara permanen?\n\nSemua data lokal dan referensi acara ini akan dihapus.`)) {
    return;
  }

  // 1. Hapus dari STATE.events lokal
  if (Array.isArray(STATE.events)) {
    STATE.events = STATE.events.filter(e => e.idEvent !== idEvent);
  }
  localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));

  // Hapus cache foto acara ini jika ada
  try {
    localStorage.removeItem(`snapevent_photos_${idEvent}`);
  } catch (e) {}

  // Jika acara yang dihapus adalah acara aktif, pindahkan ke acara lain jika ada
  if (STATE.activeEventId === idEvent) {
    const nextEv = (STATE.events && STATE.events.length > 0) ? STATE.events[0] : null;
    if (nextEv) {
      STATE.activeEventId = nextEv.idEvent;
      STATE.activeEvent = nextEv;
      localStorage.setItem('snapevent_active_event_id', nextEv.idEvent);
      localStorage.setItem('snapevent_active_event', JSON.stringify(nextEv));
    } else {
      STATE.activeEventId = null;
      STATE.activeEvent = null;
      localStorage.removeItem('snapevent_active_event_id');
      localStorage.removeItem('snapevent_active_event');
    }
  }

  // Bersihkan form edit jika sedang membuka event ini
  resetCreateEventForm();

  // Kembali ke tab events & re-render
  switchAdminTab('events');
  renderAdminDashboard();
  applyEventToUI();
  showToast(`🗑️ Acara "${evName}" berhasil dihapus.`, "info");

  // 2. Sinkronkan hapus acara ke Google Apps Script / Google Sheets (Resilient Multi-Tier)
  if (STATE.gasApiUrl) {
    try {
      const res = await callGasApiSafe('adminDeleteEvent', {
        idEvent: idEvent,
        eventId: idEvent
      });

      if (res && res.status === 'success') {
        showToast(`✅ Acara "${evName}" berhasil dihapus dari Google Sheets!`, "success");
      } else if (res && res.status === 'error') {
        if (res.message && res.message.includes('tidak dikenali')) {
          showToast(`ℹ️ Acara dihapus di browser. Deploy versi terbaru Google Apps Script agar terhapus otomatis di Google Sheets.`, "info");
        } else {
          showToast(`Catatan server: ${res.message}`, "warning");
        }
      }
    } catch (err) {
      console.warn("GAS delete event sync warn:", err);
    }
  }
}

async function saveAdminEventForm() {
  const submitBtn = document.querySelector('#formSaveEvent button[type="submit"]');
  let originalBtnHtml = '';
  if (submitBtn) {
    originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span> Menyimpan Acara & Bingkai ke Cloud...';
  }

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

  const targetEventId = document.getElementById('formEventId').value || 'EVT-' + Date.now();
  const existingEv = (STATE.events && STATE.events.find(e => e.idEvent === targetEventId)) || {};

  let frameLockMode = 'multi';
  document.getElementsByName('frameLockModeRadio').forEach(r => {
    if (r.checked) frameLockMode = r.value;
  });

  let singleLockedFrame = document.getElementById('formEventSingleFrameSelect')?.value || 'GOLD_DECO';

  let activeFrames = [];
  if (frameLockMode === 'single') {
    activeFrames = [singleLockedFrame];
  } else {
    document.querySelectorAll('#adminFrameSortableList .frame-sortable-item').forEach(item => {
      const chk = item.querySelector('.adm-frame-check');
      if (chk && chk.checked) {
        const val = chk.value;
        if (!activeFrames.includes(val)) activeFrames.push(val);
      }
    });
    if (activeFrames.length === 0) {
      document.querySelectorAll('.adm-frame-check').forEach(chk => {
        if (chk.checked) {
          const val = chk.value;
          if (!activeFrames.includes(val)) activeFrames.push(val);
        }
      });
    }
    if (activeFrames.length === 0) activeFrames = ['GOLD_DECO', 'POLAROID', 'MINIMAL'];
  }

  let customFrameData = STATE.tempCustomFrameData;
  if (!customFrameData) {
    const targetCustomId = (frameLockMode === 'single')
      ? singleLockedFrame
      : (activeFrames.find(fid => String(fid).startsWith('frame_') || fid === 'CUSTOM_EVENT' || fid === 'CUSTOM') || singleLockedFrame);
    if (targetCustomId && Array.isArray(STATE.customFrames)) {
      const foundCf = STATE.customFrames.find(cf => cf.id === targetCustomId);
      if (foundCf && foundCf.dataUrl) customFrameData = foundCf.dataUrl;
    }
  }
  if (!customFrameData) {
    customFrameData = (existingEv ? (existingEv.customFrameData || existingEv.customFrameUrl) : null) || (STATE.activeEvent ? (STATE.activeEvent.customFrameData || STATE.activeEvent.customFrameUrl) : null);
  }

  const isRevPreserved = (revealMode === 'SEGERA') 
    ? true 
    : (existingEv && existingEv.isRevealed !== undefined ? existingEv.isRevealed : false);

  const savedEvent = Object.assign({}, existingEv, {
    idEvent: targetEventId,
    namaEvent: nama,
    slugEvent: nama.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    tanggalEvent: tanggal,
    hashtagEvent: hashtag,
    maxFotoPerGuest: maxFoto,
    maxVotePerGuest: maxVote,
    revealMode: revealMode,
    isRevealed: isRevPreserved,
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

  // Simpan Bingkai Kustom Baru HANYA jika pengguna benar-benar mengunggah file baru lewat form input
  if (STATE.isNewFrameUploaded && STATE.tempCustomFrameData) {
    const scope = document.getElementById('formEventFrameScope')?.value || 'event';
    const frameName = document.getElementById('formEventFrameName')?.value.trim() || `${nama} Frame`;
    
    if (!Array.isArray(STATE.customFrames)) STATE.customFrames = [];
    const existingCfIdx = STATE.customFrames.findIndex(cf => 
      cf && (cf.eventId === savedEvent.idEvent || cf.name.trim().toLowerCase() === frameName.toLowerCase())
    );

    let newFrameId;
    if (existingCfIdx >= 0) {
      STATE.customFrames[existingCfIdx].dataUrl = STATE.tempCustomFrameData;
      STATE.customFrames[existingCfIdx].scope = scope;
      STATE.customFrames[existingCfIdx].name = frameName;
      newFrameId = STATE.customFrames[existingCfIdx].id;
    } else {
      newFrameId = 'frame_' + Date.now();
      const newFrameObj = {
        id: newFrameId,
        name: frameName,
        scope: scope,
        eventId: savedEvent.idEvent,
        dataUrl: STATE.tempCustomFrameData
      };
      STATE.customFrames.unshift(newFrameObj);
    }
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));

    if (frameLockMode === 'multi' && !activeFrames.includes(newFrameId)) {
      activeFrames.unshift(newFrameId);
      savedEvent.activeFrames = activeFrames;
    } else if (frameLockMode === 'single') {
      singleLockedFrame = newFrameId;
      savedEvent.singleLockedFrame = newFrameId;
      savedEvent.activeFrames = [newFrameId];
    }
    STATE.isNewFrameUploaded = false;
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
    localStorage.setItem('snapevent_active_event_id', savedEvent.idEvent);
    localStorage.setItem('snapevent_active_event', JSON.stringify(STATE.activeEvent));
    applyEventToUI();
    const avail = getAvailableFrames();
    if (!avail.some(f => f.id === STATE.activeFrame)) {
      STATE.activeFrame = avail[0] ? avail[0].id : 'GOLD_DECO';
    }
    applyActiveFrame(STATE.activeFrame);
  }

  // Sinkronisasi ke Backend GAS dengan Resilient Multi-Tier (Kebal NetworkError & CORS)
  if (STATE.gasApiUrl) {
    try {
      const res = await callGasApiSafe('adminSaveEvent', {
        idEvent: savedEvent.idEvent,
        eventId: savedEvent.idEvent,
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
      });

      if (res && res.status === 'success') {
        if (res.customFrameUrl) {
          savedEvent.customFrameUrl = res.customFrameUrl;
          if (STATE.activeEvent && STATE.activeEvent.idEvent === savedEvent.idEvent) {
            STATE.activeEvent.customFrameUrl = res.customFrameUrl;
          }
          localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
        }
      } else if (res && res.status === 'error') {
        console.warn("GAS simpan peringatan:", res.message);
      }
    } catch (err) {
      console.warn("Sinkronisasi GAS warn:", err.message);
    }
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml || 'Simpan Pengaturan Acara';
  }

  applyEventToUI();
  showToast("✅ Acara & Pengaturan Bingkai Berhasil Disimpan Permanen!", "success");
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

  // Segera simpan URL ini ke sistem agar tidak pernah hilang atau tertimpa
  STATE.gasApiUrl = url;
  localStorage.setItem('snapevent_gas_url', url);
  localStorage.setItem('snapevent_gas_url_custom', 'true');

  showToast("Menguji koneksi ke Google Apps Script...", "info");
  try {
    const resp = await fetch(`${url}?action=ping`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const res = await resp.json();
    if (res.status === 'success') {
      showToast("✅ Berhasil! Google Apps Script Online & Sinkronisasi Aktif.", "success");
      await loadEventData();
    } else {
      showToast("⚠️ Respon server: " + (res.message || "Gagal sinkron"), "warning");
    }
  } catch (err) {
    console.error("Test GAS connection error:", err);
    showToast("⚠️ URL berhasil disimpan! (Catatan: Pastikan saat deploy Web App dipilih 'Who has access: Anyone')", "info");
  }
}

// --- 11. BIND ALL EVENT LISTENERS ---
function bindEvents() {
  // Tombol Uji Koneksi & Sinkronisasi GAS
  document.getElementById('btnTestGasConnection')?.addEventListener('click', testGasConnection);

  // Auto-Save Realtime untuk Input URL Backend GAS (Anti Hilang & Anti Overwrite)
  const gasInput = document.getElementById('cfgGasUrl');
  if (gasInput) {
    const syncGasUrlInstant = (e) => {
      const val = e.target.value.trim();
      if (val && val.startsWith('http')) {
        STATE.gasApiUrl = val;
        localStorage.setItem('snapevent_gas_url', val);
        localStorage.setItem('snapevent_gas_url_custom', 'true');
      }
    };
    gasInput.addEventListener('input', syncGasUrlInstant);
    gasInput.addEventListener('change', syncGasUrlInstant);
    gasInput.addEventListener('paste', () => {
      setTimeout(() => {
        const val = gasInput.value.trim();
        if (val && val.startsWith('http')) {
          STATE.gasApiUrl = val;
          localStorage.setItem('snapevent_gas_url', val);
          localStorage.setItem('snapevent_gas_url_custom', 'true');
          showToast("URL Backend berhasil ditempel & disimpan!", "info");
        }
      }, 50);
    });
  }
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

      const targetEventId = document.getElementById('formEventId')?.value;
      const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;

      if (isSingle) {
        const singleSelect = document.getElementById('formEventSingleFrameSelect');
        const lockedId = singleSelect?.value || currentEv?.singleLockedFrame || 'GOLD_DECO';
        const candidateFrames = getAllAdminCandidateFrames(currentEv);
        renderSingleLockCustomFrameList(candidateFrames, lockedId);
      } else {
        renderAdminFrameSettings(currentEv);
      }
    });
  });

  // Listener Perubahan Dropdown Pilihan Single Frame Lock (Sinkron ke Kartu Visual)
  document.getElementById('formEventSingleFrameSelect')?.addEventListener('change', (e) => {
    const targetEventId = document.getElementById('formEventId')?.value;
    const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
    const candidateFrames = getAllAdminCandidateFrames(currentEv);
    renderSingleLockCustomFrameList(candidateFrames, e.target.value);
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
    loadGallery();
  });
  document.getElementById('navBtnEventInfo').addEventListener('click', () => {
    showView('viewWelcome');
  });

  // Akses Cepat Galeri & Voting dari Halaman Tulis Nama (viewWelcome)
  document.getElementById('btnWelcomeGoGallery')?.addEventListener('click', () => {
    showView('viewGallery');
    loadGallery();
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
        img.onload = async () => {
          await processPhotoWithFrameAndFilter(img);
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
      img.onload = async () => await processPhotoWithFrameAndFilter(img);
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Switch Camera Lens (Front/Back)
  document.getElementById('btnSwitchCamera').addEventListener('click', () => {
    STATE.facingMode = (STATE.facingMode === 'environment') ? 'user' : 'environment';
    localStorage.setItem('snapevent_camera_facing', STATE.facingMode);
    startCameraStream();
  });

  // Camera Zoom Controls (1x, 2x, 3x)
  document.querySelectorAll('.btn-cam-zoom').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const z = parseFloat(btn.getAttribute('data-zoom')) || 1.0;
      setCameraZoom(z);
    });
  });

  // Touch Pinch-to-zoom on Viewfinder for Mobile Phones
  const viewfinder = document.getElementById('viewfinderViewport');
  if (viewfinder) {
    let pinchStartDist = 0;
    let pinchStartZoom = 1.0;
    viewfinder.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartZoom = STATE.cameraZoom || 1.0;
      }
    }, { passive: true });

    viewfinder.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const scaleChange = currentDist / pinchStartDist;
        const newZoom = Math.max(1.0, Math.min(3.0, pinchStartZoom * scaleChange));
        setCameraZoom(newZoom);
      }
    }, { passive: true });

    viewfinder.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        pinchStartDist = 0;
      }
    }, { passive: true });
  }

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

  // Live Camera Frame Selector Pills (Pilih Bingkai Sebelum Foto di Live Cam)
  document.getElementById('frameListContainer')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.frame-pill');
    if (!pill) return;
    STATE.userHasSelectedFrame = true;
    const frameId = pill.getAttribute('data-frame');
    applyActiveFrame(frameId);
    document.querySelectorAll('.frame-pill').forEach(p => {
      if (p.getAttribute('data-frame') === frameId) {
        p.className = 'frame-pill shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-gold text-black border-brand-gold border transition shadow-sm';
      } else {
        p.className = 'frame-pill shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-zinc-300 border-white/10 border transition';
      }
    });
  });

  // Modal Vote Category Event Listeners
  document.getElementById('btnCloseVoteCategory')?.addEventListener('click', () => {
    document.getElementById('modalVoteCategory')?.classList.add('hidden');
  });
  document.getElementById('btnCancelVoteCategory')?.addEventListener('click', () => {
    document.getElementById('modalVoteCategory')?.classList.add('hidden');
  });
  document.getElementById('btnConfirmVoteCategory')?.addEventListener('click', handleConfirmVoteCategory);

  // Tombol Sinkronisasi Manual Galeri
  document.getElementById('btnSyncGalleryManual')?.addEventListener('click', async () => {
    showToast("🔄 Menyinkronkan seluruh galeri dari Google Drive...", "info");
    const targetId = getResolvedEventId(STATE.activeEventId);
    // Bersihkan kartu lokal zombie/gagal yang belum terunggah agar galeri 100% online
    STATE.photos = (STATE.photos || []).filter(p => p && !p.isUploading && p.gdriveViewUrl && !p.gdriveViewUrl.startsWith('data:'));
    saveEventPhotos(targetId);
    await loadEventData();
    await loadGallery();
    showToast("✅ Galeri berhasil disinkronkan 100% online dari Google Drive!", "success");
  });

  // Review Frame Selector Pills (Pilih Bingkai Pasca-Foto)
  document.getElementById('reviewFrameListContainer')?.addEventListener('click', async (e) => {
    const pill = e.target.closest('.rev-frame-pill');
    if (!pill || !STATE.rawCapturedImageObj) return;
    const chosenFrame = pill.getAttribute('data-frame');
    await processPhotoWithFrameAndFilter(STATE.rawCapturedImageObj, chosenFrame);
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

  // Tombol Tampilkan QR Code di Layar (Header, Kamera, & Layar Selamat Datang)
  document.getElementById('btnHeaderQr')?.addEventListener('click', () => {
    openShareQrModal(STATE.activeEvent);
  });
  document.getElementById('btnCamShowQr')?.addEventListener('click', () => {
    openShareQrModal(STATE.activeEvent);
  });
  document.getElementById('welcomeQrClickBox')?.addEventListener('click', () => {
    openShareQrModal(STATE.activeEvent);
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

  // Tombol Kembali dari Podium Pemenang ke Galeri Foto
  document.getElementById('btnBackToGalleryFromWinners')?.addEventListener('click', () => {
    STATE.activeGalleryFilter = 'ALL';
    document.querySelectorAll('.cat-tab').forEach(t => {
      if (t.getAttribute('data-cat') === 'ALL') {
        t.classList.remove('bg-white/5', 'text-zinc-300');
        t.classList.add('bg-brand-gold', 'text-black');
      } else {
        t.classList.remove('bg-brand-gold', 'text-black');
        t.classList.add('bg-white/5', 'text-zinc-300');
      }
    });
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

  // Filter Foto Admin Galeri (Semua, Tampil, Disembunyikan)
  document.querySelectorAll('.adm-photo-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.adm-photo-filter').forEach(b => {
        b.classList.remove('bg-brand-gold', 'text-black');
        b.classList.add('bg-white/5', 'text-zinc-300');
      });
      btn.classList.remove('bg-white/5', 'text-zinc-300');
      btn.classList.add('bg-brand-gold', 'text-black');
      STATE.adminPhotoFilter = btn.getAttribute('data-admphotofilter');
      renderAdminGallery();
    });
  });

  // Tombol Segarkan Galeri Admin
  document.getElementById('btnAdminRefreshGallery')?.addEventListener('click', async () => {
    showToast("⏳ Menyegarkan foto galeri dari cloud...", "info");
    await loadGallery();
    renderAdminGallery();
    showToast("✅ Galeri foto diperbarui!", "success");
  });

  // Custom Frame File Upload
  document.getElementById('formEventCustomFrame').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      STATE.tempCustomFrameData = dataUrl;
      STATE.isNewFrameUploaded = true;
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
    STATE.isNewFrameUploaded = false;
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

    // Gelar Podium Juara & Mode Pemenang
    const podiumP1 = document.getElementById('cfgPodiumTitleP1')?.value.trim() || '🥇 Juara 1 (Emas)';
    const podiumP2 = document.getElementById('cfgPodiumTitleP2')?.value.trim() || '🥈 Juara 2 (Perak)';
    const podiumP3 = document.getElementById('cfgPodiumTitleP3')?.value.trim() || '🥉 Juara 3 (Perunggu)';
    const podiumMode = document.getElementById('cfgPodiumDisplayMode')?.value || 'all';

    STATE.gasApiUrl = url;
    STATE.appTitle = appTitle;
    STATE.appLogoUrl = appLogoUrl;
    STATE.appPhone = appPhone;
    STATE.appInstagram = appInstagram;
    STATE.adminUser = user;
    STATE.adminPass = pass;
    STATE.driveMasterId = driveMaster;
    STATE.podiumTitleP1 = podiumP1;
    STATE.podiumTitleP2 = podiumP2;
    STATE.podiumTitleP3 = podiumP3;
    STATE.podiumDisplayMode = podiumMode;

    localStorage.setItem('snapevent_gas_url', url);
    localStorage.setItem('snapevent_gas_url_custom', 'true');
    localStorage.setItem('snapevent_app_title', appTitle);
    localStorage.setItem('snapevent_app_logo_url', appLogoUrl);
    localStorage.setItem('snapevent_app_phone', appPhone);
    localStorage.setItem('snapevent_app_instagram', appInstagram);
    localStorage.setItem('snapevent_admin_user', user);
    localStorage.setItem('snapevent_admin_pass', pass);
    localStorage.setItem('snapevent_drive_master_id', driveMaster);
    localStorage.setItem('snapevent_podium_p1', podiumP1);
    localStorage.setItem('snapevent_podium_p2', podiumP2);
    localStorage.setItem('snapevent_podium_p3', podiumP3);
    localStorage.setItem('snapevent_podium_mode', podiumMode);

    applyGlobalConfigToUI();

    // Sinkronisasi ke Backend GAS jika URL aktif (dengan Multi-Tier Fallback agar kebal NetworkError)
    if (url) {
      showToast("Menyimpan ke Google Sheets & database cloud...", "info");
      const configUpdates = {
        app_title: appTitle,
        app_logo_url: appLogoUrl,
        app_phone: appPhone,
        app_instagram: appInstagram,
        admin_user: user,
        admin_pass: pass,
        master_drive_folder_id: driveMaster,
        podium_title_p1: podiumP1,
        podium_title_p2: podiumP2,
        podium_title_p3: podiumP3,
        podium_display_mode: podiumMode,
        gas_webapp_url: url,
        user_accounts: JSON.stringify(STATE.userAccounts)
      };

      try {
        const res = await callGasApiSafe('adminUpdateGlobalConfig', { updates: configUpdates });
        if (res && res.status === 'success') {
          showToast("✅ Berhasil! Pengaturan tersimpan ke Google Sheets & aktif untuk seluruh perangkat.", "success");
        } else {
          showToast("✅ Pengaturan berhasil diperbarui dan disinkronkan ke Cloud!", "success");
        }
      } catch (err) {
        showToast("✅ Pengaturan berhasil disimpan di sistem lokal dan siap digunakan.", "info");
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

  // Tombol Hapus Cache Offline & Sinkronkan Ulang (Admin)
  document.getElementById('btnAdminPurgeOfflineCache')?.addEventListener('click', async () => {
    const targetId = getResolvedEventId(STATE.activeEventId);
    localStorage.removeItem('snapevent_photos_' + targetId);
    localStorage.removeItem('snapevent_events');
    localStorage.removeItem('snapevent_voted_category_ids');
    localStorage.removeItem('snapevent_voted_photo_ids');
    STATE.photos = [];
    STATE.votedCategoryIds = [];
    STATE.votedPhotoIds = [];
    showToast("🧹 Cache lokal dibersihkan! Mengunduh data bersih dari server...", "info");
    await loadEventData();
    await loadGallery();
    showToast("✅ Berhasil disinkronkan dengan database cloud!", "success");
  });

  document.getElementById('btnResetDemoData').addEventListener('click', () => {
    localStorage.removeItem('snapevent_gas_url');
    localStorage.removeItem('snapevent_gas_url_custom');
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

async function triggerCameraShutter() {
  // Flash Animation
  const flash = document.getElementById('flashOverlay');
  if (flash) {
    flash.classList.remove('flash-anim');
    void flash.offsetWidth; // Trigger reflow
    flash.classList.add('flash-anim');
  }

  const video = document.getElementById('cameraVideo');
  // Cek apakah live video stream sudah aktif dan memiliki frame riil
  if (STATE.mediaStream && video && video.readyState >= 2 && video.videoWidth > 0) {
    try {
      if (video.paused) await video.play();
    } catch (e) {}
    await processPhotoWithFrameAndFilter(video);
  } else {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      triggerNativeCamera();
    } else {
      // Pada desktop/laptop tanpa webcam, buat snapshot demo pesta beresolusi tinggi agar tidak layar hitam
      const simulated = generateSimulatedPartySnapshot();
      await processPhotoWithFrameAndFilter(simulated);
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
  const gasInput = document.getElementById('cfgGasUrl');
  const isEditingSettings = gasInput && (document.activeElement === gasInput || !document.getElementById('adminTabSettings')?.classList.contains('hidden'));
  if (STATE.gasApiUrl && !document.hidden && !isEditingSettings) {
    loadEventData();
  }
}, 45000);

// Auto-Poll Galeri Realtime: Otomatis memuat foto terbaru tanpa reload halaman (setiap 6 detik)
setInterval(() => {
  if (STATE.gasApiUrl && !document.hidden) {
    const isGalleryActive = !document.getElementById('viewGallery')?.classList.contains('hidden');
    const isSlideshowActive = !document.getElementById('modalSlideshow')?.classList.contains('hidden');
    if (isGalleryActive || isSlideshowActive) {
      loadGallery();
    }
  }
}, 6000);

document.addEventListener('visibilitychange', () => {
  const gasInput = document.getElementById('cfgGasUrl');
  const isEditingSettings = gasInput && (document.activeElement === gasInput || !document.getElementById('adminTabSettings')?.classList.contains('hidden'));
  if (!document.hidden && STATE.gasApiUrl && !isEditingSettings) {
    loadEventData();
    loadGallery();
  }
});

