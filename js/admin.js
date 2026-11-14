/**
 * ==============================================================================
 * SNAPEVENT: JS/ADMIN.JS
 * Admin Dashboard, Multi-Event CRUD, Custom Frame Engine & Global Settings
 * ==============================================================================
 */

function openAdminPanel() {
  if (sessionStorage.getItem('snapevent_admin_session') === 'true') {
    showView('viewAdmin');
    renderAdminDashboard();
    syncEventsFromBackend(false);
    return;
  }
  const modal = document.getElementById('modalAdminPin');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('inputAdminUser').value = '';
    document.getElementById('inputAdminPass').value = '';
  }
}

async function verifyAdminLogin() {
  const user = document.getElementById('inputAdminUser').value.trim();
  const pass = document.getElementById('inputAdminPass').value.trim();

  if (!user || !pass) {
    showToast("Masukkan Username dan Password Admin!", "warning");
    return;
  }

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

  return [
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
  const radSingle = document.querySelector('input[name="frameLockModeRadio"][value="single"]');
  if (radSingle) radSingle.checked = true;

  document.getElementById('containerSingleFrameLock')?.classList.remove('hidden');
  document.getElementById('containerMultiFrameSelection')?.classList.add('hidden');

  const singleSelect = document.getElementById('formEventSingleFrameSelect');
  if (singleSelect) {
    singleSelect.value = frameId;
  }

  const targetEventId = document.getElementById('formEventId')?.value;
  const currentEv = (STATE.events && STATE.events.find(evItem => evItem.idEvent === targetEventId)) || STATE.activeEvent;
  if (currentEv) {
    currentEv.frameLockMode = 'single';
    currentEv.singleLockedFrame = frameId;
  }

  renderAdminFrameSettings(currentEv);
  document.getElementById('containerSingleFrameLock')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`🔒 Bingkai "${frameName || frameId}" berhasil dikunci sebagai 1 bingkai seragam wajib acara!`, "success");
}

function getAllAdminCandidateFrames(eventObj) {
  const frames = [
    { id: 'GOLD_DECO', name: '✨ Gold Deco', type: 'builtin', icon: '✨' },
    { id: 'POLAROID', name: '📷 Polaroid', type: 'builtin', icon: '📷' },
    { id: 'MINIMAL', name: '▪️ Minimalist', type: 'builtin', icon: '▪️' },
    { id: 'NONE', name: 'Tanpa Bingkai', type: 'builtin', icon: '🚫' }
  ];

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

  let activeOrder = [];
  if (eventObj && Array.isArray(eventObj.activeFrames) && eventObj.activeFrames.length > 0) {
    activeOrder = [...eventObj.activeFrames];
  } else {
    activeOrder = ['GOLD_DECO', 'POLAROID', 'MINIMAL'];
    if (candidateFrames.some(f => f.id === 'CUSTOM_EVENT')) {
      activeOrder.unshift('CUSTOM_EVENT');
    }
  }

  const eventCustomData = STATE.tempCustomFrameData || eventObj?.customFrameData || eventObj?.customFrameUrl;
  const sortedFrames = [];
  activeOrder.forEach(id => {
    const found = candidateFrames.find(f => 
      f.id === id || 
      ((id === 'CUSTOM_EVENT' || id === 'CUSTOM' || String(id).indexOf('frame_') === 0) && (f.id === 'CUSTOM_EVENT' || f.type === 'custom' || (eventCustomData && f.dataUrl === eventCustomData)))
    );
    if (found && !sortedFrames.some(s => s.id === found.id)) {
      sortedFrames.push(found);
    }
  });
  candidateFrames.forEach(f => {
    if (!sortedFrames.some(s => s.id === f.id)) {
      sortedFrames.push(f);
    }
  });

  const currentLocked = eventObj?.singleLockedFrame || sortedFrames[0]?.id || 'GOLD_DECO';

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

  renderSingleLockCustomFrameList(sortedFrames, currentLocked);

  if (container) {
    container.innerHTML = '';
    sortedFrames.forEach((frame) => {
      const isCustomMatch = (frame.id === 'CUSTOM_EVENT' || frame.type === 'custom') && activeOrder.some(a => a === 'CUSTOM_EVENT' || a === 'CUSTOM' || String(a).indexOf('frame_') === 0);
      const isChecked = activeOrder.includes(frame.id) || isCustomMatch || (frame.id === 'CUSTOM_EVENT' && !eventObj) || (frame.id !== 'NONE' && !eventObj);
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
  document.getElementById('formEventMaxVote').value = "3";
  document.getElementById('formEventDriveFolder').value = "";
  document.getElementById('formEventFrameName').value = "";

  const elP1 = document.getElementById('formEventPodiumP1');
  const elP2 = document.getElementById('formEventPodiumP2');
  const elP3 = document.getElementById('formEventPodiumP3');
  if (elP1) elP1.value = "👑 JUARA 1 EMAS";
  if (elP2) elP2.value = "⭐ JUARA 2 PERAK";
  if (elP3) elP3.value = "🥉 JUARA 3 PERUNGGU";

  const radSegera = document.querySelector('input[name="revealModeRadio"][value="SEGERA"]');
  if (radSegera) radSegera.checked = true;
  document.getElementById('formCheckLike').checked = true;
  document.getElementById('formCheckVisibility').checked = true;

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
    }

    if (document.getElementById('cfgGasUrl')) document.getElementById('cfgGasUrl').value = STATE.gasApiUrl;
    if (document.getElementById('cfgAppTitle')) document.getElementById('cfgAppTitle').value = STATE.appTitle;
    if (document.getElementById('cfgAppLogoUrl')) document.getElementById('cfgAppLogoUrl').value = STATE.appLogoUrl;
    if (document.getElementById('cfgAppPhone')) document.getElementById('cfgAppPhone').value = STATE.appPhone;
    if (document.getElementById('cfgAppInstagram')) document.getElementById('cfgAppInstagram').value = STATE.appInstagram;
    if (document.getElementById('cfgAdminUser')) document.getElementById('cfgAdminUser').value = STATE.adminUser;
    if (document.getElementById('cfgAdminPass')) document.getElementById('cfgAdminPass').value = STATE.adminPass;
    if (document.getElementById('cfgDriveMasterId')) document.getElementById('cfgDriveMasterId').value = STATE.driveMasterId;

    renderUserAccountsList();
    renderCustomFramesList();
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
  if (!container) return;
  const deadIds = getDeadPhotoIds();
  const sorted = [...STATE.photos].filter(p => p && !deadIds.has(p.idFoto)).sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));

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
        <img src="${p.gdriveViewUrl}" class="w-10 h-10 rounded-lg object-cover" onerror="this.onerror=null; if(this.src.includes('/d/')){const fid=this.src.split('/d/')[1]?.split('?')[0]; if(fid) this.src='https://drive.google.com/thumbnail?id='+fid+'&sz=w1080';} else { this.parentElement.parentElement.remove(); }" />
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

  const pTitles = ev.podiumTitles || {};
  const p1Val = pTitles.p1 || ev.podiumTitleP1 || "👑 JUARA 1 EMAS";
  const p2Val = pTitles.p2 || ev.podiumTitleP2 || "⭐ JUARA 2 PERAK";
  const p3Val = pTitles.p3 || ev.podiumTitleP3 || "🥉 JUARA 3 PERUNGGU";
  const elP1 = document.getElementById('formEventPodiumP1');
  const elP2 = document.getElementById('formEventPodiumP2');
  const elP3 = document.getElementById('formEventPodiumP3');
  if (elP1) elP1.value = p1Val;
  if (elP2) elP2.value = p2Val;
  if (elP3) elP3.value = p3Val;

  const frameData = ev.customFrameData || ev.customFrameUrl;
  const previewBox = document.getElementById('customFramePreviewBox');
  const previewImg = document.getElementById('customFramePreviewImg');
  const btnRemove = document.getElementById('btnRemoveCustomFrame');

  if (frameData) {
    previewImg.src = frameData;
    previewBox.classList.remove('hidden');
    btnRemove.classList.remove('hidden');
    STATE.tempCustomFrameData = null;
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

  const isSingle = (ev.frameLockMode === 'single');
  const radSingle = document.querySelector('input[name="frameLockModeRadio"][value="single"]');
  const radMulti = document.querySelector('input[name="frameLockModeRadio"][value="multi"]');
  if (isSingle && radSingle) radSingle.checked = true;
  else if (radMulti) radMulti.checked = true;

  const containerSingle = document.getElementById('containerSingleFrameLock');
  const containerMulti = document.getElementById('containerMultiFrameSelection');
  if (containerSingle) containerSingle.classList.toggle('hidden', !isSingle);
  if (containerMulti) containerMulti.classList.toggle('hidden', isSingle);

  renderAdminFrameSettings(ev);
  renderCategoryInputRows(STATE.activeCategories);
}

function renderCategoryInputRows(cats) {
  const container = document.getElementById('categoryInputsContainer');
  if (!container) return;
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
    document.getElementById(id)?.classList.add('hidden');
  });

  if (tabName === 'events') document.getElementById('adminTabEvents')?.classList.remove('hidden');
  if (tabName === 'create') document.getElementById('adminTabCreate')?.classList.remove('hidden');
  if (tabName === 'leaderboard') document.getElementById('adminTabLeaderboard')?.classList.remove('hidden');
  if (tabName === 'settings') document.getElementById('adminTabSettings')?.classList.remove('hidden');
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
  const targetEventId = document.getElementById('formEventId').value || 'EVT-' + Date.now();
  const existingEv = (STATE.events && STATE.events.find(e => e.idEvent === targetEventId)) || {};

  const rawDriveFolder = extractDriveFolderId(document.getElementById('formEventDriveFolder').value.trim());
  const driveFolder = rawDriveFolder || existingEv?.gdriveFolderId || (STATE.activeEvent && STATE.activeEvent.idEvent === targetEventId ? STATE.activeEvent.gdriveFolderId : '') || '';

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

  let customFrameToSend = '';
  if (STATE.tempCustomFrameData && typeof STATE.tempCustomFrameData === 'string' && STATE.tempCustomFrameData.startsWith('data:image/') && STATE.gasApiUrl) {
    try {
      if (submitBtn) {
        submitBtn.innerHTML = `
          <div class="flex items-center justify-center gap-2">
            <div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <span>Mengunggah Bingkai Kustom ke Cloud Drive...</span>
          </div>
        `;
      }
      const frameUploadResp = await fetch(STATE.gasApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'uploadCustomFrame',
          eventId: targetEventId,
          folderId: driveFolder || STATE.activeEvent?.gdriveFolderId || "",
          imageBase64: STATE.tempCustomFrameData
        })
      });
      const frameUploadRes = await frameUploadResp.json();
      if (frameUploadRes && (frameUploadRes.viewUrl || frameUploadRes.fileId)) {
        const cloudUrl = frameUploadRes.viewUrl || ('https://lh3.googleusercontent.com/d/' + frameUploadRes.fileId);
        customFrameToSend = cloudUrl;
        STATE.tempCustomFrameData = null;
      }
    } catch (fErr) {
      console.warn("Upload bingkai kustom via uploadCustomFrame:", fErr.message);
    }
  }

  if (!customFrameToSend) {
    if (STATE.tempCustomFrameData && STATE.tempCustomFrameData.startsWith('http')) {
      customFrameToSend = STATE.tempCustomFrameData;
    } else if (existingEv && existingEv.customFrameUrl && existingEv.customFrameUrl.startsWith('http')) {
      customFrameToSend = existingEv.customFrameUrl;
    } else if (STATE.activeEvent && STATE.activeEvent.customFrameUrl && STATE.activeEvent.customFrameUrl.startsWith('http')) {
      customFrameToSend = STATE.activeEvent.customFrameUrl;
    }
  }

  // PROTEKSI MUTLAK GAS 50.000 KARAKTER:
  if (customFrameToSend && (customFrameToSend.startsWith('data:') || customFrameToSend.length > 500)) {
    console.warn("Mencegah error Google Sheets 50.000 karakter: URL bingkai dinetralkan.");
    customFrameToSend = (existingEv && existingEv.customFrameUrl && existingEv.customFrameUrl.startsWith('http'))
      ? existingEv.customFrameUrl
      : '';
  }
  const customFrameData = customFrameToSend;

  let frameLockMode = 'multi';
  document.getElementsByName('frameLockModeRadio').forEach(r => {
    if (r.checked) frameLockMode = r.value;
  });

  let singleLockedFrame = document.getElementById('formEventSingleFrameSelect')?.value || 'GOLD_DECO';
  if (singleLockedFrame.indexOf('frame_') === 0) {
    singleLockedFrame = 'CUSTOM_EVENT';
  }

  const podiumP1 = document.getElementById('formEventPodiumP1')?.value.trim() || "👑 JUARA 1 EMAS";
  const podiumP2 = document.getElementById('formEventPodiumP2')?.value.trim() || "⭐ JUARA 2 PERAK";
  const podiumP3 = document.getElementById('formEventPodiumP3')?.value.trim() || "🥉 JUARA 3 PERUNGGU";
  const podiumTitles = { p1: podiumP1, p2: podiumP2, p3: podiumP3 };

  let activeFrames = [];
  if (frameLockMode === 'single') {
    activeFrames = [singleLockedFrame];
  } else {
    document.querySelectorAll('#adminFrameSortableList .frame-sortable-item').forEach(item => {
      const chk = item.querySelector('.adm-frame-check');
      if (chk && chk.checked) {
        let val = chk.value;
        if (val.indexOf('frame_') === 0) val = 'CUSTOM_EVENT';
        if (!activeFrames.includes(val)) activeFrames.push(val);
      }
    });
    if (activeFrames.length === 0) {
      document.querySelectorAll('.adm-frame-check').forEach(chk => {
        if (chk.checked) {
          let val = chk.value;
          if (val.indexOf('frame_') === 0) val = 'CUSTOM_EVENT';
          if (!activeFrames.includes(val)) activeFrames.push(val);
        }
      });
    }
    if (activeFrames.length === 0) activeFrames = ['GOLD_DECO', 'POLAROID', 'MINIMAL'];
  }

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
    customFrameData: getSafeFrameHttpUrl(customFrameData),
    customFrameUrl: getSafeFrameHttpUrl(customFrameData),
    podiumTitles: podiumTitles,
    categories: cats
  });

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

  if (!Array.isArray(STATE.events)) STATE.events = [];
  const existingIdx = STATE.events.findIndex(e => e.idEvent === savedEvent.idEvent);
  if (existingIdx >= 0) {
    STATE.events[existingIdx] = savedEvent;
  } else {
    STATE.events.unshift(savedEvent);
  }
  localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));

  if (savedEvent.idEvent === STATE.activeEventId || STATE.events.length === 1) {
    STATE.activeEventId = savedEvent.idEvent;
    STATE.activeEvent = savedEvent;
    STATE.activeCategories = cats;
    applyEventToUI();
  }

  if (STATE.gasApiUrl) {
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <div class="flex items-center justify-center gap-2">
            <div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <span>Mengunggah Pengaturan & Bingkai ke Cloud...</span>
          </div>
        `;
      }

      const resp = await fetch(STATE.gasApiUrl, {
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
          customFrameUrl: getSafeFrameHttpUrl(customFrameData),
          podiumTitles: podiumTitles,
          categories: cats
        })
      });

      let res = null;
      try { res = await resp.json(); } catch (jsonErr) {}
      if (res && res.status === 'success') {
        if (res.customFrameUrl) {
          savedEvent.customFrameUrl = res.customFrameUrl;
          savedEvent.customFrameData = res.customFrameUrl;
          if (STATE.activeEvent && STATE.activeEvent.idEvent === savedEvent.idEvent) {
            STATE.activeEvent.customFrameUrl = res.customFrameUrl;
            STATE.activeEvent.customFrameData = res.customFrameUrl;
          }
          localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
        }
        showToast("☁️ Bingkai Kustom & Pengaturan Acara Sukses Diunggah ke Cloud Server!", "success");
      } else if (res && res.status === 'error') {
        console.warn("GAS simpan peringatan:", res.message);
        showToast("Peringatan GAS: " + res.message, "warning");
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
    const resp = await fetch(`${url}?action=testConnection`, {
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

async function purgeAllOfflineDataAndResync() {
  if (!confirm("Bersihkan cache offline dan sinkronkan ulang seluruh data foto & acara langsung dari Cloud Server Google Apps Script?")) {
    return;
  }

  showToast("🧹 Membersihkan seluruh cache foto offline...", "info");

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('snapevent_photos') || k.startsWith('snapevent_votes') || k.startsWith('snapevent_voted') || k.startsWith('snapevent_dead'))) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  STATE.photos = [];
  STATE.votedPhotoIds = [];
  STATE.votedCategoryIds = [];

  if (STATE.gasApiUrl) {
    try {
      showToast("☁️ Mengunduh data terbaru & membersihkan foto usang...", "info");
      try {
        await fetch(STATE.gasApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'cleanDeletedPhotos' })
        });
      } catch(cErr) {}
      await loadEventData();
      await loadGallery();
      applyEventToUI();
      applyGlobalConfigToUI();
      renderGallery();
      renderAdminDashboard();
      showToast("✅ Sinkronisasi tuntas! Semua data kini 100% identik dengan server cloud.", "success");
    } catch (err) {
      console.warn("Purge resync warning:", err.message);
      showToast("Peringatan saat sinkronisasi cloud: " + err.message, "warning");
    }
  } else {
    renderGallery();
    showToast("Cache lokal foto berhasil dibersihkan.", "info");
  }
}
