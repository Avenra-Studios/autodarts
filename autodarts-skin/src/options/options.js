// Auto-generates the settings UI from SKIN_SCHEMA, persists to chrome.storage.sync,
// and drives a live preview built from the same overlay renderer.

(function () {
  const SCHEMA = window.SKIN_SCHEMA;
  const DEFAULTS = window.SKIN_DEFAULTS;
  let settings = { ...DEFAULTS };

  const controlsEl = document.getElementById("controls");
  const previewBox = document.getElementById("preview");
  const savedHint = document.getElementById("saved-hint");

  // ---- preview -----------------------------------------------------------
  const overlay = new window.SkinOverlay();
  overlay.rootEl.classList.add("is-preview");
  overlay.mount(previewBox);

  function previewModel() {
    const m = window.skinMockState();
    if (!document.getElementById("preview-checkout").checked) {
      m.players.forEach((p) => { p.checkoutDarts = []; p.turnDarts = []; });
    }
    return m;
  }
  function refreshPreview() {
    overlay.applySettings(settings, SCHEMA, window.skinCssValue);
    const ref = Math.min(1500, settings.maxWidth || 1500);
    const fit = Math.max(0.18, Math.min(0.7, previewBox.clientWidth / ref));
    overlay.rootEl.style.setProperty("--sk-preview-fit", String(fit));
    overlay.render(previewModel());
    // synthetic board so the side history tables have something to anchor to
    const bgMode = settings.pageBg || "default";
    if (bgMode !== "default") {
      const u = bgMode === "custom" ? settings.pageBgUrl : chrome.runtime.getURL("assets/background.jpg");
      const d = Math.max(0, Math.min(0.95, +settings.pageBgDim || 0));
      previewBox.style.backgroundImage = u
        ? `linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${d})),url("${u}")`
        : "radial-gradient(120% 90% at 50% 60%, #2f63a0, #1d264a 70%)";
    } else {
      previewBox.style.backgroundImage = "radial-gradient(120% 90% at 50% 60%, #2f63a0, #1d264a 70%)";
    }
    const w = previewBox.clientWidth, h = previewBox.clientHeight;
    const bw = h * 0.5, bt = h * 0.42;
    overlay.setBoard({
      left: w / 2 - bw / 2, right: w / 2 + bw / 2,
      top: bt, bottom: bt + bw,
      width: bw, height: bw, cx: w / 2, cy: bt + bw / 2
    });
  }
  window.addEventListener("resize", refreshPreview);

  // ---- persistence ------------------------------------------------------
  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      chrome.storage.sync.set(settings, () => {
        savedHint.hidden = false;
        savedHint.style.opacity = "1";
        setTimeout(() => (savedHint.style.opacity = "0"), 900);
        setTimeout(() => (savedHint.hidden = true), 1300);
      });
    }, 250);
  }

  function setValue(key, value) {
    settings[key] = value;
    refreshPreview();
    persist();
  }

  // ---- control builders ----------------------------------------------
  function fieldRow(f) {
    const row = document.createElement("div");
    row.className = "field";
    const label = document.createElement("label");
    label.textContent = f.label;
    label.htmlFor = "f-" + f.key;
    const control = document.createElement("div");
    control.className = "control";
    row.append(label, control);

    if (f.type === "toggle") {
      const wrap = document.createElement("label");
      wrap.className = "switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "f-" + f.key;
      input.checked = !!settings[f.key];
      input.addEventListener("change", () => setValue(f.key, input.checked));
      const slider = document.createElement("span");
      wrap.append(input, slider);
      control.append(wrap);
    } else if (f.type === "color") {
      const input = document.createElement("input");
      input.type = "color";
      input.id = "f-" + f.key;
      input.value = settings[f.key];
      input.addEventListener("input", () => setValue(f.key, input.value));
      control.append(input);
    } else if (f.type === "range") {
      const input = document.createElement("input");
      input.type = "range";
      input.id = "f-" + f.key;
      input.min = f.min; input.max = f.max; input.step = f.step;
      input.value = settings[f.key];
      const val = document.createElement("span");
      val.className = "val";
      const fmt = () => (val.textContent = String(input.value) + (f.unit || ""));
      fmt();
      input.addEventListener("input", () => { fmt(); setValue(f.key, parseFloat(input.value)); });
      control.append(input, val);
    } else if (f.type === "select") {
      const sel = document.createElement("select");
      sel.id = "f-" + f.key;
      for (const o of f.options) {
        const opt = document.createElement("option");
        opt.value = o.value; opt.textContent = o.label;
        sel.append(opt);
      }
      sel.value = settings[f.key];
      sel.addEventListener("change", () => setValue(f.key, sel.value));
      control.append(sel);
    } else if (f.type === "text") {
      const input = document.createElement("input");
      input.type = "text";
      input.id = "f-" + f.key;
      input.placeholder = "https://…";
      input.value = settings[f.key] || "";
      input.addEventListener("input", () => setValue(f.key, input.value.trim()));
      control.append(input);
    }
    return row;
  }

  // ---- developer capture panel ---------------------------------------
  const capText = document.getElementById("cap-text");
  const capStatus = document.getElementById("cap-status");
  document.getElementById("cap-load").addEventListener("click", () => {
    chrome.storage.local.get({ __skinCapture: [] }, (v) => {
      const arr = v.__skinCapture || [];
      capText.value = JSON.stringify(arr, null, 2);
      capStatus.textContent = arr.length + " events";
    });
  });
  document.getElementById("cap-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(capText.value || ""); capStatus.textContent = "copied"; }
    catch (_) { capText.select(); document.execCommand("copy"); capStatus.textContent = "copied"; }
  });
  document.getElementById("cap-clear").addEventListener("click", () => {
    chrome.storage.local.set({ __skinCapture: [] }, () => { capText.value = ""; capStatus.textContent = "cleared"; });
  });

  function build() {
    // keep the dev box, rebuild only schema groups after it
    controlsEl.querySelectorAll(".group:not(#devbox)").forEach((n) => n.remove());
    for (const g of SCHEMA) {
      const sec = document.createElement("div");
      sec.className = "group";
      const h = document.createElement("h2");
      h.textContent = g.group;
      sec.append(h);
      for (const f of g.fields) sec.append(fieldRow(f));
      controlsEl.append(sec);
    }
  }

  // ---- toolbar --------------------------------------------------------
  document.getElementById("btn-reset").addEventListener("click", () => {
    settings = { ...DEFAULTS };
    chrome.storage.sync.set(settings, () => { build(); refreshPreview(); });
  });
  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "autodarts-skin-settings.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const fileInput = document.getElementById("file-import");
  document.getElementById("btn-import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      settings = { ...DEFAULTS };
      for (const k of Object.keys(DEFAULTS)) if (k in parsed) settings[k] = parsed[k];
      chrome.storage.sync.set(settings, () => { build(); refreshPreview(); });
    } catch (_) {
      alert("Could not read that settings file.");
    }
    fileInput.value = "";
  });
  document.getElementById("preview-checkout").addEventListener("change", refreshPreview);

  // ---- init ----------------------------------------------------------
  chrome.storage.sync.get(DEFAULTS, (v) => {
    settings = { ...DEFAULTS, ...v };
    build();
    refreshPreview();
  });
})();
