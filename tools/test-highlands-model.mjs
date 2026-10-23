import { attackColumns, isGroundAttack } from "../src/core/highlandTelegraphs.js";
// Fixed-level model: real battle entry, turn controller, native skills and settlement.
// No EXP, events, preparations or retreats; heuristic reads visible intents, never future RNG.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { remakeHarness } from "./highland-remake-harness.mjs";
import { highlandActions, highlandIntents, projectHighlandWind, canReachHighlandTarget } from "../src/core/highlandBattle.js";
import { getWeaponActions, getWeaponTechnique } from "../src/core/weaponTechniques.js";
import { highlandsRegion as region } from "../src/data/regions/highlands.js";
import { getRouteDefinition, getRouteGroup } from "../src/data/routes/index.js";
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { buildScaledEnemy } from "../src/core/combat.js";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { highlandPathChoices } from "../src/data/highlandPaths.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import { withSeed, seedFromText, weightedPick } from "./model-test-helpers.mjs";

const rounds = Number(process.argv[2]) || 100;
const equipment = {
 adventurer: ["adventurer-pathfinder-sword", "reefbreaker-warhammer", "brinefang-dagger", "windbreak-sword", "cairn-warhammer", "gale-dagger"],
 archer: ["tidepiercer-shortbow", "ridgewind-bow"], kaige: ["worn-battle-axe", "stormsplit-axe"]
};
const route = getRouteDefinition("windbreak-ascent");
function chooseBlessing(h, owned, tactical) {
 const pool = region.blessings.filter(b => !b.maxStacks || (owned[b.id] || 0) < b.maxStacks), choices = [];
 for (let i = 0; i < 3 && pool.length; i++) { const b = weightedPick(pool, b => getBlessingRarity(b.rarity).weight); choices.push(b); pool.splice(pool.indexOf(b), 1); }
 const value = b => b.effects.reduce((s,e) => s + (e.stat === "maxHp" ? e.amount*.7 : e.stat === "killHeal" ? e.amount*4 : e.stat === "shieldStart" ? e.amount : e.stat === "highlandMoveShield" ? e.amount*1.7 : e.stat === "highlandShelterHeal" ? e.amount*1.4 : e.stat === "highlandSlipToken" ? 14 : e.stat === "highlandDemolish" ? 8 : e.stat?.endsWith("Attack") ? e.amount*.8 : e.stat === "openingCritChance" ? e.amount*45 : e.amount || 4), 0);
 const chosen = tactical ? choices.sort((a,b) => value(b)-value(a))[0] : choices[Math.floor(Math.random()*choices.length)];
 owned[chosen.id] = (owned[chosen.id] || 0)+1; applyBlessingEffects(h, chosen);
}
export function heuristicAction(state, tactical = true) {
 const h = state.hero, enemies = state.enemies.filter(e => e.hp>0);
 const targets = enemies.filter(e => canReachHighlandTarget(state,e)).sort((a,b) => (a.hp - (a.combatRole === "support" ? 22 : 0)) - (b.hp - (b.combatRole === "support" ? 22 : 0)));
 const target = targets[0] || enemies[0]; state.targetEnemyId = target.runtimeId;
 if (!tactical) return targets.length ? {type:"attack"} : {type:"move",column:1};
 const intents = highlandIntents(state), r = h.weaponRuntime, kind = getWeaponTechnique(h);
 const candidates = [{type:"guard"}, ...highlandActions(state), ...getWeaponActions(h)];
 if (targets.length) candidates.push({type:"attack"});
 let best, bestValue = -Infinity;
 for (const a of candidates) {
  if (["sweep","cleave","breach"].includes(a.type) && !targets.length) continue;
  if (kind === "weight" && a.type === "sweep" && enemies.length === 1 && r.weight < 4) continue;
  if (a.type === "breach" && (target.weaponBreach || state.turn+1 <= (target.breachCooldownUntil??-1))) continue;
  const projection = projectHighlandWind(state,a,intents), mine = projection[0];
  const base = Math.max(1,h.attack + (h.battleAttackBonus||0) - target.defense) * (h.characterId === "archer" ? 1.55 : 1.15);
  let outgoing = ["attack","lunge","sweep","cleave","breach"].includes(a.type) ? Math.min(target.hp,base) : 0;
  if (a.type === "attack" && r.riposte) outgoing += base*.7;
  if (a.type === "attack" && r.charge) outgoing += base*(enemies.length===1 ? 1.1 : .8+.5*(enemies.length-1));
  if (a.type === "sweep") outgoing += enemies.reduce((s,e)=>s+Math.min(e.hp,Math.max(1,h.attack*r.weight*.35-e.defense)),0);
  if (a.type === "cleave") outgoing += Math.min(Math.max(0,target.hp-base),h.attack*1.5);
  if (a.type === "breach") outgoing += Math.min(target.hp-base,h.attack*r.impact*.2) + Math.min(target.hp, target.defense*.25*r.impact*(r.impact===3?2:1));
  if (a.type === "charge") outgoing += h.attack*(enemies.length===1 ? .25 : .45+.25*(enemies.length-1));
  let incoming = 0, collateral=0;
  for (const p of projection.slice(1)) {
   const i = intents.find(i=>i.id===p.unit.runtimeId); if (!i) continue;
   if (isGroundAttack(i)) {
    const columns=attackColumns(i), hits=i.kind==="flurry"?2:1;
    if(columns.includes(mine.destination)) incoming+=hits*Math.max(1,p.unit.attack*(i.attackRatio||1)-h.defense);
    if(i.friendly) collateral+=projection.slice(1).filter(q=>q.unit!==p.unit && columns.includes(q.destination)).reduce((s,q)=>s+Math.min(q.unit.hp,hits*Math.max(1,p.unit.attack*(i.kind==="charge"?1.2:i.attackRatio||1)-q.unit.defense)),0);
   } else if (i.kind==="track" && Math.abs(p.destination-mine.destination)<=i.range) incoming+=Math.max(1,p.unit.attack-h.defense);
  }
  if (a.type === "guard") incoming *= .65;
  if (a.type === "hold") incoming *= .8;
  if (mine.stagger) incoming += 8;
  const immediateKill = outgoing>=target.hp && ["attack","lunge","sweep","cleave","breach"].includes(a.type);
  if(immediateKill) incoming *= enemies.length===1 ? 0 : .7;
  let value = outgoing + collateral*.7 - incoming*(h.hp<h.maxHp*.35 ? .9 : .5);
  if (["move","ride"].includes(a.type)) {
   if ((state.highlandBattle.moveShieldUses||0)<2) value += h.highlandMoveShield||0;
   value += (a.type==="ride" && !h.highlandOpportunities?.ride ? h.highlandRideAttack||0 : 0)*.7;
  }
  if (a.type==="guard" && kind==="riposte" && !r.riposte && incoming>0) value += h.attack*.6;
  if (a.type==="slip") value -= 8; // Free action still spends a once-per-battle option.
  if (!targets.length && mine.destination===1) value += h.attack*.8;
  if (mine.sheltered && (state.highlandBattle.shelterHealUses||0)<2) value += Math.min(h.maxHp-h.hp,h.highlandShelterHeal||0);
  if (value>bestValue) {bestValue=value;best=a;}
 }
 return best;
}
function simulate(character,weapon,level,tactical,path) {
 const x=remakeHarness({character,weapon,level,index:0,quiet:true}), s=x.state, owned={}, actions={};
 let total=0;
 for(let index=0;index<12;index++) {
  s.ended=false; s.outcome=null; s.encounterIndex=index; s.routeEncounterIndex=index;
  s.highlandChoices=path === "mixed" ? {0:"shelter",4:"gale",8:"shelter"} : {0:path,4:path,8:path};
  const entry=route.encounterPlan[index], choice=highlandPathChoices[index]?.find(p=>p.id===s.highlandChoices[index]);
  x.battle.beginBattleRuntime({ enemies:getRouteGroup(route,choice?.groupId||entry.groupId).members.map(m=>({enemy:buildScaledEnemy(getEnemyDefinition(m.enemyId),region,index),statScale:m.statScale,rewardScale:m.rewardScale})),encounterType:entry.type });
  let attempts=0;
  while(!s.ended && s.turn<100 && attempts++<130) {
   const a=heuristicAction(s,tactical); actions[a.type]=(actions[a.type]||0)+1;
   x.controller.playTurn(a);
  }
  total+=s.turn;
  if(s.outcome!=="victory") return {won:false,reached:index+1,turns:total,actions,stalled:!s.ended};
  x.skills.applyVictorySkills(); x.skills.consumeBattleLimitedEffects();
  if(index<11) chooseBlessing(s.hero,owned,tactical);
 }
 return {won:true,reached:12,turns:total,actions,hp:s.hero.hp/s.hero.maxHp};
}
const results=[];
for(const level of [28,30]) for(const [character,weapons] of Object.entries(equipment)) for(const weapon of weapons) for(const path of ["shelter","gale","mixed"]) for(const tactical of [false,true]) {
 let wins=0,reached=0,turns=0,stalls=0;const defeats={},actions={};
 for(let n=0;n<rounds;n++) {
  const r=withSeed(seedFromText(`remake:${character}:${level}:${n}`),()=>simulate(character,weapon,level,tactical,path));
  wins+=Number(r.won); reached+=r.reached; turns+=r.turns;stalls+=Number(r.stalled||false);
  if(!r.won) defeats[r.reached]=(defeats[r.reached]||0)+1;
  for(const [a,count] of Object.entries(r.actions)) actions[a]=(actions[a]||0)+count;
 }
 const row={character,weapon,level,path,tactical,rounds,winRatio:wins/rounds,averageReached:reached/rounds,averageTurns:turns/rounds,stalls,defeats,actions};
 results.push(row); console.log(JSON.stringify(row)); assert.equal(stalls,0,"A policy must finish without a no-op/guard loop");
}
mkdirSync("tools/verification-artifacts/highlands",{recursive:true});
writeFileSync("tools/verification-artifacts/highlands/model-results.json",JSON.stringify({rounds,limitations:["Fixed level; no EXP, events, preparations or retreat","Actual battle entry/controller/settlement; heuristic is not a human player","Both policies get blessings; tactical policy also selects blessings by a fixed score","No future random outcome search; results are policy diagnostics, not player win rates"],results},null,2));

if(rounds>=100) for(const character of Object.keys(equipment)) for(const path of ["shelter","gale","mixed"]) {
 const older=results.filter(r=>r.character===character && r.path===path && r.level===30 && r.tactical && !["windbreak-sword","ridgewind-bow","cairn-warhammer","gale-dagger","stormsplit-axe"].includes(r.weapon));
 assert.ok(older.some(r=>r.winRatio>=.55), `${character}/${path} needs a viable existing weapon`);
}
