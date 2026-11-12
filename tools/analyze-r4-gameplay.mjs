// Paired policy review: both policies can use breach; only one can use wave.
// Uses current visible state and forecasts, never future random outcomes.
// Usage: node tools/analyze-r4-gameplay.mjs [rounds=12] [ratioTag=100] [--name=<suffix>] [--overwrite]
// ratioTag is the expected wave ratio in percent. The tool reads the actual ratio from
// runWeaponAttack and stops before simulating or writing when the two differ.
// Existing outputs are never replaced unless --overwrite is given.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { reviewHarness } from './r3-review-harness.mjs';
import { withRunRandom } from '../src/core/runSnapshot.js';
import { canReachHighlandTarget, highlandActions } from '../src/core/highlandBattle.js';
import { previewHighlandTurn } from '../src/core/highlandPreview.js';
import { getHeroEffectiveAttack } from '../src/core/heroCombat.js';
import { getEnemyProtectionState } from '../src/core/enemyProtection.js';
import { runWeaponAttack } from '../src/core/weaponTechniques.js';
import { estimateBreachBonusPerHit, estimatePacket, estimatePrimaryHit, estimateWave } from './r4-policy-damage.mjs';

const cliArgs=process.argv.slice(2);
const positional=cliArgs.filter(a=>!a.startsWith('--'));
const flagValue=name=>cliArgs.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const fail=message=>{console.error(`analyze-r4-gameplay: ${message}`);process.exit(1);};
const unknownFlags=cliArgs.filter(a=>a.startsWith('--')&&a!=='--overwrite'&&!a.startsWith('--name='));
if(unknownFlags.length)fail(`unknown option ${unknownFlags.join(' ')}`);
const rounds=Number(positional[0])||12;
const tag=positional[1]||'100';
if(!/^\d+$/.test(tag))fail(`ratio tag must be an integer percent such as 45 or 100, got "${tag}"`);
const nameSuffix=flagValue('name');
if(nameSuffix!==undefined&&!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(nameSuffix))fail(`--name must use letters, digits, ".", "_" or "-", got "${nameSuffix}"`);
const waveRatio=Number(runWeaponAttack.toString().match(/packet\(enemy, power \* ([.\d]+), "震岩裂陣"\)/)?.[1]);
const expectedRatio=Number(tag)/100;
if(!Number.isFinite(waveRatio))fail('cannot read the 震岩裂陣 ratio from runWeaponAttack; update the parser before running');
if(Math.abs(waveRatio-expectedRatio)>1e-9)fail(`ratio tag ${tag} expects ${expectedRatio}, but the loaded source uses ${waveRatio}. Nothing was written. Use tools/r4-reproduce-source.mjs for another ratio.`);
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outputDir=path.join(projectRoot,'tools','verification-artifacts');
const outputBase=`r4-paired-${tag}${nameSuffix?`-${nameSuffix}`:''}`;
const outputFiles=[path.join(outputDir,`${outputBase}.json.gz`),path.join(outputDir,`${outputBase}-summary.json`)];
const existingOutputs=outputFiles.filter(f=>existsSync(f));
if(existingOutputs.length&&!cliArgs.includes('--overwrite'))fail(`refusing to replace ${existingOutputs.map(f=>path.relative(projectRoot,f)).join(', ')}. Nothing was written. Use --name=<suffix> for a new output, or --overwrite after backing up.`);
const sha256=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const git=(...a)=>{try{return execFileSync('git',a,{cwd:projectRoot,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return null;}};
const gitHead=git('rev-parse','HEAD');
const source={
 label:process.env.R4_SOURCE_LABEL||'working-tree',
 patch:process.env.R4_SOURCE_PATCH||null,
 baseGitHead:process.env.R4_SOURCE_BASE_HEAD||gitHead,
 baseWorkingTreeDirty:process.env.R4_SOURCE_BASE_DIRTY?process.env.R4_SOURCE_BASE_DIRTY==='true':gitHead?git('status','--porcelain')!=='':null,
 waveRatio,
 weaponTechniquesSha256:sha256(path.join(projectRoot,'src','core','weaponTechniques.js')),
 analyzerSha256:sha256(fileURLToPath(import.meta.url)),
 policyDamageSha256:sha256(path.join(projectRoot,'tools','r4-policy-damage.mjs'))
};
const alive=s=>s.enemies.filter(e=>e.hp>0);
const sequence={none:[],sustain:['highlands-rations','highlands-cairn','highlands-move-shield','highlands-shelter-heal','highlands-guard-shield','highlands-rations','highlands-calm-eye','highlands-border','highlands-rations','highlands-wind-step','highlands-rations']};
function policy(s,allowWave){
 const enemies=alive(s),reachable=enemies.filter(e=>canReachHighlandTarget(s,e));
 const power=getHeroEffectiveAttack(s.hero), candidates=[{type:'guard'}];
 if(s.highlandBattle)candidates.push(...highlandActions(s).filter(a=>!['slip','tool-step'].includes(a.type)));
 for(const e of reachable){
  candidates.push({type:'attack',target:e.runtimeId});
  const impact=s.hero.weaponRuntime.impact;
  if(impact>0&&!e.weaponBreach&&s.turn+1>(e.breachCooldownUntil??-1))candidates.push({type:'breach',target:e.runtimeId});
  if(allowWave&&impact===3&&enemies.length>=2)candidates.push({type:'breach-wave',target:e.runtimeId});
 }
 if(!s.highlandBattle&&!reachable.length)throw Error('No reachable target');
 let best=null;
 for(const action of candidates){
  const e=enemies.find(x=>x.runtimeId===action.target);s.targetEnemyId=action.target||reachable[0]?.runtimeId||enemies[0].runtimeId;
  const p=s.highlandBattle?previewHighlandTurn(s,action):null;
  const incoming=(p?(p.threats||[]).filter(Boolean).reduce((v,i)=>{const enemy=enemies.find(x=>x.runtimeId===i.id);return v+(enemy?Math.max(1,enemy.attack*(i.attackRatio||1)-s.hero.defense)*(i.kind==='flurry'?2:1):0);},0):enemies.reduce((v,e)=>v+Math.max(1,e.attack-s.hero.defense),0))*(action.type==='guard'?.65:1);
  // R5-01: every direct-damage estimate uses the formal rounding, guard and remaining-HP rules.
  const hit=e?estimatePrimaryHit({power,enemy:e,enemies}):0;
  let value=e?Math.min(e.hp,hit):0;
  if(e&&e.hp<=hit)value+=e.attack*.8;
  if(action.type==='breach'){
   const impact=s.hero.weaponRuntime.impact,left=Math.max(0,e.hp-hit);
   const extra=Math.min(left,estimatePacket({amount:power*impact*.2,enemy:e,enemies}));
   value+=extra;
   if(left>0&&left<=extra)value+=e.attack*.8;
   const remaining=left-extra;
   if(remaining>0)value+=Math.min(remaining,estimateBreachBonusPerHit({power,enemy:e,enemies,strength:impact})*(impact===3?2:1))*.65;
   if(impact<3&&remaining>0)value-=8;
  }
  if(action.type==='breach-wave')for(const {damage,killed,enemy:other} of estimateWave({power,ratio:waveRatio,target:e,hit,enemies})){
   value+=damage;if(killed)value+=other.attack*.8;
  }
  value+=(p?.collateral||[]).reduce((n,x)=>n+x.damage*.65,0)-incoming*(s.highlandBattle?.9:.4);
  if(action.type==='guard'&&s.lastPlayerAction==='guard')value-=power*2;
  if(action.type==='move'&&!reachable.length&&action.column===1)value+=power;
  if(action.type==='move'&&(s.highlandBattle?.moveShieldUses||0)<2)value+=s.hero.highlandMoveShield||0;
  if(!best||value>best.score)best={...action,score:value,incoming};
 }
 s.targetEnemyId=best.target||reachable[0]?.runtimeId||enemies[0].runtimeId;
 return best;
}
function run({seed,path,build,mode}){
 const h=reviewHarness({level:28,seed,path,unlocked:true});let turns=0;const actions={},encounters=[],decisions=[];
 for(let index=0;index<12;index++){
  const entryMark=h.messages.length;h.begin(index);const s=h.state,startHp=s.hero.hp,startShield=s.hero.shield,entryLogs=h.messages.slice(entryMark);let count=0;
  while(!s.ended&&count++<90){
   const noWave=policy(s,false),withWave=mode==='wave'?policy(s,true):noWave;
   let selected=withWave;
   if(mode==='attack'){const t=alive(s).filter(e=>canReachHighlandTarget(s,e)).sort((a,b)=>a.hp-b.hp)[0];selected=t?{type:'attack',target:t.runtimeId,incoming:null}:{type:'move',column:1,incoming:null};}
   s.targetEnemyId=selected.target||s.targetEnemyId;
   const before={turn:s.turn,hp:s.hero.hp,shield:s.hero.shield,impact:s.hero.weaponRuntime.impact,wind:s.highlandBattle?.pattern[s.turn%s.highlandBattle.pattern.length],enemies:alive(s).map(e=>({id:e.runtimeId,name:e.name,hp:e.hp,defense:e.defense,role:e.combatRole,formation:e.formationId,protected:getEnemyProtectionState({enemy:e,enemies:s.enemies}).protected}))};
   const mark=h.messages.length;h.controller.playTurn(selected);
   if(s.turn<=before.turn&&!s.ended)throw Error('Illegal policy action '+JSON.stringify(selected));
   actions[selected.type]=(actions[selected.type]||0)+1;
   if(build==='sustain'||selected.type==='breach-wave'||selected.incoming>0)decisions.push({index,before,selected,noWave,after:{hp:s.hero.hp,shield:s.hero.shield,enemies:alive(s).map(e=>({id:e.runtimeId,hp:e.hp}))},logs:h.messages.slice(mark)});
  }
  turns+=s.turn;const combatEndHp=s.hero.hp;
  if(s.outcome==='victory')withRunRandom(s,()=>{h.skills.applyVictorySkills();h.skills.consumeBattleLimitedEffects();});
  encounters.push({index,outcome:s.outcome,turns:s.turn,startHp,startShield,entryLogs,combatEndHp,endHp:s.hero.hp,victoryHeal:s.hero.hp-combatEndHp,blessingAfter:sequence[build][index]||null});
  if(s.outcome!=='victory')break;
  if(sequence[build][index])h.bless(sequence[build][index]);
 }
 return {seed,path,build,mode,outcome:h.state.outcome||'stalled',won:encounters.length===12&&h.state.outcome==='victory',reached:encounters.length,turns,endHp:h.state.hero.hp,maxHp:h.state.hero.maxHp,actions,encounters,decisions};
}
const rows=[];
for(const build of ['none','sustain'])for(const path of ['shelter','gale'])for(let seed=1;seed<=rounds;seed++)for(const mode of ['attack','breach','wave'])rows.push(run({seed,path,build,mode}));
function category(a,b){const dt=b.turns-a.turns,dh=b.endHp-a.endHp;return a.outcome==='stalled'||b.outcome==='stalled'?'stalled':a.won!==b.won?(b.won?'wave-only-win':'breach-only-win'):!a.won?'both-defeat':dt===0&&dh===0?'equal':dt<=0&&dh>=0?'wave-dominates':dt>=0&&dh<=0?'breach-dominates':dt>0&&dh>0?'wave-slower-safer':'wave-faster-riskier';}
const pairs=[];
for(const a of rows.filter(r=>r.mode==='breach')){
 const b=rows.find(r=>r.mode==='wave'&&r.seed===a.seed&&r.path===a.path&&r.build===a.build);
 pairs.push({seed:a.seed,path:a.path,build:a.build,category:category(a,b),breach:{won:a.won,reached:a.reached,turns:a.turns,endHp:a.endHp,actions:a.actions},wave:{won:b.won,reached:b.reached,turns:b.turns,endHp:b.endHp,actions:b.actions}});
}
function scene(region,index,option,seed,allowWave,build){
 const blessings=build==='legal'?['beach-tide-whetstone','beach-reef-shell','beach-tide-scavenger','beach-tide-counter']:[];
 const h=reviewHarness({region,level:28,seed,unlocked:true,blessings});h.begin(index,option);const s=h.state;
 const opening=alive(s).map(e=>({id:e.runtimeId,name:e.name,hp:e.hp,defense:e.defense,role:e.combatRole,formation:e.formationId})),trace=[],counts={};
 while(!s.ended&&trace.length<90){const a=policy(s,allowWave);s.targetEnemyId=a.target||s.targetEnemyId;const before={turn:s.turn,hp:s.hero.hp,shield:s.hero.shield,impact:s.hero.weaponRuntime.impact,enemies:alive(s).map(e=>({id:e.runtimeId,hp:e.hp,defense:e.defense,role:e.combatRole,protected:getEnemyProtectionState({enemy:e,enemies:s.enemies}).protected}))};const mark=h.messages.length;h.controller.playTurn(a);if(s.turn<=before.turn&&!s.ended)throw Error('Invalid scene action');counts[a.type]=(counts[a.type]||0)+1;trace.push({before,action:a,after:{hp:s.hero.hp,shield:s.hero.shield,enemies:alive(s).map(e=>({id:e.runtimeId,hp:e.hp}))},logs:h.messages.slice(mark)});}
 return {region,index,option,seed,build,blessings,mode:allowWave?'wave':'breach',opening,outcome:s.outcome||'stalled',won:s.outcome==='victory',turns:s.turn,endHp:s.hero.hp,actions:counts,trace};
}
const scenes=[];
for(const [region,index,option] of [['highlands',0,0],['highlands',2,0],['highlands',6,0],['highlands',8,0],['highlands',5,0],['beach',9,1],['beach',9,2],['beach',15,0]])for(const build of region==='beach'?['none','legal']:['none'])for(let seed=1;seed<=rounds;seed++)for(const allow of [false,true])scenes.push(scene(region,index,option,seed,allow,build));
const scenePairs=[];
for(const a of scenes.filter(r=>r.mode==='breach')){const b=scenes.find(r=>r.mode==='wave'&&r.region===a.region&&r.index===a.index&&r.option===a.option&&r.seed===a.seed&&r.build===a.build);scenePairs.push({region:a.region,index:a.index,option:a.option,seed:a.seed,build:a.build,opening:a.opening,category:category(a,b),breach:{won:a.won,turns:a.turns,endHp:a.endHp,actions:a.actions},wave:{won:b.won,turns:b.turns,endHp:b.endHp,actions:b.actions}});}
const categories=Object.fromEntries([...new Set(pairs.map(p=>p.category))].map(k=>[k,pairs.filter(p=>p.category===k).length]));
mkdirSync(outputDir,{recursive:true});
writeFileSync(outputFiles[0],gzipSync(JSON.stringify({waveRatio,source,limitations:['Fixed level 28; no EXP, events, preparations or retreat','Prescribed legal blessing sequence, no draft probabilities','Both policies use identical scoring and can use breach; one also considers wave','Identical initial seed; actions may consume different random draws','Heuristic scoring is not human play or optimal strategy'],rounds,rows,pairs,categories,scenes,scenePairs})));
writeFileSync(outputFiles[1],JSON.stringify({waveRatio,source,rounds,categories,pairs,scenePairs},null,2));
console.log(JSON.stringify({waveRatio,source,outputs:outputFiles.map(f=>path.relative(projectRoot,f)),rounds,categories,pairs:pairs.length,breachUses:rows.reduce((n,r)=>n+(r.actions.breach||0),0),waveUses:rows.reduce((n,r)=>n+(r.actions['breach-wave']||0),0)}));
