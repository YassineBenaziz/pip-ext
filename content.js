(() => {
  if (window.__pipExtLoaded) return;
  window.__pipExtLoaded = true;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MIN_WIDTH = 160;
  const MIN_HEIGHT = 90;
  const BUTTON_SIZE = 36;
  const HIDE_DELAY = 2500;
  const IS_YOUTUBE = /(^|\.)youtube\.com$/.test(location.hostname);

  const t = (key) => chrome.i18n.getMessage(key) || key;
  const labelFor = (video) =>
    document.pictureInPictureElement === video ? t('exitPip') : t('enterPip');

  // Construit l'icône en DOM (pas d'innerHTML : YouTube impose les Trusted Types).
  function createPipIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute(
      'd',
      'M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z'
    );
    svg.appendChild(path);
    return svg;
  }

  async function togglePip(video) {
    if (!document.pictureInPictureEnabled) {
      console.warn('[PiP] Picture-in-Picture indisponible sur cette page.');
      return;
    }
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        // Certains sites désactivent volontairement le PiP.
        video.removeAttribute('disablepictureinpicture');
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('[PiP]', e);
    }
  }

  // ---------------------------------------------------------------------------
  // YouTube : bouton intégré à la barre de contrôle du lecteur
  // ---------------------------------------------------------------------------

  function injectYouTubeButtons() {
    for (const player of document.querySelectorAll('.html5-video-player')) {
      const controls = player.querySelector('.ytp-right-controls');
      if (!controls || controls.querySelector('.pip-ext-yt-button')) continue;

      const button = document.createElement('button');
      button.className = 'ytp-button pip-ext-yt-button';
      button.appendChild(createPipIcon());
      const updateLabel = () => {
        const video = player.querySelector('video');
        const label = video ? labelFor(video) : t('enterPip');
        button.title = label;
        button.setAttribute('aria-label', label);
      };
      updateLabel();
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const video = player.querySelector('video');
        if (video) togglePip(video);
      });
      button.addEventListener('pip-ext-update', updateLabel);

      const anchor = controls.querySelector(
        '.ytp-miniplayer-button, .ytp-size-button, .ytp-fullscreen-button'
      );
      if (anchor) anchor.parentNode.insertBefore(button, anchor);
      else controls.appendChild(button);
    }
  }

  const hasYouTubeButton = (video) =>
    IS_YOUTUBE &&
    !!video.closest('.html5-video-player')?.querySelector('.pip-ext-yt-button');

  if (IS_YOUTUBE) {
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        injectYouTubeButtons();
      });
    };
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    document.addEventListener('yt-navigate-finish', schedule);
    injectYouTubeButtons();
  }

  // ---------------------------------------------------------------------------
  // Autres sites : bouton flottant affiché au survol d'une vidéo
  // ---------------------------------------------------------------------------

  const host = document.createElement('div');
  host.style.cssText =
    'all:initial;position:fixed;top:0;left:0;z-index:2147483647;display:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    button {
      all: initial;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${BUTTON_SIZE}px;
      height: ${BUTTON_SIZE}px;
      padding: 7px;
      border-radius: 8px;
      background: rgba(20, 20, 20, 0.72);
      color: #fff;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      transition: background 0.15s, transform 0.15s;
    }
    button:hover { background: rgba(20, 20, 20, 0.9); transform: scale(1.06); }
    button:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 2px; }
    svg { width: 100%; height: 100%; display: block; }
  `;
  const floatingButton = document.createElement('button');
  floatingButton.appendChild(createPipIcon());
  shadow.append(style, floatingButton);

  let currentVideo = null;
  let hideTimer = 0;

  function mountHost() {
    const fs = document.fullscreenElement;
    const parent = fs && fs.tagName !== 'VIDEO' ? fs : document.documentElement;
    if (host.parentNode !== parent) parent.appendChild(host);
  }

  function hideButton() {
    clearTimeout(hideTimer);
    host.style.display = 'none';
    currentVideo = null;
  }

  function showButton(video) {
    const rect = video.getBoundingClientRect();
    const left = Math.min(rect.right, window.innerWidth) - BUTTON_SIZE - 10;
    const top = Math.max(rect.top, 0) + 10;
    mountHost();
    host.style.transform = `translate(${left}px, ${top}px)`;
    host.style.display = 'block';
    currentVideo = video;
    const label = labelFor(video);
    floatingButton.title = label;
    floatingButton.setAttribute('aria-label', label);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideButton, HIDE_DELAY);
  }

  const isEligible = (video) => {
    const rect = video.getBoundingClientRect();
    return rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT && !hasYouTubeButton(video);
  };

  function findVideoAt(x, y, path) {
    // La vidéo est souvent recouverte par les contrôles du site : on compare donc
    // la position du pointeur aux rectangles des vidéos plutôt qu'à la cible.
    const direct = path.find((el) => el instanceof HTMLVideoElement);
    if (direct && isEligible(direct)) return direct;
    for (const video of document.querySelectorAll('video')) {
      const r = video.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && isEligible(video)) {
        return video;
      }
    }
    return null;
  }

  let pendingMove = null;
  document.addEventListener(
    'pointermove',
    (e) => {
      if (pendingMove) {
        pendingMove = e;
        return;
      }
      pendingMove = e;
      requestAnimationFrame(() => {
        const ev = pendingMove;
        pendingMove = null;
        const path = ev.composedPath();
        if (path.includes(host)) {
          clearTimeout(hideTimer);
          return;
        }
        const video = findVideoAt(ev.clientX, ev.clientY, path);
        if (video) showButton(video);
        else hideButton();
      });
    },
    { capture: true, passive: true }
  );

  // Empêche le site de réagir (pause/lecture) aux clics sur notre bouton.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick']) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }
  floatingButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentVideo) togglePip(currentVideo);
  });

  window.addEventListener('scroll', hideButton, { capture: true, passive: true });
  window.addEventListener('resize', hideButton, { passive: true });
  document.addEventListener('fullscreenchange', hideButton);

  // Met à jour les libellés (Activer / Quitter) lors des changements d'état.
  const refreshLabels = () => {
    if (currentVideo) {
      const label = labelFor(currentVideo);
      floatingButton.title = label;
      floatingButton.setAttribute('aria-label', label);
    }
    for (const button of document.querySelectorAll('.pip-ext-yt-button')) {
      button.dispatchEvent(new Event('pip-ext-update'));
    }
  };
  document.addEventListener('enterpictureinpicture', refreshLabels, true);
  document.addEventListener('leavepictureinpicture', refreshLabels, true);
})();
