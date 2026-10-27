import assert from "node:assert/strict";
import { remakeHarness } from "./highland-remake-harness.mjs";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { applyEventEffects } from "../src/core/events.js";
import { getEventDefinition } from "../src/data/events/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { blessingPoolDefinitions } from "../src/data/blessings/index.js";

const beachShield = blessingPoolDefinitions.beach.blessings.find(b => b.id === "beach-crosscurrent-guard");
const caveShield = blessingPoolDefinitions.cave.blessings.find(b => b.id === "cave-crosscurrent-shell");
const slime = regionDefinitions.plains.enemies.find(enemy => enemy.id === "slime");
function startShield(count, bonuses, fixed = 0) {
  const { state, battle } = remakeHarness({ region: "plains", level: 1, weapon: "iron-longsword" });
  bonuses.forEach((blessing, i) => applyBlessingEffects(state.hero, blessing, { instanceId: `shield-${i}` }));
  state.hero.multiEnemyShieldStart = fixed;
  battle.beginBattleRuntime({ enemies: Array.from({ length: count }, () => ({ ...slime })), encounterType: "normal" });
  return state.hero.shield;
}
const base = n => startShield(n, []);
assert.equal(startShield(1, [beachShield]) - base(1), 0);
assert.equal(startShield(2, [beachShield]) - base(2), 18);
assert.equal(startShield(4, [caveShield]) - base(4), 72);
assert.equal(startShield(5, [caveShield, caveShield, beachShield], 6) - base(5), 106,
  "Stacked blessing shields cap at 100; fixed weapon shield is separate");

const spring = getEventDefinition("cave-rockspring");
const altar = getEventDefinition("cave-deep-tide-altar");
const hero = { hp: 50, maxHp: 100 };
const rest = spring.choices.find(c => c.id === "rest");
const gather = spring.choices.find(c => c.id === "gather");
const safe = altar.choices.find(c => c.id === "leave");
assert.ok(rest && gather && safe);
let materials = [];
applyEventEffects({ hero, effects: gather.result.effects, grantMaterials: effect => { materials = effect.materials; } });
assert.equal(hero.hp, 50);
assert.deepEqual(materials, [{ id: "cave_shell_fragment", quantity: 2 }]);
applyEventEffects({ hero, effects: rest.result.effects });
assert.equal(hero.hp, 65);
applyEventEffects({ hero, effects: safe.result.effects });
assert.equal(hero.hp, 65, "Safely leaving the altar costs no HP");
console.log("Crowd shields cap separately from weapon shield; spring and altar choices have their stated effects");
