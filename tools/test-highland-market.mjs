import assert from 'node:assert/strict';
import { weaponDefinitions } from '../src/data/weapons.js';
import { questDefinitions } from '../src/data/quests.js';
import { materialDefinitions } from '../src/data/materials.js';
import { createDefaultSave } from '../src/core/storage.js';
import { formatQuestObjective } from '../src/core/questRules.js';
import { createQuestRuntime } from '../src/features/quest/questRuntime.js';
import { createTestTransactions } from './save-transaction-test-helper.mjs';
import { installTestDocument } from './dom-test-stub.mjs';
import { createBlacksmithEffectList } from '../src/ui/blacksmithWeaponEffects.js';
import { remakeHarness } from './highland-remake-harness.mjs';
import { getHeroEffectiveAttack } from '../src/core/heroCombat.js';

installTestDocument();
const walk = node => [node,...node.children.flatMap(walk)];
for(const id of ['windbreak-sword','ridgewind-bow','cairn-warhammer','gale-dagger','stormsplit-axe']) {
 const weapon=weaponDefinitions[id], nodes=walk(createBlacksmithEffectList(weapon));
 assert.ok(nodes.some(n=>n.className==='weapon-base-stats' && /攻擊.*1/.test(n.textContent)));
 assert.ok(nodes.some(n=>n.tagName==='details'));
 assert.ok(nodes.some(n=>n.tagName==='p' && n.textContent===weapon.effectText),'Full purchasing rules must be reachable, not just the summary');
}
assert.match(formatQuestObjective(questDefinitions['highlands-signals']),/結繩哨衛 4 隻/);
assert.match(formatQuestObjective(questDefinitions['highlands-bait']),/誤傷同伴/);
const save=createDefaultSave();save.statistics.regions.beach.clears=1;
save.quests.active={questId:'highlands-signals',progress:0,acceptedAtCompletionCount:0};
const tx=createTestTransactions(save), quest=createQuestRuntime({...tx,questDefinitions,materialDefinitions});
assert.equal(quest.recordEnemyDefeated({regionId:'highlands',enemyId:'highland-hound'}),false);
assert.equal(tx.saveStore.current.quests.active.progress,0);
assert.equal(quest.recordEnemyDefeated({regionId:'highlands',enemyId:'highland-signal-keeper'}),true);
assert.equal(tx.saveStore.current.quests.active.progress,1);
const fixed=fn=>{const old=Math.random;Math.random=()=>.99;try{return fn();}finally{Math.random=old;}};
for(const cancelled of [false,true]) for(const debug of [false,true]) {
 const events=[],x=remakeHarness({index:5,configure:()=>({recordTactic:e=>events.push(e)})});
 x.state.hero.highlandShove=1;x.state.debugBuildRun=debug;
 fixed(()=>[{type:'move',column:0},{type:'move',column:1},{type:'move',column:0}].forEach(a=>x.controller.playTurn(a)));
 if(cancelled)x.state.hero.entangle={attempts:0};
 fixed(()=>x.controller.playTurn({type:'shove',column:0}));
 assert.equal(events.filter(e=>e.tactic==='breakRock').length,!cancelled&&!debug?1:0,'Only a real, non-debug rock interruption advances the quest');
}
const archer=remakeHarness({character:'archer',weapon:'ridgewind-bow',index:5});
fixed(()=>archer.controller.playTurn('charge'));
assert.equal(archer.state.hero.skillState.archer.playerAttackCount,0);
const expected=Math.max(1,Math.round(getHeroEffectiveAttack(archer.state.hero)*1.1-archer.state.enemies[0].defense));
fixed(()=>archer.controller.playTurn('attack'));
const packets=archer.messages.filter(m=>m.text?.includes('蓄射追加・集中餘力'));
assert.equal(packets.length,1);assert.ok(packets[0].text.includes(`造成 ${expected} 點傷害`));
assert.equal(archer.state.hero.skillState.archer.playerAttackCount,1,'Concentrated damage cannot charge native shooting counters');
assert.equal(archer.state.hero.weaponRuntime.charge,0);
console.log('Purchasing rules, exact quest targets, real rock-tactic attribution and single-packet charged shooting passed');
