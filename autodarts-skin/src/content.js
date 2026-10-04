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

  // --- quick correction: clicking a thrown dart in our row triggers
  // autodarts' own per-dart correction (then you click the real spot on the
  // board and press OK — all while the skin stays on).
  let editingDart = -1;
  let editSeg = "";
  let editPoll = null;
  function nativeDartEl(idx) {
    const wrap = document.querySelector(
      '[class*="container-type:size"] > div[class*="grid-rows-"] > *:first-child .justify-evenly'
    );
    return (wrap && wrap.children[idx]) || null;
  }
  function inCorrectionMode() {
    try {
      const ctl = document.querySelector(
        '[class*="container-type:size"] > div[class*="grid-rows-"] > *:last-child'
      );
      return !!ctl && /cancel|bouncer/i.test(ctl.textContent || "");
    } catch (_) { return false; }
  }
  function stopEditing() {
    editingDart = -1; editSeg = "";
    clearInterval(editPoll); editPoll = null;
    rerender();
  }
  overlay.onDartClick = (idx) => {
    try {
      const dart = nativeDartEl(idx);
      if (!dart) return;
      dart.click();
      editingDart = idx;
      editSeg = "";
      rerender();
      clearInterval(editPoll);
      editPoll = setInterval(() => {
        if (!extAlive()) { clearInterval(editPoll); return; }
        if (editingDart < 0 || !inCorrectionMode()) { stopEditing(); return; }
        const d = nativeDartEl(editingDart);
        const t = d ? (d.textContent || "").replace(/\s+/g, "") : "";
        if (t && t !== editSeg) { editSeg = t; overlay.setEditing(editingDart, editSeg); }
      }, 180);
    } catch (_) {}
  };

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
    // In "sides" layout the panels are off to the sides, so barely any top
    // space is reserved — the board fills the freed room.
    const reserve = settings.layout === "sides"
      ? Math.ceil((overlay.stageHeight() || 90) * 0.55 + 4)
      : Math.ceil((overlay.stageHeight() || 240) + 8);
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
  // ---- coded play background (SVG, resolution independent) ------------
  function codedBgSvg(o, b) {
    const W = 1600, H = 900, cx = 800, cy = 450;
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const arc = (rx, ry, rot, a0, a1) => {
      let d = "";
      for (let i = 0; i <= 120; i++) {
        const t = (a0 + ((a1 - a0) * i) / 120) * Math.PI / 180;
        const x = rx * Math.cos(t), y = ry * Math.sin(t);
        const X = x * Math.cos(rot) - y * Math.sin(rot) + cx;
        const Y = x * Math.sin(rot) + y * Math.cos(rot) + cy;
        d += (i ? "L" : "M") + X.toFixed(1) + "," + Y.toFixed(1);
      }
      return d;
    };
    let arcs = "", glow = "";
    for (let k = 0; k < 8; k++) {
      const rx = 360 + k * 88, ry = 262 + k * 74, rot = -0.16;
      const op = (1 - k * 0.09).toFixed(2), sw = (3.4 - k * 0.3).toFixed(2);
      const L = arc(rx, ry, rot, 118, 252), R = arc(rx, ry, rot, -72, 72);
      arcs += `<path d="${L}" stroke="${o}" stroke-width="${sw}" opacity="${op}" fill="none" stroke-linecap="round"/>`;
      arcs += `<path d="${R}" stroke="${b}" stroke-width="${sw}" opacity="${op}" fill="none" stroke-linecap="round"/>`;
      glow += `<path d="${L}" stroke="${o}" stroke-width="${(sw * 5).toFixed(1)}" opacity="0.6" fill="none"/>`;
      glow += `<path d="${R}" stroke="${b}" stroke-width="${(sw * 5).toFixed(1)}" opacity="0.6" fill="none"/>`;
    }
    const streaks = [
      ["M-40,820 Q520,560 1000,80", o], ["M1640,80 Q1060,330 620,900", b],
      ["M-40,330 Q360,160 760,-40", o], ["M1640,600 Q1200,640 880,940", b]
    ].map(([d, c]) => `<path d="${d}" stroke="${c}" stroke-width="1.8" opacity="0.6" fill="none" stroke-linecap="round"/>`).join("");
    let sparks = "";
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * H;
      const c = x < cx ? o : b;
      sparks += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.5 + rnd() * 1.6).toFixed(2)}" fill="${c}" opacity="${(0.2 + rnd() * 0.7).toFixed(2)}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="blurBig" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
        <filter id="gl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
        <filter id="glowRing" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
        <radialGradient id="vg" cx="0.5" cy="0.5" r="0.75"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="#03050b"/>
      <g filter="url(#blurBig)">
        <ellipse cx="60" cy="${cy}" rx="330" ry="300" fill="${o}" opacity="0.75"/>
        <ellipse cx="${W - 60}" cy="${cy}" rx="330" ry="300" fill="${b}" opacity="0.75"/>
      </g>
      <ellipse cx="${cx}" cy="${cy}" rx="350" ry="350" fill="none" stroke="#e8f4ff" stroke-width="22" opacity="0.55" filter="url(#glowRing)"/>
      <ellipse cx="${cx}" cy="${cy}" rx="350" ry="350" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.5"/>
      <g filter="url(#gl)">${glow}</g>
      ${arcs}
      ${streaks}
      ${sparks}
      <rect width="${W}" height="${H}" fill="url(#vg)"/>
    </svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function updatePageBg() {
    if (!bgStyle || !bgStyle.isConnected) {
      bgStyle = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
      bgStyle.id = "autodarts-skin-bg";
      (document.head || document.documentElement).appendChild(bgStyle);
    }
    const mode = settings.pageBg || "default";
    if (!settings.enabled || mode === "default") { bgStyle.textContent = ""; return; }
    const dim = Math.max(0, Math.min(0.95, +settings.pageBgDim || 0));
    const dimLayer = `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim}))`;
    const imgLayer = (u) => `url("${u.replace(/["\\]/g, encodeURIComponent)}")`;
    let layers;
    if (onPlayRoute() && mode === "coded") {
      // Vector (SVG) background: crisp at any resolution, colours from settings.
      layers = [`url("${codedBgSvg(settings.codedLeft || "#ff7a1a", settings.codedRight || "#1e9bff")}")`];
    } else {
      const url = mode === "custom"
        ? settings.pageBgUrl
        : (extAlive()
          ? chrome.runtime.getURL(onPlayRoute() ? "assets/background.jpg" : "assets/background-menu.jpg")
          : "");
      if (!url) { bgStyle.textContent = ""; return; }
      layers = [dimLayer, imgLayer(url)];
    }
    bgStyle.textContent = `
      html.dark, body {
        background-image: ${layers.join(", ")} !important;
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
    overlay.setEditing(editingDart, editSeg);
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
        if (editingDart >= 0) stopEditing();
        rerender();
      }
      if (editingDart >= 0 && !inCorrectionMode()) stopEditing();
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
