/**
 * ==============================================================================
 * SNAPEVENT: JS/CAMERA.JS
 * Live Camera Stream Lifecycle, Color Filters, Canvas HD Frame Renderer & WYSIWYG Capture
 * ==============================================================================
 */

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

    let stream;
    const isPortrait = window.innerHeight >= window.innerWidth;

    try {
      // 1. Prioritaskan Mode Kualitas Full HD Sensor (1080p - 4K ideal, responsif orientasi ponsel)
      const hdConstraints = {
        video: {
          facingMode: { ideal: STATE.facingMode },
          width: { ideal: isPortrait ? 1080 : 1920, max: 3840 },
          height: { ideal: isPortrait ? 1920 : 1080, max: 3840 },
          aspectRatio: { ideal: isPortrait ? (9/16) : (16/9) }
        },
        audio: false
      };
      stream = await navigator.mediaDevices.getUserMedia(hdConstraints);
    } catch (eHD) {
      console.warn("HD stream primary constraints fallback:", eHD.message);
      // Fallback ramah jika ponsel membutuhkan parameter standar
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
    standby.classList.add('hidden');
    updateLiveCameraFilter();
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
  if (input) input.click();
}

async function processPhotoWithFrameAndFilter(imgSource, overrideFrame) {
  const canvas = document.getElementById('photoRenderCanvas');
  const ctx = canvas.getContext('2d');
  const viewport = document.getElementById('viewfinderViewport');

  // Simpan referensi gambar mentah agar user bisa mengganti bingkai sesuka hati di modal review
  STATE.rawCapturedImageObj = imgSource;

  // Ekstraksi dimensi riil (Krusial: HTMLVideoElement, ImageBitmap, HTMLImageElement)
  const srcWidth = imgSource.videoWidth || imgSource.naturalWidth || imgSource.width || 1080;
  const srcHeight = imgSource.videoHeight || imgSource.naturalHeight || imgSource.height || 1920;
  
  // Orientasi perangkat: jika live camera, ikuti orientasi layar ponsel (portrait vs landscape)
  const isMobilePortrait = window.innerHeight >= window.innerWidth;
  const isLandscape = (imgSource instanceof HTMLImageElement || imgSource.tagName === 'IMG') ? (srcWidth > srcHeight) : (!isMobilePortrait);

  // 1. Tentukan bingkai resmi yang aktif
  let frameToUse = overrideFrame || STATE.activeFrame || 'GOLD_DECO';
  if (STATE.activeEvent && STATE.activeEvent.frameLockMode === 'single') {
    frameToUse = STATE.activeEvent.singleLockedFrame || (Array.isArray(STATE.activeEvent.activeFrames) && STATE.activeEvent.activeFrames[0]) || 'GOLD_DECO';
  }
  STATE.activeFrame = frameToUse;

  // 2. Preload bingkai kustom PNG untuk mendeteksi rasio aspek aslinya (Cegah Gambar Gepeng)
  let customFrameImg = null;
  let customFrameRatio = null;

  if (frameToUse !== 'NONE' && frameToUse !== 'GOLD_DECO' && frameToUse !== 'POLAROID' && frameToUse !== 'MINIMAL') {
    const customObj = Array.isArray(STATE.customFrames) ? STATE.customFrames.find(f => f.id === frameToUse) : null;
    let dataUrl = customObj ? customObj.dataUrl : null;
    if (!dataUrl) {
      dataUrl = STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl || STATE.tempCustomFrameData;
    }
    if (dataUrl) {
      customFrameImg = await preloadFrameImage(dataUrl);
      if (customFrameImg && (customFrameImg.naturalWidth > 0 || customFrameImg.width > 0)) {
        const fw = customFrameImg.naturalWidth || customFrameImg.width;
        const fh = customFrameImg.naturalHeight || customFrameImg.height;
        if (fw > 0 && fh > 0) {
          customFrameRatio = fw / fh;
        }
      }
    }
    if (!customFrameImg && STATE.customFrameImgObj && (STATE.customFrameImgObj.complete || STATE.customFrameImgObj.naturalWidth > 0)) {
      const fw = STATE.customFrameImgObj.naturalWidth || STATE.customFrameImgObj.width;
      const fh = STATE.customFrameImgObj.naturalHeight || STATE.customFrameImgObj.height;
      if (fw > 0 && fh > 0) {
        customFrameImg = STATE.customFrameImgObj;
        customFrameRatio = fw / fh;
      }
    }
  }

  // 3. Konfigurasi Dimensi Canvas Full HD (1080p Standard)
  if (customFrameRatio) {
    if (customFrameRatio < 1) {
      canvas.height = 1920;
      canvas.width = Math.round(1920 * customFrameRatio);
    } else {
      canvas.width = 1920;
      canvas.height = Math.round(1920 / customFrameRatio);
    }
  } else {
    if (isLandscape) {
      canvas.width = 1920;
      canvas.height = 1080;
    } else {
      canvas.width = 1080;
      canvas.height = 1920;
    }
  }

  // 4. Optimasi Rendering HD: Smoothing Tajam & Kualitas Maksimal
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 5. Render Foto Kamera: Pemetaan Presisi 1:1 Mengikuti Viewfinder (WYSIWYG Sejati)
  const targetW = canvas.width;
  const targetH = canvas.height;
  const targetRatio = targetW / targetH;
  const srcRatio = srcWidth / srcHeight;

  const vpWidth = (viewport && viewport.clientWidth) ? viewport.clientWidth : targetW;
  const vpHeight = (viewport && viewport.clientHeight) ? viewport.clientHeight : targetH;
  const vpRatio = (vpWidth > 0 && vpHeight > 0) ? (vpWidth / vpHeight) : targetRatio;

  let sx = 0, sy = 0, sw = srcWidth, sh = srcHeight;
  const cropRatio = (imgSource instanceof HTMLVideoElement || imgSource.tagName === 'VIDEO') ? vpRatio : targetRatio;

  if (srcRatio > cropRatio) {
    sw = Math.round(srcHeight * cropRatio);
    sx = Math.round((srcWidth - sw) / 2);
    sy = 0;
    sh = srcHeight;
  } else {
    sh = Math.round(srcWidth / cropRatio);
    sy = Math.round((srcHeight - sh) / 2);
    sx = 0;
    sw = srcWidth;
  }

  ctx.drawImage(imgSource, sx, sy, sw, sh, 0, 0, targetW, targetH);

  // 6. Terapkan Filter Warna Analog
  applyColorFilter(ctx, canvas.width, canvas.height, STATE.activeFilter);

  // 7. Render Bingkai (Preservasi Rasio Gambar Tanpa Distorsi)
  await renderCustomFrameOverlay(ctx, canvas.width, canvas.height, frameToUse, customFrameImg);

  // 8. Terapkan Butiran Sensor Analog 35mm (Photographic Micro-Grain HD)
  applyPhotographicAnalogGrain(ctx, canvas.width, canvas.height, 8);

  // 9. Ekspor ke DataURL Full HD Kualitas Maksimal (1080p, Sekitar 1 MB hingga 3 MB, JPEG 0.99)
  const rawDataUrl = canvas.toDataURL('image/jpeg', 0.99);
  const dataUrl = ensureJpegMinimumSize(rawDataUrl, 1350000);
  STATE.currentCapturedDataUrl = dataUrl;

  const reviewImg = document.getElementById('reviewPhotoImg');
  if (reviewImg) {
    reviewImg.src = dataUrl;
  }

  // Sesuaikan rasio wadah pratinjau modal review mengikuti rasio asli foto/bingkai Full HD (Anti-Gepeng & Anti-Bilah Hitam)
  const reviewContainer = document.getElementById('reviewPhotoContainer');
  if (reviewContainer && canvas.width > 0 && canvas.height > 0) {
    reviewContainer.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    reviewContainer.style.maxHeight = '56vh';
    reviewContainer.style.width = 'auto';
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

async function renderCustomFrameOverlay(ctx, w, h, frameStyle, preloadedFrameImg) {
  const evName = STATE.activeEvent?.namaEvent || "The Wedding of Sarah & Kevin";
  const hashtag = STATE.activeEvent?.hashtagEvent || "#SarahKevinEverAfter";
  const dateStr = STATE.activeEvent?.tanggalEvent || "20.11.2026";

  if (frameStyle === 'GOLD_DECO') {
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#D4AF37';
    ctx.strokeRect(30, 30, w - 60, h - 60);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#F3E5AB';
    ctx.strokeRect(48, 48, w - 96, h - 96);

    drawDecoCorner(ctx, 48, 48);
    drawDecoCorner(ctx, w - 48, 48, true);
    drawDecoCorner(ctx, 48, h - 48, false, true);
    drawDecoCorner(ctx, w - 48, h - 48, true, true);

    ctx.fillStyle = 'rgba(12, 12, 16, 0.85)';
    ctx.fillRect(60, h - 180, w - 120, 115);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, h - 180, w - 120, 115);

    ctx.fillStyle = '#F3E5AB';
    ctx.font = 'bold 36px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.fillText(evName, w / 2, h - 125);

    ctx.fillStyle = '#D4AF37';
    ctx.font = '22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${hashtag}  •  ${dateStr}`, w / 2, h - 85);

  } else if (frameStyle === 'POLAROID') {
    ctx.lineWidth = 35;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, h - 230, w, 230);

    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 50px "Caveat", cursive';
    ctx.textAlign = 'center';
    ctx.fillText(evName, w / 2, h - 130);

    ctx.fillStyle = '#666666';
    ctx.font = '24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${hashtag} — ${dateStr}`, w / 2, h - 70);

  } else if (frameStyle === 'MINIMAL') {
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
    let frameImg = preloadedFrameImg;
    if (!frameImg) {
      const customObj = Array.isArray(STATE.customFrames) ? STATE.customFrames.find(f => f.id === frameStyle) : null;
      let dataUrl = customObj ? customObj.dataUrl : null;
      if (!dataUrl) {
        dataUrl = STATE.activeEvent?.customFrameData || STATE.activeEvent?.customFrameUrl || STATE.tempCustomFrameData;
      }

      if (dataUrl) {
        frameImg = await preloadFrameImage(dataUrl);
      }
    }

    if (!frameImg && STATE.customFrameImgObj && (STATE.customFrameImgObj.complete || STATE.customFrameImgObj.naturalWidth > 0)) {
      frameImg = STATE.customFrameImgObj;
    }

    if (frameImg && (frameImg.naturalWidth > 0 || frameImg.width > 0)) {
      const fw = frameImg.naturalWidth || frameImg.width;
      const fh = frameImg.naturalHeight || frameImg.height;
      const fRatio = fw / fh;
      const cRatio = w / h;

      let dx = 0, dy = 0, dw = w, dh = h;
      if (Math.abs(fRatio - cRatio) > 0.01) {
        if (fRatio > cRatio) {
          dw = w;
          dh = w / fRatio;
          dy = (h - dh) / 2;
        } else {
          dh = h;
          dw = h * fRatio;
          dx = (w - dw) / 2;
        }
      }
      ctx.drawImage(frameImg, dx, dy, dw, dh);
      return;
    }

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

async function triggerCameraShutter() {
  const flash = document.getElementById('flashOverlay');
  if (flash) {
    flash.classList.remove('flash-anim');
    void flash.offsetWidth;
    flash.classList.add('flash-anim');
  }

  const video = document.getElementById('cameraVideo');
  if (STATE.mediaStream && video && video.readyState >= 2 && video.videoWidth > 0) {
    await processPhotoWithFrameAndFilter(video);
  } else {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      triggerNativeCamera();
    } else {
      const simulated = generateSimulatedPartySnapshot();
      await processPhotoWithFrameAndFilter(simulated);
    }
  }
}
