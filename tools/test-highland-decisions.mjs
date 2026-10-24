import assert from "node:assert/strict";
import { remakeHarness } from "./highland-remake-harness.mjs";
import { highlandActions, lockHighlandIntents, highlandIntents, startHighlandBattle } from "../src/core/highlandBattle.js";
import { previewHighlandTurn } from "../src/core/highlandPreview.js";
import { captureRunSnapshot, readRunSnapshot } from "../src/core/runSnapshot.js";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { highlandsRegion } from "../src/data/regions/highlands.js";

const fixed = fn => { const old = Math.random; Math.random = () => .99; try { return fn(); } finally { Math.random = old; } };
function chargeScene() {
  const x = remakeHarness({ index: 5 }); const s=x.state;
  s.turn=2; s.hero.battleColumn=1; s.hero.highlandShove=1; s.hero.shield=0;
  s.enemies[0].battleColumn=1; s.highlandBattle.pattern=[1]; s.highlandBattle.rocks=[3,0,2];
  lockHighlandIntents(s); return x;
}
const x=chargeScene(), s=x.state, before=JSON.stringify(s), action={type:"shove",column:0};
const oldRandom=Math.random; Math.random=()=>{throw new Error("Preview must not draw RNG");};
let preview;
try { preview=previewHighlandTurn(s,action); } finally { Math.random=oldRandom; }
assert.equal(JSON.stringify(s),before,"Preview must preserve all live resources, turn, intents and RNG");
assert.equal(preview.interrupted,s.targetEnemyId); assert.equal(preview.threats.length,0);
const enemyHp=s.enemies[0].hp, heroHp=s.hero.hp, weapon=JSON.stringify(s.hero.weaponRuntime);
fixed(()=>x.controller.playTurn(action));
assert.equal(s.highlandBattle.rocks[0],0,"Interrupt consumes the whole rock, including three durability");
assert.equal(s.enemies[0].hp,enemyHp,"Shoving has no free damage"); assert.equal(s.hero.hp,heroHp);
assert.equal(JSON.stringify(s.hero.weaponRuntime),weapon,"Shoving cannot charge or trigger weapon packets");
assert.equal(s.enemies[0].battleColumn,preview.final[1].destination);
s.runPreparation={effect:{type:'highlandTool',tool:'rock'},remainingCharges:2};
assert.ok(!highlandActions(s).some(a=>a.type==='tool-rock' && a.column===0),'Reinforcement cannot rebuild the consumed rock');
const crowd=chargeScene(), cs=crowd.state;
cs.enemies.push({...cs.enemies[0],runtimeId:'other',windRole:'carrier',stoneStock:0,battleColumn:2,attack:30});
lockHighlandIntents(cs);const crowdHp=cs.hero.hp;fixed(()=>crowd.controller.playTurn(action));
assert.ok(cs.hero.hp<crowdHp,'Interrupting one charge must not cancel other enemies');
const cancelled=chargeScene(); cancelled.state.hero.entangle={attempts:0};
fixed(()=>cancelled.controller.playTurn(action));
assert.equal(cancelled.state.highlandBattle.interruptedEnemyId,undefined,"Cancelled player action cannot interrupt");
assert.equal(cancelled.state.enemies[0].battleColumn,1,"Charge still executes when the push fails");
const empty=chargeScene(); empty.state.highlandBattle.rocks=[0,0,0];
assert.equal(previewHighlandTurn(empty.state,action).interrupted,null);
fixed(()=>empty.controller.playTurn(action)); assert.equal(empty.state.enemies[0].battleColumn,1);
const choices=remakeHarness().state; choices.hero.highlandDemolish=1; choices.hero.highlandShatterGust=1;
choices.highlandBattle.pattern=[2];
assert.ok(!highlandActions(choices).some(a=>a.type==="gust-break"));
assert.ok(!highlandActions(choices).some(a=>a.type==="demolish" && a.column===choices.hero.battleColumn));
const patterns=new Set();
for(let seed=42;seed<48;seed++) {
  const c=remakeHarness().state; c.runRandomState=seed; startHighlandBattle(c);
  patterns.add(JSON.stringify(c.highlandBattle.pattern));
  const snapshot=captureRunSnapshot(c), resumed=readRunSnapshot(snapshot);
  assert.equal(resumed.ok,true); assert.deepEqual(resumed.state.highlandBattle.pattern,c.highlandBattle.pattern);
  assert.deepEqual(highlandIntents(resumed.state),highlandIntents(c));
}
assert.ok(patterns.size>=3,"Repeated visits need visible, frozen opening wind variants");
// Actual route enemies and stats, reached only through legal ordinary actions.
// A safe move remains an alternative: interruption trades a whole rock for staying put.
function naturalKing(blessings, steps) {
  const c=remakeHarness({index:5});
  for(const id of blessings) applyBlessingEffects(c.state.hero,highlandsRegion.blessings.find(b=>b.id===id));
  fixed(()=>steps.forEach(a=>c.controller.playTurn(a)));return c;
}
const opening=[{type:"move",column:0},{type:"move",column:1},{type:"move",column:0}];
const pushed=naturalKing(['highlands-wind-heal'],opening), guarded=naturalKing(['highlands-wind-heal'],opening);
assert.equal(highlandIntents(pushed.state)[0].kind,'charge');
const keptHp=pushed.state.hero.hp;
fixed(()=>pushed.controller.playTurn({type:'shove',column:0}));fixed(()=>guarded.controller.playTurn('guard'));
assert.equal(pushed.state.hero.hp,keptHp);assert.ok(guarded.state.hero.hp<keptHp);assert.equal(pushed.state.highlandBattle.rocks[0],0);
const build=['highlands-rock-shield','highlands-wind-step','highlands-break-strike','highlands-border'];
const lead=['guard','attack','attack','attack'];
const gust=naturalKing(build,lead), ordinary=naturalKing(build,lead);
fixed(()=>{gust.controller.playTurn({type:'gust-break',column:0});gust.controller.playTurn('attack');ordinary.controller.playTurn({type:'break',column:0});ordinary.controller.playTurn('attack');});
assert.equal(gust.state.hero.hp,ordinary.state.hero.hp);
assert.equal(ordinary.state.enemies[0].hp-gust.state.enemies[0].hp,14,'Stronger wind earns stagger8 + border6; shared banks are not counted twice');
const uncertain=remakeHarness({index:2}), u=uncertain.state;
u.turn=2;u.hero.battleColumn=2;u.hero.shield=0;u.highlandBattle.pattern=[0];u.highlandBattle.rocks=[0,0,0];
Object.assign(u.enemies[0],{windRole:'captain',battleColumn:2,hp:1,attack:100});
Object.assign(u.enemies[1],{windRole:'carrier',stoneStock:0,battleColumn:2,hp:10,attack:30});
u.targetEnemyId=u.enemies[0].runtimeId;lockHighlandIntents(u);
assert.ok(previewHighlandTurn(u).threats.length,'Do not promise safety when attacking may cancel the caster that would kill another enemy');
const hpBefore=u.hero.hp;fixed(()=>uncertain.controller.playTurn('attack'));assert.ok(u.hero.hp<hpBefore);
console.log("Finite rock interruption, cancellation, preview purity/parity, nonredundant actions and saved wind variants passed");
