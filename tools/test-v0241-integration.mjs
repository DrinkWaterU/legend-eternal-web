import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  game,
  html,
  dom,
  commerce,
  merchantView,
  merchantController,
  componentsCss,
  responsiveCss,
  version,
  config,
  readme,
  styleIndex,
  editorSource
] = await Promise.all([
  readFile(new URL("../game.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/dom.js", import.meta.url), "utf8"),
  readFile(new URL("../src/core/commerce.js", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/merchantView.js", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/merchantController.js", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/components.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/responsive.css", import.meta.url), "utf8"),
  readFile(new URL("../VERSION", import.meta.url), "utf8"),
  readFile(new URL("../src/config.js", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("./content-editor.js", import.meta.url), "utf8")
]);

assert.equal(version.trim(), "v0.2.4.2-alpha");
assert.match(config, /GAME_VERSION = "v0\.2\.4\.2-alpha"/);
assert.match(readme, /v0\.2\.4\.2-alpha/);
assert.match(html, /styles\.css\?v=0\.2\.4\.2-alpha/);
assert.match(html, /game\.js\?v=0\.2\.4\.2-alpha/);
assert.match(editorSource, /DEFAULT_GAME_VERSION = "v0\.2\.4\.2-alpha"/);
const styleCacheVersions = [...styleIndex.matchAll(/\?v=([^"\)]+)/g)].map((match) => match[1]);
assert.deepEqual([...new Set(styleCacheVersions)], ["0.2.4.2-alpha"]);

for (const id of [
  "merchantBatchToggleButton",
  "merchantBatchBar",
  "merchantBatchSummary",
  "merchantBatchTotal",
  "confirmMerchantBatchButton",
  "cancelMerchantBatchButton",
  "merchantSaleDecreaseFiveButton",
  "merchantSaleIncreaseFiveButton",
  "merchantSaleQuantity",
  "merchantBatchSaleList"
]) {
  assert.match(html, new RegExp(`id="${id}"`), `Merchant HTML 缺少 ${id}`);
  assert.match(dom, new RegExp(`#${id}`), `dom.js 缺少 ${id}`);
}

assert.match(html, /id="merchantSaleQuantity"[^>]*type="number"[^>]*inputmode="numeric"/);
assert.match(html, /id="merchantSaleDecreaseFiveButton"[^>]*>−5</);
assert.match(html, /id="merchantSaleIncreaseFiveButton"[^>]*>＋5</);

assert.match(game, /import \{ createMerchantController \} from "\.\/src\/ui\/merchantController\.js"/);
assert.match(game, /const merchantController = createMerchantController\(\{/);
assert.match(game, /getInventory: \(\) => saveData\.inventory/);
assert.match(game, /getSafeArea: getCurrentSafeArea/);
assert.match(game, /saveInventory: saveGameSafe/);
assert.match(game, /merchantController\.reset\(\)/);
assert.match(game, /merchantController\.render\(\)/);
assert.match(game, /merchantController\.closeSaleDialog/);
for (const field of [
  "merchantSortMode",
  "merchantBatchMode",
  "merchantBatchMaterialIds",
  "merchantSaleDialogMode",
  "merchantSaleQuantityInput",
  "merchantNotice"
]) {
  assert.doesNotMatch(game, new RegExp(`${field}:`), `Merchant 專屬 State 不應留在 game.js：${field}`);
}
assert.doesNotMatch(game, /function renderMerchantScreen\(/);
assert.doesNotMatch(game, /function confirmMerchantBatchSale\(/);

assert.match(merchantController, /export function createMerchantController/);
assert.match(merchantController, /function createMerchantState\(\)/);
assert.match(merchantController, /function normalizeBatchSelection\(\)/);
assert.match(merchantController, /function changeSaleQuantity\(change\)[\s\S]*state\.saleQuantity \+ change/);
const controllerBatchConfirmStart = merchantController.indexOf("function confirmBatchSale()");
const controllerBatchConfirmEnd = merchantController.indexOf("function resetSaleDialogState()", controllerBatchConfirmStart);
const controllerBatchConfirmSource = merchantController.slice(controllerBatchConfirmStart, controllerBatchConfirmEnd);
assert.match(controllerBatchConfirmSource, /sellMaterials\(/);
assert.match(controllerBatchConfirmSource, /saveInventory\(\)/);
assert.match(controllerBatchConfirmSource, /state\.batchMaterialIds = new Set\(\)/);
assert.match(controllerBatchConfirmSource, /result\.totalQuantity/);
assert.match(controllerBatchConfirmSource, /result\.totalGold/);
assert.match(merchantController, /Object\.freeze\(\{[\s\S]*reset,[\s\S]*render,[\s\S]*closeSaleDialog/);

assert.match(commerce, /export function sellMaterials/);
assert.match(commerce, /createMaterialSalePlan/);
assert.match(commerce, /const plan = createMaterialSalePlan/);
assert.match(commerce, /const nextMaterials = \{ \.\.\.inventory\.materials \}/);
assert.match(commerce, /export function sellMaterial[\s\S]*sellMaterials\(/);
const sellMaterialsSource = commerce.match(/export function sellMaterials\([\s\S]*?\n\}/)?.[0] || "";
assert.doesNotMatch(sellMaterialsSource, /sellMaterial\(/, "批次交易不得逐筆 mutation");

assert.match(merchantView, /createMerchantBatchPreview/);
assert.match(merchantView, /aria-pressed/);
assert.match(merchantView, /renderMerchantBatchSalePanel/);
assert.match(merchantView, /getValidMerchantSaleQuantity/);
assert.doesNotMatch(merchantView, /setTimeout|setInterval|requestAnimationFrame/, "數量控制不需要長按 timer");

assert.match(componentsCss, /\.merchant-toolbar\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
assert.match(componentsCss, /\.merchant-quantity-control > div\s*\{[\s\S]*repeat\(2, minmax\(48px, 1fr\)\)/);
assert.match(componentsCss, /\.merchant-slot\.is-selected/);
assert.match(componentsCss, /\.merchant-batch-sale-list\[hidden\]/);
assert.match(responsiveCss, /\.merchant-batch-bar\s*\{[\s\S]*grid-template-columns: 1fr/);

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const domIds = [...dom.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map((match) => match[1]);
const missingIds = domIds.filter((id) => !htmlIds.has(id));
assert.deepEqual(missingIds, [], `dom.js 不可引用不存在的 HTML id：${missingIds.join(", ")}`);

assert.match(config, /SAVE_SCHEMA_VERSION = 6/);

console.log("v0.2.4.1 merchant quantity and atomic batch sale integration tests passed.");
