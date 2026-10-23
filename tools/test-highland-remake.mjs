import assert from "node:assert/strict";
import { remakeHarness } from "./highland-remake-harness.mjs";
import { getWeaponActions } from "../src/core/weaponTechniques.js";
import { highlandActions, resolveHighlandWind, highlandIntents, actOnHighland, projectHighlandWind, lockHighlandIntents } from "../src/core/highlandBattle.js";
import { captureRunSnapshot, readRunSnapshot } from "../src/core/runSnapshot.js";
import { canCharacterEquipWeapon } from "../src/core/equipment.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { scheduleRegionEvent } from "../src/core/events.js";
import { getRouteDefinition } from "../src/data/routes/index.js";
import { withSeed } from "./model-test-helpers.mjs";
import { createQuestRuntime } from "../src/features/quest/questRuntime.js";
import { questDefinitions } from "../src/data/quests.js";
import { materialDefinitions } from "../src/data/materials.js";
import { createTestTransactions } from "./save-transaction-test-helper.mjs";
import { createAdventureSaveActions } from "../src/app/adventureSaveActions.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { buildScaledEnemy } from "../src/core/combat.js";

const h = remakeHarness();
const before = JSON.stringify(h.state);
assert.equal(h.controller.playTurn("unrecognised"), false);
assert.equal(JSON.stringify(h.state), before, "Unknown actions must not mutate resources, turns or RNG");
h.state.hero.battleColumn = 0; h.state.enemies.forEach(e => e.battleColumn = 2);
assert.equal(h.controller.playTurn("attack"), false);
assert.equal(h.state.turn, 0);
h.state.highlandBattle.pattern = [1]; h.state.highlandBattle.rocks = [1, 0, 2];
h.state.enemies.forEach(e => e.battleColumn = 0);
h.state.turn = 1;
resolveHighlandWind(h.state, { type: "attack" }, [], { fixed() {} });
assert.equal(h.state.highlandBattle.rocks[0], 0);
assert.equal(h.state.hero.battleColumn, 0);
assert.ok(h.state.enemies.every(e => e.battleColumn === 0), "Final durability protects every occupant in the pulse");

const demolition = remakeHarness();
demolition.state.hero.highlandBreakAttack = 6;
demolition.state.hero.battleColumn = 2;
demolition.state.highlandBattle.pattern = [-1];
actOnHighland(demolition.state, { type: "break", column: 2 }, { fixed() {} });
demolition.state.turn = 1;
resolveHighlandWind(demolition.state, { type: "break", column: 2 }, [], { fixed() {} });
assert.equal(demolition.state.hero.highlandOpportunities.break, 6, "Wind cannot erase the demolition reward");

const escape = remakeHarness({ character: "kaige", weapon: "stormsplit-axe" });
escape.state.turn = 5; escape.state.hero.battleColumn = 1; escape.state.highlandBattle.rocks = [0, 0, 1];
escape.state.hero.highlandOpportunities = { break: 11 };
escape.state.hero.weaponRuntime.weight = 3; escape.state.hero.shield = 7;
escape.state.enemies.forEach(e => { e.battleColumn = 2; e.windStagger = true; });
escape.battle.savePendingThreat("safeEscape");
escape.battle.resumePendingThreat();
assert.equal(escape.state.turn, 5);
assert.deepEqual(escape.state.highlandBattle.rocks, [0, 0, 1]);
assert.equal(escape.state.hero.weaponRuntime.weight, 3);
assert.equal(escape.state.hero.shield, 7);
assert.equal(escape.state.hero.highlandOpportunities.break, 11);
assert.ok(escape.state.enemies.every(e => e.battleColumn === 2 && e.windStagger));
assert.ok(readRunSnapshot(captureRunSnapshot(escape.state)).ok);

for (const region of ["plains", "forest", "beach", "highlands"]) {
  const bow = remakeHarness({ character: "archer", weapon: "ridgewind-bow", region });
  if (bow.state.highlandBattle) bow.state.hero.battleColumn = 1;
  assert.ok(getWeaponActions(bow.state.hero).some(a => a.type === "charge"));
  withSeed(42, () => bow.controller.playTurn("charge"));
  assert.equal(bow.state.hero.weaponRuntime.charge, 2);
  const attacks = bow.state.hero.skillState.archer.playerAttackCount;
  assert.equal(attacks, 0, "Charging cannot advance precision or arrow rain");
  bow.state.enemies.forEach(e => { e.dodgeChance = 1; });
  withSeed(42, () => bow.controller.playTurn("attack"));
  assert.equal(bow.state.hero.weaponRuntime.charge, 0, "A dodged committed shot still spends its charge");
  assert.equal(bow.messages.some(m => m.text?.includes("穿風箭")), false);
}

const axe = remakeHarness({ character: "kaige", weapon: "stormsplit-axe", region: "plains" });
axe.state.hero.weaponRuntime.weight = 4;
axe.state.hero.hp = Math.round(axe.state.hero.maxHp * .2);
withSeed(42, () => axe.controller.playTurn("sweep"));
assert.equal(axe.state.hero.weaponRuntime.weight, 0, "All secondary packets share the original action and cannot recharge");
assert.equal(canCharacterEquipWeapon({ id: "future-axe-user", weaponCompatibility: { mode: "include", categoryIds: ["battle-axe"] } }, weaponDefinitions["stormsplit-axe"]), true);
assert.equal(canCharacterEquipWeapon(characterDefinitions.adventurer, weaponDefinitions["stormsplit-axe"]), false);
assert.equal(canCharacterEquipWeapon(characterDefinitions.archer, weaponDefinitions["stormsplit-axe"]), false);
for (let seed = 0; seed < 100; seed++) {
  const event = withSeed(seed, () => scheduleRegionEvent(getRouteDefinition("windbreak-ascent")));
  assert.equal(event.remaining.length, 1);
  assert.notEqual(event.eventId, event.remaining[0].eventId);
  assert.ok(event.triggerBeforeEncounter < event.remaining[0].triggerBeforeEncounter);
}
console.log("Highland action, shelter, threat resume, cross-region weapon sources, category compatibility and two-event schedule passed");

// Every available terrain action must agree with the pure pre-action forecast.
for (const wind of [-2, -1, 0, 1, 2]) for (const type of ["move", "ride", "break", "demolish", "tool-brace", "tool-rock"]) {
  const x = remakeHarness(); const s = x.state;
  s.highlandBattle.pattern = [wind]; s.hero.battleColumn = 1;
  s.hero.highlandRideAttack = 10; s.hero.highlandDemolish = 1;
  s.runPreparation = { effect: { type: "highlandTool", tool: type === "tool-rock" ? "rock" : "brace" }, remainingCharges: 2 };
  const action = highlandActions(s).find(a => a.type === type);
  const intents = highlandIntents(s), snapshot = JSON.stringify(s);
  const projected = projectHighlandWind(s, action, intents).map(p => p.destination);
  assert.equal(JSON.stringify(s), snapshot, "Forecast must not change charges, RNG or terrain");
  s.turn++; actOnHighland(s, action, { fixed() {} }); resolveHighlandWind(s, action, intents, { fixed() {} });
  assert.deepEqual([s.hero, ...s.enemies].map(e => e.battleColumn), projected, `${type} wind ${wind}`);
}

const combo = remakeHarness();
combo.state.hero.highlandRideAttack = 10; combo.state.hero.highlandWindAttack = 6; combo.state.hero.highlandBreakAttack = 10;
combo.state.hero.battleColumn = 1; combo.state.highlandBattle.pattern = [1];
actOnHighland(combo.state, { type: "break", column: 0 }, { fixed() {} });
actOnHighland(combo.state, { type: "ride", column: 1 }, { fixed() {} });
combo.state.turn = 1; resolveHighlandWind(combo.state, { type: "ride" }, [], { fixed() {} });
assert.deepEqual(combo.state.hero.highlandOpportunities, { break: 10, ride: 10, wind: 6 });
combo.state.hero.battleColumn = 1; combo.state.enemies.forEach(e => { e.hp = 10000; e.defense = 50; });
withSeed(42, () => combo.controller.playTurn("attack"));
assert.ok(combo.messages.some(m => m.text?.includes("借勢破綻") && m.text.includes("26")), "Three costs should combine into one non-recursive fixed packet");

for (const technique of ["stormsplit-axe", "cairn-warhammer"]) {
  const x = remakeHarness({ character: technique === "stormsplit-axe" ? "kaige" : "adventurer", weapon: technique });
  const s = x.state; s.hero.highlandNoRockLunge = 1; s.hero.battleColumn = 0; s.highlandBattle.rocks = [0, 0, 0]; s.highlandBattle.pattern = [0];
  s.enemies.forEach(e => { e.hp = 10000; e.battleColumn = 2; e.dodgeChance = 0; });
  withSeed(42, () => x.controller.playTurn("lunge"));
  assert.equal(s.turn, 1); assert.equal(s.hero.battleColumn, 2);
  assert.equal(s.hero.weaponRuntime[technique === "stormsplit-axe" ? "weight" : "impact"], 1, "Lunge is one normal resource-generating main attack");
}

// A free reposition belongs to the locked-intent turn even when the next action
// is attack (or is cancelled by entangle). Natural wind alone earns no credit.
for (const type of ["slip", "tool-step"]) for (const entangled of [false, true]) {
  const x = remakeHarness({ index: 5 }); const s = x.state;
  s.hero.battleColumn = 2; s.hero.hp = 100; s.hero.highlandSlipToken = 1; s.hero.highlandEnvKillHeal = 12;
  s.highlandBattle.pattern = [0]; s.runPreparation = { effect: { type: "highlandTool", tool: "step" }, remainingCharges: 2 };
  const boss = s.enemies[0]; boss.windRole = "boss"; boss.battleColumn = 1; boss.hp = 10000; boss.attack = 50;
  s.enemies.push({ ...boss, id: "bait", runtimeId: "bait", name: "bait", windRole: "guard", battleColumn: 2, hp: 1, maxHp: 100 });
  lockHighlandIntents(s);
  x.controller.playTurn({ type, column: 0 }); s.targetEnemyId = boss.runtimeId;
  if (entangled) s.hero.entangle = { attempts: 0 };
  const original = Math.random; Math.random = () => .99;
  try { x.controller.playTurn("attack"); } finally { Math.random = original; }
  assert.equal(s.highlandBattle.inducedCollisions, 1, `${type} credit survives the following action`);
  assert.equal(s.hero.hp, 112);
  assert.equal(s.runPreparation.remainingCharges, type === "tool-step" ? 1 : 2);
}
assert.equal(canCharacterEquipWeapon({ id: "future", weaponCompatibility: { mode: "include", categoryIds: ["battle-axe"] } }, weaponDefinitions["worn-battle-axe"]), true);
console.log("Forecast parity, additive opportunities, lunge resource contracts and free-action collision attribution passed");

let tx, quest, succeeds = false;
const attempts = [];
const atomic = remakeHarness({ configure({ state, permanent }) {
  permanent.statistics.regions.beach.clears = 1;
  permanent.quests.active = { questId: "highlands-rockwork", progress: 0, acceptedAtCompletionCount: 0 };
  tx = createTestTransactions(permanent, candidate => { attempts.push(structuredClone(candidate)); return succeeds; });
  quest = createQuestRuntime({ ...tx, questDefinitions, materialDefinitions });
  const operations = createAdventureSaveActions({ ...tx, state });
  return { ...operations, recordTactic: quest.recordHighlandTactic };
} });
atomic.state.hero.highlandBreakAttack = 10;
atomic.controller.playTurn({ type: "break", column: 2 });
assert.equal(tx.saveStore.current.quests.active.progress, 0, "Failed save must not commit a tactic separately");
assert.equal(attempts[0].quests.active.progress, 1);
assert.equal(attempts[0].activeRun.state.hero.highlandOpportunities.break, 10);
const pendingRuntime = JSON.stringify(atomic.state);
atomic.controller.playTurn("guard"); tx.retry();
assert.equal(JSON.stringify(atomic.state), pendingRuntime, "Pending action cannot be replayed or spend another turn");
succeeds = true; tx.retry();
assert.equal(tx.saveStore.current.quests.active.progress, 1);
assert.deepEqual(attempts[0], attempts[2], "Retry writes identical terrain, RNG, resources and quest progress");
assert.equal(quest.recordHighlandTactic({ regionId: "highlands", tactic: "breakRock", debugBuildRun: true }), false);
assert.equal(quest.recordHighlandTactic({ regionId: "beach", tactic: "breakRock" }), false);
assert.equal(quest.recordHighlandTactic({ regionId: "highlands", tactic: "inducedCollision" }), false);
for (let n = 0; n < 4; n++) quest.recordHighlandTactic({ regionId: "highlands", tactic: "breakRock" });
assert.equal(tx.saveStore.current.quests.active.progress, 2, "Tactic progress stops at its objective");
const corrupted = captureRunSnapshot(atomic.state);
corrupted.state.highlandBattle.intents[0].column = 99;
corrupted.state.highlandBattle.intents[0].kind = "charge";
assert.equal(readRunSnapshot(corrupted).ok, false, "Corrupt cached intents must not resume into invalid columns");
console.log("Highland tactic/save retry atomicity, debug exclusions and tactical snapshot validation passed");

let crossRegionCases = 0;
for (const region of ["plains", "forest", "beach", "highlands"]) for (const boss of [false, true]) {
  for (const [character, weapon, action] of [
    ["adventurer", "windbreak-sword", "attack"], ["adventurer", "ridgewind-bow", "attack"],
    ["archer", "ridgewind-bow", "attack"], ["adventurer", "cairn-warhammer", "breach"],
    ["adventurer", "gale-dagger", "attack"], ["kaige", "stormsplit-axe", "cleave"]
  ]) {
    const fixtures = [true, false].map(technique => {
      const x = remakeHarness({ character, weapon, region, index: 2 });
      const def = regionDefinitions[region];
      const candidates = boss ? [def.boss] : def.enemies.filter(e => e.kind === "普通");
      assert.ok(candidates.length);
      x.battle.beginBattleRuntime({ enemies: candidates.slice(0, boss ? 1 : 2).map(e => ({ enemy: buildScaledEnemy(e, def, 2) })), encounterType: boss ? "boss" : "normal" });
      x.state.hero.attack = 30; x.state.hero.critChance = 1;
      if (character === "kaige") x.state.hero.hp = Math.round(x.state.hero.maxHp * .2);
      x.state.enemies.forEach(e => { e.hp = 10000; e.maxHp = 10000; e.dodgeChance = 0; e.battleColumn = 1; });
      if (x.state.highlandBattle) x.state.hero.battleColumn = 1;
      const r = x.state.hero.weaponRuntime;
      Object.assign(r, { riposte: true, charge: 2, impact: 3, weight: 4, chain: 2, targetId: x.state.enemies[0].runtimeId });
      if (!technique) x.state.hero.equipment.weaponId = null;
      const packets = []; x.state.hero.battleHooks = { onDirectAttackResolved: result => packets.push(result.source) };
      const random = Math.random; Math.random = () => .01;
      try { x.controller.playTurn(technique ? action : "attack"); } finally { Math.random = random; }
      return { x, packets };
    });
    assert.deepEqual(fixtures[0].packets, fixtures[1].packets, `${region}/${character}/${weapon}/${boss}: weapon packets cannot invoke native hit hooks`);
    if (character === "archer") assert.equal(fixtures[0].x.state.hero.skillState.archer.playerAttackCount, fixtures[1].x.state.hero.skillState.archer.playerAttackCount);
    assert.ok(fixtures[0].x.messages.some(m => m.text && /架勢反攻|蓄射追加|震岩破勢|三連收割|斧勢重劈/.test(m.text)), "Technique must actually execute in this region");
    crossRegionCases++;
  }
}
assert.equal(crossRegionCases, 48);
console.log("48 actual cross-region/native-character/weapon single-boss and enemy-group source comparisons passed");

const finale = remakeHarness({ index: 11 });
assert.equal(finale.state.enemies.length, 2, "The final boss has one finite ally for the region's collision payoff");
const signal = finale.state.enemies.find(e => e.windRole === "signal");
finale.state.targetEnemyId = signal.runtimeId;
const random = Math.random; Math.random = () => .99;
try {
  finale.controller.playTurn("attack");
  finale.controller.playTurn("guard");
  finale.controller.playTurn({ type: "move", column: 1 });
} finally { Math.random = random; }
assert.equal(finale.state.highlandBattle.inducedCollisions, 1, "Preserve the right rock, then sidestep the telegraphed real boss charge into its ally");
assert.ok(finale.messages.some(m => m.text?.includes("攻擊波及")));
console.log("Final encounter's real three-action rock/guard/bait sequence passed");
