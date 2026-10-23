import assert from "node:assert/strict";
import { remakeHarness } from "./highland-remake-harness.mjs";
import { highlandIntents, lockHighlandIntents, projectHighlandWind, highlandActions } from "../src/core/highlandBattle.js";
import { projectedHighlandThreats } from "../src/core/highlandTelegraphs.js";
import { captureRunSnapshot, readRunSnapshot } from "../src/core/runSnapshot.js";

const noRandomHits = action => { const old = Math.random; Math.random = () => .99; try { action(); } finally { Math.random = old; } };
function scene({ role = "hunter", column = 1, turn = 0, rocks = [0, 0, 0], wind = 1 } = {}) {
  const x = remakeHarness({ index: 2 }); const s = x.state;
  s.enemies = [s.enemies[0]]; Object.assign(s.enemies[0], { windRole: role, hp: 10000, maxHp: 10000, battleColumn: 1, dodgeChance: 0 });
  s.hero.shield = 0; s.hero.battleColumn = column; s.highlandBattle.rocks = [...rocks]; s.highlandBattle.pattern = [wind]; s.turn = turn;
  lockHighlandIntents(s); return x;
}
// Same attack and wind, different actions: attacking slips out, guarding stays
// in the committed attack area. This is the first lesson's actual game rule.
for (const action of ["attack", "guard"]) {
  const x = remakeHarness({ index: 0 }); const s = x.state, hp = s.hero.hp;
  assert.deepEqual(highlandIntents(s)[0].columns, [1]);
  noRandomHits(() => x.controller.playTurn(action));
  assert.equal(s.hero.battleColumn, action === "attack" ? 2 : 1);
  assert.equal(s.hero.hp === hp, action === "attack");
  assert.ok(s.enemies[0].hp < s.enemies[0].maxHp || action === "guard");
}
// A different caster intercepts the downwind square. The opposite action wins.
for (const action of ["attack", "guard"]) {
  const x = scene({ role: "signal" }); const s = x.state, hp = s.hero.hp;
  assert.deepEqual(highlandIntents(s)[0].columns, [2]);
  noRandomHits(() => x.controller.playTurn(action));
  assert.equal(s.hero.hp === hp, action === "guard");
}
// A shelter can trap you in a locked attack. Destroying it lets the wind help.
for (const action of ["attack", { type: "break", column: 0 }]) {
  const x = scene({ column: 0, rocks: [2, 0, 0] }); const s = x.state, hp = s.hero.hp;
  const forecast = projectHighlandWind(s, typeof action === "string" ? { type: action } : action);
  noRandomHits(() => x.controller.playTurn(action));
  assert.equal(s.hero.battleColumn, forecast[0].destination);
  assert.equal(s.hero.hp === hp, typeof action !== "string");
}
// Tracking follows you after wind; a green-looking empty ground is not safety.
const tracking = scene({ role: "hawk", turn: 1 });
assert.equal(projectedHighlandThreats(tracking.state, projectHighlandWind(tracking.state), highlandIntents(tracking.state))[0].kind, "track");
const trackingHp = tracking.state.hero.hp;
noRandomHits(() => tracking.controller.playTurn("attack")); assert.ok(tracking.state.hero.hp < trackingHp);

const push = scene({ role: "captain", turn: 2, column: 0, rocks: [2, 0, 0] });
const s = push.state; s.hero.highlandShove = 1;
const caster = s.enemies[0]; caster.attack = 50;
s.enemies.push({ ...caster, id: "bait", runtimeId: "bait", name: "bait", windRole: "hunter", battleColumn: 0, hp: 1, maxHp: 50 });
s.targetEnemyId = "bait"; lockHighlandIntents(s);
const frozen = JSON.stringify(highlandIntents(s));
noRandomHits(() => push.controller.playTurn({ type: "shove", column: 1 }));
assert.equal(s.enemies.some(e => e.runtimeId === "bait"), false);
assert.equal(s.highlandBattle.inducedCollisions, 1);
assert.equal(s.hero.weaponRuntime.impact, 0, "Pushing and collateral never charge weapons");

const free = scene({ role: "signal" }); free.state.hero.highlandSlipToken = 1;
const locked = JSON.stringify(highlandIntents(free.state));
free.controller.playTurn({ type: "slip", column: 0 });
assert.equal(JSON.stringify(highlandIntents(free.state)), locked);
free.battle.savePendingThreat("safeEscape"); free.battle.resumePendingThreat();
assert.equal(JSON.stringify(highlandIntents(free.state)), locked, "Free moves and threat resumes never retarget an attack");

const gust = scene({ column: 0, rocks: [2, 0, 2] }); gust.state.hero.highlandShatterGust = 1;
const gustAction = highlandActions(gust.state).find(a => a.type === "gust-break" && a.column === 0);
const gustPreview = projectHighlandWind(gust.state, gustAction);
noRandomHits(() => gust.controller.playTurn(gustAction));
assert.equal(gust.state.hero.battleColumn, gustPreview[0].destination);
assert.equal(gust.state.highlandBattle.lastWind, 2);

const hold = scene({ role: "signal", wind: 2 }); hold.state.hero.highlandHold = 1;
const hp = hold.state.hero.hp; noRandomHits(() => hold.controller.playTurn("hold"));
assert.equal(hold.state.hero.battleColumn, 1); assert.equal(hold.state.hero.hp, hp);

const killed = scene(); killed.state.enemies[0].hp = 1; const beforeHp = killed.state.hero.hp;
noRandomHits(() => killed.controller.playTurn("attack")); assert.equal(killed.state.hero.hp, beforeHp); assert.equal(killed.state.outcome, "victory");
const broken = captureRunSnapshot(scene().state); broken.state.highlandBattle.intents[0].columns = [3];
assert.equal(readRunSnapshot(broken).ok, false);

// A ground flurry has one frozen area for both segments; no hit is allowed
// outside it, and its collateral is resolved before the caster's next ally.
const flurry = scene({ role: "storm", turn: 1 });
assert.deepEqual(highlandIntents(flurry.state)[0].columns, [1, 2]);
const flurryHp = flurry.state.hero.hp;
noRandomHits(() => flurry.controller.playTurn({ type: "move", column: 0 }));
assert.equal(flurry.state.hero.hp, flurryHp);
for (const action of ["guard", { type: "move", column: 1 }]) {
  const natural = scene({ role: "captain", turn: 2, column: 0, wind: 0 }); const s = natural.state;
  s.hero.hp = 100; s.hero.highlandEnvKillHeal = 12; s.enemies[0].attack = 50;
  s.enemies.push({ ...s.enemies[0], runtimeId: "natural-bait", name: "bait", windRole: "hunter", battleColumn: 2, hp: 1 });
  lockHighlandIntents(s); noRandomHits(() => natural.controller.playTurn(action));
  assert.equal(s.highlandBattle.inducedCollisions || 0, 0, "Moving between safe squares cannot claim a pre-existing friendly hit");
  assert.equal(s.hero.hp, 100);
}
console.log("Ground attacks, wind benefit/harm, shelter traps, tracking, push collateral, frozen intents, stronger gust and anchored guard passed");
