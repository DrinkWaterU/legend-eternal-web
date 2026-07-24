import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import {
  resetBlessingBattleState
} from "../src/core/caveBlessingEffects.js";
import {
  resolveEnemyAction,
  resolveHeroAction,
  resolveHeroStrike
} from "../src/core/combat.js";
import { createRuntimeEnemyGroup } from "../src/core/enemyGroups.js";
import caveBlessingData from "../src/data/blessings/cave.json" with { type: "json" };
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { beachRegion } from "../src/data/regions/beach.js";
import {
  initializeBattleState as initializeArcherBattleState,
  modifyIncomingDirectDamage as modifyArcherIncomingDirectDamage,
  resolvePlayerAction as resolveArcherPlayerAction
} from "../src/characters/skills/archer/combat.js";

function createLogger() {
  const entries = [];
  return {
    entries,
    template(type, templateId, values) {
      entries.push({ type, templateId, values });
    },
    fixed(type, text) {
      entries.push({ type, text });
    }
  };
}

function createHero(overrides = {}) {
  return {
    characterId: "adventurer",
    name: "測試冒險者",
    hp: 200,
    maxHp: 200,
    attack: 50,
    defense: 10,
    critChance: 0,
    critDamageMultiplier: 1.7,
    shield: 0,
    shieldStart: 0,
    skills: [],
    skillState: {},
    hasAttackedThisBattle: false,
    poison: 0,
    ...overrides
  };
}

const blessingById = new Map(caveBlessingData.blessings.map((blessing) => [blessing.id, blessing]));
assert.equal(caveBlessingData.contentStatus, "balanced");
assert.deepEqual(
  caveBlessingData.blessings.map((blessing) => blessing.name),
  [
    "碎盾反噬",
    "礁石礪鋒",
    "潮殼承壓",
    "窟泉寒澤",
    "逆潮孤戍",
    "退潮拾遺",
    "隙光截擊",
    "破陣撕裂",
    "潮痕追穴",
    "電光寄襲",
    "濕岩硬化",
    "聽潮察警",
    "霆擊共鳴",
    "深窟迴響",
    "怒濤貫陣"
  ],
  "洞穴祝福名稱應使用 v0.2.7.2 定案版本"
);

const echoBlessing = blessingById.get("cave-cavern-echo");
const echoHero = createHero({ attack: 20, defense: 0 });
applyBlessingEffects(echoHero, echoBlessing);
applyBlessingEffects(echoHero, echoBlessing);
assert.equal(echoHero.cavernEchoDamagePerStack, 4, "重複深窟迴響應增加每層傷害");
assert.equal(echoHero.cavernEchoMaxStacks, 4, "重複深窟迴響不得增加最大層數");
resetBlessingBattleState(echoHero);
const echoEnemy = {
  runtimeId: "echo-target",
  name: "測試目標",
  hp: 200,
  maxHp: 200,
  defense: 0,
  family: "beast",
  poison: 0,
  paralysis: null
};
const originalRandom = Math.random;
try {
  Math.random = () => 0.99;
  const first = resolveHeroStrike({ hero: echoHero, enemy: echoEnemy, enemies: [echoEnemy], log: createLogger() });
  const second = resolveHeroStrike({ hero: echoHero, enemy: echoEnemy, enemies: [echoEnemy], log: createLogger() });
  const third = resolveHeroStrike({ hero: echoHero, enemy: echoEnemy, enemies: [echoEnemy], log: createLogger() });
  assert.deepEqual(
    [first.damage, second.damage, third.damage],
    [20, 24, 28],
    "深窟迴響應從第二次直接攻擊開始增加傷害"
  );
} finally {
  Math.random = originalRandom;
}

const protectedGroup = createRuntimeEnemyGroup([
  getEnemyDefinition("cave-fishman-frontline"),
  getEnemyDefinition("cave-fishman-output")
]);
const protectedOutput = protectedGroup[1];
const formationHero = createHero({ attack: 50, defense: 0, skills: ["skilled-follow-up"] });
applyBlessingEffects(formationHero, blessingById.get("cave-break-formation"));
try {
  Math.random = () => 0;
  resolveHeroAction({
    hero: formationHero,
    enemy: protectedOutput,
    enemies: protectedGroup,
    log: createLogger()
  });
} finally {
  Math.random = originalRandom;
}
assert.equal(
  protectedOutput.hp,
  83,
  "怒濤貫陣應讓直接攻擊與角色追擊無視魚人前衛保護"
);

const arrowRainGroup = createRuntimeEnemyGroup([
  getEnemyDefinition("cave-fishman-frontline"),
  getEnemyDefinition("cave-fishman-output")
]);
const arrowHero = createHero({
  characterId: "archer",
  name: "測試弓箭手",
  attack: 50,
  defense: 0,
  skills: ["arrow-rain"],
  skillState: {}
});
applyBlessingEffects(arrowHero, blessingById.get("cave-break-formation"));
initializeArcherBattleState({ hero: arrowHero });
arrowHero.skillState.archer.playerAttackCount = 3;
try {
  Math.random = () => 0.99;
  resolveArcherPlayerAction({
    hero: arrowHero,
    enemies: arrowRainGroup,
    targetEnemyId: arrowRainGroup[1].runtimeId,
    log: createLogger()
  });
} finally {
  Math.random = originalRandom;
}
assert.equal(
  arrowRainGroup[1].hp,
  85,
  "怒濤貫陣應讓弓箭手直接攻擊與箭雨無視魚人前衛保護"
);

const tidalGiantCrab = beachRegion.bosses.find((boss) => boss.id === "tidal-giant-crab");
assert.ok(tidalGiantCrab, "正式海灘資料應包含潮汐巨蟹");
assert.deepEqual(
  {
    maxHp: tidalGiantCrab.maxHp,
    attack: tidalGiantCrab.attack,
    defense: tidalGiantCrab.defense
  },
  { maxHp: 660, attack: 45, defense: 12 }
);
assert.deepEqual(
  tidalGiantCrab.specialAttack,
  {
    id: "breaking-wave-pincer",
    name: "破浪橫鉗",
    everyTurns: 4,
    telegraphText: "潮汐巨蟹張開雙鉗，壓低身軀準備橫掃。",
    hits: [
      { label: "第一鉗", attackRatio: 0.4, allowDirectDamageModifier: true },
      { label: "第二鉗", attackRatio: 1, allowDirectDamageModifier: false }
    ]
  }
);

const telegraphHero = createHero({ hp: 200, defense: 10 });
const telegraphLogger = createLogger();
try {
  Math.random = () => 0.99;
  resolveEnemyAction({
    hero: telegraphHero,
    enemy: { ...tidalGiantCrab },
    turn: 3,
    log: telegraphLogger
  });
} finally {
  Math.random = originalRandom;
}
assert.ok(
  telegraphLogger.entries.some((entry) => entry.text === tidalGiantCrab.specialAttack.telegraphText),
  "破浪橫鉗前一回合應顯示蓄力提示"
);

const adventurerHero = createHero({ hp: 200, defense: 10 });
const adventurerLogger = createLogger();
try {
  Math.random = () => 0.99;
  resolveEnemyAction({
    hero: adventurerHero,
    enemy: { ...tidalGiantCrab },
    turn: 4,
    log: adventurerLogger
  });
} finally {
  Math.random = originalRandom;
}
assert.equal(adventurerHero.hp, 157, "冒險者應分別承受 8 點與 35 點雙段傷害");
assert.equal(
  adventurerLogger.entries.filter((entry) => entry.type === "enemy-damage").length,
  2,
  "破浪橫鉗應記錄兩段命中"
);

const archerHero = createHero({
  characterId: "archer",
  name: "測試弓箭手",
  hp: 200,
  defense: 10,
  skills: ["keep-distance"],
  skillState: {}
});
initializeArcherBattleState({ hero: archerHero });
const archerLogger = createLogger();
try {
  Math.random = () => 0.99;
  resolveEnemyAction({
    hero: archerHero,
    enemy: { ...tidalGiantCrab },
    turn: 4,
    log: archerLogger,
    modifyDirectDamage: modifyArcherIncomingDirectDamage
  });
} finally {
  Math.random = originalRandom;
}
assert.equal(archerHero.hp, 164, "保持距離應把第一鉗降至 1 點，第二鉗仍造成 35 點傷害");
assert.equal(archerHero.skillState.archer.keepDistanceCharges, 1, "破浪橫鉗整招只應消耗 1 次保持距離");
assert.equal(
  archerLogger.entries.filter((entry) => entry.templateId === "critical").length,
  0,
  "固定未暴擊亂數下不應產生暴擊"
);

const statusHero = createHero({ hp: 200, defense: 10 });
const statusRolls = [0.99, 0.1];
try {
  Math.random = () => statusRolls.shift() ?? 0.99;
  resolveEnemyAction({
    hero: statusHero,
    enemy: { ...tidalGiantCrab },
    turn: 4,
    log: createLogger()
  });
} finally {
  Math.random = originalRandom;
}
assert.equal(statusHero.saltErosion?.remainingTurns, 5, "破浪橫鉗整招應只進行一次鹽蝕判定");

console.log("v0.2.7.2 洞穴祝福、潮汐巨蟹與雙段破浪橫鉗測試：全部通過");
