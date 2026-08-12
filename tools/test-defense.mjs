import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  applyGuardToDirectDamage,
  beginGuard,
  clearGuard,
  DEFAULT_GUARD_DAMAGE_REDUCTION,
  getGuardState
} from "../src/core/guard.js";
import { resolveEnemyAction } from "../src/core/combat.js";

function createLogger() {
  return {
    entries: [],
    fixed(type, text) {
      this.entries.push({ type, text });
    },
    template(type, templateId, values) {
      this.entries.push({ type, templateId, values });
    }
  };
}

function createHero() {
  return {
    name: "測試角色",
    hp: 100,
    maxHp: 100,
    defense: 0,
    shield: 0,
    poison: 0,
    entangle: null,
    saltErosion: null,
    paralysis: null,
    skills: []
  };
}

const hero = createHero();
assert.equal(DEFAULT_GUARD_DAMAGE_REDUCTION, 0.35);
assert.equal(getGuardState(hero), null);
beginGuard(hero);
assert.equal(getGuardState(hero).damageReduction, 0.35);

const directDamage = applyGuardToDirectDamage({ hero, damage: 20, log: createLogger() });
assert.deepEqual(
  {
    damage: directDamage.damage,
    preventedDamage: directDamage.preventedDamage,
    guarded: directDamage.guarded
  },
  { damage: 13, preventedDamage: 7, guarded: true }
);
assert.equal(hero.guardState.preventedDamage, 7);

const enemy = {
  id: "test-enemy",
  name: "測試敵人",
  attack: 20,
  defense: 0,
  critChance: 0,
  kind: "普通",
  family: "beast"
};
const standardLog = createLogger();
resolveEnemyAction({ hero, enemy, turn: 1, log: standardLog });
assert.equal(hero.hp, 87, "守勢應減少一般直接攻擊傷害");
assert.ok(standardLog.entries.some((entry) => entry.text?.includes("守勢減輕了")));

clearGuard(hero);
assert.equal(getGuardState(hero), null);

const specialHero = createHero();
beginGuard(specialHero);
const specialLog = createLogger();
resolveEnemyAction({
  hero: specialHero,
  enemy: {
    ...enemy,
    specialAttack: {
      id: "test-multi-hit",
      name: "測試連擊",
      everyTurns: 1,
      hits: [
        { label: "第一段", attackRatio: 0.5, allowDirectDamageModifier: false },
        { label: "第二段", attackRatio: 1, allowDirectDamageModifier: false }
      ]
    }
  },
  turn: 1,
  log: specialLog
});
assert.equal(specialHero.hp, 80, "守勢應套用到不可被其他角色／整備修改的特殊攻擊段落");
assert.equal(specialHero.guardState.preventedDamage, 10);

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const renderer = await readFile(new URL("../src/features/battle/combatRenderer.js", import.meta.url), "utf8");
assert.match(html, /id="guardButton"/);
assert.match(html, /id="combatActionHint"/);
assert.match(renderer, /lastPlayerAction/);

console.log("Defense action and combat panel contract tests passed.");
