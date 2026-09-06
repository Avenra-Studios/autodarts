// Normalizes autodarts match-state into the model the overlay renders.
//
// Source: WS topic "<matchId>.state" and XHR "GET /gs/v0/matches/<id>/state"
// carry the same object. WS topic "<matchId>.game-events" carries transient
// {event,body} notifications (throw / turn_start / turn_end).

(function (root) {
  function num(v, d = 0) { return typeof v === "number" && isFinite(v) ? v : d; }
  function str(v) { return v == null ? "" : String(v); }
  function round1(n) { return Math.round(n * 10) / 10; }

  function countryFlag(code) {
    code = str(code);
    if (code.length !== 2) return "";
    return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }

  // Rough autodarts skill band from a pre-match average.
  function skillBand(avg) {
    if (!avg) return "";
    if (avg < 30) return "30-";
    if (avg < 40) return "30+";
    if (avg < 50) return "40+";
    if (avg < 60) return "50+";
    if (avg < 70) return "60+";
    if (avg < 80) return "70+";
    if (avg < 90) return "80+";
    return "90+";
  }

  function normalize(st, flash) {
    if (!st || typeof st !== "object" || !Array.isArray(st.players) || !st.players.length) return null;

    const settings = st.settings || {};
    const start = num(settings.baseScore, 501);
    const cur = num(st.player, 0);
    const scores = st.scores || [];
    const gameScores = st.gameScores || [];
    const stats = st.stats || [];
    const chalk = st.chalkboards || [];
    const guides = (st.state && st.state.checkoutGuides) || [];
    const turn = (st.turns && st.turns[0]) || null;

    const players = st.players.map((p, i) => {
      const sc = scores[i] || {};
      const legStats = (stats[i] && (stats[i].legStats || stats[i].matchStats)) || {};
      const matchStats = (stats[i] && stats[i].matchStats) || {};
      const rows = (chalk[i] && chalk[i].rows) || [];
      const preAvg = num(p.average != null ? p.average : (p.user && p.user.average));
      const isActive = i === cur;
      return {
        index: i,
        name: str(p.name || (p.user && p.user.name)) || `Player ${i + 1}`,
        score: num(gameScores[i], start),
        legs: num(sc.legs),
        sets: num(sc.sets),
        average: round1(num(legStats.average)),
        averageAlt: round1(num(legStats.first9Average)),
        matchAverage: round1(num(matchStats.average)),
        dartsThrown: num(legStats.dartsThrown),
        rank: preAvg ? "⌀ " + Math.round(preAvg) : "",
        skill: skillBand(preAvg),
        country: str(p.country || (p.user && p.user.country)).slice(0, 2),
        avatarUrl: str(p.avatarUrl || (p.user && p.user.avatarUrl)),
        history: rows.map((r) => ({
          scored: num(r.points),
          left: num(r.score),
          bust: !!(r.isScoreStruck || r.isPointsStruck)
        })),
        turnDarts: isActive && turn && Array.isArray(turn.throws)
          ? turn.throws.map((t) => ({ name: str(t.segment && t.segment.name) || "–", value: segValue(t.segment) }))
          : [],
        checkoutDarts: isActive
          ? ((guides[i] || (st.state && st.state.checkoutGuide) || []).map((s) => str(s.name)).filter(Boolean))
          : [],
        isActive,
        isWinner: st.winner === i || st.gameWinner === i
      };
    });

    let lastEvent = null;
    if (st.turnBusted) lastEvent = "bust";
    else if (flash && flash.type && Date.now() < flash.until) lastEvent = flash.type;
    else if (st.gameWinner >= 0 || st.winner >= 0) lastEvent = "checkout";

    return {
      active: !st.finished || st.winner >= 0,
      variant: str(st.variant || "X01"),
      startScore: start,
      inMode: str(settings.inMode || "Straight"),
      outMode: str(settings.outMode || "Double"),
      legs: num(st.legs),
      sets: num(st.sets),
      leg: num(st.leg, 1),
      set: num(st.set, 1),
      round: num(st.round, 1),
      currentPlayerIndex: cur,
      players,
      lastEvent,
      _flag: countryFlag
    };
  }

  function segValue(s) {
    if (!s) return 0;
    const m = s.multiplier || (s.bed === "Triple" ? 3 : s.bed === "Double" ? 2 : 1);
    return num(s.number) * m;
  }

  // ---- accumulator ---------------------------------------------------
  function SkinStateStore() { this.state = null; this.flash = null; }

  SkinStateStore.prototype.ingest = function (payload) {
    if (!payload || typeof payload !== "object") return;
    const inner = payload.data;

    // WS envelope: { channel, topic, data }
    if (inner && inner.channel === "autodarts.matches" && typeof inner.topic === "string") {
      if (/\.state$/.test(inner.topic) && inner.data && inner.data.players) {
        this.state = inner.data;
      } else if (/\.game-events$/.test(inner.topic) && inner.data) {
        this._event(inner.data);
      }
      return;
    }

    // XHR / fetch: { url, data: <stateObject> }
    if (typeof payload.url === "string" && inner && inner.players && inner.variant) {
      if (/\/state(\?|$)/.test(payload.url) || inner.gameScores) this.state = inner;
    }
  };

  SkinStateStore.prototype._event = function (ev) {
    const e = ev.event || ev.type;
    if (e === "turn_end" && ev.body && ev.body.points === 0) this.flash = { type: "bust", until: Date.now() + 2500 };
    if (e === "turn_start" && ev.body && ev.body.isCheckout === false) this.flash = null;
  };

  SkinStateStore.prototype.model = function () { return normalize(this.state, this.flash); };
  SkinStateStore.prototype.reset = function () { this.state = null; this.flash = null; };

  // ---- preview mock (mirrors the reference screenshot) -------------
  function mockState() {
    return {
      active: true, variant: "X01", startScore: 501, inMode: "Straight", outMode: "Double",
      legs: 3, sets: 0, leg: 3, set: 1, round: 6, currentPlayerIndex: 1,
      players: [
        {
          index: 0, name: "HOLBECK", score: 157, legs: 1, sets: 0,
          average: 57.3, averageAlt: 47.9, matchAverage: 55.9, dartsThrown: 18, rank: "⌀ 55", skill: "50+",
          country: "gb", avatarUrl: "",
          history: [
            { scored: 60, left: 441 }, { scored: 65, left: 376 }, { scored: 60, left: 316 },
            { scored: 79, left: 237 }, { scored: 35, left: 202 }, { scored: 45, left: 157 }
          ],
          turnDarts: [], checkoutDarts: [], isActive: false, isWinner: false
        },
        {
          index: 1, name: "JOBEGOOD", score: 60, legs: 1, sets: 0,
          average: 82.7, averageAlt: 53.7, matchAverage: 78.4, dartsThrown: 16, rank: "⌀ 71", skill: "70+",
          country: "de", avatarUrl: "",
          history: [
            { scored: 0, left: 501 }, { scored: 85, left: 416 }, { scored: 41, left: 375 },
            { scored: 76, left: 299 }, { scored: 140, left: 159 }, { scored: 80, left: 79, bust: true }
          ],
          turnDarts: [{ name: "S19", value: 19 }],
          checkoutDarts: ["S20", "D20"], isActive: true, isWinner: false
        }
      ],
      lastEvent: null, _flag: countryFlag
    };
  }

  root.SkinNormalize = normalize;
  root.SkinStateStore = SkinStateStore;
  root.skinMockState = mockState;
  root.skinCountryFlag = countryFlag;
})(typeof window !== "undefined" ? window : globalThis);
