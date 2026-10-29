// Clic sur l'icône de l'extension ou raccourci clavier (Alt+P) :
// bascule le Picture-in-Picture sur la vidéo principale de l'onglet actif.

async function togglePipInTab(tab) {
  if (!tab || tab.id === undefined) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['pip-toggle.js'],
    });
  } catch (e) {
    // Pages où l'injection est interdite (chrome://, Chrome Web Store, etc.)
    console.warn('[PiP] Injection impossible :', e.message);
  }
}

chrome.action.onClicked.addListener(togglePipInTab);

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-pip') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  togglePipInTab(tab);
});
