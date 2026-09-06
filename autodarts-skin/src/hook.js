// Runs in the PAGE (MAIN world) at document_start.
// Wraps WebSocket + XHR + fetch so the extension can observe the same
// match-state stream the autodarts frontend uses, without its own auth.
// Nothing is modified — payloads are only cloned out via window.postMessage.

(function () {
  const TAG = "AUTODARTS_SKIN";
  const post = (kind, payload) => {
    try { window.postMessage({ __src: TAG, kind, payload }, window.location.origin); }
    catch (_) { /* not cloneable */ }
  };

  const LOG = [];
  const LOG_MAX = 400;
  const record = (kind, entry) => { LOG.push({ t: Date.now(), kind, ...entry }); if (LOG.length > LOG_MAX) LOG.shift(); };

  window.__autodartsSkinDump = function () {
    const text = JSON.stringify(LOG, null, 2);
    try { navigator.clipboard.writeText(text); } catch (_) {}
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = "autodarts-skin-capture.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (_) {}
    console.log("[AutodartsSkin] " + LOG.length + " events captured");
    return LOG;
  };

  const RELEVANT = /\/(matches|games)\/[0-9a-f-]+/i;

  // ---- WebSocket --------------------------------------------------------
  const NativeWS = window.WebSocket;
  if (NativeWS) {
    function SkinWS(url, protocols) {
      const ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      record("ws-open", { url: String(url) });
      ws.addEventListener("message", (ev) => {
        if (typeof ev.data !== "string") return;
        let parsed; try { parsed = JSON.parse(ev.data); } catch (_) { return; }
        record("ws-message", { url: String(url), data: parsed });
        post("ws-message", { url: String(url), data: parsed });
      });
      return ws;
    }
    SkinWS.prototype = NativeWS.prototype;
    SkinWS.CONNECTING = NativeWS.CONNECTING; SkinWS.OPEN = NativeWS.OPEN;
    SkinWS.CLOSING = NativeWS.CLOSING; SkinWS.CLOSED = NativeWS.CLOSED;
    window.WebSocket = SkinWS;
  }

  // ---- XMLHttpRequest (axios) -----------------------------------------
  const XP = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (XP) {
    const open = XP.open, send = XP.send;
    XP.open = function (method, url) { this.__skinUrl = url; this.__skinMethod = method; return open.apply(this, arguments); };
    XP.send = function () {
      this.addEventListener("load", () => {
        try {
          const url = this.__skinUrl || "";
          if (!RELEVANT.test(url)) return;
          let data = this.responseText;
          try { data = JSON.parse(data); } catch (_) { return; }
          record("xhr", { url, method: this.__skinMethod, data });
          post("xhr", { url, data });
        } catch (_) {}
      });
      return send.apply(this, arguments);
    };
  }

  // ---- fetch ---------------------------------------------------------
  const nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = async function (...args) {
      const res = await nativeFetch.apply(this, args);
      try {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        if (RELEVANT.test(url)) {
          res.clone().json().then(
            (json) => { record("fetch", { url, data: json }); post("xhr", { url, data: json }); },
            () => {}
          );
        }
      } catch (_) {}
      return res;
    };
  }

  console.log("[AutodartsSkin] hook active");
  post("hook-ready", { href: window.location.href });
})();
