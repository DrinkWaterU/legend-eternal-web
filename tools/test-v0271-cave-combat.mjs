import assert from "node:assert/strict";

import {
  applyEnemyDamageProtection,
  applyEnemyEndOfTurnNegativeEffects,
  advanceParalysis,
  applyParalysis,
  getParalysisDamageMultiplier,
  getEnemyProtectionState,
  resolveEnemyAction,
  resolveEnemySupportAction,
  resolveHeroAction,
  resolveHeroStrike
} from "../src/core/combat.js";
import { createRuntimeEnemyGroup } from "../src/core/enemyGroups.js";
import { getBattleFleeChance } from "../src/core/fleeRules.js";
import { materialDefinitions } from "../src/data/materials.js";
import caveBlessingData from "../src/data/blessings/cave.json" with { type: "json" };
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { getRouteDefinition, getRouteGroup, routeDefinitions } from "../src/data/routes/index.js";
import { getAllIndependentBlessings, getBlessingPool } from "../src/data/blessings/index.js";
import { rollEnemyRewards } from "../src/core/rewards.js";
import {
  initializeBattleState as initializeArcherBattleState,
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

const caveEnemyIds = [
  "cave-fishman-frontline",
  "cave-fishman-output",
  "cave-fishman-support",
  "cave-fishman-control",
  "cave-fishman-elite-frontline",
  "cave-fishman-boss"
];
caveEnemyIds.forEach((enemyId) => assert.ok(getEnemyDefinition(enemyId), `洞穴敵人應可解析：${enemyId}`));

assert.equal(caveBlessingData.contentStatus, "balanced", "v0.2.7.2 完成平衡後應標示為 balanced");
assert.equal(caveBlessingData.blessings.length, 15, "洞穴祝福池應固定 15 張");
assert.equal(
  new Set(caveBlessingData.blessings.map((blessing) => blessing.eventTitle)).size,
  caveBlessingData.blessings.length,
  "洞穴 Blessing 的 eventTitle 不可重複"
);
assert.ok(
  caveBlessingData.blessings.every((blessing) => blessing.eventText?.length >= 25),
  "洞穴 Blessing eventText 應維持具體冒險情境，不得退化成短規則摘要"
);
assert.ok(
  caveBlessingData.blessings.every((blessing) => blessing.flavorText?.length >= 18),
  "洞穴 Blessing flavorText 應維持海灘同等的敘事短句"
);
assert.deepEqual(
  ["common", "uncommon", "rare"].map((rarity) => caveBlessingData.blessings.filter((blessing) => blessing.rarity === rarity).length),
  [6, 6, 3],
  "洞穴祝福稀有度應固定為 6／6／3"
);

assert.equal(getEnemyDefinition("cave-fishman-frontline").combatRole, "frontline");
assert.equal(getEnemyDefinition("cave-fishman-output").combatRole, "output");
assert.deepEqual(getEnemyDefinition("cave-fishman-support").supportAction, {
  everyTurns: 3,
  maxUses: 2,
  targetCombatRole: "frontline",
  attackGain: 0,
  defenseGain: 3
});
assert.equal(getEnemyDefinition("cave-fishman-control").paralysisChance, 0.15);
assert.equal(getEnemyDefinition("cave-fishman-boss").chargeEvery, 4);
assert.equal(getEnemyDefinition("cave-fishman-boss").chargeMultiplier, 1.45);
assert.equal(getEnemyDefinition("cave-fishman-boss").paralysisChance, 0.2);

assert.deepEqual(
  ["cave_shell_fragment", "tidebone_fragment", "tide_mark_shard", "deep_tide_core"]
    .map((materialId) => materialDefinitions[materialId]?.sellPrice),
  [3, 3, 7, 18]
);

const coastCaveRoute = getRouteDefinition("coast-cave");
assert.equal(coastCaveRoute.groups.length, 10, "洞穴應有 10 組可重用編隊資料");
assert.equal(coastCaveRoute.encounterPlan.length, 16, "洞穴應固定 16 場遭遇");
assert.deepEqual(
  coastCaveRoute.encounterPlan.map((entry) => entry.groupId),
  [
    "cave-lesson-front-output",
    "cave-lesson-front-output",
    "cave-lesson-front-output",
    "cave-lesson-front-output",
    "cave-support-lesson",
    "cave-support-mix",
    "cave-control-lesson",
    "cave-control-lesson",
    "cave-control-mix-elite",
    "cave-control-mix",
    "cave-support-control",
    "cave-support-control",
    "cave-full-roles-elite",
    "cave-full-roles",
    "cave-full-roles",
    "cave-boss"
  ]
);
assert.deepEqual(
  getRouteGroup(coastCaveRoute, "cave-full-roles-elite").members.map((member) => member.enemyId),
  [
    "cave-fishman-elite-frontline",
    "cave-fishman-output",
    "cave-fishman-support",
    "cave-fishman-control"
  ]
);
assert.ok(coastCaveRoute, "洞穴資料完成後必須註冊正式 coast-cave Route");
assert.equal(Object.hasOwn(routeDefinitions, "coast-cave"), true);
assert.deepEqual(getBlessingPool("beach")?.ownerType, "region");
assert.deepEqual(getBlessingPool("beach")?.ownerId, "beach");
assert.deepEqual(getBlessingPool("cave")?.ownerType, "route");
assert.deepEqual(getBlessingPool("cave")?.ownerId, "coast-cave");
assert.ok(
  getAllIndependentBlessings().some((blessing) => blessing.id === "cave-shield-reversal"),
  "Route-owned 洞穴祝福應可被共用祝福查閱面板解析"
);

assert.equal(getBattleFleeChance({
  encounterType: "normal",
  threatKind: "普通",
  normalChance: 0.8,
  eliteChance: 0.55,
  routeFleeChance: coastCaveRoute.fleeChance
}), 0.75);
assert.equal(getBattleFleeChance({
  encounterType: "elite",
  threatKind: "普通",
  normalChance: 0.8,
  eliteChance: 0.55,
  routeFleeChance: coastCaveRoute.fleeChance
}), 0.5);
assert.equal(getBattleFleeChance({
  encounterType: "boss",
  threatKind: "首領",
  normalChance: 0.8,
  eliteChance: 0.55,
  routeFleeChance: coastCaveRoute.fleeChance
}), 0);
assert.equal(getBattleFleeChance({
  encounterType: "normal",
  threatKind: "普通",
  normalChance: 0.8,
  eliteChance: 0.55
}), 0.8, "沒有 Route 覆寫時應保留海灘普通逃跑率");
assert.equal(getBattleFleeChance({
  encounterType: "elite",
  threatKind: "普通",
  normalChance: 0.8,
  eliteChance: 0.55
}), 0.55, "沒有 Route 覆寫時應保留海灘精英逃跑率");

const group = createRuntimeEnemyGroup([
  { enemy: getEnemyDefinition("cave-fishman-frontline"), statScale: 1, rewardScale: 1 },
  { enemy: getEnemyDefinition("cave-fishman-output"), statScale: 1, rewardScale: 1 }
]);
const frontline = group[0];
const output = group[1];
const protection = getEnemyProtectionState({ enemy: output, enemies: group });
assert.equal(protection.protected, true);
assert.equal(protection.reductionRatio, 0.3);
assert.match(protection.description, /降低 30%/);

const protectedDamage = applyEnemyDamageProtection({ enemy: output, enemies: group, damage: 46 });
assert.deepEqual(protectedDamage, {
  damage: 32,
  preventedDamage: 14,
  protected: true,
  reductionRatio: 0.3
});

const hero = {
  name: "測試冒險者",
  hp: 100,
  maxHp: 100,
  attack: 50,
  defense: 0,
  critChance: 0,
  skills: [],
  hasAttackedThisBattle: false,
  poison: 0
};
resolveHeroStrike({ hero, enemy: output, enemies: group, log: createLogger() });
assert.equal(output.hp, 122, "普通玩家傷害應套用 30% 被保護減傷");

frontline.hp = 0;
output.hp = output.maxHp;
hero.hasAttackedThisBattle = false;
resolveHeroStrike({ hero, enemy: output, enemies: group, log: createLogger() });
assert.equal(output.hp, output.maxHp - 46, "前衛死亡後應立即解除被保護");
assert.equal(getEnemyProtectionState({ enemy: output, enemies: group }).protected, false);

const followUpGroup = createRuntimeEnemyGroup([
  { enemy: getEnemyDefinition("cave-fishman-frontline"), statScale: 1, rewardScale: 1 },
  { enemy: getEnemyDefinition("cave-fishman-output"), statScale: 1, rewardScale: 1 }
]);
const followUpHero = {
  ...hero,
  skills: ["skilled-follow-up"],
  hasAttackedThisBattle: false
};
const originalRandom = Math.random;
try {
  Math.random = () => 0;
  resolveHeroAction({
    hero: followUpHero,
    enemy: followUpGroup[1],
    enemies: followUpGroup,
    log: createLogger()
  });
} finally {
  Math.random = originalRandom;
}
assert.equal(followUpGroup[1].hp, 104, "技能追擊也必須套用同一個被保護傷害邊界");

const poisonLogger = createLogger();
followUpGroup[1].poison = 10;
followUpGroup[1].hp = 100;
applyEnemyEndOfTurnNegativeEffects({ enemy: followUpGroup[1], enemies: followUpGroup, log: poisonLogger });
assert.equal(followUpGroup[1].hp, 93, "被保護後排的中毒跳傷應降低 30%");
assert.equal(poisonLogger.entries.at(-1).values.amount, 7);
followUpGroup[0].hp = 0;
followUpGroup[1].hp = 100;
applyEnemyEndOfTurnNegativeEffects({ enemy: followUpGroup[1], enemies: followUpGroup, log: poisonLogger });
assert.equal(followUpGroup[1].hp, 90, "前衛死亡後中毒跳傷應恢復原值");

const archerGroup = createRuntimeEnemyGroup([
  { enemy: getEnemyDefinition("cave-fishman-frontline"), statScale: 1, rewardScale: 1 },
  { enemy: getEnemyDefinition("cave-fishman-output"), statScale: 1, rewardScale: 1 }
]);
const archer = {
  name: "測試弓手",
  hp: 100,
  maxHp: 100,
  attack: 10,
  defense: 0,
  critChance: 0,
  skills: ["arrow-rain"],
  skillState: {},
  hasAttackedThisBattle: false,
  poison: 0
};
initializeArcherBattleState({ hero: archer });
archer.skillState.archer.playerAttackCount = 3;
resolveArcherPlayerAction({
  hero: archer,
  enemies: archerGroup,
  targetEnemyId: archerGroup[1].runtimeId,
  log: createLogger()
});
assert.equal(archerGroup[1].hp, 148, "弓箭雨對後排也必須套用被保護減傷");

const controlHero = {
  name: "測試冒險者",
  hp: 100,
  maxHp: 100,
  defense: 0,
  shield: 0,
  skills: [],
  paralysis: null
};
const controlEnemy = {
  ...getEnemyDefinition("cave-fishman-control"),
  hp: getEnemyDefinition("cave-fishman-control").maxHp
};
try {
  Math.random = () => 0;
  resolveEnemyAction({ hero: controlHero, enemy: controlEnemy, turn: 1, log: createLogger() });
} finally {
  Math.random = originalRandom;
}
assert.equal(controlHero.paralysis.remainingTurns, 2, "控場魚人應沿用既有敵方麻痺流程");

const paralyzedEnemy = { name: "測試魚人", paralysis: null };
applyParalysis(paralyzedEnemy);
assert.equal(paralyzedEnemy.paralysis.remainingTurns, 2, "英雄與敵方應共用麻痺套用規則");
assert.equal(getParalysisDamageMultiplier(paralyzedEnemy, () => 0), 0.8, "敵方麻痺應共用攻擊弱化規則");
advanceParalysis(paralyzedEnemy);
advanceParalysis(paralyzedEnemy);
assert.equal(paralyzedEnemy.paralysis, null, "敵方麻痺應共用回合遞減規則");

const supportGroup = createRuntimeEnemyGroup([
  { enemy: getEnemyDefinition("cave-fishman-support"), statScale: 1, rewardScale: 1 },
  { enemy: getEnemyDefinition("cave-fishman-frontline"), statScale: 1, rewardScale: 1 }
]);
assert.equal(resolveEnemySupportAction({
  enemies: supportGroup,
  actor: supportGroup[0],
  turn: 3,
  log: createLogger()
}), true);
assert.equal(supportGroup[1].defense, 12, "洞穴支援應在固定回合提高前衛防禦");

const bossRewards = rollEnemyRewards(getEnemyDefinition("cave-fishman-boss"), () => 0);
assert.equal(bossRewards.gold, 22);
assert.equal(bossRewards.materials.deep_tide_core.quantity, 1, "洞穴 Boss 深潮核應保底掉落");
assert.equal(bossRewards.materials.tidebone_fragment.quantity, 1);

console.log("v0.2.7.2-alpha 洞穴回歸 洞穴戰鬥與資料驗證：全部通過");
