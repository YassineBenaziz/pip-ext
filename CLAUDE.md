# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chrome extension (Manifest V3, plain JavaScript, no build step, no dependencies) that adds Picture-in-Picture buttons to video players, with dedicated support for YouTube. UI strings and comments are in French.

## Commands

There is no build, lint, or test tooling. To check syntax:

```sh
for f in *.js; do node --check "$f"; done
```

To run the extension, load the folder unpacked: `chrome://extensions` → Developer mode → "Load unpacked". After editing, click reload on the extension card and refresh the page under test (content scripts are not re-injected into already-open tabs).

## Architecture

Three independent entry points, sharing no code (each file is self-contained):

- **`content.js`** (content script, injected into every frame via `<all_urls>` + `all_frames`). Guarded by `window.__pipExtLoaded`. Two mechanisms:
  - **YouTube**: a `MutationObserver` (rAF-debounced) plus the `yt-navigate-finish` event re-inject a `.ytp-button.pip-ext-yt-button` into each `.html5-video-player .ytp-right-controls`, before the miniplayer/size/fullscreen button. YouTube's SPA rebuilds the player, so injection must stay idempotent. If YouTube changes its player DOM, the selectors in `injectYouTubeButtons` are what breaks.
  - **Other sites**: one floating button in a closed Shadow DOM host (`position: fixed`), positioned on `pointermove` by hit-testing the pointer against every `<video>`'s bounding rect, because site overlays usually cover the video and swallow the event target. Videos already handled by the YouTube button are skipped. In fullscreen the host is re-parented into `document.fullscreenElement`.
- **`background.js`** (service worker): the toolbar action click and the `toggle-pip` command (Alt+P) inject `pip-toggle.js` into all frames via `chrome.scripting.executeScript`. This relies on `activeTab`, not host permissions.
- **`pip-toggle.js`**: runs once per frame per injection. It exits PiP if active, otherwise picks the best video (playing first, then largest). Non-top frames act only if their video is playing, so frames don't fight over the single PiP window.

## Constraints

- **Trusted Types on YouTube**: never use `innerHTML`. SVG icons are built with `createElementNS` (`createPipIcon`).
- PiP requests remove the `disablepictureinpicture` attribute on purpose, to override sites that block PiP.
- Text uses `chrome.i18n` (`_locales/fr` is the default locale, `_locales/en` the second). Add every new message key to both.
- Icons in `icons/` are PNGs generated with PowerShell `System.Drawing` (red rounded square with a white PiP glyph). There is no source file, so regenerate them the same way.
