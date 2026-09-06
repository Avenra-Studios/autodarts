# Autodarts Skin

A Chrome (Manifest V3) extension that replaces the play-screen scoreboard on
`play.autodarts.com` with a custom, fully configurable UI. Colors, fonts, sizes,
spacing, layout and which stats are shown are all set from the extension's
settings page, with a live preview.

## How it works

- `src/hook.js` runs in the page and wraps `WebSocket`/`fetch` so the extension
  can watch the same match-state stream the autodarts frontend already uses — no
  separate login or API key.
- `src/common/state.js` normalizes those raw messages into a small model.
- `src/overlay/overlay.js` renders the custom scoreboard from that model; every
  visual value is a CSS custom property.
- `src/content.js` mounts the overlay, hides the native scoreboard, and keeps
  everything in sync with `chrome.storage.sync`.
- `src/options/` is the settings page (auto-generated from `src/common/defaults.js`).

## Load it

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `autodarts-skin/` folder.
3. Open `play.autodarts.com`, start a match. Click the extension icon for settings.

## Status

Working: extension scaffold, settings page + live preview, WebSocket/fetch hook,
overlay renderer, native-scoreboard hiding.

Still to finalize against the live site (needs DOM/WebSocket capture):

- `PLAY_ROUTE`, `NATIVE_SCOREBOARD_SEL`, `NATIVE_BOARD_SEL` in `src/content.js`
- the field mappings in `normalize()` in `src/common/state.js`
