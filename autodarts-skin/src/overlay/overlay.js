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
    this.colL = el("div", "sk-col sk-col-l");
    this.colR = el("div", "sk-col sk-col-r");
    this.colL.hidden = true;
    this.colR.hidden = true;
    this.editLabel = el("div", "sk-edit-label");
    this.editLabel.hidden = true;
    this.stage.append(this.panel, this.dartsRow, this.editLabel, this.pager);
    this.rootEl.append(this.backdrop, this.stage, this.banner, this.sideL, this.sideR, this.colL, this.colR);
    this._editing = -1;
    // click a thrown-dart slot -> ask the host to open autodarts' correction for it
    this.dartsRow.addEventListener("click", (e) => {
      const slot = e.target.closest(".sk-dart");
      if (!slot || !slot.classList.contains("is-thrown")) return;
      const idx = Array.prototype.indexOf.call(this.dartsRow.children, slot);
      if (idx >= 0 && this.onDartClick) this.onDartClick(idx);
    });
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
    r.dataset.dimInactive = String(settings.dimInactive !== false);
    r.dataset.turn = settings.turnHighlight || "rainbow";
  };

  SkinOverlay.prototype.setVisible = function (v) { this.rootEl.hidden = !v; };

  SkinOverlay.prototype.setEditing = function (idx, seg) {
    this._editing = typeof idx === "number" ? idx : -1;
    const on = this._editing >= 0;
    this.rootEl.dataset.editing = String(on);
    this.editLabel.hidden = !on;
    if (on) {
      this.editLabel.textContent = seg
        ? "Dart " + (this._editing + 1) + " → " + seg + "   ·   tap the board to adjust, then OK"
        : "Editing dart " + (this._editing + 1) + " — tap where it really landed on the board";
    }
    const slots = this.dartsRow.children;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      s.classList.toggle("is-editing", i === this._editing);
      if (i === this._editing && seg) s.textContent = seg;
    }
  };


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
    const n = model.players.length;
    const sidesLayout = s.layout === "sides";

    // keep card elements stable across updates so animations aren't interrupted
    while (this._cards.length > n) this._cards.pop().remove();
    while (this._cards.length < n) this._cards.push(el("div", "sk-card"));

    const switched = model.currentPlayerIndex !== this._lastActive;
    for (let i = 0; i < n; i++) this._fillCard(this._cards[i], model.players[i], model);

    if (switched && this._hadActive && n > 1) {
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

    if (sidesLayout) {
      // cards + history stacked in absolute side columns; big board between
      this.colL.textContent = "";
      this.colR.textContent = "";
      this.colL.classList.remove("sk-col-dim");
      this.colR.classList.remove("sk-col-dim");
      for (let i = 0; i < n; i++) {
        let col = this.colL;
        if (n > 1) col = i % 2 ? this.colR : this.colL;
        else if ((s.historySide || "left") === "right") col = this.colR;
        col.appendChild(this._cards[i]);
        const p = model.players[i];
        if (s.showHistory && p.history && p.history.length) {
          col.appendChild(this._buildHistory(p, false, true));
        }
        if (n > 1 && !p.isActive && !p.isWinner) col.classList.add("sk-col-dim");
      }
      this.colL.hidden = !this.colL.children.length;
      this.colR.hidden = !this.colR.children.length;
      this.sideL.hidden = true;
      this.sideR.hidden = true;
    } else {
      for (const c of this._cards) if (c.parentNode !== this.panel) this.panel.appendChild(c);
      this.colL.hidden = true;
      this.colR.hidden = true;
      this._renderSides(model);
    }
    this._positionSides();

    const active = model.players[model.currentPlayerIndex] || model.players.find((x) => x.isActive);
    if (s.showDartsRow && active) this._darts(active);
    const legTarget = Math.max(model.legs || 0, model.leg || 1);
    if (s.showPager && legTarget > 1) {
      for (let i = 1; i <= legTarget; i++) {
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

    if (p.isActive && model.players.length > 1) {
      if ((s.turnHighlight || "rainbow") !== "none") card.appendChild(el("div", "sk-turn-ring"));
      if (s.showTurnFlag) card.appendChild(el("div", "sk-turn-flag", "▸ TO THROW"));
    }

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

    const scoreRow = el("div", "sk-score-row");
    scoreRow.appendChild(scoreEl);
    if (s.showCheckout !== false && p.checkoutDarts && p.checkoutDarts.length) {
      const ck = el("div", "sk-checkout");
      for (const d of p.checkoutDarts) {
        const name = typeof d === "string" ? d : d.name;
        if (name) ck.appendChild(el("span", "sk-ck-dart", name));
      }
      if (ck.children.length) scoreRow.appendChild(ck);
    }
    main.appendChild(scoreRow);

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
    const multi = model.players.length > 1;
    this.sideL.classList.toggle("sk-side-dim", multi && !!leftP && !leftP.isActive && !leftP.isWinner);
    this.sideR.classList.toggle("sk-side-dim", multi && !!rightP && !rightP.isActive && !rightP.isWinner);
    this._positionSides();
  };

  // Fills `box` (a .sk-history element) with an optional name + the score rows.
  // `all` = keep every round (Sides layout — the panel clips at the board edge);
  // otherwise cap at the "History rows" setting.
  SkinOverlay.prototype._fillHistoryBox = function (box, p, withName, all) {
    const s = this._s;
    const rows = all ? 200 : Math.max(3, Math.min(60, (s.historyRows | 0) || 40));
    box.textContent = "";
    if (withName) box.appendChild(el("div", "sk-h-name", p.name));
    const rowsWrap = el("div", "sk-h-rows");
    for (const h of p.history.slice(-rows)) {
      const row = el("div", "sk-h-row" + (h.leftStruck ? " was-bust" : ""));
      row.appendChild(el("span", "sk-h-scored", String(h.scored)));
      row.appendChild(el("span", "sk-h-left", String(h.left)));
      rowsWrap.appendChild(row);
    }
    box.appendChild(rowsWrap);
  };

  SkinOverlay.prototype._buildHistory = function (p, withName, all) {
    const box = el("div", "sk-history");
    this._fillHistoryBox(box, p, withName, all);
    return box;
  };

  SkinOverlay.prototype._fillSide = function (box, p) {
    const s = this._s;
    if (!p || !s.showHistory || !p.history || !p.history.length) {
      box.hidden = true;
      box.textContent = "";
      return;
    }
    this._fillHistoryBox(box, p, this._cards.length > 1);
    box.hidden = false;
  };

  SkinOverlay.prototype._positionSides = function () {
    const b = this._board;
    const s = this._s || {};
    const gap = s.sidePanelGap != null ? +s.sidePanelGap : 18;
    const vw = window.innerWidth || 1920;

    // history-only side boxes: centred vertically on the board
    const placeBox = (box, side) => {
      if (!box || box.hidden) return;
      if (!b) { box.style.visibility = "hidden"; return; }
      box.style.visibility = "";
      box.style.height = "";
      box.style.top = b.cy + "px";
      if (side === "left") {
        box.style.left = Math.max(4, b.left - gap) + "px";
        box.style.transform = "translate(-100%, -50%)";
      } else {
        box.style.left = Math.min(vw - 4, b.right + gap) + "px";
        box.style.transform = "translate(0, -50%)";
      }
    };
    // side columns (Sides layout): top-aligned to the board, the history free
    // to grow downward with the rounds to near the bottom of the screen
    const vh = window.innerHeight || 1080;
    const placeCol = (col, side) => {
      if (!col || col.hidden) return;
      if (!b) { col.style.visibility = "hidden"; return; }
      col.style.visibility = "";
      col.style.transform = "none";
      col.style.height = "auto";
      col.style.maxHeight = "none";
      const topPx = Math.max(6, b.top);
      col.style.top = topPx + "px";
      const w = col.offsetWidth || 280;
      col.style.left = (side === "left"
        ? Math.max(6, b.left - gap - w)
        : Math.min(vw - w - 6, b.right + gap)) + "px";
      const card = col.querySelector(".sk-card");
      const hist = col.querySelector(".sk-history");
      if (hist) {
        const cardH = card ? card.getBoundingClientRect().height : 0;
        // grow down as far as the bottom of the screen
        const room = vh - topPx - cardH - 24;
        hist.style.maxHeight = Math.max(90, room) + "px";
      }
    };

    placeBox(this.sideL, "left");
    placeBox(this.sideR, "right");
    placeCol(this.colL, "left");
    placeCol(this.colR, "right");
  };

  SkinOverlay.prototype._darts = function (p) {
    const s = this._s;
    const thrown = p.turnDarts || [];
    const guide = s.showCheckoutDarts ? p.checkoutDarts || [] : [];
    const thrownAsPoints = s.dartValues !== false;
    const label = (d, asPoints) => {
      if (d == null) return "";
      if (typeof d === "string") return d;
      if (asPoints) return d.value != null ? String(d.value) : (d.name || "");
      return d.name || (d.value != null ? String(d.value) : "");
    };
    // Always exactly 3 equal slots: thrown darts, then checkout suggestion,
    // then blanks — so the row never changes size between rounds.
    for (let i = 0; i < 3; i++) {
      let text = "", cls = "is-empty";
      if (i < thrown.length) { text = label(thrown[i], thrownAsPoints) || "0"; cls = "is-thrown"; }
      else if (i - thrown.length < guide.length) { text = label(guide[i - thrown.length], false); cls = "is-suggest"; }
      this.dartsRow.appendChild(el("span", "sk-dart " + cls, text || " "));
    }
  };

  root.SkinOverlay = SkinOverlay;
})(typeof window !== "undefined" ? window : globalThis);
