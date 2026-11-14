import assert from "node:assert/strict";
import { createDefaultSave } from "../../src/core/storage.js";
import { createSaveStore } from "../../src/app/saveStore.js";
import { createSaveTransactions } from "../../src/app/saveTransactions.js";
import { createBlacksmithController } from "../../src/ui/blacksmithController.js";
import { createHammerTrainingCard, createSwordTrainingCard } from "../../src/ui/weaponTrainingView.js";
import { createElementMap, installTestDocument } from "../dom-test-stub.mjs";

installTestDocument();
const training = { regions: { forest: true, beach: false, highlands: false }, unlocked: false, ready: false };
const card = createSwordTrainingCard({ training, owned: true, location: "guild" });
const text = node => [node.textContent, ...node.children.map(text)].join(" ");
assert.match(text(card), /森林：已完成/);
assert.match(text(card), /海岸：尚未完成/);
assert.match(text(card), /普通守勢減輕直接傷害/);
assert.match(text(card), /比「穩守反攻」少減傷/);
assert.match(text(card), /只在下一回合攻擊命中時發動/);
assert.match(text(card), /否則失效/);
assert.match(text(card), /完成專精連招/);
const guildDisclosure = card.children.find(node => node.className === "weapon-training-disclosure");
assert.ok(guildDisclosure, "guild cards keep full steps behind an explicit disclosure");
assert.equal(guildDisclosure.attributes.open, undefined, "guild details start collapsed");
assert.equal(card.children.some(node => node.className === "weapon-training-steps-panel"), false);
assert.ok(guildDisclosure.children.some(node => node.className === "weapon-training-steps-panel"));
assert.equal(card.children.some(node => node.tagName === "button"), false);

const unlockedSwordCard = createSwordTrainingCard({
  training: { regions: { forest: true, beach: true, highlands: true }, unlocked: true, ready: true },
  owned: true,
  location: "guild"
});
assert.match(text(unlockedSwordCard), /已解鎖。到角色裝備頁選擇打法/);
assert.equal(unlockedSwordCard.children.some(node => node.className === "weapon-training-steps-panel"), false);
assert.ok(unlockedSwordCard.children.some(node => node.className === "weapon-training-disclosure"));

const unlockedHammerCard = createHammerTrainingCard({
  training: { regions: { highlands: true }, unlocked: true, ready: true },
  owned: true,
  location: "guild"
});
assert.match(text(unlockedHammerCard), /已解鎖。裝備鎮隘岩鎚/);
assert.equal(unlockedHammerCard.children.some(node => node.className === "weapon-training-steps-panel"), false);
assert.ok(unlockedHammerCard.children.some(node => node.className === "weapon-training-disclosure"));

const hammerCard = createHammerTrainingCard({
  training: { regions: { highlands: false }, unlocked: false, ready: false },
  owned: true,
  location: "guild"
});
assert.doesNotMatch(text(hammerCard), /先完成守隘劍專精/);
assert.match(text(hammerCard), /累積3層衝擊/);
assert.match(text(hammerCard), /高地開場至少有2名敵人/);
assert.match(text(hammerCard), /未命中時，仍會消耗3層衝擊/);
const readyHammerCard = createHammerTrainingCard({
  training: { regions: { highlands: true }, unlocked: false, ready: true },
  owned: true,
  location: "blacksmith"
});
const hammerUnlock = readyHammerCard.children.find(node => node.tagName === "button");
assert.equal(hammerUnlock.textContent, "解鎖震岩裂陣");
assert.equal(hammerUnlock.disabled, false, "hammer unlock is available without sword-training state");

const ids = ["blacksmithAreaLabel", "blacksmithGold", "blacksmithNotice", "blacksmithWeaponList", "blacksmithEmpty", "blacksmithDetailPanel", "blacksmithDetail", "blacksmithCraftButton", "blacksmithCraftPanel", "blacksmithCraftTitle", "blacksmithCraftMeta", "blacksmithCraftCostList", "confirmBlacksmithCraftButton"];
const els = createElementMap(ids);
const save = createDefaultSave();
save.inventory.weapons["windbreak-sword"] = true;
save.weaponTraining = { regions: { forest: true, beach: true, highlands: true }, unlocked: false, mode: "steady" };
let succeeds = false;
let retry;
const store = createSaveStore({ initialSave: save, persistSave: () => succeeds });
const transactions = createSaveTransactions({ saveStore: store, pendingView: { show(options) { retry = options.retry; }, hide() {} } });
const controller = createBlacksmithController({
  els,
  weaponDefinitions: { "windbreak-sword": { id: "windbreak-sword", name: "斷風守隘劍", categoryId: "sword", rarityId: "common", statEffects: [], recipe: { goldCost: 0, materialCosts: [] } } },
  weaponCategoryDefinitions: { sword: { label: "劍" } }, materialDefinitions: {},
  getInventory: () => store.current.inventory, getSave: () => store.current,
  commitSaveChange: transactions.commitSaveChange,
  commitInventoryChange: (mutate, done) => transactions.commitSaveChange(draft => mutate(draft.inventory), done)
});
controller.render();
const section = els.blacksmithDetail.children.find(node => node.attributes["aria-label"] === "守隘劍專精");
const button = section.children.find(node => node.tagName === "button");
assert.equal(button.textContent, "解鎖冒險反攻");
assert.equal(button.disabled, false);
button.listeners.get("click")();
assert.equal(store.current.weaponTraining.unlocked, false, "保存失敗時不可提前解鎖");
assert.doesNotMatch(els.blacksmithNotice.textContent, /已解鎖/);
succeeds = true;
retry();
assert.equal(store.current.weaponTraining.unlocked, true);
assert.match(els.blacksmithNotice.textContent, /已解鎖冒險反攻/);
console.log("守隘劍專精介面與保存重試：通過");
