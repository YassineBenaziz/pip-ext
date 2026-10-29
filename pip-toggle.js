// Injecté dans toutes les frames de l'onglet lors d'un clic sur l'icône / Alt+P.
(async () => {
  if (!document.pictureInPictureEnabled) return;

  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture().catch(() => {});
    return;
  }

  const isPlaying = (v) => !v.paused && !v.ended && v.readyState > 2;
  const area = (v) => {
    const r = v.getBoundingClientRect();
    return r.width * r.height;
  };

  const videos = [...document.querySelectorAll('video')]
    .filter((v) => v.readyState > 0 && area(v) > 0)
    .sort((a, b) => isPlaying(b) - isPlaying(a) || area(b) - area(a));

  const video = videos[0];
  if (!video) return;
  // Dans une iframe, on n'agit que si la vidéo joue, pour éviter que plusieurs
  // frames se disputent la fenêtre PiP.
  if (window !== window.top && !isPlaying(video)) return;

  video.removeAttribute('disablepictureinpicture');
  await video.requestPictureInPicture().catch((e) => console.warn('[PiP]', e));
})();
