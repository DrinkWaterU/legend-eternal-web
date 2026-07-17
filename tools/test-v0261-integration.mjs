import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";

import { GAME_VERSION, SAVE_SCHEMA_VERSION } from "../src/config.js";
import { dialogueDefinitions } from "../src/data/dialogues.js";
import { facilityDefinitions } from "../src/data/facilities.js";
import { npcDefinitions } from "../src/data/npcs.js";
import { safeAreaDefinitions } from "../src/data/safeAreas.js";

const root = new URL("../", import.meta.url);
const [html, game, dom, componentsCss, responsiveCss, storage, commerce, dialogueCore] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  Promise.all(["src/app/createWorldFeatures.js", "src/features/facility/facilityController.js"].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n")),
  readFile(new URL("src/ui/dom.js", root), "utf8"),
  readFile(new URL("src/styles/components.css", root), "utf8"),
  readFile(new URL("src/styles/responsive.css", root), "utf8"),
  Promise.all(["src/core/storage.js", "src/core/saveDefaults.js", "src/core/saveMigrations.js"].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n")),
  Promise.all(["src/core/commerce.js", "src/core/materialSales.js"].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n")),
  readFile(new URL("src/core/dialogue.js", root), "utf8")
]);

assert.match(GAME_VERSION, /^v0\.2\.6\.\d+-alpha$/);
assert.equal(SAVE_SCHEMA_VERSION, 9);
assert.deepEqual(safeAreaDefinitions["anping-town"].facilityIds, ["blacksmith", "adventurers-guild"]);
assert.equal(facilityDefinitions["adventurers-guild"].npcId, "anping-guild-receptionist");
assert.equal(facilityDefinitions["guild-adventure-record"].hiddenFromList, true);
assert.equal(facilityDefinitions["guild-bulk-sale"].hiddenFromList, true);
assert.equal(npcDefinitions["anping-guild-receptionist"].name, "瑟琳");
assert.equal(dialogueDefinitions["anping-guild-receptionist-main"].nodes["first-feature-overview"].pages.length, 4);

for (const id of [
  "guildRecordView", "guildRecordAreaLabel", "guildRecordBackButton", "guildRecordContent",
  "guildBulkView", "guildBulkAreaLabel", "guildBulkBackButton", "guildBulkSpeakerPortraitImage",
  "guildBulkSpeakerPortraitFallback", "guildBulkSpeakerTitle", "guildBulkSpeakerName", "guildBulkDialogueTextRegion",
  "guildBulkDialogueSkipButton", "guildBulkDialogueText", "guildBulkGold", "guildBulkNotice",
  "guildBulkEmpty", "guildBulkGrid", "guildBulkSearchInput", "guildBulkRegionFilter", "guildBulkSortSelect",
  "guildBulkResultCount", "guildBulkClearDraftButton", "guildBulkSummaryEmpty", "guildBulkSummaryContent",
  "guildBulkSummaryList", "guildBulkSummaryKinds", "guildBulkSummaryQuantity",
  "guildBulkSummaryReference", "guildBulkSummaryTotal", "guildBulkSummaryDifference", "guildBulkSummaryHint",
  "confirmGuildBulkDraftButton", "guildBulkConfirmPanel", "guildBulkConfirmMeta",
  "guildBulkConfirmList", "guildBulkConfirmReference", "guildBulkConfirmTotal",
  "guildBulkConfirmDifference", "confirmGuildBulkSaleButton", "closeGuildBulkConfirmButton"
]) {
  assert.match(html, new RegExp(`id="${id}"`), `HTML 缺少 ${id}`);
  assert.match(dom, new RegExp(`#${id}`), `dom.js 缺少 ${id}`);
}

assert.match(storage, /metAnpingGuildReceptionist: false/);
assert.match(storage, /knowsAnpingGuildReceptionistName: false/);
assert.match(storage, /registeredAtAnpingGuild: false/);
assert.match(storage, /registeredAtAnpingGuild[\s\S]*knowsAnpingGuildReceptionistName = true/);

assert.match(dialogueCore, /regionRouteClear/);
assert.match(dialogueCore, /getVisibleDialoguePages/);
assert.match(commerce, /GUILD_BULK: "guild-bulk"/);
assert.match(commerce, /percent: 90/);
assert.match(commerce, /percent: 110/);
assert.match(commerce, /percent: 115/);

for (const source of [
  "createGuildAdventureRecordController",
  "createGuildBulkSaleController",
  '"guild-adventure-record": showGuildAdventureRecordFacility',
  '"guild-bulk-sale": showGuildBulkSaleFacility',
  "returnToGuildDialogue",
  "guildBulkSaleController.reset()",
  'classList.toggle("is-guild-record-mode"',
  'classList.toggle("is-guild-sale-mode"'
]) {
  assert.match(game, new RegExp(escapeRegExp(source)), `公會 Feature 缺少接線：${source}`);
}

assert.match(componentsCss, /\.facility-panel\.is-guild-record-mode[\s\S]*max-width: 1120px/);
assert.match(componentsCss, /\.facility-panel\.is-guild-sale-mode[\s\S]*max-width: 1160px/);
assert.match(componentsCss, /\.guild-record-layout[\s\S]*grid-template-columns/);
assert.match(componentsCss, /\.guild-record-reception-card/);
assert.match(componentsCss, /\.guild-record-sheet/);
assert.match(componentsCss, /\.guild-record-celine-note/);
assert.match(componentsCss, /\.guild-sale-layout[\s\S]*grid-template-columns/);
assert.match(componentsCss, /\.guild-clerk-strip/);
assert.match(componentsCss, /\.summary-empty\[hidden\][\s\S]*display: none !important/);
assert.match(responsiveCss, /@media \(max-width: 920px\)[\s\S]*\.guild-record-layout/);
assert.match(responsiveCss, /@media \(max-width: 980px\)[\s\S]*\.guild-sale-layout/);

if (!existsSync(new URL("AI_PACKAGE_INFO.txt", root))) {
  await access(new URL("assets/images/npcs/anping/celine.png", root));
}
assert.match(html, new RegExp(`styles\\.css\\?v=${GAME_VERSION.slice(1).replaceAll(".", "\\.")}`));
assert.match(html, new RegExp(`game\\.js\\?v=${GAME_VERSION.slice(1).replaceAll(".", "\\.")}`));

console.log("v0.2.6.1 guild facility, Celine, adventure record, bulk sale, DOM, responsive, and version integration tests passed.");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
