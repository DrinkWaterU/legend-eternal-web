import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { getFacilityDefinition } from "../src/data/facilities.js";
import { getSafeAreaDefinition } from "../src/data/safeAreas.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { GAME_VERSION } from "../src/config.js";

const root = new URL("../", import.meta.url);
const [html, game, dom, componentsCss, responsiveCss, gitignore] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  Promise.all(["src/features/facility/facilityController.js", "src/features/character/characterController.js", "src/features/character/characterEquipmentController.js", "src/app/createFoundation.js", "src/app/eventBindings.js"].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n")),
  readFile(new URL("src/ui/dom.js", root), "utf8"),
  readFile(new URL("src/styles/components.css", root), "utf8"),
  readFile(new URL("src/styles/responsive.css", root), "utf8"),
  readFile(new URL(".gitignore", root), "utf8")
]);

for (const id of [
  "blacksmithView",
  "blacksmithAreaLabel",
  "blacksmithGold",
  "blacksmithNotice",
  "blacksmithWeaponList",
  "blacksmithEmpty",
  "blacksmithDetail",
  "blacksmithCraftButton",
  "blacksmithCraftPanel",
  "blacksmithCraftTitle",
  "blacksmithCraftMeta",
  "blacksmithCraftCostList",
  "confirmBlacksmithCraftButton",
  "closeBlacksmithCraftButton",
  "characterDetailWeaponName",
  "openCharacterEquipmentButton",
  "characterEquipmentView",
  "equipmentCharacterName",
  "equipmentCurrentSlot",
  "equipmentWeaponGrid",
  "equipmentPreview",
  "equipWeaponButton",
  "unequipWeaponButton"
]) {
  assert.match(html, new RegExp(`id="${id}"`), `HTML 缺少 ${id}`);
  assert.match(dom, new RegExp(`#${id}`), `dom.js 缺少 ${id}`);
}

const blacksmith = getFacilityDefinition("blacksmith");
assert.equal(blacksmith.actionId, "blacksmith");
assert.ok(getSafeAreaDefinition("anping-town").facilityIds.includes("blacksmith"));
assert.deepEqual(Object.keys(weaponDefinitions), [
  "iron-longsword",
  "guard-short-sword",
  "hunter-shortbow",
  "vanguard-hunting-bow",
  "verdant-pursuit-bow",
  "ancient-wood-eroding-bow",
  "bloodbone-guardian-mace",
  "spider-silk-stinger-dagger"
]);

assert.match(game, /const actionHandlers = Object\.freeze\(\{[\s\S]*blacksmith: showBlacksmithFacility/);
assert.match(game, /function showCharacterEquipment\(/);
assert.match(game, /function equipCharacterWeapon\(/);
assert.match(game, /function unequipCharacterWeapon\(/);
assert.match(game, /buildHeroFromProgression\(characterDefinitions\[characterId\], progress, \{[\s\S]*inventory: saveStore\.current\.inventory,[\s\S]*weaponDefinitions/);
assert.match(game, /closeBlacksmithCraft: blacksmithController\.closeCraftDialog/);
const cacheVersion = GAME_VERSION.replace(/^v/, "");
assert.match(html, new RegExp(`styles\\.css\\?v=${cacheVersion.replaceAll(".", "\\.")}`));
assert.match(html, new RegExp(`game\\.js\\?v=${cacheVersion.replaceAll(".", "\\.")}`));

assert.match(componentsCss, /\.blacksmith-layout/);
assert.match(componentsCss, /\.equipment-layout/);
assert.match(componentsCss, /\.weapon-icon/);
assert.match(componentsCss, /\.blacksmith-weapon-card\.rarity-uncommon/);
assert.match(componentsCss, /\.equipment-current-slot\[data-rarity="uncommon"\]/);
assert.doesNotMatch(componentsCss, /grade-special/);
assert.match(responsiveCss, /\.blacksmith-layout/);
assert.match(responsiveCss, /\.equipment-layout/);
assert.match(gitignore, /^\/武器icon生圖通用prompt\.md$/m);
if (!existsSync(new URL("AI_PACKAGE_INFO.txt", root))) {
  await access(new URL("assets/images/icons/weapons/.gitkeep", root));
}

console.log("Blacksmith, weapon equipment UI, fallback asset, and wiring tests passed.");
