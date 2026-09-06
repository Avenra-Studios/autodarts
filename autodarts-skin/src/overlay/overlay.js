// Builds and updates the custom play-UI DOM from a normalized model.
// Pure rendering — no storage, no network. Exposes window.SkinOverlay.

(function (root) {
  const NS = "http://www.w3.org/1999/xhtml";
  function el(tag, cls, text) {
    const n = document.createElementNS(NS, tag);
    if (cls) n.setAttribute("class", cls);
    if (text != null) n.textContent = text;
    return n;
  }

  function SkinOverlay() {
    this.rootEl = el("div");
    this.rootEl.id = "autodarts-skin-root";
    this.rootEl.hidden = true;
    this.backdrop = el("div", "sk-backdrop");
    this.stage = el("div", "sk-stage");
    this.panel = el("div", "sk-panel");
    this.dartsRow = el("div", "sk-darts-row");
    this.pager = el("div", "sk-pager");
    this.banner = el("div", "sk-banner");
    this.banner.hidden = true;
    this.sideL = el("div", "sk-history sk-side sk-side-l");
    this.sideR = el("div", "sk-history sk-side sk-side-r");
    this.sideL.hidden = true;
    this.sideR.hidden = true;
    this.stage.append(this.panel, this.dartsRow, this.pager);
    this.rootEl.append(this.backdrop, this.stage, this.banner, this.sideL, this.sideR);
    this._s = {};
    this._cards = [];
    this._lastActive = -1;
    this._hadActive = false;
    this._prevScore = {};
    this._bannerTimer = null;
    this._board = null;
  }

  SkinOverlay.prototype.mount = function (parent) {
    (parent || document.body).appendChild(this.rootEl);
  };

  SkinOverlay.prototype.applySettings = function (settings, schema, cssValue) {
    this._s = settings;
    const r = this.rootEl;
    for (const g of schema) for (const f of g.fields) {
      if (f.cssVar) r.style.setProperty(f.cssVar, cssValue(f, settings[f.key]));
    }
    r.dataset.layout = settings.layout || "board";
    r.dataset.anchor = settings.position || "top";
    r.dataset.keepBoard = String(!!settings.keepBoard && !!settings.hideNative);
  };

  SkinOverlay.prototype.setVisible = function (v) { this.rootEl.hidden = !v; };

  SkinOverlay.prototype.stageHeight = function () {
    if (this.rootEl.hidden || !this.stage) return 0;
    return this.stage.getBoundingClientRect().height;
  };

  SkinOverlay.prototype.render = function (model) {
    const s = this._s;
    if (!model || !model.active || !Array.isArray(model.players) || !s.enabled) {
      this.setVisible(false);
      this.sideL.hidden = true;
      this.sideR.hidden = true;
      this._lastActive = -1;
      this._hadActive = false;
      return;
    }
    this.setVisible(true);
    this.dartsRow.textContent = "";
    this.pager.textContent = "";

    // keep card elements stable across updates so animations aren't interrupted
    while (this._cards.length > model.players.length) this._cards.pop().remove();
    while (this._cards.length < model.players.length) {
      const c = el("div", "sk-card");
      this.panel.appendChild(c);
      this._cards.push(c);
    }

    const switched = model.currentPlayerIndex !== this._lastActive;
    for (let i = 0; i < model.players.length; i++) {
      this._fillCard(this._cards[i], model.players[i], model);
    }

    if (switched && this._hadActive && this._cards.length > 1) {
      const card = this._cards[model.currentPlayerIndex];
      if (card && s.animActive !== false) {
        card.classList.remove("sk-turn-in");
        void card.offsetWidth; // restart animation
        card.classList.add("sk-turn-in");
      }
      if (s.showTurnBanner !== false) this._showBanner(model.players[model.currentPlayerIndex]);
    }
    this._lastActive = model.currentPlayerIndex;
    this._hadActive = true;

    this._renderSides(model);

    const active = model.players[model.currentPlayerIndex] || model.players.find((x) => x.isActive);
    if (s.showDartsRow && active) this._darts(active);
    if (s.showPager && model.legs > 0) {
      for (let i = 1; i <= Math.max(model.legs, model.leg || 1); i++) {
        const b = el("span", "sk-pg" + (i === (model.leg || 1) ? " is-cur" : ""), String(i));
        this.pager.appendChild(b);
      }
    }
  };

  SkinOverlay.prototype._showBanner = function (p) {
    if (!p) return;
    clearTimeout(this._bannerTimer);
    this.banner.textContent = p.name;
    this.banner.hidden = false;
    this.banner.classList.remove("sk-banner-in");
    void this.banner.offsetWidth;
    this.banner.classList.add("sk-banner-in");
    this._bannerTimer = setTimeout(() => {
      this.banner.hidden = true;
      this.banner.classList.remove("sk-banner-in");
    }, 1600);
  };

  SkinOverlay.prototype._fillCard = function (card, p, model) {
    const s = this._s;
    card.className = "sk-card";
    if (p.isActive) card.classList.add("is-active");
    if (p.isWinner) card.classList.add("is-winner");
    if (model.lastEvent && p.isActive) card.classList.add("evt-" + model.lastEvent);
    card.textContent = "";

    const main = el("div", "sk-card-main");

    const scoreEl = el("div", "sk-score", String(p.score));
    if (
      s.animScore !== false &&
      this._prevScore[p.index] !== undefined &&
      this._prevScore[p.index] !== p.score
    ) {
      scoreEl.classList.add("sk-score-bump");
    }
    this._prevScore[p.index] = p.score;
    main.appendChild(scoreEl);

    const id = el("div", "sk-idrow");
    if (s.showLegs) {
      const legs = el("span", "sk-legs", model.sets > 0 ? `${p.sets}·${p.legs}` : String(p.legs));
      id.appendChild(legs);
    }
    if (s.showAvatar) {
      if (p.avatarUrl) {
        const img = el("img", "sk-avatar");
        img.src = p.avatarUrl;
        img.referrerPolicy = "no-referrer";
        id.appendChild(img);
      } else {
        id.appendChild(el("span", "sk-avatar sk-avatar-ph", (p.name[0] || "?").toUpperCase()));
      }
    }
    id.appendChild(el("span", "sk-name", p.name));
    if (s.showFlag && p.country) {
      const f = (model._flag || root.skinCountryFlag)(p.country);
      if (f) id.appendChild(el("span", "sk-flag", f));
    }
    if (s.showSkill && p.skill) id.appendChild(el("span", "sk-skill", p.skill));
    main.appendChild(id);

    if (s.showCheckout && !s.showCheckoutDarts && p.checkoutDarts && p.checkoutDarts.length && p.isActive) {
      main.appendChild(el("div", "sk-checkout", "→ " + p.checkoutDarts.join("  ")));
    }

    if (s.showStatLine) {
      const bits = [];
      if (s.showAverage) bits.push("Ø " + (p.average || 0).toFixed(1));
      if (s.showFirst9 && p.averageAlt) bits.push("F9 " + p.averageAlt.toFixed(1));
      if (s.showLegDarts && p.dartsThrown) bits.push(p.dartsThrown + " darts");
      if (s.showMatchAverage && p.matchAverage) bits.push("M " + p.matchAverage.toFixed(1));
      if (!bits.length && p.rank) bits.push(p.rank);
      if (bits.length) main.appendChild(el("div", "sk-statline", bits.join("   ·   ")));
    }

    card.appendChild(main);
  };

  // ---- score-history tables, positioned beside the live board ----------
  SkinOverlay.prototype.setBoard = function (rect) {
    this._board = rect && rect.width > 40 ? rect : null;
    this._positionSides();
  };

  SkinOverlay.prototype._renderSides = function (model) {
    const s = this._s;
    let leftP = null, rightP = null;
    if (s.showHistory) {
      const ps = model.players;
      if (ps.length <= 1) {
        if ((s.historySide || "left") === "right") rightP = ps[0]; else leftP = ps[0];
      } else {
        leftP = ps[0];
        rightP = ps[1];
      }
    }
    this._fillSide(this.sideL, leftP);
    this._fillSide(this.sideR, rightP);
    this._positionSides();
  };

  SkinOverlay.prototype._fillSide = function (box, p) {
    const s = this._s;
    if (!p || !s.showHistory || !p.history || !p.history.length) {
      box.hidden = true;
      box.textContent = "";
      return;
    }
    const rows = Math.max(1, Math.min(25, (s.historyRows | 0) || 6));
    box.textContent = "";
    if (this._cards.length > 1) {
      box.appendChild(el("div", "sk-h-name", p.name));
    }
    const rowsWrap = el("div", "sk-h-rows");
    for (const h of p.history.slice(-rows)) {
      const row = el("div", "sk-h-row" + (h.bust ? " is-bust" : ""));
      row.appendChild(el("span", "sk-h-scored", String(h.scored)));
      row.appendChild(el("span", "sk-h-left", String(h.left)));
      rowsWrap.appendChild(row);
    }
    box.appendChild(rowsWrap);
    box.hidden = false;
  };

  SkinOverlay.prototype._positionSides = function () {
    const b = this._board;
    const gap = 22;
    const place = (box, side) => {
      if (box.hidden) return;
      if (!b) { box.style.visibility = "hidden"; return; }
      box.style.visibility = "";
      box.style.top = b.cy + "px";
      if (side === "left") {
        box.style.left = b.left - gap + "px";
        box.style.transform = "translate(-100%, -50%)";
      } else {
        box.style.left = b.right + gap + "px";
        box.style.transform = "translateY(-50%)";
      }
    };
    place(this.sideL, "left");
    place(this.sideR, "right");
  };

  SkinOverlay.prototype._darts = function (p) {
    const s = this._s;
    const thrown = p.turnDarts || [];
    const guide = s.showCheckoutDarts ? p.checkoutDarts || [] : [];
    // Always exactly 3 equal slots: thrown darts, then checkout suggestion,
    // then blanks — so the row never changes size between rounds.
    for (let i = 0; i < 3; i++) {
      let text = "", cls = "is-empty";
      if (i < thrown.length) { text = thrown[i].name || "–"; cls = "is-thrown"; }
      else if (i - thrown.length < guide.length) { text = guide[i - thrown.length]; cls = "is-suggest"; }
      this.dartsRow.appendChild(el("span", "sk-dart " + cls, text || " "));
    }
  };

  root.SkinOverlay = SkinOverlay;
})(typeof window !== "undefined" ? window : globalThis);
