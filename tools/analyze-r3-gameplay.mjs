import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { reviewHarness, withReviewRandom } from './r3-review-harness.mjs';
import { canReachHighlandTarget, highlandActions, highlandIntents, windFor } from '../src/core/highlandBattle.js';
import { previewHighlandTurn } from '../src/core/highlandPreview.js';
import { runWeaponAttack } from '../src/core/weaponTechniques.js';
import { getHeroEffectiveAttack } from '../src/core/heroCombat.js';
import { regionDefinitions } from '../src/data/regions/index.js';
import { withRunRandom } from '../src/core/runSnapshot.js';
import { getEnemyProtectionState } from '../src/core/enemyProtection.js';

const tag=process.argv[3]||'results';
const output=`tools/verification-artifacts/r3-gameplay-${tag}.json.gz`;
const rounds=Number(process.argv[2])||30;
const waveRatio=Number(runWeaponAttack.toString().match(/packet\(enemy, power \* ([.\d]+)/)?.[1]);
assert.ok(Number.isFinite(waveRatio));
const living=s=>s.enemies.filter(e=>e.hp>0);
function target(s,order='lowest'){
  const all=living(s),reachable=all.filter(e=>canReachHighlandTarget(s,e));
  const candidates=reachable.length?reachable:all;
  candidates.sort((a,b)=>order==='largest'?b.hp-a.hp:a.hp-b.hp);
  s.targetEnemyId=candidates[0]?.runtimeId;
  return {enemy:candidates[0],reachable:reachable.length>0};
}
function attack(s,order='lowest'){
  const t=target(s,order);return t.reachable?{type:'attack'}:{type:'move',column:1};
}
function train(s,order){
  const follow=living(s).find(e=>e.runtimeId===s.hammerTrainingBreachTargetId&&e.weaponBreach?.strength===3);
  if(follow&&canReachHighlandTarget(s,follow)){s.targetEnemyId=follow.runtimeId;return {type:'attack'};}
  if(s.hero.weaponRuntime.impact===3){
    const durable=living(s).filter(e=>canReachHighlandTarget(s,e)&&!e.weaponBreach&&s.turn+1>(e.breachCooldownUntil??-1)).sort((a,b)=>b.hp-a.hp)[0];
    if(durable){s.targetEnemyId=durable.runtimeId;return {type:'breach'};}
  }
  return attack(s,order);
}
function adaptive(s,{wave=false,riposte=false}={}){
  if(!s.highlandBattle){const a=attack(s);if(riposte&&!s.hero.weaponRuntime.riposte&&s.turn%2===0)return {type:'guard'};
    if(wave&&s.hero.weaponRuntime.impact===3&&living(s).length>1)return {type:'breach-wave'};return a;}
  const t=target(s),h=s.hero,power=getHeroEffectiveAttack(h);
  const opts=[{type:'guard'},...highlandActions(s).filter(a=>!['slip','tool-step'].includes(a.type))];
  if(t.reachable)opts.push({type:'attack'});
  const waveTarget=living(s).filter(e=>canReachHighlandTarget(s,e)).sort((a,b)=>b.hp-a.hp)[0];
  if(wave&&t.reachable&&h.weaponRuntime.impact===3&&living(s).length>1)opts.push({type:'breach-wave'});
  let best,bestScore=-Infinity;
  for(const a of opts){const p=previewHighlandTurn(s,a);let damage=0;
    for(const i of p.threats.filter(Boolean)){const e=s.enemies.find(e=>e.runtimeId===i.id);if(e)damage+=Math.max(1,e.attack*(i.attackRatio||1)-h.defense)*(i.kind==='flurry'?2:1);}
    if(a.type==='guard')damage*=h.equipment.trainingMode==='swift'?.8:.65;
    const main=a.type==='breach-wave'?waveTarget:t.enemy;
    let outgoing=['attack','breach-wave'].includes(a.type)?Math.min(main.hp,Math.max(1,power-main.defense)):0;
    if(outgoing&&h.weaponRuntime.riposte)outgoing+=Math.min(Math.max(0,t.enemy.hp-outgoing),power*(h.equipment.trainingMode==='swift'?1.1:.7)+4-t.enemy.defense);
    if(a.type==='breach-wave')outgoing+=living(s).filter(e=>e!==main).reduce((n,e)=>n+Math.min(e.hp,Math.max(1,power*waveRatio-e.defense))+(e.hp<=Math.max(1,power*waveRatio-e.defense)?e.attack:0),0);
    if(a.type==='guard'&&riposte&&!h.weaponRuntime.riposte&&damage>0)outgoing+=power*.55;
    let score=outgoing+p.collateral.reduce((n,e)=>n+e.damage,0)*.65-damage*.9;
    if(a.type==='move'&&!t.reachable&&a.column===1)score+=power;
    if(a.type==='move'&&(s.highlandBattle.moveShieldUses||0)<2)score+=h.highlandMoveShield||0;
    if(score>bestScore){best=a;bestScore=score;}
  }if(best.type==='breach-wave')s.targetEnemyId=waveTarget.runtimeId;return best;
}
function step(h,a,trace=null){
  const s=h.state,before=JSON.parse(JSON.stringify({turn:s.turn,hp:s.hero.hp,shield:s.hero.shield,impact:s.hero.weaponRuntime.impact,ready:s.hero.weaponRuntime.riposte,riposteUntil:s.hero.weaponRuntime.riposteUntil,rng:s.runRandomState,wind:windFor(s),column:s.hero.battleColumn,target:s.targetEnemyId,enemies:living(s).map(e=>({id:e.runtimeId,name:e.name,hp:e.hp,defense:e.defense,column:e.battleColumn,role:e.combatRole,formation:e.formationId,protected:getEnemyProtectionState({enemy:e,enemies:s.enemies}).protected})),intents:highlandIntents(s)}));
  const mark=h.messages.length,changes=observeHp(s.hero,()=>h.controller.playTurn(a));
  assert.ok(s.turn>before.turn||s.ended,`Policy made an illegal/no-op action ${JSON.stringify(a)}`);
  const logs=h.messages.slice(mark);
  if(trace)trace.push({before,action:a,recoveredHp:changes.gained,lostHp:changes.lost,after:{turn:s.turn,hp:s.hero.hp,shield:s.hero.shield,impact:s.hero.weaponRuntime.impact,riposte:s.hero.weaponRuntime.riposte,rng:s.runRandomState,living:living(s).map(e=>({id:e.runtimeId,hp:e.hp,column:e.battleColumn}))},logs});
  return logs;
}
function finish(h,policy,trace=null){let attempts=0;while(!h.state.ended&&attempts++<90)step(h,policy(h.state),trace);return h.state.outcome||'stalled';}
const training=[];
for(const level of [24,28,30])for(const build of ['none','offense'])for(const order of ['lowest','largest'])for(let index=0;index<12;index++)for(let seed=1;seed<=rounds;seed++){
  const row=withReviewRandom(seed,()=>{const blessings=build==='offense'&&index>=3?['highlands-calm-eye','highlands-wind-step','highlands-border']:[];
    const h=reviewHarness({level,seed,blessings});h.begin(index);const trace=[],initial=structuredClone(h.state.enemies),outcome=finish(h,s=>train(s,order),trace);
    return {level,build,order,index,seed,initial:initial.map(e=>({name:e.name,hp:e.hp,attack:e.attack,defense:e.defense})),hero:{hp:h.state.hero.maxHp,attack:h.state.hero.attack,skills:h.state.hero.skills},outcome,success:h.trainingEvents.some(e=>e.kind==='hammer'),events:h.trainingEvents,turns:h.state.turn,hp:h.state.hero.hp,trace};});training.push(row);
}
const choices=[];
for(const region of ['highlands','beach'])for(const level of [28,30])for(const index of region==='highlands'?[0,2,4,5,6,8,9,11]:[9,10,11,15])for(const option of region==='beach'&&index!==15?[0,1,2]:[0])for(let seed=1;seed<=rounds;seed++){
  withReviewRandom(seed,()=>{const h=reviewHarness({region,level,seed,unlocked:true});h.begin(index,option);const prefix=[];
    while(!h.state.ended&&h.state.turn<40&&h.state.hero.weaponRuntime.impact<3)step(h,attack(h.state),prefix);
    const row={region,level,index,option,seed,openingCount:h.state.hammerTrainingStartEnemyCount,opening:prefix[0]?.before.enemies,chargeTurns:h.state.turn,liveAtCharge:living(h.state).length,checkpoint:living(h.state).map(e=>({id:e.runtimeId,hp:e.hp,defense:e.defense,role:e.combatRole,formation:e.formationId,protected:getEnemyProtectionState({enemy:e,enemies:h.state.enemies}).protected})),available:!h.state.ended&&h.state.hero.weaponRuntime.impact===3&&living(h.state).length>=2,branches:[]};
    if(!h.state.ended&&h.state.hero.weaponRuntime.impact===3){const snapshot=structuredClone(h.state);
      for(const first of ['attack','breach','breach-wave'])for(const chosenTarget of snapshot.enemies.filter(e=>e.hp>0&&canReachHighlandTarget(snapshot,e))){
        if(first==='breach-wave'&&!row.available)continue;
        Object.assign(h.state,structuredClone(snapshot));h.messages.length=0;h.state.targetEnemyId=chosenTarget.runtimeId;
        if(!canReachHighlandTarget(h.state,h.state.enemies.find(e=>e.runtimeId===h.state.targetEnemyId)))continue;
        const trace=[];step(h,{type:first},trace);finish(h,s=>attack(s),trace);
        row.branches.push({first,target:chosenTarget.runtimeId,outcome:h.state.outcome,turns:h.state.turn-snapshot.turn,hp:h.state.hero.hp,hpChange:h.state.hero.hp-snapshot.hero.hp,trace});
      }
    }choices.push(row);});
}
const routes=[];
const sequences={none:[],sustain:['highlands-rations','highlands-cairn','highlands-move-shield','highlands-shelter-heal','highlands-guard-shield','highlands-rations','highlands-calm-eye','highlands-border','highlands-rations','highlands-wind-step','highlands-rations'],offense:['highlands-calm-eye','highlands-wind-step','highlands-border','highlands-break-strike','highlands-ride','highlands-cairn','highlands-rock-shield','highlands-no-rock','highlands-rations','highlands-wind-heal','highlands-move-shield']};
for(const level of [28,30])for(const build of Object.keys(sequences))for(const weapon of ['cairn-warhammer','windbreak-sword'])for(const path of ['shelter','gale'])for(const policy of ['attack','guard-attack','adaptive'])for(const mode of weapon==='windbreak-sword'?['steady','swift']:['normal','wave'])for(let seed=1;seed<=rounds;seed++){
  routes.push(withReviewRandom(seed,()=>{const h=reviewHarness({level,seed,path,weapon,mode,unlocked:true});let total=0,healed=0,hpLost=0,victoryHealed=0,waves=0;const actions={},encounters=[];
    for(let index=0;index<12;index++){h.begin(index);const start=h.state.hero.hp,trace=[];const mark=h.messages.length;
      finish(h,s=>{let a=policy==='adaptive'?adaptive(s,{wave:mode==='wave',riposte:weapon==='windbreak-sword'}):attack(s);
        if(policy==='guard-attack'&&s.turn%2===0)a={type:'guard'};
        if(policy!=='adaptive'&&mode==='wave'&&s.hero.weaponRuntime.impact===3&&living(s).length>1&&a.type==='attack'){target(s,'largest');a={type:'breach-wave'};}
        actions[a.type]=(actions[a.type]||0)+1;return a;},trace);
      total+=h.state.turn;const logs=h.messages.slice(mark);healed+=trace.reduce((n,t)=>n+t.recoveredHp,0);hpLost+=trace.reduce((n,t)=>n+t.lostHp,0);waves+=trace.filter(t=>t.action.type==='breach-wave').length;
      const endHp=h.state.hero.hp;
      if(h.state.outcome==='victory')withRunRandom(h.state,()=>{h.skills.applyVictorySkills();h.skills.consumeBattleLimitedEffects();});
      const victoryHeal=h.state.hero.hp-endHp;victoryHealed+=victoryHeal;
      encounters.push({index,outcome:h.state.outcome,turns:h.state.turn,startHp:start,endHp,endHpAfterVictory:h.state.hero.hp,victoryHeal,recoveredHp:trace.reduce((n,t)=>n+t.recoveredHp,0),lostHp:trace.reduce((n,t)=>n+t.lostHp,0),actions:trace.map(t=>({turn:t.after.turn,action:t.action,target:t.before.target,hp:t.after.hp,recoveredHp:t.recoveredHp,lostHp:t.lostHp,wind:t.before.wind,column:t.before.column,readyBefore:t.before.ready,readyAfter:t.after.riposte,riposteUntil:t.before.riposteUntil})),waveTurns:trace.filter(t=>t.action.type==='breach-wave').map(t=>({turn:t.after.turn,impactBefore:t.before.impact,defeated:t.logs.filter(m=>m.key==='enemyDefeated').length,recoveredHp:t.recoveredHp,hpBefore:t.before.hp,hpAfter:t.after.hp}))});
      if(h.state.outcome!=='victory')break;
      if(sequences[build][index])h.bless(sequences[build][index]);
    }return{level,build,weapon,path,policy,mode,seed,won:encounters.length===12&&h.state.outcome==='victory',reached:encounters.length,turns:total,endHp:h.state.hero.hp,maxHp:h.state.hero.maxHp,healed,hpLost,victoryHealed,waves,actions,encounters};}));
}
const swordTraining=[];
for(const region of ['forest','beach','highlands'])for(const index of region==='highlands'?[0,1,2,4,6,8,11]:[0,8,15])for(let seed=1;seed<=rounds;seed++){
  swordTraining.push(withReviewRandom(seed,()=>{const h=reviewHarness({region,weapon:'windbreak-sword',level:28,seed});h.begin(index);const trace=[];finish(h,s=>{
    if(s.hero.weaponRuntime.riposte)return attack(s);
    if(!s.highlandBattle||previewHighlandTurn(s,{type:'guard'}).threats.length)return {type:'guard'};
    return attack(s);
  },trace);return{region,index,seed,success:h.trainingEvents.some(e=>e.kind==='sword'),outcome:h.state.outcome,trace};}));
}
function grouped(rows,keys,metrics){const map=new Map();for(const row of rows){const key=keys.map(k=>row[k]).join('/');if(!map.has(key))map.set(key,[]);map.get(key).push(row);}return [...map].map(([key,group])=>({key,n:group.length,...metrics(group)}));}
const swordChoices=[];
for(const mode of ['steady','swift'])for(const index of [0,1,2,4,6,8])for(let seed=1;seed<=rounds;seed++){
  const h=reviewHarness({weapon:'windbreak-sword',mode,seed});h.begin(index);
  while(!h.state.ended&&!h.state.hero.weaponRuntime.riposte&&h.state.turn<25){const s=h.state;step(h,previewHighlandTurn(s,{type:'guard'}).threats.length?{type:'guard'}:attack(s));}
  if(h.state.ended||!h.state.hero.weaponRuntime.riposte||!target(h.state).reachable)continue;
  const snapshot=structuredClone(h.state),branches=[];
  for(const plan of ['now','move-then-attack']){
    Object.assign(h.state,structuredClone(snapshot));const trace=[];
    if(plan==='move-then-attack')step(h,{type:'move',column:h.state.hero.battleColumn===1?0:1},trace);
    if(!h.state.ended)step(h,attack(h.state),trace);
    branches.push({plan,hp:h.state.hero.hp,attackAttempted:trace.some(t=>t.action.type==='attack'),readyAfter:h.state.hero.weaponRuntime.riposte,usedRiposte:trace.some(t=>t.logs.some(m=>/^(冒險反攻|架勢反攻)命中/.test(m.text||''))),trace});
  }swordChoices.push({mode,index,seed,branches});
}
const sum=(g,key)=>g.reduce((n,r)=>n+Number(r[key]||0),0),avg=(g,key)=>+(sum(g,key)/g.length).toFixed(3);
const summary={rounds,waveRatio,dataDefinitions:{healed:'Sum of positive hero.hp writes during turns, including revival from negative HP; not shield or exclusively kill healing',hpLost:'Sum of negative hero.hp writes during turns, including lethal overflow; not shield loss or capped effective damage',victoryHealed:'HP increase from victory skills after the encounter, before the next blessing',choiceCounts:'Equally enumerated selected encounters and group options, not encounter probabilities or player win rates'},
 training:grouped(training,['level','build','order'],g=>({completed:sum(g,'success'),singleSurvivor:g.filter(r=>r.events.some(e=>e.living===1)).length,byEncounter:grouped(g,['index'],x=>({completed:sum(x,'success'),won:x.filter(r=>r.outcome==='victory').length}))})),
 choices:grouped(choices,['region','level'],g=>({chargeAvailable:g.filter(r=>r.available).length,charged:g.filter(r=>r.branches.length).length,waveFaster:g.filter(r=>{const w=bestBranch(r,'breach-wave'),a=bestBranch(r,'attack');return w?.outcome==='victory'&&a?.outcome==='victory'&&w.turns<a.turns;}).length,waveLessDamage:g.filter(r=>{const w=bestBranch(r,'breach-wave'),a=bestBranch(r,'attack');return w?.outcome==='victory'&&a?.outcome==='victory'&&w.hp>a.hp;}).length})),
 waveVsBreach:grouped(choices,['region','level'],g=>({available:g.filter(r=>r.available).length,protectedCheckpoints:g.filter(r=>r.available&&r.checkpoint.some(e=>e.protected)).length,highDefenseCheckpoints:g.filter(r=>r.available&&r.checkpoint.some(e=>e.defense>=10)).length,waveBetter:g.filter(r=>better(bestBranch(r,'breach-wave'),bestBranch(r,'breach'))).length,breachBetter:g.filter(r=>r.available&&better(bestBranch(r,'breach'),bestBranch(r,'breach-wave'))).length})),
 routes:grouped(routes,['level','build','weapon','path','policy','mode'],g=>({wins:sum(g,'won'),avgReached:avg(g,'reached'),avgTurns:avg(g,'turns'),avgEndHp:avg(g,'endHp'),avgHealed:avg(g,'healed'),avgHpLost:avg(g,'hpLost'),avgVictoryHealed:avg(g,'victoryHealed'),avgWaves:avg(g,'waves'),stalls:g.filter(r=>r.encounters.some(e=>e.outcome===null)).length})),
 swordTraining:grouped(swordTraining,['region'],g=>({completed:sum(g,'success')})),
 swordChoices:grouped(swordChoices,['mode'],g=>({immediateRipostes:g.filter(r=>r.branches.find(b=>b.plan==='now').usedRiposte).length,delayedAttackSamples:g.filter(r=>r.branches.find(b=>b.plan==='move-then-attack').attackAttempted).length,delayedRipostes:g.filter(r=>{const b=r.branches.find(b=>b.plan==='move-then-attack');return b.attackAttempted&&b.usedRiposte;}).length}))};
mkdirSync('tools/verification-artifacts',{recursive:true});
writeFileSync(output,gzipSync(JSON.stringify({limitations:['Deterministic production-controller model, not browser combat or human play','Normal enemy and hero stats, native learned skills; no EXP/events/preparations/retreat','Battle entry, committed turns and victory skills use production withRunRandom and update snapshot state','Training snapshots use legal highlands blessings only after at least three encounters','Route blessings are prescribed achievable choices, not measured draft probabilities; offer RNG is not simulated','Policies read current state and visible previews, never future RNG','Paired choices enumerate every reachable initial target: summary compares best branches in hindsight, not policy win rates','Paired choices restore snapshot.runRandomState; different actions may consume different later draws','Full training/choice/sword traces retained for seeds 1 and 2; other samples retain outcomes'],summary,training:training.map(r=>({...r,trace:r.seed<=2?r.trace:undefined})),choices:choices.map(r=>({...r,branches:r.branches.map(b=>({...b,firstAction:b.trace[0],trace:r.seed<=2?b.trace:undefined}))})),routes,swordTraining:swordTraining.map(r=>({...r,trace:r.seed<=2?r.trace:undefined})),swordChoices})));
writeFileSync(`tools/verification-artifacts/r3-gameplay-${tag}-summary.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify({rounds,trainingBattles:training.length,choiceCheckpoints:choices.length,routes:routes.length,swordTrainingBattles:swordTraining.length,choices:summary.choices,swordTraining:summary.swordTraining,output},null,2));

function bestBranch(row,type){return row.branches.filter(b=>b.first===type).sort((a,b)=>Number(b.outcome==='victory')-Number(a.outcome==='victory')||a.turns-b.turns||b.hp-a.hp)[0];}
function better(a,b){return a?.outcome==='victory'&&b?.outcome==='victory'&&(a.turns<b.turns||(a.turns===b.turns&&a.hp>b.hp));}
function observeHp(hero,action){
  let hp=hero.hp,gained=0,lost=0;
  Object.defineProperty(hero,'hp',{configurable:true,enumerable:true,get:()=>hp,set(value){if(value>hp)gained+=value-hp;else lost+=hp-value;hp=value;}});
  try{action();}finally{Object.defineProperty(hero,'hp',{value:hp,writable:true,configurable:true,enumerable:true});}
  return {gained,lost};
}
