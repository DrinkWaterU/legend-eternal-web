import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createDefaultSave, migrateSave } from "../src/core/storage.js";
import { highlandsRegion as region } from "../src/data/regions/highlands.js";
import { getRouteDefinition, getRouteGroup } from "../src/data/routes/index.js";
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { questDefinitions } from "../src/data/quests.js";
import { materialDefinitions } from "../src/data/materials.js";
import { getRegionAccess } from "../src/core/regionAccess.js";
import { createRunPreparation, beginPreparationBattle, runPreparationOpeningAction, resolvePreparationIncomingDirectDamage } from "../src/core/preparations.js";
import { getEnemyProtectionState } from "../src/core/enemyProtection.js";
import { resolveEnemySupportAction } from "../src/core/enemySupport.js";
import { getEnemyIntent } from "../src/core/enemyIntent.js";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { generateQuestBoard, matchClearObjective, matchEnemyObjective } from "../src/core/questRules.js";
import { createQuestRuntime } from "../src/features/quest/questRuntime.js";
import { createTestTransactions } from "./save-transaction-test-helper.mjs";
import { withSeed } from "./model-test-helpers.mjs";

const route = getRouteDefinition(region.startRouteId);
const data = createDefaultSave();
assert.equal(getRegionAccess(region, data).unlocked, false);
data.statistics.regions.beach.bestEncounter = 16;
assert.equal(getRegionAccess(region, data).unlocked, false, "Beach segment does not unlock highlands");
data.statistics.regions.beach.clears = 1;
assert.equal(getRegionAccess(region, data).unlocked, true);
assert.equal(migrateSave(data).statistics.regions.beach.clears, 1);
assert.ok(migrateSave({ schemaVersion: 11 }).statistics.regions.highlands);
assert.equal(route.regionId, region.id);
assert.equal(route.encounterPlan.length, 20);
assert.equal(route.encounterPlan.at(-1).type, "boss");
assert.equal(route.encounterPlan.filter(e => e.type === "boss").length, 2);
assert.equal(route.eventDefinitions.length, 5);
assert.equal(region.blessings.length, 15);
assert.equal(new Set(region.blessings.map(b => b.id)).size, 15);
assert.ok(region.blessings.filter(b => b.rarity === "rare").length >= 3);
const enemyIds = new Set();
for (const entry of route.encounterPlan) {
  const group = getRouteGroup(route, entry.groupId);
  assert.ok(group && group.members.length <= 3);
  for (const member of group.members) {
    const enemy = getEnemyDefinition(member.enemyId); assert.ok(enemy);
    enemyIds.add(enemy.id);
    for (const drop of enemy.rewards.materials) assert.ok(materialDefinitions[drop.id]);
    if (enemy.specialAttack) {
      assert.ok(enemy.specialAttack.telegraphText);
      assert.match(getEnemyIntent({ ...enemy, hp: enemy.maxHp }, enemy.specialAttack.everyTurns - 1), /下回合/);
    }
  }
}
assert.equal(enemyIds.size, 12, "All twelve enemies must actually appear");
for (const b of region.blessings) {
  const hero = { hp: 60, maxHp: 100 };
  applyBlessingEffects(hero, b);
  assert.ok(Number.isFinite(hero.hp));
}
for (const event of route.eventDefinitions) {
  assert.ok(event.choices.length >= 2);
  assert.ok(event.choices.some(c => !(c.result.effects || []).some(e => e.type === "loseHp")), "Every event needs a safe option");
  assert.ok(event.triggerBeforeEncounter < 20);
}
const front = { ...getEnemyDefinition("highland-slate-guard"), hp: 100 };
const support = { ...getEnemyDefinition("highland-signal-keeper"), hp: 88 };
assert.equal(getEnemyProtectionState({ enemy: support, enemies: [front, support] }).protected, true);
assert.equal(getEnemyProtectionState({ enemy: support, enemies: [{ ...front, hp: 0 }, support] }).protected, false);
assert.equal(getEnemyProtectionState({ enemy: support, enemies: [{ ...front, formationId: "other" }, support] }).protected, false, "Unrelated formations cannot grant protection");
const logger = { fixed() {}, template() {} };
assert.equal(resolveEnemySupportAction({ enemies: [front, support], actor: support, turn: 1, log: logger }), false);
for (const turn of [2, 4]) assert.equal(resolveEnemySupportAction({ enemies: [front, support], actor: support, turn, log: logger }), true);
assert.equal(resolveEnemySupportAction({ enemies: [front, support], actor: support, turn: 6, log: logger }), false);
for (const enhanced of [false, true]) {
  for (const p of region.preparations) assert.ok(createRunPreparation(region, p.id, { enhanced }));
  const prep = createRunPreparation(region, "ridge-anchor", { enhanced });
  beginPreparationBattle(prep, { enemyCount: 2 });
  assert.ok(resolvePreparationIncomingDirectDamage({ preparation: prep, enemy: front, damage: 100 }).damage < 100);
  assert.equal(resolvePreparationIncomingDirectDamage({ preparation: prep, enemy: front, damage: 100 }).damage, 100);
  const opening = createRunPreparation(region, "ridge-whetstone", { enhanced });
  const hero = { battleAttackBonus: 0 };
  assert.ok(runPreparationOpeningAction({ preparation: opening, hero, encounterType: "boss", action: () => hero.battleAttackBonus }).result > 0);
  assert.equal(hero.battleAttackBonus, 0);
}
const newWeapons = ["windbreak-sword", "ridgewind-bow", "cairn-warhammer", "gale-dagger", "stormsplit-axe"];
assert.equal(new Set(newWeapons.map(id => weaponDefinitions[id].categoryId)).size, 5);
for (const id of newWeapons) {
  const w = weaponDefinitions[id];
  assert.ok(existsSync(`assets/images/icons/weapons/${w.iconAssetId}.png`));
  assert.ok(w.recipe.materialCosts.every(m => materialDefinitions[m.materialId]));
  assert.ok(w.recipe.materialCosts.some(m => m.materialId.startsWith("slate") || m.materialId.startsWith("gale")));
}
assert.deepEqual(weaponDefinitions["stormsplit-axe"].allowedCharacterIds, ["kaige"]);
assert.equal(matchClearObjective(questDefinitions["highlands-survey"].objective, { regionId: "highlands", clearSourceId: "main" }), false);
assert.equal(matchClearObjective(questDefinitions["highlands-survey"].objective, { regionId: "highlands", clearSourceId: "highlandsAscent" }), true);
assert.equal(matchEnemyObjective(questDefinitions["highlands-signals"].objective, { regionId: "highlands", enemyId: "highland-signal-keeper" }), true);
for (let seed = 1; seed <= 500; seed++) {
  const ids = withSeed(seed, () => generateQuestBoard(questDefinitions));
  assert.equal(ids.length, 4); assert.equal(new Set(ids).size, 4);
  assert.ok(ids.filter(id => questDefinitions[id].rarity === "rare").length <= 1);
}
for (const unlocked of [false, true]) {
  const current = createDefaultSave(); current.statistics.regions.beach.clears = Number(unlocked);
  const { saveStore, commitSaveChange } = createTestTransactions(current);
  const runtime = createQuestRuntime({ saveStore, commitSaveChange, questDefinitions, materialDefinitions });
  const board = runtime.ensureBoard();
  if (!unlocked) assert.equal(board.some(id => questDefinitions[id].requiredRegionId), false);
}
console.log("Highlands content, access, formation, preparation, economy references, migration and board contracts passed");
