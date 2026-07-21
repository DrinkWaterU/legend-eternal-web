import assert from "node:assert/strict";

import {
  resolveEnemyAction,
  resolveEnemySupportAction,
  resolveHeroAction
} from "../src/core/combat.js";
import {
  createRuntimeEnemyGroup,
  restoreRuntimeEnemyGroup
} from "../src/core/enemyGroups.js";
import { createBattleTurnController } from "../src/features/battle/battleTurnController.js";

function createLogger() {
  const entries = [];
  return {
    entries,
    template(type, templateId, values) {
      entries.push({ type, templateId, values });
    },
    fixed() {}
  };
}

const supportDefinition = {
  id: "test-support-fishman",
  name: "測試支援魚人",
  kind: "普通",
  combatRole: "support",
  maxHp: 100,
  hp: 100,
  attack: 12,
  defense: 3,
  critChance: 0,
  supportAction: {
    everyTurns: 2,
    maxUses: 1,
    targetCombatRole: "frontline",
    attackGain: 3,
    defenseGain: 2
  }
};

const frontlineDefinition = {
  id: "test-frontline-fishman",
  name: "測試前衛魚人",
  kind: "普通",
  combatRole: "frontline",
  maxHp: 100,
  hp: 50,
  attack: 20,
  defense: 5,
  critChance: 0
};

const outputDefinition = {
  id: "test-output-fishman",
  name: "測試輸出魚人",
  kind: "普通",
  combatRole: "output",
  maxHp: 100,
  hp: 20,
  attack: 25,
  defense: 2,
  critChance: 0
};

const group = createRuntimeEnemyGroup([
  supportDefinition,
  frontlineDefinition,
  outputDefinition
]);
const support = group[0];
const frontline = group[1];
const output = group[2];
const logger = createLogger();

assert.equal(
  resolveEnemySupportAction({ enemies: group, actor: support, turn: 1, log: logger }),
  false,
  "未到固定間隔時不得觸發支援"
);
assert.equal(support.supportUses, 0);

assert.equal(
  resolveEnemySupportAction({ enemies: group, actor: support, turn: 2, log: logger }),
  true,
  "到達固定間隔且有合法目標時應觸發支援"
);
assert.equal(frontline.attack, 23);
assert.equal(frontline.defense, 7);
assert.equal(frontline.supportAttackBonus, 3);
assert.equal(frontline.supportDefenseBonus, 2);
assert.equal(output.attack, 25, "支援不得套用到錯誤職能或玩家未指定的其他後排");
assert.equal(support.supportUses, 1);
assert.equal(logger.entries.at(-1).templateId, "enemySupportAttackDefense");

assert.equal(
  resolveEnemySupportAction({ enemies: group, actor: support, turn: 4, log: logger }),
  false,
  "達到最大次數後不得重複支援"
);
assert.equal(frontline.attack, 23);
assert.equal(frontline.defense, 7);

const restored = restoreRuntimeEnemyGroup(group);
assert.equal(restored[1].attack, 23, "同一場未完成戰鬥恢復時應保留支援後數值");
assert.equal(restored[1].defense, 7);
assert.equal(restored[1].supportAttackBonus, 3);
assert.equal(restored[0].supportUses, 1);

const hero = {
  name: "測試冒險者",
  hp: 100,
  maxHp: 100,
  defense: 0,
  shield: 0,
  skills: []
};
resolveEnemyAction({ hero, enemy: frontline, turn: 1, log: createLogger() });
assert.equal(hero.hp, 77, "支援後的前衛攻擊應使用目前有效攻擊力");

const attackingHero = {
  name: "測試冒險者",
  hp: 100,
  maxHp: 100,
  attack: 20,
  defense: 0,
  critChance: 0,
  skills: [],
  hasAttackedThisBattle: false
};
const protectedFrontline = {
  name: "測試前衛魚人",
  hp: 100,
  maxHp: 100,
  defense: 7,
  attack: 20,
  critChance: 0,
  poison: 0,
  dodgeChance: 0
};
resolveHeroAction({ hero: attackingHero, enemy: protectedFrontline, log: createLogger() });
assert.equal(protectedFrontline.hp, 87, "支援後的前衛防禦應進入既有玩家傷害公式");

const noTargetGroup = createRuntimeEnemyGroup([supportDefinition]);
const noTargetSupport = noTargetGroup[0];
assert.equal(
  resolveEnemySupportAction({ enemies: noTargetGroup, actor: noTargetSupport, turn: 2, log: createLogger() }),
  false,
  "沒有其他存活隊友時不得消耗支援次數"
);
assert.equal(noTargetSupport.supportUses, 0);

const invalidSupport = createRuntimeEnemyGroup([{
  ...supportDefinition,
  supportAction: {
    everyTurns: 0,
    maxUses: 2,
    attackGain: 3
  }
}]);
assert.equal(
  resolveEnemySupportAction({ enemies: invalidSupport, actor: invalidSupport[0], turn: 2, log: createLogger() }),
  false,
  "無效支援設定應安全停用，不得產生部分強化"
);

const controllerGroup = createRuntimeEnemyGroup([
  {
    ...supportDefinition,
    attack: 100
  },
  {
    ...frontlineDefinition,
    attack: 1
  }
]);
const controllerHero = {
  name: "測試冒險者",
  hp: 100,
  maxHp: 100,
  defense: 0,
  shield: 0,
  skills: []
};
const controllerState = {
  ended: false,
  awaitingBlessing: false,
  phase: "combat",
  turn: 1,
  hero: controllerHero,
  enemies: controllerGroup
};
let controllerLost = false;
const controller = createBattleTurnController({
  state: controllerState,
  createCombatLogger: () => createLogger(),
  currentTargetEnemy: () => controllerGroup[0],
  runHeroPlayerAction() {},
  modifyIncomingDirectDamage: ({ damage }) => damage,
  consumeEntangleRetry: () => false,
  recordEntangleRetryResult() {},
  modifyPoisonDamage: (damage) => damage,
  settleDefeatedEnemies: () => 0,
  applyEmergencyBandage() {},
  tryLastStand: () => false,
  winEncounter() {},
  loseRun() {
    controllerLost = true;
    controllerState.ended = true;
  },
  render() {}
});
controller.playTurn();
assert.equal(controllerHero.hp, 96, "支援成功後，支援者不可在同一回合追加普通攻擊");
assert.equal(controllerLost, false);

console.log("敵人支援行動隔離驗證：全部通過");
