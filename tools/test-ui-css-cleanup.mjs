import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, guildRecordView, screensCss, componentsCss, responsiveCss, refreshCss] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("src/ui/guildAdventureRecordView.js", root), "utf8"),
  readFile(new URL("src/styles/screens.css", root), "utf8"),
  readFile(new URL("src/styles/components.css", root), "utf8"),
  readFile(new URL("src/styles/responsive.css", root), "utf8"),
  readFile(new URL("src/styles/ui-refresh.css", root), "utf8")
]);

const combinedCss = [screensCss, componentsCss, responsiveCss, refreshCss].join("\n");
const removedHistoricalClasses = [
  "achievement-list",
  "achievement-card",
  "material-info-dialog",
  "detail-info-layout",
  "detail-info-primary",
  "detail-info-secondary",
  "detail-info-card",
  "skill-group",
  "skill-chip-list",
  "skill-chip",
  "next-skill-list",
  "next-skill-card",
  "blacksmith-summary",
  "character-equipment-summary",
  "equipment-layout",
  "guild-record-celine-card",
  "guild-record-celine-portrait",
  "guild-record-celine-quote",
  "guild-record-panel",
  "guild-record-identity",
  "guild-record-emblem",
  "guild-record-summary",
  "guild-record-experience-list",
  "guild-record-empty",
  "guild-record-intro",
  "guild-record-celine-copy",
  "guild-record-panel-heading",
  "guild-record-section-heading",
  "guild-record-experience-marker",
  "guild-bulk-dialogue-card",
  "guild-bulk-speaker",
  "guild-bulk-speaker-portrait",
  "guild-bulk-dialogue-text-region",
  "guild-bulk-status-row",
  "guild-bulk-gold-summary",
  "guild-bulk-layout",
  "guild-bulk-catalog",
  "guild-bulk-summary-card",
  "guild-bulk-grid",
  "guild-bulk-material-card",
  "guild-bulk-tier-row",
  "guild-bulk-quantity-control",
  "guild-bulk-remove-button",
  "guild-bulk-price-grid",
  "guild-bulk-summary-empty",
  "guild-bulk-summary-totals",
  "guild-bulk-summary-list",
  "guild-bulk-summary-heading"
];

for (const className of removedHistoricalClasses) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.doesNotMatch(
    combinedCss,
    new RegExp(`\\.${escaped}(?![A-Za-z0-9_-])`),
    `歷史樣式 .${className} 不應再次出現`
  );
}

for (const className of [
  "achievement-workspace",
  "achievement-index-card",
  "achievement-detail-panel",
  "skill-entry",
  "skill-stage-card",
  "character-skill-detail",
  "equipment-workspace",
  "equipment-weapon-card",
  "equipment-preview-heading",
  "equipment-current-slot",
  "guild-record-reception-card",
  "guild-record-sheet",
  "guild-record-milestone-list",
  "guild-material-card",
  "quantity-panel",
  "summary-item",
  "confirm-item"
]) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(combinedCss, new RegExp(`\\.${escaped}(?![A-Za-z0-9_-])`), `正式樣式缺少 .${className}`);
}

for (const className of [
  "equipment-workspace",
  "achievement-workspace",
  "guild-sale-layout",
  "guild-bulk-confirm-list"
]) {
  assert.match(html, new RegExp(`class="[^"]*\\b${className}\\b`), `HTML 缺少正式結構 .${className}`);
}

assert.match(guildRecordView, /className = "guild-record-layout"/, "冒險履歷應建立正式 guild-record-layout");

console.log("Historical UI CSS was removed while current UI contracts remain intact.");
