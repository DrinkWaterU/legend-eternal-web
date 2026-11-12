import {writeFileSync} from 'node:fs';
import {reviewHarness} from './r3-review-harness.mjs';
import {canReachHighlandTarget} from '../src/core/highlandBattle.js';
import {getEnemyProtectionState} from '../src/core/enemyProtection.js';
const examples={guardAlive:null,guardDefeated:null},trials=[];
for(const index of [2,4,6,8,9,11])for(let seed=1;seed<=60;seed++){
 const h=reviewHarness({level:28,seed,unlocked:true});h.begin(index);const s=h.state,trace=[];
 for(let turn=0;turn<25&&!s.ended;turn++){
  const living=s.enemies.filter(e=>e.hp>0),guard=living.find(e=>e.combatRole==='frontline'&&canReachHighlandTarget(s,e)),rear=living.find(e=>getEnemyProtectionState({enemy:e,enemies:s.enemies}).protected);
  if(guard&&rear&&s.hero.weaponRuntime.impact===3){
   const snapshot=structuredClone(s),guardId=guard.runtimeId;
   const before={turn:s.turn,hp:s.hero.hp,shield:s.hero.shield,target:guard.runtimeId,enemies:living.map(e=>({id:e.runtimeId,name:e.name,hp:e.hp,defense:e.defense,role:e.combatRole,protected:getEnemyProtectionState({enemy:e,enemies:s.enemies}).protected}))};
   s.targetEnemyId=guard.runtimeId;const mark=h.messages.length;h.controller.playTurn('breach-wave');
   const row={index,seed,before,after:{hp:s.hero.hp,enemies:s.enemies.map(e=>({id:e.runtimeId,hp:e.hp,protected:getEnemyProtectionState({enemy:e,enemies:s.enemies}).protected}))},logs:h.messages.slice(mark),prefix:trace};
   const dead=guard.hp<=0;
   if((dead&&!examples.guardDefeated)||(!dead&&!examples.guardAlive)){
    row.branches=[];
    for(const first of ['attack','breach','breach-wave']){
     Object.assign(s,structuredClone(snapshot));s.targetEnemyId=guardId;h.messages.length=0;h.controller.playTurn(first);let n=0;
     while(!s.ended&&n++<90){const reachable=s.enemies.filter(e=>e.hp>0&&canReachHighlandTarget(s,e)).sort((a,b)=>a.hp-b.hp);
      if(!reachable.length){h.controller.playTurn({type:'move',column:1});continue;}
      const target=reachable[0];s.targetEnemyId=target.runtimeId;
      const impact=s.hero.weaponRuntime.impact,canBreach=impact>=2&&!target.weaponBreach&&s.turn+1>(target.breachCooldownUntil??-1);
      const action=first==='breach-wave'&&impact===3&&s.enemies.filter(e=>e.hp>0).length>=2?'breach-wave':canBreach?'breach':'attack';
      const prior=s.turn;h.controller.playTurn(action);if(s.turn===prior&&!s.ended)throw Error('Invalid continuation '+action);
     }
     row.branches.push({first,outcome:s.outcome||'stalled',turns:s.turn-snapshot.turn,hp:s.hero.hp});
    }
   }
   if(dead&&!examples.guardDefeated)examples.guardDefeated=row;if(!dead&&!examples.guardAlive)examples.guardAlive=row;
   trials.push({index,seed,guardDefeated:dead});break;
  }
  const target=guard||living.filter(e=>canReachHighlandTarget(s,e)).sort((a,b)=>b.hp-a.hp)[0];
  if(!target){h.controller.playTurn({type:'move',column:1});trace.push({action:'move',column:1});continue;}
  s.targetEnemyId=target.runtimeId;const hp=target.hp;h.controller.playTurn('attack');trace.push({action:'attack',target:target.name,beforeHp:hp,afterHp:target.hp});
 }
 if(examples.guardAlive&&examples.guardDefeated)break;
}
writeFileSync('tools/verification-artifacts/r4-guard-scenes.json',JSON.stringify({method:'Normal level 28 and native encounter stats; prioritize reachable frontline with ordinary attacks, otherwise attack another reachable target or move into range. Use wave at 3 impact while a rear target is protected; no empty turns.',trials,examples},null,2));
console.log(JSON.stringify({trials:trials.length,guardAlive:!!examples.guardAlive,guardDefeated:!!examples.guardDefeated,examples}));
