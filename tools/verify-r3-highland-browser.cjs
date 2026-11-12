async (page) => {
  const rows=[];
  async function seedBattle(width,index,{seed=1,unlocked=false,shove=index===6}={}) {
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('http://127.0.0.1:4197/');
    await page.locator('#menuScreen .run-resume-panel').waitFor({state:'attached'});
    await page.evaluate(async ({index,seed,unlocked,shove})=>{
      const {reviewHarness}=await import('/tools/r3-review-harness.mjs');
      const {createDefaultSave}=await import('/src/core/saveDefaults.js');
      const {captureRunSnapshot}=await import('/src/core/runSnapshot.js');
      const h=reviewHarness({level:28,seed,unlocked});if(shove)h.bless('highlands-wind-heal');h.begin(index);
      const save=createDefaultSave();save.settings.musicEnabled=false;save.settings.selectedRegionId='highlands';
      save.statistics.regions.beach.clears=1;save.storyFlags.phoenixBlessingUnlocked=true;
      save.inventory.weapons['cairn-warhammer']=true;save.progression.characters.adventurer.level=28;
      if(unlocked)save.hammerTraining={regions:{highlands:true},unlocked:true};
      save.progression.characters.adventurer.equipment.weaponId='cairn-warhammer';
      save.activeRun=captureRunSnapshot(h.state);if(!save.activeRun)throw new Error('No valid review snapshot');
      localStorage.setItem('legendEternalSave',JSON.stringify(save));
    },{index,seed,unlocked,shove});
    await page.reload();await page.locator('#menuScreen .resume-run-button').click();
  }
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('legendEternalSave')));
  async function action(a){
    if(a.type==='attack')return page.click('#nextButton');
    if(a.column!==undefined){const details=page.locator('#tacticalActions > details');if(!await details.evaluate(e=>e.open))await details.locator(':scope > summary').click();await page.locator(`#tacticalActions [data-tactic-column="${a.column}"]`).click();}
    const selector=`#tacticalActions button[data-preview-only][data-action-type="${a.type}"]`+(a.column===undefined?'':`[data-column="${a.column}"]`);
    await page.locator(selector).click();await page.locator('[data-action-confirm]').click();
  }
  for(const width of [320,390]){
    await seedBattle(width,6);
    const cards=page.locator('#enemyRoster .enemy-card');if(await cards.count()!==3)throw new Error('Expected three native enemies');
    await page.locator('#enemyRoster').focus();await page.keyboard.press('End');
    const third=cards.nth(2),id=await third.getAttribute('data-runtime-id');await third.click();
    if((await read()).activeRun.state.targetEnemyId!==id)throw new Error('Third enemy target mismatch');
    const roster=await page.locator('#enemyRoster').evaluate(e=>({height:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop}));
    await page.locator('#tacticalActions > details > summary').click();
    await page.locator('#tacticalActions [data-tactic-column="1"]').click();
    await page.locator('#tacticalActions [data-preview-only][data-action-type="shove"][data-column="1"]').click();
    const targetName=(await read()).activeRun.state.enemies.find(e=>e.runtimeId===id).name;
    const previewText=await page.locator('.tactical-selection p').innerText();
    if(!previewText.includes(targetName))throw new Error('Target-specific tactical preview did not update');
    await page.locator('.tactical-selection p').evaluate(e=>e.scrollIntoView({block:'start'}));
    const previewUnobstructed=await page.locator('.tactical-selection p').evaluate(e=>{const r=document.createRange();r.setStart(e.firstChild,0);r.setEnd(e.firstChild,1);const b=r.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return e===hit||e.contains(hit);});
    if(!previewUnobstructed){await page.screenshot({path:`tools/verification-artifacts/r3-highland-${width}-preview-before.png`,fullPage:false});throw new Error('First tactical preview character covered by sticky status');}
    const confirm=page.locator('[data-action-confirm]');
    await confirm.scrollIntoViewIfNeeded();
    const unobstructed=await confirm.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit);});
    if(!unobstructed)throw new Error('Tactical confirmation obstructed');
    await page.screenshot({path:`tools/verification-artifacts/r3-highland-${width}-third-target-confirm.png`,fullPage:false});
    const before=(await read()).activeRun.state.turn;await confirm.click();
    if((await read()).activeRun.state.turn!==before+1)throw new Error('Tactical confirmation did not commit');
    rows.push({width,kind:'three-enemy-layout',thirdTarget:id,roster,previewText,previewUnobstructed,confirmationUnobstructed:unobstructed,committed:true});
    await seedBattle(width,2);const trace=[];
    for(let n=0;n<24;n++){
      const save=await read();if(save.hammerTraining.regions.highlands)break;
      const s=save.activeRun?.state;if(!s||s.ended)throw new Error('Training battle ended before combo');
      const choice=await page.evaluate(async()=>{
        const {canReachHighlandTarget}=await import('/src/core/highlandBattle.js');
        const s=JSON.parse(localStorage.getItem('legendEternalSave')).activeRun.state;
        const alive=s.enemies.filter(e=>e.hp>0),reachable=alive.filter(e=>canReachHighlandTarget(s,e));
        const follow=reachable.find(e=>e.runtimeId===s.hammerTrainingBreachTargetId&&e.weaponBreach?.strength===3);
        if(follow)return{target:follow.runtimeId,action:{type:'attack'}};
        const targets=reachable.sort((a,b)=>s.hero.weaponRuntime.impact===3?b.hp-a.hp:a.hp-b.hp);
        if(!targets.length)return{action:{type:'move',column:1}};
        const t=targets[0];return{target:t.runtimeId,action:{type:s.hero.weaponRuntime.impact===3&&!t.weaponBreach?'breach':'attack'}};
      });
      if(choice.target)await page.locator(`#enemyRoster [data-runtime-id="${choice.target}"]`).click();
      await action(choice.action);const after=await read();
      trace.push({turn:s.turn+1,target:choice.target,action:choice.action,hp:after.activeRun?.state.hero.hp,living:after.activeRun?.state.enemies.filter(e=>e.hp>0).length});
    }
    if(!(await read()).hammerTraining.regions.highlands)throw new Error('Natural training combo failed');
    rows.push({width,kind:'normal-stat-training',level:28,index:2,trace});
  }
  await seedBattle(390,6,{seed:3,unlocked:true,shove:false});
  while((await read()).activeRun.state.hero.weaponRuntime.impact<3){
    const a=await page.evaluate(async()=>{const {canReachHighlandTarget}=await import('/src/core/highlandBattle.js');const s=JSON.parse(localStorage.getItem('legendEternalSave')).activeRun.state;const t=s.enemies.filter(e=>e.hp>0&&canReachHighlandTarget(s,e)).sort((a,b)=>a.hp-b.hp)[0];return t?{target:t.runtimeId,action:{type:'attack'}}:{action:{type:'move',column:1}};});
    if(a.target)await page.locator(`#enemyRoster [data-runtime-id="${a.target}"]`).click();await action(a.action);
  }
  const beforeWave=(await read()).activeRun.state;
  if(beforeWave.enemies.filter(e=>e.hp>0).length<2)throw new Error('Wave fixture no longer has two living enemies');
  const power=await page.evaluate(async()=>{const {getHeroEffectiveAttack}=await import('/src/core/heroCombat.js');return getHeroEffectiveAttack(JSON.parse(localStorage.getItem('legendEternalSave')).activeRun.state.hero);});
  await page.locator('#enemyRoster [data-runtime-id="enemy-1"]').click();
  await action({type:'breach-wave'});
  const afterWave=(await read()).activeRun.state;
  const sideBefore=beforeWave.enemies.find(e=>e.runtimeId==='enemy-2'),sideAfter=afterWave.enemies.find(e=>e.runtimeId==='enemy-2');
  if(sideBefore.hp-sideAfter.hp!==Math.max(1,Math.round(power-sideBefore.defense)))throw new Error('Browser wave damage disagrees with the 100% defense-scaled rule');
  if(afterWave.hero.weaponRuntime.impact!==0)throw new Error('Browser wave did not consume impact');
  rows.push({width:390,kind:'normal-stat-wave',index:6,seed:3,power,sideDefense:sideBefore.defense,sideHpBefore:sideBefore.hp,sideHpAfter:sideAfter.hp,impactAfter:afterWave.hero.weaponRuntime.impact});
  return {passed:true,rows};
}
