import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { beginGuard, clearGuard } from "../../src/core/guard.js";
import { resolveEnemyAction, resolveHeroStrike } from "../../src/core/combat.js";
import { getEnemyIntent } from "../../src/core/enemyIntent.js";
import { getStaggerDamageBonus } from "../../src/core/chargeBrace.js";

function createLogger() {
  return {
    entries: [],
    fixed(type, text) { this.entries.push({ type, text }); },
    template(type, templateId, values) { this.entries.push({ type, templateId, values }); }
  };
}
const createHero = () => ({
  name: "測試角色", hp: 100, maxHp: 100, attack: 10, defense: 0, shield: 0, critChance: 0,
  poison: 0, entangle: null, saltErosion: null, paralysis: null, skills: [], skillState: {}
});
const createBoar = (extra = {}) => ({
  runtimeId: "e1", name: "野豬", hp: 100, maxHp: 100, attack: 20, defense: 0, critChance: 0,
  chargeEvery: 3, chargeMultiplier: 1.5,
  chargeBrace: { damageReduction: 0.7, staggerDamageBonus: 0.75 }, ...extra
});

// 1. 守勢撐住衝鋒：減傷 70%，敵人失衡。
{
  const hero = createHero(), enemy = createBoar(), log = createLogger();
  beginGuard(hero);
  resolveEnemyAction({ hero, enemy, turn: 3, log });
  assert.equal(hero.hp, 100 - 9, "衝鋒 30 點在撐住後應只剩 9 點");
  assert.equal(getStaggerDamageBonus(enemy), 0.75);
  assert.ok(log.entries.some(e => e.text?.includes("失衡")));
  assert.equal(hero.guardState.preventedDamage, 21, "守勢減輕量要照常記錄，供守隘劍反攻判定");
}

// 2. 非衝鋒回合的守勢維持原本 35%，不會失衡。
{
  const hero = createHero(), enemy = createBoar(), log = createLogger();
  beginGuard(hero);
  resolveEnemyAction({ hero, enemy, turn: 2, log });
  assert.equal(hero.hp, 100 - 13);
  assert.equal(getStaggerDamageBonus(enemy), 0);
}

// 3. 沒守勢吃完整衝鋒，不會失衡。
{
  const hero = createHero(), enemy = createBoar(), log = createLogger();
  resolveEnemyAction({ hero, enemy, turn: 3, log });
  assert.equal(hero.hp, 70);
  assert.equal(getStaggerDamageBonus(enemy), 0);
}

// 4. 沒有 chargeBrace 的敵人（其他地區）行為不變：守勢 35%，不失衡。
{
  const hero = createHero(), enemy = createBoar({ chargeBrace: undefined }), log = createLogger();
  beginGuard(hero);
  resolveEnemyAction({ hero, enemy, turn: 3, log });
  assert.equal(hero.hp, 100 - 20);
  assert.equal(getStaggerDamageBonus(enemy), 0);
  assert.match(getEnemyIntent(enemy, 2, [enemy]), /可考慮守勢/);
}

// 5. 失衡只加成下一次主攻，用掉就消失；追擊等非 original 來源不吃也不消耗。
{
  const hero = createHero(), enemy = createBoar(), log = createLogger();
  beginGuard(hero);
  resolveEnemyAction({ hero, enemy, turn: 3, log });
  clearGuard(hero);
  resolveHeroStrike({ hero, enemy, enemies: [enemy], log, options: { source: "followUp", allowHeavyStrike: false } });
  assert.equal(enemy.hp, 90, "非主攻不吃失衡加成");
  assert.equal(getStaggerDamageBonus(enemy), 0.75, "非主攻不消耗失衡");
  resolveHeroStrike({ hero, enemy, enemies: [enemy], log });
  assert.equal(enemy.hp, 90 - 18, "主攻 10 點 ×1.75 = 18（四捨五入）");
  assert.equal(getStaggerDamageBonus(enemy), 0);
  resolveHeroStrike({ hero, enemy, enemies: [enemy], log });
  assert.equal(enemy.hp, 90 - 18 - 10, "加成只有一次");
}

// 6. 再次撐住只刷新，不疊加。
{
  const hero = createHero(), enemy = createBoar(), log = createLogger();
  beginGuard(hero); resolveEnemyAction({ hero, enemy, turn: 3, log });
  beginGuard(hero); resolveEnemyAction({ hero, enemy, turn: 6, log });
  assert.equal(getStaggerDamageBonus(enemy), 0.75);
}

// 7. 預告文字與實際數值一致，且只在衝鋒前一回合出現。
{
  const enemy = createBoar();
  assert.equal(getEnemyIntent(enemy, 1, [enemy]), null);
  const text = getEnemyIntent(enemy, 2, [enemy]);
  assert.match(text, /70%/); assert.match(text, /至少 1\.75 倍/, "失衡與技能倍率取較高者，預告寫「至少」才準確"); assert.match(text, /先打倒/);
}

// 8. 全部會衝鋒的敵人都能撐住（2026-11-14 作者同意正式採用並擴大到海岸洞穴首領），
//    避免玩家在平原學到「守勢撐衝鋒」，到別區卻只剩一般守勢。
{
  const plains = JSON.parse(await readFile(new URL("../../src/data/regions/plains.json", import.meta.url), "utf8"));
  const cave = JSON.parse(await readFile(new URL("../../src/data/enemies/cave.json", import.meta.url), "utf8"));
  const collect = (node, out = []) => {
    if (Array.isArray(node)) node.forEach((item) => collect(item, out));
    else if (node && typeof node === "object") { if (node.chargeEvery) out.push(node); Object.values(node).forEach((value) => collect(value, out)); }
    return out;
  };
  const chargers = [...collect(plains), ...collect(cave)];
  assert.deepEqual(chargers.map(e => e.id).sort(), ["boar", "boar-king", "cave-fishman-boss", "giant-boar", "horn-rabbit"]);
  chargers.forEach(e => assert.deepEqual(e.chargeBrace, { damageReduction: 0.7, staggerDamageBonus: 0.75 }, e.id));
}

// 10. 失衡與技能倍率（凱哥終結技）取較高者，不相乘（2026-11-14 實測後改規則）。
{
  const strike = (multiplier, stagger) => {
    const random = Math.random; Math.random = () => 0.99; // 不觸發暴擊、重擊、閃避
    try {
      const hero = createHero(), enemy = createBoar({ stagger: stagger ? { damageBonus: 0.75 } : null }), log = createLogger();
      resolveHeroStrike({ hero, enemy, log, options: { damageMultiplier: multiplier, allowHeavyStrike: false } });
      return { damage: 100 - enemy.hp, stagger: getStaggerDamageBonus(enemy) };
    } finally { Math.random = random; }
  };
  const plain = strike(1, false).damage;
  assert.equal(strike(1, true).damage, Math.round(plain * 1.75), "普通攻擊吃完整 +75%");
  assert.equal(strike(1.75, true).damage, strike(1.75, false).damage, "終結技 ×1.75 已不低於失衡，失衡不再加成");
  const finisher15 = strike(1.5, false).damage;
  assert.equal(strike(1.5, true).damage, Math.round(finisher15 * (1.75 / 1.5)), "終結技 ×1.5 只補到 ×1.75");
  assert.equal(strike(1.75, true).stagger, 0, "失衡仍會被這一擊用掉");
}

// 9. 逃跑失敗固定為普通攻擊：不重複剛結束回合的衝鋒，也不打出特殊攻擊。
{
  const { createEscapeController } = await import("../../src/features/escape/escapeController.js");
  for (const turn of [2, 3, 6]) {
    const lines = [];
    const state = { turn, phase: "combat", ended: false, awaitingBlessing: false, battleEncounterType: "elite",
      hero: { ...createHero(), fleesRemaining: 2 }, enemies: [createBoar()], runStats: { fleeAttempts: 0, fleeFailures: 0 } };
    const controller = createEscapeController({ state, normalFleeChance: 0, eliteFleeChance: 0, tacticalFleeResults: [],
      createCombatLogger: () => ({ fixed: (type, text) => lines.push(text), template: (type, id) => lines.push(id) }),
      modifyIncomingDirectDamage: null, applyEmergencyBandage() {}, tryLastStand: () => false, loseRun() {},
      addLog() {}, render() {}, currentRoute: () => null });
    controller.tryFlee();
    assert.equal(state.hero.hp, 80, `回合 ${turn} 逃跑失敗應只受普通攻擊 20 點`);
    assert.ok(!lines.includes("charge"));
    assert.equal(state.enemies[0].chargeEvery, 3, "不可改到原本的敵人資料");
  }
}

console.log("charge brace: ok");
