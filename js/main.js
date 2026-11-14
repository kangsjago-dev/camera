// ==============================================================================
// SnapEvent Studio - Main Application Bootstrapper & Lifecycle Controller (Modular v1.8.0)
// File: js/main.js
// ==============================================================================

// Global Hoisted Aliases
window.fetchEventDetails = function() {
  if (typeof loadEventData === 'function') return loadEventData();
};

let isRevalidating = false;

// --- 1. BOOTSTRAPPER ---
async function initApp() {
  // 0. Deteksi Parameter URL Cloud Bridge (?gas=... & ?event=...) atau Gunakan Default Cloud Deployment
  const urlParams = new URLSearchParams(window.location.search);
  const gasFromUrl = urlParams.get('gas');
  const storedGas = (localStorage.getItem('snapevent_gas_url') || '').trim();

  // Auto-migrasi jika peramban pengguna masih menyimpan URL demo lama
  if (storedGas === GLOBAL_CONFIG.OLD_DEFAULT_GAS_URL) {
    STATE.gasApiUrl = GLOBAL_CONFIG.DEFAULT_GAS_URL;
    localStorage.setItem('snapevent_gas_url', GLOBAL_CONFIG.DEFAULT_GAS_URL);
  } else if (gasFromUrl && gasFromUrl.trim().startsWith('http')) {
    STATE.gasApiUrl = decodeURIComponent(gasFromUrl.trim());
    localStorage.setItem('snapevent_gas_url', STATE.gasApiUrl);
  } else if (!storedGas || !storedGas.startsWith('http')) {
    STATE.gasApiUrl = GLOBAL_CONFIG.DEFAULT_GAS_URL;
    localStorage.setItem('snapevent_gas_url', STATE.gasApiUrl);
  } else {
    STATE.gasApiUrl = storedGas;
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
  if (requestedEvent) {
    const resolvedReqId = getResolvedEventId(requestedEvent);
    STATE.activeEventId = resolvedReqId;
    const matched = (STATE.events || []).find(e => e.idEvent === resolvedReqId);
    if (matched) {
      STATE.activeEvent = matched;
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

  // GERBANG KEAMANAN ACARA: Jika URL membawa parameter event dan status event tersebut INAKTIF
  if (requestedEvent && STATE.activeEvent) {
    if (STATE.activeEvent.statusEvent && STATE.activeEvent.statusEvent !== 'AKTIF') {
      if (sessionStorage.getItem('snapevent_admin_session') !== 'true') {
        const closedTitle = document.getElementById('closedEventTitle');
        if (closedTitle) closedTitle.textContent = "Acara Ini Sedang Tidak Aktif";
        const closedDesc = document.getElementById('closedEventDesc');
        if (closedDesc) {
          closedDesc.textContent = `Tautan acara "${STATE.activeEvent.namaEvent || requestedEvent}" telah selesai atau belum dimulai. Hanya acara yang berstatus aktif yang dapat diakses oleh publik.`;
        }
        showView('viewEventClosed');
        return;
      }
    }
  }

  // 1. Muat data foto & voting terisolasi untuk event aktif (Instan dari localStorage < 2ms)
  loadEventPhotos(STATE.activeEventId);
  loadEventVotes(STATE.activeEventId);

  // Pastikan koleksi bingkai kustom terisi template preset jika belum ada
  if (!Array.isArray(STATE.customFrames) || STATE.customFrames.length === 0) {
    STATE.customFrames = getDefaultPresetCustomFrames();
    localStorage.setItem('snapevent_custom_frames', JSON.stringify(STATE.customFrames));
  }

  // 2. INSTANT FIRST-PAINT: Terapkan konfigurasi & identitas acara ke UI seketika (< 10ms)
  applyGlobalConfigToUI();
  applyEventToUI();

  // 3. SEGERA TAMPILKAN HALAMAN AKTIF TANPA MENUNGGU JARINGAN INTERNET (< 20ms)
  if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
    showView('viewAdmin');
    renderAdminDashboard();
  } else if (!STATE.guestNama || !STATE.guestNama.trim()) {
    showView('viewWelcome');
  } else {
    const savedView = sessionStorage.getItem('snapevent_current_view') || 'viewCamera';
    showView(savedView);
    if (savedView === 'viewGallery') {
      renderGallery();
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

// Global Hoisted Alias
function fetchEventDetails() {
  return loadEventData();
}
window.fetchEventDetails = fetchEventDetails;

// --- 2. DATA FETCHING (GAS API OR MOCK) & EVENT ACTIVATION ---
async function loadEventData() {
  if (STATE.gasApiUrl) {
    try {
      const targetId = getResolvedEventId(STATE.activeEventId);
      const resp = await fetch(`${STATE.gasApiUrl}?action=getEventDetails&eventId=${targetId}&guestId=${STATE.guestId}`);
      const res = await resp.json();
      if (res.status === 'success') {
        const localActive = (STATE.events || []).find(e => e.idEvent === res.event.idEvent) || STATE.activeEvent;
        
        let inferredMode = 'multi';
        let inferredLocked = 'GOLD_DECO';
        let inferredFrames = ['GOLD_DECO', 'POLAROID', 'MINIMAL'];

        const rawFrames = res.event.activeFrames;
        if (rawFrames && typeof rawFrames === 'object' && !Array.isArray(rawFrames)) {
          inferredMode = rawFrames.mode || 'single';
          inferredLocked = rawFrames.locked || 'GOLD_DECO';
          inferredFrames = Array.isArray(rawFrames.frames) ? rawFrames.frames : [inferredLocked];
        } else if (Array.isArray(rawFrames) && rawFrames.length > 0) {
          inferredFrames = rawFrames;
          inferredMode = res.event.frameLockMode || (rawFrames.length === 1 ? 'single' : (localActive?.frameLockMode || 'multi'));
          inferredLocked = res.event.singleLockedFrame || rawFrames[0] || 'GOLD_DECO';
        } else if (res.event.frameLockMode) {
          inferredMode = res.event.frameLockMode;
          inferredLocked = res.event.singleLockedFrame || 'GOLD_DECO';
          inferredFrames = [inferredLocked];
        } else if (localActive) {
          inferredMode = localActive.frameLockMode || 'multi';
          inferredLocked = localActive.singleLockedFrame || 'GOLD_DECO';
          inferredFrames = localActive.activeFrames || ['GOLD_DECO', 'POLAROID', 'MINIMAL'];
        }

        STATE.activeEvent = {
          ...localActive,
          ...res.event,
          frameLockMode: inferredMode,
          singleLockedFrame: inferredLocked,
          activeFrames: inferredFrames,
          customFrameData: getSafeFrameHttpUrl(res.event.customFrameUrl) || getSafeFrameHttpUrl(localActive?.customFrameData) || '',
          customFrameUrl: getSafeFrameHttpUrl(res.event.customFrameUrl) || getSafeFrameHttpUrl(localActive?.customFrameUrl) || ''
        };
        STATE.activeCategories = res.categories || [];

        if (res.metrics) {
          STATE.metrics = res.metrics;
          localStorage.setItem('snapevent_metrics', JSON.stringify(STATE.metrics));
        }

        // Sinkronkan seluruh event secara defensif
        if (Array.isArray(res.allEvents) && res.allEvents.length > 0) {
          STATE.events = res.allEvents.map(serverEv => {
            const localEv = (STATE.events || []).find(e => e.idEvent === serverEv.idEvent);
            let sMode = 'multi';
            let sLocked = 'GOLD_DECO';
            let sFrames = ['GOLD_DECO', 'POLAROID', 'MINIMAL'];

            const sRaw = serverEv.activeFrames;
            if (sRaw && typeof sRaw === 'object' && !Array.isArray(sRaw)) {
              sMode = sRaw.mode || 'single';
              sLocked = sRaw.locked || 'GOLD_DECO';
              sFrames = Array.isArray(sRaw.frames) ? sRaw.frames : [sLocked];
            } else if (Array.isArray(sRaw) && sRaw.length > 0) {
              sFrames = sRaw;
              sMode = serverEv.frameLockMode || (sRaw.length === 1 ? 'single' : (localEv?.frameLockMode || 'multi'));
              sLocked = serverEv.singleLockedFrame || sRaw[0] || 'GOLD_DECO';
            } else if (serverEv.frameLockMode) {
              sMode = serverEv.frameLockMode;
              sLocked = serverEv.singleLockedFrame || 'GOLD_DECO';
              sFrames = [sLocked];
            } else if (localEv) {
              sMode = localEv.frameLockMode || 'multi';
              sLocked = localEv.singleLockedFrame || 'GOLD_DECO';
              sFrames = localEv.activeFrames || ['GOLD_DECO', 'POLAROID', 'MINIMAL'];
            }

            return {
              ...localEv,
              ...serverEv,
              frameLockMode: sMode,
              singleLockedFrame: sLocked,
              activeFrames: sFrames,
              customFrameData: getSafeFrameHttpUrl(serverEv.customFrameUrl) || getSafeFrameHttpUrl(localEv?.customFrameData) || '',
              customFrameUrl: getSafeFrameHttpUrl(serverEv.customFrameUrl) || getSafeFrameHttpUrl(localEv?.customFrameUrl) || ''
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
          if (res.globalConfig.gas_webapp_url && res.globalConfig.gas_webapp_url.trim().startsWith('http')) {
            const cloudGas = res.globalConfig.gas_webapp_url.trim();
            if (cloudGas && cloudGas !== GLOBAL_CONFIG.OLD_DEFAULT_GAS_URL && cloudGas !== STATE.gasApiUrl) {
              STATE.gasApiUrl = cloudGas;
              localStorage.setItem('snapevent_gas_url', cloudGas);
              const inputEl = document.getElementById('cfgGasUrl');
              if (inputEl) inputEl.value = cloudGas;
            }
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
        const avail = getAvailableFrames();
        if (STATE.activeEvent && STATE.activeEvent.frameLockMode === 'single') {
          STATE.activeFrame = avail[0] ? avail[0].id : 'GOLD_DECO';
        } else if (!avail.some(f => f.id === STATE.activeFrame)) {
          STATE.activeFrame = avail[0] ? avail[0].id : 'GOLD_DECO';
        }
        applyActiveFrame(STATE.activeFrame);
        if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
          renderAdminDashboard();
        }
        return res;
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

  // Fallback ke Koleksi Acara Lokal
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

  // RESET SESI TAMU: Website direset untuk ketikkan nama seperti pada tampilan awal
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
    let resp = await fetch(`${STATE.gasApiUrl}?action=getAllEvents`);
    let res = null;
    try {
      res = await resp.json();
    } catch (parseErr) { }

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
          customFrameData: getSafeFrameHttpUrl(serverEv.customFrameUrl) || getSafeFrameHttpUrl(localEv?.customFrameData) || '',
          customFrameUrl: getSafeFrameHttpUrl(serverEv.customFrameUrl) || getSafeFrameHttpUrl(localEv?.customFrameUrl) || ''
        };
      });
      localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));

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
        if (res.globalConfig.gas_webapp_url && res.globalConfig.gas_webapp_url.trim().startsWith('http')) {
          const cloudGas = res.globalConfig.gas_webapp_url.trim();
          if (cloudGas && cloudGas !== GLOBAL_CONFIG.OLD_DEFAULT_GAS_URL && cloudGas !== STATE.gasApiUrl) {
            STATE.gasApiUrl = cloudGas;
            localStorage.setItem('snapevent_gas_url', cloudGas);
            const inputEl = document.getElementById('cfgGasUrl');
            if (inputEl) inputEl.value = cloudGas;
          }
        }
        if (res.globalConfig.user_accounts) {
          try {
            STATE.userAccounts = JSON.parse(res.globalConfig.user_accounts);
            localStorage.setItem('snapevent_user_accounts', JSON.stringify(STATE.userAccounts));
          } catch (e) { }
        }
        applyGlobalConfigToUI();
      }

      applyEventToUI();
      renderAdminDashboard();

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

// --- 3. UI RENDERING HELPERS ---
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

  const hTag = ev.hashtagEvent || '#SnapEvent';
  const headerHash = document.getElementById('headerEventHashtag');
  if (headerHash) headerHash.textContent = hTag;

  const camHash = document.getElementById('camEventBadge');
  if (camHash) camHash.textContent = hTag;

  const welTitle = document.getElementById('welcomeEventTitle');
  if (welTitle) welTitle.textContent = ev.namaEvent || 'Nama Acara';

  const galTitle = document.getElementById('galleryEventTitle');
  if (galTitle) galTitle.textContent = ev.namaEvent || 'Nama Acara';

  const galHash = document.getElementById('galleryEventHashtag');
  if (galHash) galHash.textContent = hTag;

  const ssTitle = document.getElementById('slideshowTitle');
  if (ssTitle) ssTitle.textContent = ev.namaEvent || 'Nama Acara';

  const ssHash = document.getElementById('slideshowHashtag');
  if (ssHash) ssHash.textContent = hTag;

  const vfTitle = document.getElementById('vfFrameBottomTitle');
  if (vfTitle) vfTitle.textContent = ev.namaEvent || 'Nama Acara';

  const vfHash = document.getElementById('vfFrameBottomHashtag');
  if (vfHash) vfHash.textContent = hTag;

  const vfDate = document.getElementById('vfFrameDate');
  if (vfDate) vfDate.textContent = ev.tanggalEvent || '20.11.2026';

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
  const singleBadge = document.getElementById('camSingleFrameBadge');
  const singleNameEl = document.getElementById('camSingleFrameName');
  const availFrames = getAvailableFrames();
  const isSingleLock = (ev.frameLockMode === 'single');

  if (isSingleLock) {
    if (frameContainer) frameContainer.classList.add('hidden');
    if (singleBadge) {
      singleBadge.classList.remove('hidden');
      const activeObj = availFrames[0];
      if (singleNameEl) singleNameEl.textContent = activeObj ? activeObj.name.replace(/^🖼️\s*/, '') : 'Bingkai Acara';
    }
  } else {
    if (singleBadge) singleBadge.classList.add('hidden');
    if (frameContainer) {
      frameContainer.classList.remove('hidden');
      frameContainer.innerHTML = availFrames.map(f => {
        const isActive = (STATE.activeFrame === f.id);
        const thumbHtml = f.dataUrl 
          ? `<img src="${f.dataUrl}" class="w-4 h-4 object-contain rounded shrink-0 pointer-events-none" alt="" />`
          : `<span class="text-[10px] pointer-events-none">${f.icon || '🖼️'}</span>`;
        return `
          <button data-frame="${f.id}" class="frame-pill shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${isActive ? 'bg-brand-gold text-black border-brand-gold shadow-sm' : 'bg-white/5 text-zinc-300 border-white/10 hover:border-brand-gold/50'} border transition active:scale-95">
            ${thumbHtml}
            <span class="truncate max-w-[90px]">${f.name.replace(/^🖼️\s*/, '')}</span>
          </button>
        `;
      }).join('');
    }
  }

  // Render Kategori Voting di Galeri
  const catContainer = document.getElementById('galleryCategoryTabs');
  if (catContainer) {
    const isAll = (STATE.activeGalleryFilter === 'ALL' || !STATE.activeGalleryFilter);
    const isWinners = (STATE.activeGalleryFilter === 'WINNERS');
    const isPopular = (STATE.activeGalleryFilter === 'POPULAR');

    let tabsHtml = `
      <button data-cat="ALL" class="cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold ${isAll ? 'bg-brand-gold text-black border-brand-gold shadow-sm' : 'bg-white/5 text-zinc-300 border-white/10 hover:border-brand-gold/50'} transition">Semua Foto</button>
      <button data-cat="WINNERS" class="cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold ${isWinners ? 'bg-amber-400 text-black border-amber-400 shadow-sm' : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'} transition flex items-center gap-1.5">🏆 Pemenang Voting</button>
      <button data-cat="POPULAR" class="cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold ${isPopular ? 'bg-brand-gold text-black border-brand-gold shadow-sm' : 'bg-white/5 text-zinc-300 border-white/10 hover:border-brand-gold/50'} transition">🔥 Paling Populer</button>
    `;

    (STATE.activeCategories || []).forEach(cat => {
      const isCatActive = (STATE.activeGalleryFilter === cat.idKategori);
      tabsHtml += `
        <button data-cat="${cat.idKategori}" class="cat-tab shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold ${isCatActive ? 'bg-brand-gold text-black border-brand-gold shadow-sm' : 'bg-white/5 text-zinc-300 border-white/10 hover:border-brand-gold/50'} transition">
          👑 ${cat.namaKategori}
        </button>
      `;
    });

    catContainer.innerHTML = tabsHtml;
  }

  // Set bingkai aktif sesuai kebijakan frame acara
  let targetFrame = availFrames[0] ? availFrames[0].id : 'GOLD_DECO';
  if (ev.frameLockMode === 'single') {
    const lockedFrame = ev.singleLockedFrame || targetFrame;
    const match = availFrames.find(f => f.id === lockedFrame) || availFrames[0];
    targetFrame = match ? match.id : 'GOLD_DECO';
  } else if (Array.isArray(ev.activeFrames) && ev.activeFrames.length > 0) {
    if (availFrames.some(f => f.id === STATE.activeFrame)) {
      targetFrame = STATE.activeFrame;
    } else {
      targetFrame = availFrames[0] ? availFrames[0].id : 'GOLD_DECO';
    }
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

  // Tampilkan navigasi bawah untuk tamu (hanya disembunyikan pada panel Admin)
  if (viewId === 'viewAdmin') {
    if (bottomNav) bottomNav.classList.add('hidden');
  } else {
    if (bottomNav) bottomNav.classList.remove('hidden');
  }

  // Persistensi halaman yang sedang aktif agar saat refresh tetap di halaman ini
  sessionStorage.setItem('snapevent_current_view', viewId);

  // Update Nav Buttons Active State
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('text-brand-gold');
    btn.classList.add('text-zinc-400');
  });

  if (viewId === 'viewCamera') {
    document.getElementById('navBtnCamera')?.classList.add('text-brand-gold');
    document.getElementById('navBtnCamera')?.classList.remove('text-zinc-400');
    const avail = getAvailableFrames();
    if (STATE.activeEvent && STATE.activeEvent.frameLockMode === 'single') {
      STATE.activeFrame = avail[0] ? avail[0].id : 'GOLD_DECO';
    } else if (!avail.some(f => f.id === STATE.activeFrame)) {
      STATE.activeFrame = avail[0] ? avail[0].id : 'GOLD_DECO';
    }
    applyActiveFrame(STATE.activeFrame);
    if (STATE.guestNama && !STATE.mediaStream) {
      startCameraStream();
    }
  } else {
    stopCameraStream();

    if (viewId === 'viewGallery') {
      document.getElementById('navBtnGallery')?.classList.add('text-brand-gold');
      document.getElementById('navBtnGallery')?.classList.remove('text-zinc-400');
      renderGallery();
      loadGallery();
    } else if (viewId === 'viewWelcome') {
      document.getElementById('navBtnEventInfo')?.classList.add('text-brand-gold');
      document.getElementById('navBtnEventInfo')?.classList.remove('text-zinc-400');
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
  
  const badgeEl = document.getElementById('vfActiveFrameBadge');
  if (badgeEl) badgeEl.textContent = selected ? selected.name : '';
  
  const activeFrameNameEl = document.getElementById('activeFrameName');
  if (activeFrameNameEl) activeFrameNameEl.textContent = (selected?.name || '').toUpperCase();
  
  document.querySelectorAll('#frameListContainer .frame-pill').forEach(pill => {
    const pId = pill.getAttribute('data-frame');
    if (pId === STATE.activeFrame) {
      pill.classList.remove('bg-white/5', 'text-zinc-300', 'border-white/10');
      pill.classList.add('bg-brand-gold', 'text-black', 'border-brand-gold', 'shadow-sm');
    } else {
      pill.classList.remove('bg-brand-gold', 'text-black', 'border-brand-gold', 'shadow-sm');
      pill.classList.add('bg-white/5', 'text-zinc-300', 'border-white/10');
    }
  });

  const customImgEl = document.getElementById('vfCustomFrameImg');
  const builtInOverlayEl = document.getElementById('viewfinderFrameOverlay');
  
  let customUrl = (selected && selected.dataUrl) ? selected.dataUrl : null;
  if (!customUrl && selected && (selected.type === 'custom' || selected.id === 'CUSTOM_EVENT')) {
    customUrl = STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl || STATE.tempCustomFrameData;
  }

  const isCustomFrame = Boolean(selected && (selected.type === 'custom' || selected.id === 'CUSTOM_EVENT') && customUrl);

  if (isCustomFrame) {
    if (customImgEl) {
      customImgEl.src = customUrl;
      customImgEl.classList.remove('hidden');
    }
    if (builtInOverlayEl) {
      builtInOverlayEl.classList.add('hidden');
    }
    preloadFrameImage(customUrl);
  } else {
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
        if (bt) bt.textContent = STATE.activeEvent ? STATE.activeEvent.namaEvent : 'Our Event';
        if (bh) bh.textContent = STATE.activeEvent ? STATE.activeEvent.hashtagEvent : '#SnapEvent';
        if (dt) dt.textContent = STATE.activeEvent ? STATE.activeEvent.tanggalEvent : '20.11.2026';
      }
    }
  }
}

// --- 5. BIND ALL EVENT LISTENERS ---
function bindEvents() {
  // Tombol Manual Sinkronisasi Galeri dengan Google Drive
  document.getElementById('btnSyncGalleryManual')?.addEventListener('click', async () => {
    showToast("🔄 Menyinkronkan album foto dengan Google Drive...", "info");
    await loadGallery();
    showToast("✅ Galeri foto telah sinkron dengan server Google Drive!", "success");
  });
  
  // Tombol Uji Koneksi & Sinkronisasi GAS
  document.getElementById('btnTestGasConnection')?.addEventListener('click', testGasConnection);
  
  // Tombol Bersihkan Cache Offline & Sync Ulang
  document.getElementById('btnAdminPurgeOfflineCache')?.addEventListener('click', purgeAllOfflineDataAndResync);
  
  // Tombol Edit Kata Gelar Juara Khusus Halaman Admin
  document.getElementById('btnAdminEditPodiumTitles')?.addEventListener('click', promptEditPodiumTitles);
  
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

  // Switcher Radio Mode Kebijakan Bingkai di Panel Admin
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

  // Listener Dropdown Single Frame Lock
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

  // Navigation Bar Buttons
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

  // Akses Cepat Galeri & Voting dari Halaman Tulis Nama
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
          galleryInput.value = '';
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
    startCameraStream();
  });

  // Filter Selector Pills
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

  // Live Camera Frame Selector Pills
  document.getElementById('frameListContainer')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.frame-pill');
    if (!pill) return;
    const chosenFrame = pill.getAttribute('data-frame');
    if (chosenFrame) {
      applyActiveFrame(chosenFrame);
    }
  });

  // Review Frame Selector Pills
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

  // Tambah Akun Pengguna / Operator Kru
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

  // Ganti Password Akun Pengguna
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

  // Gallery Category Tabs
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

  document.getElementById('btnGoActiveEvent')?.addEventListener('click', () => {
    window.location.href = window.location.pathname;
  });

  document.getElementById('btnSyncEventsBackend')?.addEventListener('click', () => {
    syncEventsFromBackend(true);
  });

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

    showToast("Mengoptimalkan resolusi bingkai kustom...", "info");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawDataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        let targetW = img.naturalWidth || img.width;
        let targetH = img.naturalHeight || img.height;
        const maxDimension = 1920;

        if (targetW > maxDimension || targetH > maxDimension) {
          if (targetW >= targetH) {
            targetH = Math.round((targetH * maxDimension) / targetW);
            targetW = maxDimension;
          } else {
            targetW = Math.round((targetW * maxDimension) / targetH);
            targetH = maxDimension;
          }
        }

        const optCanvas = document.createElement('canvas');
        optCanvas.width = targetW;
        optCanvas.height = targetH;
        const optCtx = optCanvas.getContext('2d');
        optCtx.imageSmoothingEnabled = true;
        optCtx.imageSmoothingQuality = 'high';
        optCtx.drawImage(img, 0, 0, targetW, targetH);

        const optimizedDataUrl = optCanvas.toDataURL('image/png');
        STATE.tempCustomFrameData = optimizedDataUrl;

        document.getElementById('customFramePreviewImg').src = optimizedDataUrl;
        document.getElementById('customFramePreviewBox').classList.remove('hidden');
        document.getElementById('btnRemoveCustomFrame').classList.remove('hidden');

        const targetEventId = document.getElementById('formEventId')?.value;
        const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
        renderAdminFrameSettings(currentEv);

        showToast("✨ Bingkai kustom PNG siap disimpan & diunggah ke Cloud!", "success");
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btnRemoveCustomFrame').addEventListener('click', () => {
    STATE.tempCustomFrameData = null;
    document.getElementById('formEventCustomFrame').value = '';
    document.getElementById('customFramePreviewBox').classList.add('hidden');
    document.getElementById('btnRemoveCustomFrame').classList.add('hidden');
    if (STATE.activeEvent) {
      STATE.activeEvent.customFrameData = '';
      STATE.activeEvent.customFrameUrl = '';
    }
    const targetEventId = document.getElementById('formEventId')?.value;
    const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
    if (currentEv) {
      currentEv.customFrameData = '';
      currentEv.customFrameUrl = '';
    }
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

    if (url) {
      showToast("Menyimpan ke Google Sheets & database cloud...", "info");
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'adminUpdateGlobalConfig',
            updates: {
              gas_webapp_url: url,
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
        showToast("⚠️ Tersimpan lokal, namun gagal sync ke Google Sheets: " + err.message, "error");
      }
    } else {
      const inputEl = document.getElementById('cfgGasUrl');
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEl.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => inputEl.classList.remove('ring-2', 'ring-amber-400'), 5000);
      }
      showToast("⚠️ PERHATIAN: Pengaturan HANYA tersimpan di browser ini! Masukkan URL Web App GAS pada kolom yang ditandai.", "warning");
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

  // Vote Category Modal Close
  document.getElementById('btnCloseVoteModal')?.addEventListener('click', () => {
    document.getElementById('modalVoteCategory')?.classList.add('hidden');
  });
  document.getElementById('modalVoteCategory')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalVoteCategory') {
      document.getElementById('modalVoteCategory').classList.add('hidden');
    }
  });

  document.getElementById('btnEmptyGoCamera').addEventListener('click', () => {
    showView('viewCamera');
  });
}

// --- 6. REALTIME CLOUD HEARTBEAT & EVENT LISTENERS BOOTSTRAP ---
setInterval(() => {
  if (!STATE.gasApiUrl || document.hidden || STATE.isSavingPhotoToDrive) return;
  const isGalleryOpen = !document.getElementById('viewGallery')?.classList.contains('hidden');
  const isSlideshowOpen = !document.getElementById('modalSlideshow')?.classList.contains('hidden');
  if (isGalleryOpen || isSlideshowOpen) {
    loadGallery().catch(err => console.warn("Live gallery auto-refresh note:", err));
  }
}, 5000);

setInterval(() => {
  if (STATE.gasApiUrl && !document.hidden && !STATE.isSavingPhotoToDrive) {
    loadEventData().catch(err => console.warn("Cloud heartbeat note:", err));
  }
}, 30000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && STATE.gasApiUrl) {
    loadEventData();
    loadGallery();
  }
});

// Bootstrap application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  initApp();
  bindEvents();
});
