import assert from "node:assert/strict";
import { applyBlessingEffects } from "../../src/core/blessings.js";
import { getHeroEffectiveAttack } from "../../src/core/heroCombat.js";
import { getHammerTraining, recordHammerBreak, unlockHammerTechnique, HAMMER_TRAINING_WEAPON } from "../../src/core/hammerTraining.js";
import { getWeaponActions, runWeaponAttack } from "../../src/core/weaponTechniques.js";
import { createDefaultSave, migrateSave } from "../../src/core/storage.js";
import { regionDefinitions } from "../../src/data/regions/index.js";
import { characterDefinitions } from "../../src/data/characters/index.js";
import { canCharacterEquipWeapon } from "../../src/core/equipment.js";
import { weaponDefinitions } from "../../src/data/weapons.js";
import { remakeHarness } from "../highland-remake-harness.mjs";
import { withSeed } from "../model-test-helpers.mjs";

const trainingEvent = {
  regionId: "highlands",
  weaponId: HAMMER_TRAINING_WEAPON,
  battleSource: "main",
  debugBuildRun: false,
  battleStartEnemyCount: 2,
  playerAction: "attack",
  breachTargetId: "training-target",
  targetId: "training-target",
  breachStrength: 3,
  primaryHit: true
};

const save = createDefaultSave();
assert.equal(canCharacterEquipWeapon(characterDefinitions.adventurer, weaponDefinitions[HAMMER_TRAINING_WEAPON]), true);
assert.equal(canCharacterEquipWeapon(characterDefinitions.archer, weaponDefinitions[HAMMER_TRAINING_WEAPON]), false);
assert.equal(canCharacterEquipWeapon(characterDefinitions.kaige, weaponDefinitions[HAMMER_TRAINING_WEAPON]), false);
assert.throws(() => unlockHammerTechnique(save), /打造鎮隘岩鎚/);
save.inventory.weapons[HAMMER_TRAINING_WEAPON] = true;
assert.throws(() => unlockHammerTechnique(save), /完成斷風高地的岩鎚連招/);
for (const bad of [
  { debugBuildRun: true },
  { battleSource: "duel" },
  { weaponId: "windbreak-sword" },
  { regionId: "forest" },
  { battleStartEnemyCount: 1 },
  { playerAction: "breach" },
  { targetId: "different-target" },
  { breachStrength: 2 },
  { primaryHit: false }
]) {
  assert.equal(recordHammerBreak(save, { ...trainingEvent, ...bad }), false);
}
assert.equal(recordHammerBreak(save, trainingEvent), true, "hammer training does not require sword training");
assert.equal(getHammerTraining(save).ready, true);
assert.equal(getHammerTraining(save).prerequisiteUnlocked, undefined);
unlockHammerTechnique(save);
assert.equal(getHammerTraining(save).unlocked, true);
assert.equal(save.weaponTraining?.unlocked, false, "hammer unlock does not grant sword training");

const oldHammerSave = createDefaultSave();
oldHammerSave.hammerTraining = { regions: { highlands: true }, unlocked: true, prerequisiteUnlocked: false };
assert.equal(getHammerTraining(migrateSave(oldHammerSave)).unlocked, true, "old hammer progress remains valid without sword progress");

function prepareHighlandBattle(h) {
  const state = h.state;
  state.hero.battleColumn = 1;
  state.targetEnemyId = state.enemies[0].runtimeId;
  state.enemies.forEach(enemy => Object.assign(enemy, {
    hp: 50000,
    maxHp: 50000,
    attack: 0,
    defense: 0,
    dodgeChance: 0,
    specialAttack: null,
    chargeEvery: null,
    paralysis: 0,
    battleColumn: 1
  }));
  if (state.highlandBattle) {
    state.highlandBattle.pattern = [0];
    state.highlandBattle.intents = state.enemies.map(enemy => ({ id: enemy.runtimeId, kind: "anchor" }));
    state.highlandBattle.intentTurn = state.turn;
  }
}

const trainingBattle = remakeHarness({
  weapon: HAMMER_TRAINING_WEAPON,
  region: "highlands",
  index: 2,
  configure: ({ permanent }) => ({ recordHammerBreak: event => recordHammerBreak(permanent, event) })
});
trainingBattle.permanent.inventory.weapons[HAMMER_TRAINING_WEAPON] = true;
assert.ok(trainingBattle.state.hammerTrainingStartEnemyCount >= 2, "training encounter starts with a group");
prepareHighlandBattle(trainingBattle);
for (let index = 0; index < 3; index++) {
  trainingBattle.state.highlandBattle.intentTurn = trainingBattle.state.turn;
  withSeed(42, () => trainingBattle.controller.playTurn("attack"));
}
assert.equal(trainingBattle.state.hero.weaponRuntime.impact, 3, "three successful main attacks build three layers");
withSeed(42, () => trainingBattle.controller.playTurn("breach"));
assert.equal(trainingBattle.state.enemies[0].weaponBreach?.strength, 3);
assert.equal(getHammerTraining(trainingBattle.permanent).ready, false, "the full follow-up is required");
trainingBattle.state.highlandBattle.intentTurn = trainingBattle.state.turn;
withSeed(42, () => trainingBattle.controller.playTurn("attack"));
assert.equal(getHammerTraining(trainingBattle.permanent).ready, true);
unlockHammerTechnique(trainingBattle.permanent);
assert.equal(getHammerTraining(trainingBattle.permanent).unlocked, true);

function prepareWaveRig(regionId, defenses = [0, 0]) {
  const h = remakeHarness({ weapon: HAMMER_TRAINING_WEAPON, region: regionId, index: 2 });
  const state = h.state;
  const target = { runtimeId: "wave-target", name: "目標", hp: 10000, maxHp: 10000, defense: 0, dodgeChance: 0 };
  const others = defenses.map((defense, index) => ({
    runtimeId: `wave-other-${index}`,
    name: `波及目標${index + 1}`,
    hp: 10000,
    maxHp: 10000,
    defense,
    dodgeChance: 0
  }));
  state.selectedRegionId = regionId;
  state.highlandBattle = null;
  state.enemies = [target, ...others];
  state.targetEnemyId = target.runtimeId;
  state.hero.activeEnemyCount = state.enemies.length;
  state.hero.highlandOpportunities = {};
  state.hero.equipment.hammerTechniqueUnlocked = true;
  state.hero.weaponRuntime.impact = 3;
  return { h, state, target, others };
}

function ensureEnemyCount(state, count) {
  const template = state.enemies.at(-1);
  while (state.enemies.length < count) {
    const extra = structuredClone(template);
    extra.runtimeId = `test-extra-${state.enemies.length}`;
    extra.name = `測試敵人${state.enemies.length}`;
    extra.displayName = extra.name;
    state.enemies.push(extra);
  }
  state.enemies = state.enemies.slice(0, count);
}

for (const regionId of ["plains", "forest", "beach", "highlands"]) {
  const h = remakeHarness({ weapon: HAMMER_TRAINING_WEAPON, region: regionId });
  h.state.hero.equipment.hammerTechniqueUnlocked = true;
  h.state.hero.activeEnemyCount = 2;
  h.state.hero.weaponRuntime.impact = 3;
  assert.ok(getWeaponActions(h.state.hero).some(action => action.type === "breach-wave"), `${regionId} permits the unlocked group technique`);
}

const eligibility = remakeHarness({ weapon: HAMMER_TRAINING_WEAPON, region: "plains" });
eligibility.state.hero.equipment.hammerTechniqueUnlocked = true;
eligibility.state.hero.weaponRuntime.impact = 2;
eligibility.state.hero.activeEnemyCount = 3;
assert.equal(getWeaponActions(eligibility.state.hero).some(action => action.type === "breach-wave"), false, "two layers are not enough");
eligibility.state.hero.weaponRuntime.impact = 3;
eligibility.state.hero.activeEnemyCount = 1;
assert.equal(getWeaponActions(eligibility.state.hero).some(action => action.type === "breach-wave"), false, "single-target battles do not offer the wave");

function runPacketWave(regionId, defenses) {
  const { h, state, target, others } = prepareWaveRig(regionId, defenses);
  const events = [];
  const hpBefore = state.hero.hp;
  state.hero.battleHooks = { onDirectAttackResolved: event => events.push(event) };
  const power = getHeroEffectiveAttack(state.hero);
  const result = runWeaponAttack({
    state,
    action: "breach-wave",
    target,
    log: { fixed() {} },
    runAttack() {
      target.hp -= 10;
      state.hero.battleHooks.onDirectAttackResolved({ source: "original", enemy: target, dodged: false, damage: 10 });
      state.hero.battleHooks.onDirectAttackResolved({ source: "characterFollowUp", enemy: target, dodged: false, damage: 5 });
    }
  });
  assert.equal(result.primaryHit, true);
  assert.equal(state.hero.weaponRuntime.impact, 0, "the wave consumes all three layers");
  assert.equal(events.length, 2, "secondary packets do not run direct-hit callbacks");
  assert.equal(state.hero.hp, hpBefore, "secondary packets do not heal the hero");
  others.forEach((enemy, index) => {
    const expected = Math.max(1, Math.round(power - defenses[index]));
    assert.equal(10000 - enemy.hp, expected, "each other living enemy receives one defense-scaled packet");
  });
  return { power, others };
}

const lowDefenseWave = runPacketWave("forest", [0, 0]);
const highDefenseWave = runPacketWave("beach", [30, 0]);
assert.equal(10000 - highDefenseWave.others[0].hp, 1, "high defense can reduce the wave to its minimum damage");
assert.ok(10000 - lowDefenseWave.others[0].hp > 1);

for (const killFrontline of [false, true]) {
  const { state, target, others } = prepareWaveRig('highlands', [4]);
  Object.assign(target, { combatRole: 'frontline', formationId: 'wave-test' });
  Object.assign(others[0], { combatRole: 'output', formationId: 'wave-test' });
  const power = getHeroEffectiveAttack(state.hero);
  runWeaponAttack({
    state, action: 'breach-wave', target, log: { fixed() {} },
    runAttack() {
      target.hp = killFrontline ? 0 : target.hp - 10;
      state.hero.battleHooks.onDirectAttackResolved({ source: 'original', enemy: target, dodged: false, damage: 10 });
    }
  });
  const raw = Math.max(1, Math.round(power - 4));
  assert.equal(10000 - others[0].hp, killFrontline ? raw : Math.max(1, Math.round(raw * .7)),
    'wave uses the living frontline protection after the primary attack resolves');
}

const missedMain = prepareWaveRig("highlands", [0]);
const otherBeforeMiss = missedMain.others[0].hp;
const missedWave = runWeaponAttack({
  state: missedMain.state,
  action: "breach-wave",
  target: missedMain.target,
  log: { fixed() {} },
  runAttack() {
    missedMain.state.hero.battleHooks.onDirectAttackResolved({ source: "original", enemy: missedMain.target, dodged: true, damage: 0 });
  }
});
assert.equal(missedWave.primaryHit, false);
assert.equal(missedMain.state.hero.weaponRuntime.impact, 0, "a missed wave still spends its layers");
assert.equal(missedMain.others[0].hp, otherBeforeMiss, "a missed main attack produces no wave damage");

const missedCharge = prepareWaveRig("highlands", [0]);
missedCharge.state.hero.weaponRuntime.impact = 0;
runWeaponAttack({
  state: missedCharge.state,
  action: "attack",
  target: missedCharge.target,
  log: { fixed() {} },
  runAttack() {
    missedCharge.state.hero.battleHooks.onDirectAttackResolved({ source: "original", enemy: missedCharge.target, dodged: true, damage: 0 });
  }
});
assert.equal(missedCharge.state.hero.weaponRuntime.impact, 0, "a missed main attack does not add a layer");

const plainsBlessings = regionDefinitions.plains.blessings;
const comboBlessings = ["critChance", "shieldStart", "killHeal"].map(stat => {
  const blessing = plainsBlessings.find(entry => entry.effects.some(effect => effect.type === "add" && effect.stat === stat));
  assert.ok(blessing, `missing actual ${stat} blessing`);
  return blessing;
});
function prepareBlessedGroup() {
  const h = remakeHarness({ weapon: HAMMER_TRAINING_WEAPON, region: "highlands", index: 2 });
  const state = h.state;
  ensureEnemyCount(state, 3);
  state.enemies.forEach(enemy => Object.assign(enemy, {
    hp: 10000,
    maxHp: 10000,
    attack: 0,
    defense: 0,
    dodgeChance: 0,
    specialAttack: null,
    chargeEvery: null,
    paralysis: 0,
    formationId: null,
    battleColumn: 1
  }));
  state.targetEnemyId = state.enemies[0].runtimeId;
  state.hero.battleColumn = 1;
  state.hero.activeEnemyCount = state.enemies.length;
  state.hero.equipment.hammerTechniqueUnlocked = true;
  state.hero.weaponRuntime.impact = 3;
  state.hero.shield += 8;
  state.hero.hp = Math.floor(state.hero.maxHp * .6);
  comboBlessings.forEach((blessing, index) => applyBlessingEffects(state.hero, blessing, { instanceId: `hammer-combo-${index}` }));
  assert.ok(state.hero.skills.includes("skilled-follow-up"));
  state.highlandBattle.pattern = [0];
  state.highlandBattle.intents = state.enemies.map(enemy => ({ id: enemy.runtimeId, kind: "anchor" }));
  state.highlandBattle.intentTurn = state.turn;
  return h;
}

let verifiedFollowUpChain = false;
for (let seed = 1; seed < 1000 && !verifiedFollowUpChain; seed++) {
  const active = prepareBlessedGroup();
  const control = prepareBlessedGroup();
  const activeOthers = active.state.enemies.slice(1).map(enemy => enemy.hp);
  const activePower = getHeroEffectiveAttack(active.state.hero);
  active.messages.length = control.messages.length = 0;
  withSeed(seed, () => active.controller.playTurn("breach-wave"));
  withSeed(seed, () => control.controller.playTurn("attack"));
  const count = (h, key) => h.messages.filter(message => message.key === key).length;
  if (!count(active, "critical") || !count(active, "skilledFollowUp")) continue;
  assert.equal(count(active, "critical"), count(control, "critical"), "wave packets do not add critical rolls");
  assert.equal(count(active, "skilledFollowUp"), 1, "the primary attack triggers one character follow-up");
  assert.equal(count(active, "skilledFollowUp"), count(control, "skilledFollowUp"));
  assert.equal(active.state.hero.hp, control.state.hero.hp, "wave packets do not trigger lifesteal or recovery");
  assert.equal(active.state.hero.shield, control.state.hero.shield, "wave packets do not add shields");
  active.state.enemies.slice(1).forEach((enemy, index) => {
    assert.equal(activeOthers[index] - enemy.hp, Math.round(activePower), "wave packets are not multiplied by the primary critical hit");
  });
  verifiedFollowUpChain = true;
}
assert.ok(verifiedFollowUpChain, "a seeded critical and skilled-follow-up chain is covered");

const killScenario = remakeHarness({ weapon: HAMMER_TRAINING_WEAPON, region: "highlands", index: 2 });
const killState = killScenario.state;
ensureEnemyCount(killState, 3);
killState.enemies.forEach((enemy, index) => Object.assign(enemy, {
  hp: index === 0 ? 10000 : 1,
  maxHp: index === 0 ? 10000 : 1,
  attack: 0,
  defense: 0,
  dodgeChance: 0,
  specialAttack: null,
  chargeEvery: null,
  paralysis: 0,
  formationId: null,
  battleColumn: 1
}));
killState.targetEnemyId = killState.enemies[0].runtimeId;
killState.hero.battleColumn = 1;
killState.hero.activeEnemyCount = killState.enemies.length;
killState.hero.equipment.hammerTechniqueUnlocked = true;
killState.hero.weaponRuntime.impact = 3;
const killHealBlessing = plainsBlessings.find(entry => entry.effects.some(effect => effect.type === "add" && effect.stat === "killHeal"));
applyBlessingEffects(killState.hero, killHealBlessing, { instanceId: "hammer-wave-kill-heal" });
killState.hero.highlandEnvKillHeal = 12;
killState.hero.hp = killState.hero.maxHp - 20;
killState.highlandBattle.pattern = [0];
killState.highlandBattle.intents = killState.enemies.map(enemy => ({ id: enemy.runtimeId, kind: "anchor" }));
killState.highlandBattle.intentTurn = killState.turn;
const hpBeforeKills = killState.hero.hp;
withSeed(42, () => killScenario.controller.playTurn("breach-wave"));
assert.equal(killScenario.messages.filter(message => message.key === "heal").length, 2, "two secondary kills pay two ordinary kill heals");
assert.equal(killState.hero.hp - hpBeforeKills, killState.hero.killHeal * 2, "kill healing applies once per defeated enemy");
assert.notEqual(killState.highlandBattle.environmentHealUsed, true, "weapon kills do not count as induced environment kills");

console.log("Hammer training independence, full-combo progress, cross-region wave, miss cost, defense, callbacks and kill-heal tests passed");
