/**
 * ==============================================================================
 * SNAPEVENT: JS/SLIDESHOW.JS
 * Ballroom Projector Slideshow Engine, QR Bridge & Live Broadcast Rotator
 * ==============================================================================
 */

function openSlideshow() {
  const modal = document.getElementById('modalSlideshow');
  if (!modal) return;
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

  if (!STATE.photos || STATE.photos.length === 0) {
    document.getElementById('slideshowEmptyMsg')?.classList.remove('hidden');
    document.getElementById('slideshowImg')?.classList.add('hidden');
    const backdrop = document.getElementById('slideshowBackdropImg');
    if (backdrop) backdrop.classList.add('hidden');
    return;
  }

  document.getElementById('slideshowEmptyMsg')?.classList.add('hidden');
  document.getElementById('slideshowImg')?.classList.remove('hidden');
  const backdrop = document.getElementById('slideshowBackdropImg');
  if (backdrop) backdrop.classList.remove('hidden');

  STATE.slideshowIndex = 0;
  showSlideshowPhoto();

  if (STATE.slideshowTimer) clearInterval(STATE.slideshowTimer);
  STATE.slideshowTimer = setInterval(() => {
    if (STATE.photos && STATE.photos.length > 0) {
      STATE.slideshowIndex = (STATE.slideshowIndex + 1) % STATE.photos.length;
      showSlideshowPhoto();
    }
  }, 6000);
}

function showSlideshowPhoto() {
  if (!STATE.photos || STATE.photos.length === 0) return;
  const img = document.getElementById('slideshowImg');
  const backdrop = document.getElementById('slideshowBackdropImg');
  const p = STATE.photos[STATE.slideshowIndex];
  if (!p) return;

  if (img) img.style.opacity = '0';
  if (backdrop) backdrop.style.opacity = '0';

  setTimeout(() => {
    if (img) img.src = p.gdriveViewUrl;
    if (backdrop) backdrop.src = p.gdriveViewUrl;

    if (img) {
      img.onload = () => {
        img.style.opacity = '1';
        if (backdrop) backdrop.style.opacity = '0.35';
      };
      img.onerror = () => {
        if (p.gdriveViewUrl && p.gdriveViewUrl.includes('/d/')) {
          const fid = p.gdriveViewUrl.split('/d/')[1]?.split('?')[0];
          if (fid) img.src = `https://drive.google.com/thumbnail?id=${fid}&sz=w1920`;
        }
      };
    }

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
  document.getElementById('modalSlideshow')?.classList.add('hidden');
  sessionStorage.removeItem('snapevent_slideshow_active');
  if (STATE.slideshowTimer) clearInterval(STATE.slideshowTimer);
}
