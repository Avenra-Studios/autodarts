// Content script (isolated world). Wires storage <-> overlay <-> hook messages.

(function () {
  const TAG = "AUTODARTS_SKIN";

  // After an extension reload the old content script keeps running but its
  // chrome.* bridge is gone; every chrome call then throws. Bail quietly.
  function extAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; }
  }

  const store = new window.SkinStateStore();
  const overlay = new window.SkinOverlay();
  let settings = { ...window.SKIN_DEFAULTS };

  // ---- native play-view hiding -------------------------------------
  // autodarts uses volatile Tailwind classes, so we hide structurally via
  // a stylesheet: the gameplay flex row has one child holding the board
  // (an [aspect-square] wrapper around a big <svg>); the other child(ren)
  // are the native scoreboard column(s). Inside the board child, the first
  // grid row is the native darts bar.
  let nativeStyle = null;
  function ensureNativeStyle() {
    if (nativeStyle && nativeStyle.isConnected) return nativeStyle;
    nativeStyle = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
    nativeStyle.id = "autodarts-skin-native";
    (document.head || document.documentElement).appendChild(nativeStyle);
    return nativeStyle;
  }
  function updateNativeStyle() {
    const el = ensureNativeStyle();
    const model = liveModel();
    const on = settings.enabled && settings.hideNative && model && model.active;
    if (!on) { el.textContent = ""; return; }

    // The board column is the gameplay child whose class carries the arbitrary
    // Tailwind value `grid-rows-[auto_minmax(0,1fr)_auto]`. Score column(s) are
    // the siblings without it. Inside the board column: row 1 = native darts
    // bar, row 2 = the board, row 3 = the Next/undo controls.
    const GP = '[class*="container-type:size"]';
    const BOARD = `${GP} > div[class*="grid-rows-"]`;
    const reserve = Math.ceil((overlay.stageHeight() || 240) + 8);
    let css = `
      ${GP} > div:not([class*="grid-rows-"]) { display: none !important; }
      ${BOARD} { visibility: visible !important; }
      ${BOARD} > *:first-child {
        visibility: hidden !important;
        height: ${reserve}px !important;
        min-height: ${reserve}px !important;
      }`;
    if (!settings.keepBoard) {
      css += `\n${BOARD} > *:nth-child(2) { visibility: hidden !important; }`;
    } else if (settings.boardGlow && settings.boardGlowSize > 0) {
      const c = settings.boardGlowColor || "#37e6c4";
      const a = (s) => Math.round(Math.max(0, Math.min(1, s)) * 255).toString(16).padStart(2, "0");
      const s = settings.boardGlowStrength || 0.55;
      const sz = settings.boardGlowSize;
      css += `\n${BOARD} > *:nth-child(2) {
        filter: drop-shadow(0 0 ${Math.round(sz * 0.45)}px ${c}${a(s)})
                drop-shadow(0 0 ${sz}px ${c}${a(s * 0.7)}) !important;
      }`;
    }
    el.textContent = css;
  }

  // ---- page background ----------------------------------------------
  // Painted on <body> (a z-index:-1 layer gets covered by the app's own
  // in-flow content, which is transparent, so <body> is what shows through).
  let bgStyle = null;
  function updatePageBg() {
    if (!bgStyle || !bgStyle.isConnected) {
      bgStyle = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
      bgStyle.id = "autodarts-skin-bg";
      (document.head || document.documentElement).appendChild(bgStyle);
    }
    const mode = settings.pageBg || "default";
    // Background applies across the whole site, not just the play screen.
    const active = settings.enabled && mode !== "default";
    const url = mode === "custom"
      ? settings.pageBgUrl
      : (extAlive() ? chrome.runtime.getURL("assets/background.jpg") : "");
    if (!active || !url) { bgStyle.textContent = ""; return; }
    const dim = Math.max(0, Math.min(0.95, +settings.pageBgDim || 0));
    const safe = url.replace(/["\\]/g, encodeURIComponent);
    bgStyle.textContent = `
      html.dark, body {
        background-image: linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})), url("${safe}") !important;
        background-size: cover !important;
        background-position: center center !important;
        background-attachment: fixed !important;
        background-repeat: no-repeat !important;
      }
    `;
  }

  // ---- glassify autodarts' own UI (site-wide) -----------------------
  let glassStyle = null;
  function updateGlassify() {
    if (!glassStyle || !glassStyle.isConnected) {
      glassStyle = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
      glassStyle.id = "autodarts-skin-glassify";
      (document.head || document.documentElement).appendChild(glassStyle);
    }
    if (!settings.enabled || !settings.glassifyNative) { glassStyle.textContent = ""; return; }
    const b = Math.max(0, +settings.glassifyBlur || 16);
    const o = Math.max(0.05, Math.min(0.98, (+settings.glassifyOpacity || 48) / 100));
    glassStyle.textContent = `
      [class*="bg-card"] {
        background-color: color-mix(in srgb, #141722 ${Math.round(o * 100)}%, transparent) !important;
        -webkit-backdrop-filter: blur(${b}px) saturate(1.3) !important;
        backdrop-filter: blur(${b}px) saturate(1.3) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
      }
      [class*="bg-black-80"], [class*="bg-black-90"], [class*="bg-black-05"], header {
        background-color: color-mix(in srgb, #0b0e15 ${Math.round(o * 90)}%, transparent) !important;
        -webkit-backdrop-filter: blur(${b + 4}px) saturate(1.2) !important;
        backdrop-filter: blur(${b + 4}px) saturate(1.2) !important;
      }
      [class*="bg-black-70"], [class*="bg-black-60"] {
        background-color: rgba(255,255,255,0.09) !important;
        -webkit-backdrop-filter: blur(${Math.min(b, 12)}px) !important;
        backdrop-filter: blur(${Math.min(b, 12)}px) !important;
      }
      [class*="bg-popover"], [role="menu"], [role="dialog"], [role="listbox"] {
        background-color: color-mix(in srgb, #10131c ${Math.round(o * 100 + 15)}%, transparent) !important;
        -webkit-backdrop-filter: blur(${b + 6}px) saturate(1.3) !important;
        backdrop-filter: blur(${b + 6}px) saturate(1.3) !important;
      }
      /* recolour autodarts' pink/fuchsia player + winner panels to blue glass */
      [style*="--color-fushia"], [style*="fushia"], [style*="fuchsia"], [class*="from-fushia"], [class*="to-fushia"] {
        background: linear-gradient(160deg, rgba(255,255,255,.17), rgba(255,255,255,.03) 42%),
                    color-mix(in srgb, #4d6fac ${Math.round(o * 100 + 8)}%, transparent) !important;
        -webkit-backdrop-filter: blur(${b + 2}px) saturate(1.25) !important;
        backdrop-filter: blur(${b + 2}px) saturate(1.25) !important;
      }
    `;
  }

  // Locate the live board's on-screen rectangle (for placing side panels).
  function measureBoard() {
    const gp = document.querySelector('[class*="container-type:size"]');
    const boardCol = gp && gp.querySelector(':scope > div[class*="grid-rows-"]');
    const boardEl = boardCol && boardCol.children[1];
    if (!boardEl) return null;
    const r = boardEl.getBoundingClientRect();
    if (r.width < 60) return null;
    return {
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      width: r.width, height: r.height,
      cx: r.left + r.width / 2, cy: r.top + r.height / 2
    };
  }

  // Match id in the current URL, or null. Excludes /history/matches/<id>
  // (post-match stats), lobbies, and everything else.
  function matchIdOf() {
    const m = location.pathname.match(/^\/(?:matches|games)\/([0-9a-f-]{8,})/i);
    return m ? m[1] : null;
  }
  function onPlayRoute() { return !!matchIdOf(); }

  // The model is only shown when the stored state actually belongs to the
  // match in the URL — so leaving to a dialog / stats page and coming back
  // restores instantly, and stale state from a previous match never shows.
  function liveModel() {
    const mid = matchIdOf();
    if (!mid) return null;
    const st = store.state;
    if (!st) return null;
    if (st.id && st.id !== mid) return null; // state is from a different match
    return store.model();
  }

  // ---- render ----------------------------------------------------
  function rerender() {
    overlay.applySettings(settings, window.SKIN_SCHEMA, window.skinCssValue);
    overlay.render(liveModel());
    overlay.setBoard(onPlayRoute() ? measureBoard() : null);
    updateNativeStyle();
    updatePageBg();
    updateGlassify();
  }

  // ---- settings ------------------------------------------------
  chrome.storage.sync.get(window.SKIN_DEFAULTS, (v) => { settings = { ...window.SKIN_DEFAULTS, ...v }; rerender(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const k of Object.keys(changes)) settings[k] = changes[k].newValue;
    rerender();
  });

  // ---- debug capture (surfaced in the options page) ----------
  let capture = [];
  let capTimer = null;
  function saveCapture() {
    clearTimeout(capTimer);
    capTimer = setTimeout(() => {
      try { chrome.storage.local.set({ __skinCapture: capture.slice(-300) }); } catch (_) {}
    }, 1500);
  }

  // ---- hook messages ---------------------------------------
  window.addEventListener("message", (ev) => {
    if (ev.source !== window || !ev.data || ev.data.__src !== TAG) return;
    if (!extAlive()) return;
    const { kind, payload } = ev.data;
    if (kind === "ws-message" || kind === "xhr") {
      try {
        capture.push({ t: Date.now(), kind, url: payload && payload.url, data: payload && payload.data });
        if (capture.length > 300) capture.shift();
        saveCapture();
        store.ingest(payload);
        rerender();
      } catch (_) { /* ignore */ }
    }
  });

  // ---- SPA route + re-assert loop ------------------------
  let lastPath = location.pathname;
  const loop = setInterval(() => {
    if (!extAlive()) { clearInterval(loop); return; }
    try {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        rerender();
      }
      updateNativeStyle(); // recompute reserved height as the panel grows
      overlay.setBoard(onPlayRoute() ? measureBoard() : null); // board can resize
      updatePageBg();
      updateGlassify();
    } catch (_) { /* transient DOM / context race */ }
  }, 700);

  // ---- boot --------------------------------------------
  function boot() { overlay.mount(document.body); rerender(); }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
