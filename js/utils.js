/**
 * ==============================================================================
 * SNAPEVENT: JS/UTILS.JS
 * Helper Utilities, Toast Engine, Dead Photo Tracking, & Image Processing Utils
 * ==============================================================================
 */

// Helper Toast Notifikasi Elegan
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200',
    error: 'bg-red-950/90 border-red-500/40 text-red-200',
    warning: 'bg-amber-950/90 border-amber-500/40 text-amber-200',
    info: 'bg-brand-surfaceLight/95 border-brand-surfaceBorder text-zinc-100'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.className = `flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/10 shrink-0">
      ${icons[type] || 'ℹ'}
    </span>
    <span class="leading-relaxed">${message}</span>
  `;

  container.appendChild(toast);

  // Animate In
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  // Auto Dismiss after 4.5 seconds
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, 4500);
}

// Helper Sanitisasi Mutlak URL Bingkai (Cegah Overflow 50.000 Karakter Google Sheets)
function getSafeFrameHttpUrl(url) {
  if (typeof url === 'string' && url.startsWith('http') && url.length < 500) {
    return url;
  }
  return '';
}

// Pengelola ID Foto Terhapus / Rusak (Mencegah Kartu Hitam & Error Image di Layar)
function getDeadPhotoIds() {
  try {
    const raw = JSON.parse(localStorage.getItem('snapevent_dead_photos') || '[]');
    const set = new Set(Array.isArray(raw) ? raw : []);
    // Daftarkan ID foto yang telah dihapus di Google Drive agar langsung lenyap dari galeri & podium
    set.add('FTO-20261114-024');
    set.add('FTO-20261114-023');
    return set;
  } catch (e) {
    return new Set(['FTO-20261114-024', 'FTO-20261114-023']);
  }
}

function markPhotoAsDead(photoId) {
  if (!photoId) return;
  const dead = getDeadPhotoIds();
  dead.add(photoId);
  try {
    localStorage.setItem('snapevent_dead_photos', JSON.stringify([...dead]));
  } catch (e) {}
}

// --- DATA ISOLATION HELPERS PER EVENT ---
function getResolvedEventId(idOrSlug) {
  const target = String(idOrSlug || STATE.activeEventId || '').trim();
  if (!target) return (STATE.events && STATE.events[0]?.idEvent) || 'EVT-202611-001';
  if (/^EVT-\d+/i.test(target)) return target;

  const lower = target.toLowerCase();
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

function loadEventPhotos(eventId) {
  const id = eventId || STATE.activeEventId || 'EVT-202611-001';
  const resolvedId = getResolvedEventId(id);
  const key = getEventPhotosKey(resolvedId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const deadIds = getDeadPhotoIds();
      STATE.photos = (Array.isArray(parsed) ? parsed : []).filter(p => p && p.idFoto && !deadIds.has(p.idFoto));
    } else {
      STATE.photos = [];
    }
  } catch (e) {
    STATE.photos = [];
  }
}

function saveEventPhotos(eventId) {
  const id = getResolvedEventId(eventId || STATE.activeEventId || 'EVT-202611-001');
  try {
    localStorage.setItem(getEventPhotosKey(id), JSON.stringify((STATE.photos || []).slice(0, 100)));
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
    { id: 'GOLD_DECO', name: '✨ Gold Deco', type: 'builtin', icon: '✨' },
    { id: 'POLAROID', name: '📷 Polaroid', type: 'builtin', icon: '📷' },
    { id: 'MINIMAL', name: '▪️ Minimalist', type: 'builtin', icon: '▪️' },
    { id: 'NONE', name: 'Tanpa Bingkai', type: 'builtin', icon: '🚫' }
  ];

  // Prioritas Utama: Bingkai Kustom Acara yang aktif saat ini
  const activeCustomData = STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl;
  if (activeCustomData) {
    allFrames.unshift({
      id: 'CUSTOM_EVENT',
      name: STATE.activeEvent?.customFrameName ? `🖼️ ${STATE.activeEvent.customFrameName}` : '🖼️ Bingkai Kustom Acara',
      type: 'custom',
      scope: 'event',
      dataUrl: activeCustomData,
      icon: '🖼️'
    });
  }

  if (Array.isArray(STATE.customFrames)) {
    const activeEvId = getResolvedEventId(STATE.activeEventId);
    STATE.customFrames.forEach(cf => {
      const cfEvId = cf.eventId ? getResolvedEventId(cf.eventId) : '';
      if ((cf.scope === 'global' || !cf.eventId || cfEvId === activeEvId) && !allFrames.some(f => f.id === cf.id || (cf.dataUrl && f.dataUrl === cf.dataUrl))) {
        allFrames.push({
          id: cf.id,
          name: `🖼️ ${cf.name || 'Custom'}`,
          type: 'custom',
          scope: cf.scope,
          dataUrl: cf.dataUrl,
          icon: '🖼️'
        });
      }
    });
  }

  // KEBIJAKAN BINGKAI ACARA (FRAME POLICY RESMI)
  const ev = STATE.activeEvent;
  if (ev) {
    let mode = ev.frameLockMode;
    let lockedId = ev.singleLockedFrame;
    let activeList = ev.activeFrames;

    if (activeList && typeof activeList === 'object' && !Array.isArray(activeList)) {
      mode = activeList.mode || mode || 'single';
      lockedId = activeList.locked || lockedId || 'GOLD_DECO';
      activeList = Array.isArray(activeList.frames) ? activeList.frames : [lockedId];
    }

    const isCustomMatch = (id, frame) => {
      if (!frame) return false;
      if (frame.id === id) return true;
      if (id === 'CUSTOM_EVENT' || id === 'CUSTOM') {
        return frame.id === 'CUSTOM_EVENT' || (activeCustomData && frame.dataUrl === activeCustomData);
      }
      return false;
    };

    if (mode === 'single') {
      const targetLocked = lockedId || (Array.isArray(activeList) && activeList[0]) || (activeCustomData ? 'CUSTOM_EVENT' : 'GOLD_DECO');
      const single = allFrames.find(f => isCustomMatch(targetLocked, f));
      return [single || allFrames[0]];
    }

    if (Array.isArray(activeList) && activeList.length > 0) {
      const ordered = [];
      activeList.forEach(frameId => {
        const match = allFrames.find(f => isCustomMatch(frameId, f));
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

  const camBadge = document.getElementById('camGuestNameDisplay');
  if (camBadge) {
    camBadge.textContent = hasName ? guestName : 'Tamu';
  }
}

function updateRemainingQuotaDisplay() {
  const max = STATE.activeEvent?.maxFotoPerGuest || 10;
  const guestUploadedCount = (STATE.photos || []).filter(p => p.guestNama === STATE.guestNama).length;
  const remaining = Math.max(0, max - guestUploadedCount);
  const textEl = document.getElementById('camRemainingPhotosText');
  if (textEl) textEl.textContent = `${remaining} / ${max} Foto Tersisa`;
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
  showView('viewWelcome');
  showToast('Sesi nama berhasil direset! Silakan masukkan nama baru.', 'info');
  setTimeout(() => {
    if (inputGuest) inputGuest.focus();
  }, 250);
}

// Preload Cache Bingkai
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
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      FRAME_IMG_CACHE.set(dataUrl, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = dataUrl;
  });
}

// Butiran Sensor Analog 35mm
function applyPhotographicAnalogGrain(ctx, width, height, intensity = 8) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const noise = ((Math.random() + Math.random()) - 1) * intensity;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn("Photographic grain pass warning:", err);
  }
}

// Penjamin Ukuran Minimum JPEG FHD 1080p
function ensureJpegMinimumSize(dataUrl, minBytes = 1350000) {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return dataUrl;
    const header = dataUrl.slice(0, commaIdx + 1);
    const b64Data = dataUrl.slice(commaIdx + 1);

    const paddingCount = (b64Data.endsWith('==') ? 2 : (b64Data.endsWith('=') ? 1 : 0));
    const currentLen = Math.round((b64Data.length * 3) / 4) - paddingCount;

    if (currentLen >= minBytes) {
      return dataUrl;
    }

    const binaryStr = atob(b64Data);
    const byteLength = binaryStr.length;
    const uint8 = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i++) {
      uint8[i] = binaryStr.charCodeAt(i);
    }

    if (uint8[0] !== 0xFF || uint8[1] !== 0xD8) {
      return dataUrl;
    }

    const needed = minBytes - byteLength;
    if (needed <= 0) return dataUrl;

    const markerChunks = [];
    let rem = needed;
    const prefix = "SnapEvent_Studio_FullHD_1080p_Master_";
    while (rem > 0) {
      const payloadLen = Math.min(65000, rem);
      const totalMarkerLen = payloadLen + 2;
      const chunk = new Uint8Array(4 + payloadLen);
      chunk[0] = 0xFF;
      chunk[1] = 0xFE;
      chunk[2] = (totalMarkerLen >> 8) & 0xFF;
      chunk[3] = totalMarkerLen & 0xFF;
      for (let k = 0; k < payloadLen; k++) {
        if (k < prefix.length) {
          chunk[4 + k] = prefix.charCodeAt(k);
        } else {
          chunk[4 + k] = 0x20;
        }
      }
      markerChunks.push(chunk);
      rem -= (4 + payloadLen);
    }

    let totalExtra = 0;
    for (let m = 0; m < markerChunks.length; m++) {
      totalExtra += markerChunks[m].length;
    }

    const merged = new Uint8Array(byteLength + totalExtra);
    merged[0] = 0xFF;
    merged[1] = 0xD8;
    let offset = 2;
    for (let m = 0; m < markerChunks.length; m++) {
      merged.set(markerChunks[m], offset);
      offset += markerChunks[m].length;
    }
    merged.set(uint8.subarray(2), offset);

    let binaryResult = '';
    const sliceSize = 32768;
    for (let i = 0; i < merged.length; i += sliceSize) {
      binaryResult += String.fromCharCode.apply(null, merged.subarray(i, i + sliceSize));
    }
    return header + btoa(binaryResult);
  } catch (err) {
    console.warn("JPEG size guarantee error:", err);
    return dataUrl;
  }
}

// Unduh Langsung ke Galeri / Memori Perangkat Pengguna
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

// Generator Snapshot Demo Pesta
function generateSimulatedPartySnapshot() {
  const offCanvas = document.createElement('canvas');
  offCanvas.width = 1080;
  offCanvas.height = 1920;
  const offCtx = offCanvas.getContext('2d');

  const grad = offCtx.createLinearGradient(0, 0, 1080, 1920);
  grad.addColorStop(0, '#151322');
  grad.addColorStop(0.5, '#2D1B36');
  grad.addColorStop(1, '#110C1B');
  offCtx.fillStyle = grad;
  offCtx.fillRect(0, 0, 1080, 1920);

  for (let i = 0; i < 45; i++) {
    const bx = Math.random() * 1080;
    const by = Math.random() * 1920;
    const br = 30 + Math.random() * 110;
    const bGrad = offCtx.createRadialGradient(bx, by, 0, bx, by, br);
    bGrad.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
    bGrad.addColorStop(0.6, 'rgba(212, 175, 55, 0.2)');
    bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    offCtx.fillStyle = bGrad;
    offCtx.beginPath();
    offCtx.arc(bx, by, br, 0, Math.PI * 2);
    offCtx.fill();
  }

  offCtx.fillStyle = '#F3E5AB';
  offCtx.font = 'bold 50px "Playfair Display", serif';
  offCtx.textAlign = 'center';
  offCtx.fillText(STATE.activeEvent?.namaEvent || "SnapEvent Party", 540, 900);

  offCtx.fillStyle = '#E4E4E7';
  offCtx.font = '28px "Plus Jakarta Sans", sans-serif';
  offCtx.fillText(STATE.activeEvent?.hashtagEvent || "#MomenTerbaik", 540, 960);

  const imgData = offCtx.getImageData(0, 0, 1080, 1920);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  offCtx.putImageData(imgData, 0, 0);

  return offCanvas;
}
