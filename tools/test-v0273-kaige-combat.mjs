import assert from "node:assert/strict";

import {
  getCharacterCombatStatusEntries,
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../src/characters/skills/index.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { weaponDefinitions } from "../src/data/weapons.js";

const kaige = characterDefinitions.kaige;
const log = {
  fixed() {},
  template() {}
};

const level5Hero = buildKaige(5);
initializeCharacterBattleState(level5Hero);
for (let index = 0; index < 3; index += 1) {
  modifyCharacterIncomingDirectDamage({ hero: level5Hero, damage: 1 });
}
const level5Status = getCharacterCombatStatusEntries(level5Hero)[0];
assert.equal(level5Status.label, "戰意已滿｜攻擊 +3");
assert.equal(level5Status.fullHint, "攻擊 +3");
resolveCharacterPlayerAction({
  hero: level5Hero,
  enemies: [makeEnemy("level-5-target", 300, 0)],
  targetEnemyId: "level-5-target",
  log
});
assert.equal(getFury(level5Hero), 3, "Lv.5 尚未學會破陣重斬，不得消耗戰意");

const level6Hero = buildKaige(6);
initializeCharacterBattleState(level6Hero);
for (let index = 0; index < 3; index += 1) {
  modifyCharacterIncomingDirectDamage({ hero: level6Hero, damage: 1 });
}
const level6Status = getCharacterCombatStatusEntries(level6Hero)[0];
assert.equal(level6Status.label, "戰意已滿｜下一擊：破陣重斬");
assert.equal(level6Status.fullHint, "下一擊：破陣重斬");

const level25Hero = buildKaige(25);
assert.deepEqual(
  {
    maxHp: level25Hero.maxHp,
    attack: level25Hero.attack,
    defense: level25Hero.defense,
    critChance: level25Hero.critChance
  },
  { maxHp: 220, attack: 21, defense: 6, critChance: 0.08 },
  "Lv.25 應含破舊戰斧的攻擊 +2"
);
assert.equal(level25Hero.killHealRatio, 0.08);

level25Hero.hp = 100;
initializeCharacterBattleState(level25Hero);
assert.equal(getFury(level25Hero), 1, "50% 以下進場應取得 1 層戰意");
assert.equal(modifyCharacterIncomingDirectDamage({ hero: level25Hero, damage: 17 }), 17);
assert.equal(getFury(level25Hero), 3, "50% 以下直接受擊應一次取得 2 層");
assert.equal(level25Hero.battleAttackBonus, 3);

const primary = makeEnemy("primary", 300, 4);
const secondary = makeEnemy("secondary", 100, 2);
resolveCharacterPlayerAction({
  hero: level25Hero,
  enemies: [primary, secondary],
  targetEnemyId: primary.runtimeId,
  log
});
assert.equal(getFury(level25Hero), 1, "Lv.25 終結技只消耗 2 層戰意");
assert.equal(level25Hero.battleAttackBonus, 1);
assert.ok(primary.hp < 300, "終結技應命中主要目標");
assert.ok(secondary.hp < 100, "終結技應橫掃其他存活敵人");
assert.equal(level25Hero.hp, 122, "Lv.20 強化後應恢復最大生命 10%");

const status = getCharacterCombatStatusEntries(level25Hero)[0];
assert.equal(status.kind, "fury");
assert.equal(status.current, 1);
assert.equal(status.max, 3);
assert.equal(status.changeKind, "consume");
assert.ok(status.changeToken >= 3, "戰意變動需提供穩定動畫 token");

const level20Hero = buildKaige(20);
level20Hero.hp = 50;
initializeCharacterBattleState(level20Hero);
modifyCharacterIncomingDirectDamage({ hero: level20Hero, damage: 10 });
modifyCharacterIncomingDirectDamage({ hero: level20Hero, damage: 10 });
assert.equal(getFury(level20Hero), 3);
resolveCharacterPlayerAction({
  hero: level20Hero,
  enemies: [makeEnemy("target", 300, 0)],
  targetEnemyId: "target",
  log
});
assert.equal(getFury(level20Hero), 0, "Lv.25 前終結技應消耗全部戰意");
assert.ok(level20Hero.hp <= Math.floor(level20Hero.maxHp * 0.7), "浴血回復不得突破 70% 上限");

const cappedHero = buildKaige(20);
cappedHero.hp = Math.floor(cappedHero.maxHp * 0.7);
initializeCharacterBattleState(cappedHero);
for (let index = 0; index < 3; index += 1) {
  modifyCharacterIncomingDirectDamage({ hero: cappedHero, damage: 1 });
}
resolveCharacterPlayerAction({
  hero: cappedHero,
  enemies: [makeEnemy("cap-target", 300, 0)],
  targetEnemyId: "cap-target",
  log
});
assert.equal(cappedHero.hp, Math.floor(cappedHero.maxHp * 0.7));

console.log("v0.2.7.3 Kaige growth, Fury, finisher, sweep and healing cap tests passed.");

function buildKaige(level) {
  return buildHeroFromProgression(kaige, {
    unlocked: true,
    level,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "worn-battle-axe" }
  }, {
    inventory: { weapons: { "worn-battle-axe": true } },
    weaponDefinitions
  });
}

function makeEnemy(runtimeId, hp, defense) {
  return {
    id: runtimeId,
    runtimeId,
    name: runtimeId,
    maxHp: hp,
    hp,
    defense,
    poison: 0,
    dodgeChance: 0
  };
}

function getFury(hero) {
  return hero.skillState.kaige?.fury || 0;
}
