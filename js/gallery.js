/**
 * ==============================================================================
 * SNAPEVENT: JS/GALLERY.JS
 * Live Gallery Synchronization, Optimistic Rendering, Voting System & Podium Showcase
 * ==============================================================================
 */

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
      const serverPhotos = Array.isArray(res.photos) ? res.photos : [];

      // Pertahankan hanya foto lokal yang benar-benar baru diambil dalam 60 detik terakhir dan sedang dalam proses unggah
      const nowMs = Date.now();
      const pendingLocalPhotos = (STATE.photos || []).filter(p => 
        p && p.isUploading === true && p.gdriveViewUrl && p.gdriveViewUrl.startsWith('data:') && (nowMs - (p._createdAtMs || nowMs) < 60000)
      );

      // Filter foto lokal pending: buang jika foto server dengan caption dan tamu yang sama sudah ada di server
      const filteredPending = pendingLocalPhotos.filter(localP => {
        return !serverPhotos.some(srvP => 
          srvP.idFoto === localP.idFoto || 
          (srvP.guestNama === localP.guestNama && srvP.caption === localP.caption && Math.abs((new Date(srvP.createdAt).getTime() || 0) - (localP._createdAtMs || 0)) < 120000)
        );
      });

      // Gabungkan dan deduplikasi ID secara unik + saring foto yang file Drive-nya sudah terhapus
      const deadIds = getDeadPhotoIds();
      let finalPhotos = [...filteredPending, ...serverPhotos];
      const seenPhotoIds = new Set();
      finalPhotos = finalPhotos.filter(p => {
        if (!p || !p.idFoto) return false;
        if (deadIds.has(p.idFoto)) return false;
        if (seenPhotoIds.has(p.idFoto)) return false;
        seenPhotoIds.add(p.idFoto);
        return true;
      });

      // Bandingkan signature foto & like untuk mencegah flicker DOM saat auto-refresh
      const oldSignature = (STATE.photos || []).map(p => `${p.idFoto}:${p.totalLikes || 0}:${p.isUploading}`).join('|');
      const newSignature = finalPhotos.map(p => `${p.idFoto}:${p.totalLikes || 0}:${p.isUploading}`).join('|');

      STATE.photos = finalPhotos;
      STATE.votedPhotoIds = res.votedPhotoIds || [];
      if (Array.isArray(res.categories) && res.categories.length > 0) {
        STATE.activeCategories = res.categories;
        applyEventToUI();
      }
      saveEventPhotos(targetId);

      // Re-render otomatis jika ada foto baru, perubahan status unggah, atau perolehan like bertambah
      if (oldSignature !== newSignature || !grid || !grid.children.length) {
        renderGallery();
      }

      if (filteredPending.length > 0) {
        autoUploadPendingPhotos(filteredPending);
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
    if (IN_FLIGHT_PHOTO_UPLOADS.has(photo.idFoto)) continue;

    IN_FLIGHT_PHOTO_UPLOADS.add(photo.idFoto);
    try {
      const payload = {
        action: "uploadPhoto",
        eventId: getResolvedEventId(photo.eventId || STATE.activeEventId),
        folderId: STATE.activeEvent?.gdriveFolderId || STATE.driveMasterId || "",
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
        const idx = STATE.photos.findIndex(p => p.idFoto === photo.idFoto);
        if (idx !== -1) {
          STATE.photos[idx].idFoto = res.idFoto || photo.idFoto;
          STATE.photos[idx].gdriveViewUrl = res.viewUrl || (res.fileId ? `https://lh3.googleusercontent.com/d/${res.fileId}` : photo.gdriveViewUrl);
          STATE.photos[idx].isUploading = false;
        }
        saveEventPhotos(STATE.activeEventId);
        renderGallery();
      }
    } catch (err) {
      console.warn("Auto-upload pending photo warning:", err.message);
    } finally {
      IN_FLIGHT_PHOTO_UPLOADS.delete(photo.idFoto);
    }
  }
}

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

  let filtered = Array.isArray(STATE.photos) ? [...STATE.photos] : [];
  filtered = filtered.filter(p => p && p.cameraStyle !== 'FRAME' && p.guestId !== 'SYSTEM_FRAME');

  if (STATE.activeGalleryFilter === 'POPULAR') {
    filtered = filtered.filter(p => (p.totalLikes || 0) > 0);
    filtered.sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));
  } else if (STATE.activeGalleryFilter && STATE.activeGalleryFilter !== 'ALL') {
    const activeCatId = STATE.activeGalleryFilter;
    filtered = filtered.filter(p => (p.categoryLikes && p.categoryLikes[activeCatId]) > 0);
    filtered.sort((a, b) => {
      const likesA = (a.categoryLikes && a.categoryLikes[activeCatId]) || 0;
      const likesB = (b.categoryLikes && b.categoryLikes[activeCatId]) || 0;
      if (likesB !== likesA) return likesB - likesA;
      return (b.totalLikes || 0) - (a.totalLikes || 0);
    });
  }

  if (countBadge) {
    if (STATE.activeGalleryFilter && STATE.activeGalleryFilter !== 'ALL' && STATE.activeGalleryFilter !== 'POPULAR') {
      countBadge.textContent = `${filtered.length} Foto Masuk Kategori`;
    } else if (STATE.activeGalleryFilter === 'POPULAR') {
      countBadge.textContent = `${filtered.length} Foto Terpopuler`;
    } else {
      countBadge.textContent = `${filtered.length} Foto`;
    }
  }

  if (filtered.length === 0) {
    if (grid) grid.innerHTML = '';
    if (empty) {
      empty.classList.remove('hidden');
      const emptyTitle = empty.querySelector('p.font-semibold');
      const emptyDesc = empty.querySelector('p.text-zinc-500');
      if (STATE.activeGalleryFilter && STATE.activeGalleryFilter !== 'ALL' && STATE.activeGalleryFilter !== 'POPULAR') {
        const catObj = (STATE.activeCategories || []).find(c => c.idKategori === STATE.activeGalleryFilter);
        const catName = catObj ? catObj.namaKategori : 'kategori ini';
        if (emptyTitle) emptyTitle.textContent = `Belum Ada Foto di Kategori "${catName}"`;
        if (emptyDesc) emptyDesc.textContent = 'Jadilah yang pertama memberikan suara like untuk kategori ini pada tab "Semua Foto"!';
      } else if (STATE.activeGalleryFilter === 'POPULAR') {
        if (emptyTitle) emptyTitle.textContent = 'Belum Ada Foto Terpopuler';
        if (emptyDesc) emptyDesc.textContent = 'Beri like pada foto-foto seru di tab "Semua Foto" untuk melihat yang paling populer!';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'Belum Ada Foto Terbit';
        if (emptyDesc) emptyDesc.textContent = 'Jadilah orang pertama yang mengabadikan momen malam ini!';
      }
    }
    return;
  }

  if (empty) empty.classList.add('hidden');
  if (grid) {
    grid.innerHTML = '';

    filtered.forEach(photo => {
      const isVoted = Array.isArray(STATE.votedPhotoIds) && STATE.votedPhotoIds.includes(photo.idFoto);
      const isCatFilter = Boolean(STATE.activeGalleryFilter && STATE.activeGalleryFilter !== 'ALL' && STATE.activeGalleryFilter !== 'POPULAR');
      const catLikes = isCatFilter ? ((photo.categoryLikes && photo.categoryLikes[STATE.activeGalleryFilter]) || 0) : null;
      
      const card = document.createElement('div');
      card.className = "group relative bg-brand-surfaceLight border border-brand-surfaceBorder rounded-xl overflow-hidden shadow-md flex flex-col justify-between";
      card.setAttribute('data-id', photo.idFoto);

      const likeBadgeText = isCatFilter ? `${catLikes} Suara Kategori` : `${photo.totalLikes || 0}`;

      card.innerHTML = `
        <div class="relative w-full aspect-[4/5] bg-black overflow-hidden cursor-pointer img-click-zone">
          <img src="${photo.gdriveViewUrl}" alt="${photo.guestNama || 'Foto'}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2.5">
            <span class="text-[11px] text-zinc-300 truncate">${photo.caption || photo.guestNama || ''}</span>
          </div>
        </div>
        <div class="p-2.5 flex items-center justify-between bg-brand-surfaceLight border-t border-white/5 gap-1.5">
          <div class="truncate min-w-0">
            <div class="text-[11px] font-bold text-white truncate">${photo.guestNama || 'Tamu'}</div>
            <div class="text-[9px] text-zinc-400 uppercase truncate">${photo.cameraStyle || '800T'}</div>
          </div>
          <button class="btn-like-photo shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isVoted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'} transition active:scale-90" data-id="${photo.idFoto}">
            <span>${isVoted ? '❤️' : '🤍'}</span>
            <span>${likeBadgeText}</span>
          </button>
        </div>
      `;

      const imgEl = card.querySelector('img');
      if (imgEl) {
        imgEl.onerror = () => {
          if (photo.gdriveViewUrl && photo.gdriveViewUrl.includes('lh3.googleusercontent.com/d/')) {
            const parts = photo.gdriveViewUrl.split('/d/');
            const fileId = parts[1]?.split('?')[0];
            if (fileId && !imgEl._hasTriedFallback) {
              imgEl._hasTriedFallback = true;
              imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1080`;
              return;
            }
          }
          // Bersihkan foto mati agar kartu hitam lenyap sepenuhnya
          markPhotoAsDead(photo.idFoto);
          card.remove();
        };
      }

      const clickZone = card.querySelector('.img-click-zone');
      if (clickZone) {
        clickZone.addEventListener('click', () => openPhotoZoom(photo));
      }

      const likeBtn = card.querySelector('.btn-like-photo');
      if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleVotePhoto(photo.idFoto);
        });
      }

      grid.appendChild(card);
    });
  }
}

function openVoteCategoryModal(photoId) {
  const modal = document.getElementById('modalVoteCategory');
  const container = document.getElementById('voteCategoryList');
  if (!modal || !container) return;

  const categories = Array.isArray(STATE.activeCategories) && STATE.activeCategories.length > 0 
    ? STATE.activeCategories 
    : (MOCK_DATA.categories || []);

  container.innerHTML = categories.map(cat => {
    const isAlreadyVotedInThisCat = STATE.votedCategoryIds.includes(cat.idKategori);
    if (isAlreadyVotedInThisCat) {
      return `
        <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 opacity-40 cursor-not-allowed">
          <div>
            <p class="text-xs font-semibold text-zinc-300">👑 ${cat.namaKategori}</p>
            <p class="text-[10px] text-zinc-500">${cat.deskripsi || 'Kategori resmi acara'}</p>
          </div>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            ✓ Sudah Dipilih (1x)
          </span>
        </div>
      `;
    } else {
      return `
        <button data-cat-id="${cat.idKategori}" class="btn-select-vote-cat w-full flex items-center justify-between p-3 rounded-xl bg-[#1D1D26] hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold transition text-left group">
          <div>
            <p class="text-xs font-bold text-white group-hover:text-brand-gold transition">👑 ${cat.namaKategori}</p>
            <p class="text-[10px] text-zinc-400">${cat.deskripsi || 'Klik untuk memberikan 1 suara'}</p>
          </div>
          <span class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-brand-gold text-black shadow-sm group-hover:scale-105 transition">
            Pilih Ini
          </span>
        </button>
      `;
    }
  }).join('');

  container.querySelectorAll('.btn-select-vote-cat').forEach(btn => {
    btn.onclick = () => {
      const chosenCatId = btn.getAttribute('data-cat-id');
      modal.classList.add('hidden');
      handleVotePhoto(photoId, chosenCatId);
    };
  });

  modal.classList.remove('hidden');
}

async function handleVotePhoto(idFoto, idKategori) {
  if (!idKategori) {
    openVoteCategoryModal(idFoto);
    return;
  }

  if (STATE.votedCategoryIds.includes(idKategori)) {
    showToast("Anda sudah memberikan voting pada kategori ini (Maksimal 1 kali voting per kategori)!", "warning");
    return;
  }

  if (STATE.votedPhotoIds.includes(idFoto)) {
    showToast("Anda sudah menyukai foto ini!", "warning");
    return;
  }

  const catObj = (STATE.activeCategories || []).find(c => c.idKategori === idKategori);
  const catName = catObj ? catObj.namaKategori : "Kategori Pilihan";

  STATE.votedPhotoIds.push(idFoto);
  STATE.votedCategoryIds.push(idKategori);
  saveEventVotes(STATE.activeEventId);

  const targetPhoto = STATE.photos.find(p => p.idFoto === idFoto);
  if (targetPhoto) {
    targetPhoto.totalLikes = (targetPhoto.totalLikes || 0) + 1;
  }
  renderGallery();

  const zoomLikesCount = document.getElementById('zoomLikesCount');
  if (zoomLikesCount && targetPhoto) {
    zoomLikesCount.textContent = `${targetPhoto.totalLikes} Suka`;
  }

  showToast(`✅ Suara Anda berhasil dicatat untuk kategori "${catName}"! ❤️`, "success");

  if (STATE.gasApiUrl) {
    try {
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
      const res = await resp.json();

      if (res && res.status === 'success') {
        if (typeof res.updatedLikes === 'number' && targetPhoto) {
          targetPhoto.totalLikes = res.updatedLikes;
          renderGallery();
        }
      } else if (res && res.status === 'already_voted') {
        showToast(res.message, "warning");
      }
    } catch (err) {
      console.warn("Sinkronisasi vote GAS:", err.message);
    }
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

  const deadIds = getDeadPhotoIds();
  const photos = (Array.isArray(STATE.photos) ? STATE.photos : []).filter(p => p && !deadIds.has(p.idFoto));
  const sorted = [...photos].sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0));
  if (countBadge) countBadge.textContent = `${sorted.length} Foto Pilihan`;

  if (sorted.length === 0 || (sorted[0].totalLikes || 0) === 0) {
    podium.innerHTML = `
      <div class="p-8 text-center bg-brand-surfaceLight border border-white/10 rounded-2xl max-w-sm mx-auto shadow-xl">
        <div class="text-4xl mb-2">🏆</div>
        <p class="text-sm font-bold text-white mb-1">Belum Ada Suara Terdaftar</p>
        <p class="text-xs text-zinc-400">Jadilah yang pertama memberikan like pada foto favorit di tab 'Semua Foto'!</p>
      </div>
    `;
    return;
  }

  const p1 = sorted[0];
  const p2 = sorted.length > 1 && (sorted[1].totalLikes || 0) > 0 ? sorted[1] : null;
  const p3 = sorted.length > 2 && (sorted[2].totalLikes || 0) > 0 ? sorted[2] : null;

  const titles = (STATE.activeEvent && STATE.activeEvent.podiumTitles) || {};
  const titleP1 = titles.p1 || (STATE.activeEvent && STATE.activeEvent.podiumTitleP1) || '👑 JUARA 1 EMAS';
  const titleP2 = titles.p2 || (STATE.activeEvent && STATE.activeEvent.podiumTitleP2) || '⭐ JUARA 2 PERAK';
  const titleP3 = titles.p3 || (STATE.activeEvent && STATE.activeEvent.podiumTitleP3) || '🥉 JUARA 3 PERUNGGU';

  const wMode = STATE.winnerDisplayFilter || 'ALL';

  let podiumHtml = `
    <div class="flex items-center justify-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl mb-6 max-w-sm mx-auto shadow-sm">
      <button data-wmode="ALL" class="winner-filter-pill flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition ${wMode === 'ALL' ? 'bg-brand-gold text-black shadow-md' : 'text-zinc-400 hover:text-white'}">
        🌟 Semua
      </button>
      <button data-wmode="OVERALL" class="winner-filter-pill flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition ${wMode === 'OVERALL' ? 'bg-brand-gold text-black shadow-md' : 'text-zinc-400 hover:text-white'}">
        🏆 Juara Umum
      </button>
      <button data-wmode="CATEGORIES" class="winner-filter-pill flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition ${wMode === 'CATEGORIES' ? 'bg-brand-gold text-black shadow-md' : 'text-zinc-400 hover:text-white'}">
        👑 Per Kategori
      </button>
    </div>
  `;

  // 1. PODIUM JUARA UMUM
  if (wMode === 'ALL' || wMode === 'OVERALL') {
    podiumHtml += `
      <div class="mb-8">
        <div class="flex items-center justify-between gap-2 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-lg">🌟</span>
            <h4 class="font-bold text-xs uppercase tracking-widest text-brand-gold">Podium Juara Umum Pesta</h4>
          </div>
          <span class="text-[10px] text-zinc-400">Total Akumulasi Suka</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Juara 1 -->
          <div class="podium-card-gold winner-podium-card rounded-2xl p-5 text-center flex flex-col items-center cursor-pointer select-none relative overflow-hidden transition duration-300 hover:scale-[1.03]" data-photo-id="${p1.idFoto}" title="Klik untuk memperbesar foto Juara 1">
            <div class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-black text-xs font-black uppercase tracking-wider mb-3 shadow-lg shadow-amber-500/30">
              <span>${titleP1}</span>
            </div>
            <div class="w-36 h-44 rounded-xl overflow-hidden bg-black mb-3 border-2 border-brand-gold shadow-2xl relative">
              <img src="${p1.gdriveViewUrl}" alt="${p1.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300" onerror="this.onerror=null; if(this.src.includes('/d/')){const fid=this.src.split('/d/')[1]?.split('?')[0]; if(fid) this.src='https://drive.google.com/thumbnail?id='+fid+'&sz=w1080';} else { this.parentElement.parentElement.remove(); }" />
              <span class="absolute top-1.5 right-1.5 text-xs bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full text-brand-gold font-bold">🥇 1st</span>
            </div>
            <h4 class="font-serif font-bold text-base text-white truncate max-w-[200px]">${p1.guestNama || 'Tamu'}</h4>
            <p class="text-xs text-amber-200/80 italic truncate max-w-[200px] mb-2.5">"${p1.caption || 'Tanpa ucapan'}"</p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/25 text-brand-gold text-xs font-black border border-brand-gold/50 shadow-sm">
              <span>❤️</span>
              <span>${p1.totalLikes || 0} Suka (Grand Champion)</span>
            </div>
            <span class="text-[10px] text-brand-gold/80 mt-2 font-medium flex items-center gap-1">🔍 Klik untuk perbesar</span>
          </div>
    `;

    if (p2) {
      podiumHtml += `
          <!-- Juara 2 -->
          <div class="podium-card-silver winner-podium-card rounded-2xl p-4 text-center flex flex-col items-center cursor-pointer select-none transition duration-300 hover:scale-[1.02]" data-photo-id="${p2.idFoto}" title="Klik untuk memperbesar foto Juara 2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-zinc-200 via-white to-zinc-300 text-black text-[11px] font-black uppercase tracking-wider mb-2.5 shadow-md">
              <span>${titleP2}</span>
            </div>
            <div class="w-32 h-40 rounded-xl overflow-hidden bg-black mb-2.5 border-2 border-zinc-300/60 shadow-xl relative">
              <img src="${p2.gdriveViewUrl}" alt="${p2.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300" onerror="this.onerror=null; if(this.src.includes('/d/')){const fid=this.src.split('/d/')[1]?.split('?')[0]; if(fid) this.src='https://drive.google.com/thumbnail?id='+fid+'&sz=w1080';} else { this.parentElement.parentElement.remove(); }" />
              <span class="absolute top-1.5 right-1.5 text-xs bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full text-zinc-200 font-bold">🥈 2nd</span>
            </div>
            <h4 class="font-bold text-sm text-white truncate max-w-[170px]">${p2.guestNama || 'Tamu'}</h4>
            <p class="text-xs text-zinc-300 italic truncate max-w-[170px] mb-2">"${p2.caption || 'Tanpa ucapan'}"</p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-zinc-200 text-xs font-bold border border-white/20">
              <span>❤️</span>
              <span>${p2.totalLikes || 0} Suka Total</span>
            </div>
            <span class="text-[10px] text-zinc-400 mt-2 font-medium flex items-center gap-1">🔍 Klik untuk perbesar</span>
          </div>
      `;
    }

    if (p3) {
      podiumHtml += `
          <!-- Juara 3 -->
          <div class="podium-card-bronze winner-podium-card rounded-2xl p-4 text-center flex flex-col items-center cursor-pointer select-none transition duration-300 hover:scale-[1.02]" data-photo-id="${p3.idFoto}" title="Klik untuk memperbesar foto Juara 3">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white text-[11px] font-black uppercase tracking-wider mb-2.5 shadow-md">
              <span>${titleP3}</span>
            </div>
            <div class="w-32 h-40 rounded-xl overflow-hidden bg-black mb-2.5 border-2 border-amber-600/60 shadow-xl relative">
              <img src="${p3.gdriveViewUrl}" alt="${p3.guestNama}" class="w-full h-full object-cover hover:scale-105 transition duration-300" onerror="this.onerror=null; if(this.src.includes('/d/')){const fid=this.src.split('/d/')[1]?.split('?')[0]; if(fid) this.src='https://drive.google.com/thumbnail?id='+fid+'&sz=w1080';} else { this.parentElement.parentElement.remove(); }" />
              <span class="absolute top-1.5 right-1.5 text-xs bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full text-amber-200 font-bold">🥉 3rd</span>
            </div>
            <h4 class="font-bold text-sm text-white truncate max-w-[170px]">${p3.guestNama || 'Tamu'}</h4>
            <p class="text-xs text-amber-200/70 italic truncate max-w-[170px] mb-2">"${p3.caption || 'Tanpa ucapan'}"</p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-600/20 text-amber-300 text-xs font-bold border border-amber-600/40">
              <span>❤️</span>
              <span>${p3.totalLikes || 0} Suka Total</span>
            </div>
            <span class="text-[10px] text-amber-300/70 mt-2 font-medium flex items-center gap-1">🔍 Klik untuk perbesar</span>
          </div>
      `;
    }

    podiumHtml += `
        </div>
      </div>
    `;
  }

  // 2. HASIL JUARA PER KATEGORI VOTING
  const cats = Array.isArray(STATE.activeCategories) ? STATE.activeCategories : [];
  if (cats.length > 0 && (wMode === 'ALL' || wMode === 'CATEGORIES')) {
    podiumHtml += `
      <div class="mt-4 pt-4 border-t border-white/10">
        <div class="flex items-center justify-between gap-2 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-lg">👑</span>
            <h4 class="font-bold text-xs uppercase tracking-widest text-amber-300">Pemenang per Kategori Voting</h4>
          </div>
          <span class="text-[10px] text-zinc-400">Vote Spesifik Kategori</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
    `;

    cats.forEach(cat => {
      let topCatPhoto = null;
      let maxCatLikes = 0;
      photos.forEach(p => {
        const cLikes = (p.categoryLikes && p.categoryLikes[cat.idKategori]) || 0;
        if (cLikes > maxCatLikes) {
          maxCatLikes = cLikes;
          topCatPhoto = p;
        }
      });

      if (topCatPhoto && maxCatLikes > 0) {
        podiumHtml += `
          <div class="winner-podium-card flex items-center gap-3 p-3.5 rounded-2xl bg-brand-surfaceLight border border-brand-gold/40 hover:border-brand-gold transition duration-200 cursor-pointer select-none group shadow-md" data-photo-id="${topCatPhoto.idFoto}" title="Klik untuk perbesar foto pemenang kategori ${cat.namaKategori}">
            <div class="w-16 h-20 rounded-xl overflow-hidden bg-black shrink-0 border border-brand-gold/60 shadow-md">
              <img src="${topCatPhoto.gdriveViewUrl}" alt="${topCatPhoto.guestNama}" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.onerror=null; if(this.src.includes('/d/')){const fid=this.src.split('/d/')[1]?.split('?')[0]; if(fid) this.src='https://drive.google.com/thumbnail?id='+fid+'&sz=w1080';} else { this.parentElement.parentElement.remove(); }" />
            </div>
            <div class="min-w-0 flex-1">
              <span class="inline-block text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full mb-1">
                👑 ${cat.namaKategori}
              </span>
              <h5 class="font-bold text-sm text-white truncate">${topCatPhoto.guestNama || 'Tamu'}</h5>
              <p class="text-xs text-zinc-400 italic truncate mb-1.5">"${topCatPhoto.caption || 'Momen seru!'}"</p>
              <div class="inline-flex items-center gap-1 text-[11px] font-bold text-brand-gold bg-brand-gold/10 px-2.5 py-0.5 rounded-lg border border-brand-gold/25">
                <span>❤️</span>
                <span>${maxCatLikes} Suara</span>
              </div>
            </div>
          </div>
        `;
      } else {
        podiumHtml += `
          <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-brand-surfaceLight/40 border border-white/5 opacity-60">
            <div class="w-16 h-20 rounded-xl bg-white/5 flex items-center justify-center text-2xl shrink-0 border border-white/5 text-zinc-500">
              👑
            </div>
            <div class="min-w-0 flex-1">
              <span class="inline-block text-[10px] font-semibold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full mb-1">
                👑 ${cat.namaKategori}
              </span>
              <p class="text-xs text-zinc-400">Belum ada suara masuk untuk kategori ini.</p>
            </div>
          </div>
        `;
      }
    });

    podiumHtml += `
        </div>
      </div>
    `;
  }

  podium.innerHTML = podiumHtml;

  // Pasang Handler Filter Mode Pemenang
  podium.querySelectorAll('.winner-filter-pill').forEach(btn => {
    btn.onclick = () => {
      STATE.winnerDisplayFilter = btn.getAttribute('data-wmode') || 'ALL';
      renderVotingWinners();
    };
  });

  // Pasang Handler Klik Perbesar Foto Pemenang
  podium.querySelectorAll('.winner-podium-card').forEach(card => {
    card.onclick = () => {
      const pId = card.getAttribute('data-photo-id');
      const targetP = photos.find(p => p.idFoto === pId);
      if (targetP) openPhotoZoom(targetP);
    };
  });
}

function openPhotoZoom(photo) {
  const zoomEl = document.getElementById('zoomImg');
  zoomEl.src = photo.gdriveViewUrl;
  zoomEl.onerror = () => {
    if (photo.gdriveViewUrl && photo.gdriveViewUrl.includes('lh3.googleusercontent.com/d/')) {
      const parts = photo.gdriveViewUrl.split('/d/');
      const fileId = parts[1]?.split('?')[0];
      if (fileId) zoomEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`;
    }
  };
  document.getElementById('zoomGuestNama').textContent = `Oleh: ${photo.guestNama}`;
  document.getElementById('zoomTime').textContent = photo.createdAt || 'Baru Saja';
  document.getElementById('zoomCaption').textContent = photo.caption ? `"${photo.caption}"` : '';
  document.getElementById('zoomLikesCount').textContent = `${photo.totalLikes || 0} Suka`;

  const btnVote = document.getElementById('btnZoomVote');
  btnVote.onclick = () => openVoteCategoryModal(photo.idFoto);

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

async function handleSavePhotoToDrive() {
  if (STATE.isSavingPhotoToDrive) return;
  STATE.isSavingPhotoToDrive = true;
  const btnSave = document.getElementById('btnSaveToDrive');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.classList.add('opacity-50', 'pointer-events-none');
  }

  const caption = document.getElementById('inputPhotoCaption').value.trim();

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

  const targetEventId = getResolvedEventId(STATE.activeEventId);
  const dataUrlToSave = STATE.currentCapturedDataUrl;
  const tempPhotoId = "FTO-" + Date.now();

  // 1. Simpan Langsung ke Galeri / Download HP Tamu
  downloadPhotoToDevice(dataUrlToSave, tempPhotoId);

  // 2. Simpan ke Galeri Lokal Aplikasi (Optimistic UI)
  const localPhoto = {
    idFoto: tempPhotoId,
    eventId: targetEventId,
    guestId: STATE.guestId,
    guestNama: STATE.guestNama || "Tamu",
    caption: caption || "Momen seru!",
    cameraStyle: STATE.activeFilter || "RAW",
    frameStyle: STATE.activeFrame || "POLAROID",
    gdriveViewUrl: dataUrlToSave,
    totalLikes: 0,
    isFeatured: false,
    createdAt: "Baru Saja",
    isUploading: true,
    _isUploadStarted: true,
    _createdAtMs: Date.now()
  };

  STATE.photos = [localPhoto, ...(STATE.photos || []).filter(p => p.idFoto !== tempPhotoId)];
  saveEventPhotos(targetEventId);

  // 3. Tutup Modal Review Segera
  document.getElementById('modalReviewPhoto').classList.add('hidden');
  updateRemainingQuotaDisplay();
  updateGuestIdentityUI();
  showToast("💾 Foto tersimpan di HP! Mengunggah ke server di latar belakang...", "info");

  setTimeout(() => {
    STATE.isSavingPhotoToDrive = false;
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.classList.remove('opacity-50', 'pointer-events-none');
    }
  }, 1000);

  document.getElementById('inputPhotoCaption').value = "";

  // 4. Background Upload ke Google Drive
  if (STATE.gasApiUrl) {
    if (IN_FLIGHT_PHOTO_UPLOADS.has(tempPhotoId)) return;
    IN_FLIGHT_PHOTO_UPLOADS.add(tempPhotoId);

    (async () => {
      try {
        const payload = {
          action: "uploadPhoto",
          eventId: targetEventId,
          folderId: STATE.activeEvent?.gdriveFolderId || STATE.driveMasterId || "",
          guestId: STATE.guestId,
          guestNama: STATE.guestNama || "Tamu",
          caption: caption || "Momen seru!",
          cameraStyle: STATE.activeFilter || "RAW",
          frameStyle: STATE.activeFrame || "POLAROID",
          imageBase64: dataUrlToSave
        };

        const resp = await fetch(STATE.gasApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const res = await resp.json();

        if (res && res.status === 'success') {
          const idx = STATE.photos.findIndex(p => p.idFoto === tempPhotoId);
          if (idx !== -1) {
            STATE.photos[idx].idFoto = res.idFoto || tempPhotoId;
            STATE.photos[idx].gdriveViewUrl = res.viewUrl || (res.fileId ? `https://lh3.googleusercontent.com/d/${res.fileId}` : dataUrlToSave);
            STATE.photos[idx].isUploading = false;
            STATE.photos[idx]._isUploadStarted = false;
            STATE.photos[idx].uploadPending = false;
          }
          if (res.folderId && STATE.activeEvent && !STATE.activeEvent.gdriveFolderId) {
            STATE.activeEvent.gdriveFolderId = res.folderId;
            localStorage.setItem('snapevent_events', JSON.stringify(STATE.events));
          }
          saveEventPhotos(targetEventId);
          showToast("☁️ Foto berhasil terunggah ke Google Drive & Galeri Acara!", "success");
          if (!document.getElementById('viewGallery')?.classList.contains('hidden')) {
            renderGallery();
          }
        } else if (res && res.status === 'limit_reached') {
          showToast(res.message || "Batas kuota foto acara telah tercapai.", "warning");
        }
      } catch (bgErr) {
        console.warn("Background upload warning:", bgErr.message);
        const idx = STATE.photos.findIndex(p => p.idFoto === tempPhotoId);
        if (idx !== -1) {
          STATE.photos[idx].isUploading = false;
          STATE.photos[idx]._isUploadStarted = false;
          STATE.photos[idx].uploadPending = true;
        }
      } finally {
        IN_FLIGHT_PHOTO_UPLOADS.delete(tempPhotoId);
      }
    })();
  }
}
