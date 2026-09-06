// Settings schema + defaults for Autodarts Skin.
// SKIN_SCHEMA drives the auto-generated options UI *and* documents every key.
// SKIN_DEFAULTS is the flat { key: value } map stored in chrome.storage.sync.
//
// Types: "toggle" | "color" | "range" | "select" | "text"
// Any field with `cssVar` is mirrored onto #autodarts-skin-root as a CSS
// custom property (via skinCssValue).

(function (root) {
  const SKIN_SCHEMA = [
    {
      group: "General",
      fields: [
        { key: "enabled", label: "Enable custom play UI", type: "toggle", default: true },
        {
          key: "layout", label: "Layout", type: "select", default: "sides",
          options: [
            { value: "sides", label: "Sides (panels beside a big board, darts on top)" },
            { value: "board", label: "Board view (panels on top)" },
            { value: "focus", label: "Focus (active player big)" },
            { value: "minimal", label: "Minimal bar" }
          ]
        },
        { key: "position", label: "Panels at", type: "select", default: "top", cssVar: "--sk-anchor",
          options: [{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }] },
        { key: "uiScale", label: "Overall scale", type: "range", min: 0.6, max: 1.6, step: 0.02, default: 1, unit: "", cssVar: "--sk-scale" },
        { key: "maxWidth", label: "Max panel-row width", type: "range", min: 700, max: 2400, step: 20, default: 1500, unit: "px", cssVar: "--sk-maxw" },
        { key: "cardWidth", label: "Player panel width (top layouts)", type: "range", min: 380, max: 1200, step: 10, default: 640, unit: "px", cssVar: "--sk-card-w" },
        { key: "sidePanelWidth", label: "Side panel width (Sides layout)", type: "range", min: 180, max: 520, step: 5, default: 280, unit: "px", cssVar: "--sk-col-w" },
        { key: "sidePanelGap", label: "Side panel gap from board", type: "range", min: 0, max: 80, step: 2, default: 18, unit: "px" },
        { key: "hideNative", label: "Hide autodarts' original scoreboard", type: "toggle", default: true },
        { key: "keepBoard", label: "Keep the live dartboard visible", type: "toggle", default: true }
      ]
    },
    {
      group: "Colors",
      fields: [
        { key: "colBg", label: "Background base", type: "color", default: "#1d264a", cssVar: "--sk-bg" },
        { key: "colBgGlow", label: "Background glow", type: "color", default: "#2f63a0", cssVar: "--sk-bg-glow" },
        { key: "colPanel", label: "Panel", type: "color", default: "#3a3f78", cssVar: "--sk-panel" },
        { key: "colPanelActive", label: "Active panel", type: "color", default: "#4d6fac", cssVar: "--sk-panel-active" },
        { key: "colPanelBorder", label: "Active panel border", type: "color", default: "#a7c6f2", cssVar: "--sk-panel-border" },
        { key: "colTable", label: "History table lines", type: "color", default: "#8394d6", cssVar: "--sk-table" },
        { key: "colDart", label: "Dart box", type: "color", default: "#3c4a80", cssVar: "--sk-dart" },
        { key: "colDartActive", label: "Dart box (current)", type: "color", default: "#5b7cbb", cssVar: "--sk-dart-active" },
        { key: "colText", label: "Primary text", type: "color", default: "#ffffff", cssVar: "--sk-text" },
        { key: "colMuted", label: "Muted text", type: "color", default: "#c3cdec", cssVar: "--sk-muted" },
        { key: "colAccent", label: "Accent", type: "color", default: "#5b9bff", cssVar: "--sk-accent" },
        { key: "colLegs", label: "Legs badge", type: "color", default: "#3fae4a", cssVar: "--sk-legs" },
        { key: "colGood", label: "Checkout / win", type: "color", default: "#43d17a", cssVar: "--sk-good" },
        { key: "colBust", label: "Bust", type: "color", default: "#ff5c5c", cssVar: "--sk-bust" }
      ]
    },
    {
      group: "Typography",
      fields: [
        {
          key: "fontFamily", label: "Font", type: "select", default: "system", cssVar: "--sk-font",
          options: [
            { value: "system", label: "System UI", css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
            { value: "mono", label: "Monospace", css: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
            { value: "rounded", label: "Rounded", css: "'Nunito', 'Quicksand', system-ui, sans-serif" },
            { value: "condensed", label: "Condensed", css: "'Oswald', 'Bebas Neue', Impact, system-ui, sans-serif" }
          ]
        },
        { key: "scoreSize", label: "Big score size", type: "range", min: 40, max: 260, step: 2, default: 96, unit: "px", cssVar: "--sk-score-size" },
        { key: "scoreWeight", label: "Big score weight", type: "range", min: 200, max: 900, step: 100, default: 800, unit: "", cssVar: "--sk-score-weight" },
        { key: "nameSize", label: "Player name size", type: "range", min: 10, max: 44, step: 1, default: 19, unit: "px", cssVar: "--sk-name-size" },
        { key: "statSize", label: "Stat line size", type: "range", min: 9, max: 28, step: 1, default: 13, unit: "px", cssVar: "--sk-stat-size" },
        { key: "tableSize", label: "History table size", type: "range", min: 8, max: 40, step: 1, default: 19, unit: "px", cssVar: "--sk-table-size" },
        { key: "tableRowGap", label: "History row spacing", type: "range", min: 0, max: 24, step: 1, default: 11, unit: "px", cssVar: "--sk-table-row-gap" },
        { key: "dartSize", label: "Dart box text size", type: "range", min: 12, max: 48, step: 1, default: 22, unit: "px", cssVar: "--sk-dart-size" }
      ]
    },
    {
      group: "Layout & spacing",
      fields: [
        { key: "radius", label: "Corner radius", type: "range", min: 0, max: 40, step: 1, default: 22, unit: "px", cssVar: "--sk-radius" },
        { key: "panelOpacity", label: "Panel opacity", type: "range", min: 8, max: 100, step: 1, default: 46, unit: "%", cssVar: "--sk-panel-op" },
        { key: "glassBlur", label: "Glass blur", type: "range", min: 0, max: 40, step: 1, default: 22, unit: "px", cssVar: "--sk-glass-blur" },
        { key: "panelPad", label: "Panel padding", type: "range", min: 4, max: 48, step: 1, default: 18, unit: "px", cssVar: "--sk-panel-pad" },
        { key: "gap", label: "Gap between panels", type: "range", min: 0, max: 48, step: 1, default: 16, unit: "px", cssVar: "--sk-gap" },
        { key: "borderWidth", label: "Active border width", type: "range", min: 0, max: 10, step: 1, default: 3, unit: "px", cssVar: "--sk-border-w" }
      ]
    },
    {
      group: "Show / hide",
      fields: [
        { key: "showLegs", label: "Legs / sets badge", type: "toggle", default: true },
        { key: "showAvatar", label: "Player avatar", type: "toggle", default: true },
        { key: "showFlag", label: "Country flag", type: "toggle", default: true },
        { key: "showSkill", label: "Skill badge (40+, 50+…)", type: "toggle", default: true },
        { key: "showStatLine", label: "Stat line under the score", type: "toggle", default: true },
        { key: "showAverage", label: "  · 3-dart average (Ø)", type: "toggle", default: true },
        { key: "showFirst9", label: "  · first-9 average (F9)", type: "toggle", default: true },
        { key: "showLegDarts", label: "  · darts thrown this leg", type: "toggle", default: true },
        { key: "showMatchAverage", label: "  · match average", type: "toggle", default: false },
        { key: "showHistory", label: "Score-history table (beside the board)", type: "toggle", default: true },
        { key: "historyRows", label: "History rows", type: "range", min: 3, max: 25, step: 1, default: 16, unit: "" },
        { key: "historyWidth", label: "History table width", type: "range", min: 90, max: 360, step: 5, default: 180, unit: "px", cssVar: "--sk-history-w" },
        {
          key: "historySide", label: "Solo history side", type: "select", default: "left",
          options: [{ value: "left", label: "Left of board" }, { value: "right", label: "Right of board" }]
        },
        { key: "showDartsRow", label: "Current-turn darts row", type: "toggle", default: true },
        { key: "showCheckoutDarts", label: "Checkout darts in the darts row", type: "toggle", default: true },
        { key: "showCheckout", label: "Checkout hint under the score", type: "toggle", default: false },
        { key: "showPager", label: "Leg pager (1 2 3)", type: "toggle", default: true }
      ]
    },
    {
      group: "Board glow",
      fields: [
        { key: "boardGlow", label: "Glow around the live board", type: "toggle", default: true },
        { key: "boardGlowColor", label: "Glow colour", type: "color", default: "#37e6c4" },
        { key: "boardGlowSize", label: "Glow size", type: "range", min: 0, max: 220, step: 4, default: 90, unit: "px" },
        { key: "boardGlowStrength", label: "Glow strength", type: "range", min: 0.1, max: 1, step: 0.05, default: 0.55, unit: "" }
      ]
    },
    {
      group: "Animation",
      fields: [
        { key: "animActive", label: "Animate turn changes", type: "toggle", default: true },
        { key: "showTurnBanner", label: "Player-name banner on turn change", type: "toggle", default: true },
        { key: "animScore", label: "Animate score changes", type: "toggle", default: true },
        { key: "animSpeed", label: "Animation speed", type: "range", min: 0.4, max: 2, step: 0.1, default: 1, unit: "", cssVar: "--sk-anim-speed" }
      ]
    },
    {
      group: "Page background",
      fields: [
        {
          key: "pageBg", label: "Background", type: "select", default: "bundled",
          options: [
            { value: "default", label: "Autodarts default" },
            { value: "bundled", label: "Bundled image (background.jpg)" },
            { value: "custom", label: "Custom image URL" }
          ]
        },
        { key: "pageBgUrl", label: "Custom image URL", type: "text", default: "" },
        { key: "pageBgDim", label: "Darken", type: "range", min: 0, max: 0.9, step: 0.05, default: 0.4, unit: "" },
        { key: "glassifyNative", label: "Glassify autodarts' own UI (all pages)", type: "toggle", default: true },
        { key: "glassifyBlur", label: "  · glass blur", type: "range", min: 2, max: 40, step: 1, default: 16, unit: "px" },
        { key: "glassifyOpacity", label: "  · glass opacity", type: "range", min: 10, max: 95, step: 1, default: 48, unit: "%" }
      ]
    }
  ];

  const SKIN_DEFAULTS = {};
  for (const g of SKIN_SCHEMA) for (const f of g.fields) SKIN_DEFAULTS[f.key] = f.default;

  root.SKIN_SCHEMA = SKIN_SCHEMA;
  root.SKIN_DEFAULTS = SKIN_DEFAULTS;

  root.skinCssValue = function (field, value) {
    if (field.type === "range") return String(value) + (field.unit || "");
    if (field.type === "select" && field.options) {
      const opt = field.options.find((o) => o.value === value);
      if (opt && opt.css != null) return opt.css;
      return String(value);
    }
    if (field.key === "bgImage") return value ? `url("${value}")` : "none";
    return String(value);
  };
})(typeof window !== "undefined" ? window : globalThis);
