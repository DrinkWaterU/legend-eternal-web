const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tools/verification-artifacts/early-regions', process.argv[2] || 'before');
const base = 'http://127.0.0.1:4240';
const pause = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = spawn('python', ['-u','tools/dev-server.py','--port','4240'], {cwd:root,windowsHide:true,stdio:'ignore'});
  let browser;
  const results=[];
  try {
    for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await pause(100);}
    browser=await chromium.launch({channel:'msedge',headless:true});
    for(const width of [320,390,1440]) {
      const context=await browser.newContext({viewport:{width,height:width===320?800:width===390?844:900},reducedMotion:'reduce'});
      const page=await context.newPage();page.setDefaultTimeout(10000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      async function ready(){await page.locator('#menuScreen .run-resume-panel').waitFor({state:'attached'});}
      async function resume(){await page.reload();await ready();await page.locator('#menuScreen .resume-run-button').click();}
      async function capture(name){
        await page.waitForFunction(()=>{const e=document.querySelector('#eventTransition');return !e||(!e.classList.contains('is-visible')&&Number(getComputedStyle(e).opacity)===0);});
        await page.evaluate(()=>scrollTo(0,0));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflow`);
        await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});
        results.push({name,width,errors:[...errors]});
      }
      for(const region of ['plains','forest','beach']) {
        await page.goto(base);await ready();
        await page.evaluate(async region=>{
          const {createDefaultSave}=await import('/src/core/saveDefaults.js');
          const s=createDefaultSave();s.settings.musicEnabled=false;s.settings.selectedRegionId=region;
          s.storyFlags.phoenixBlessingUnlocked=true;s.storyFlags.plainsBossStorySeen=true;
          s.progression.characters.adventurer.level=region==='plains'?5:region==='forest'?15:25;
          s.inventory.gold=1000;localStorage.setItem('legendEternalSave',JSON.stringify(s));
        },region);
        await page.reload();await ready();await page.click('#openRegionButton');await page.click('#campStartButton');await capture(`${region}-departure`);
        const prep = { plains:'簡易繃帶', forest:'林地繃帶', beach:'淡水藥布' }[region];
        await page.locator('#regionPreparationChoices button').filter({hasText:prep}).click();await capture(`${region}-preparation`);
        await page.click('#startButton');await capture(`${region}-battle`);
        const original=await page.evaluate(()=>localStorage.getItem('legendEternalSave'));
        await page.evaluate(async region=>{
          const {regionDefinitions}=await import('/src/data/regions/index.js');
          const {blessingPoolDefinitions}=await import('/src/data/blessings/index.js');
          const d=JSON.parse(localStorage.getItem('legendEternalSave')),s=d.activeRun.state;
          s.awaitingBlessing=true;s.blessingChoices=(regionDefinitions[region].blessings||blessingPoolDefinitions[region].blessings).slice(0,3);
          localStorage.setItem('legendEternalSave',JSON.stringify(d));
        },region);await resume();
        if(width<821) {
          await page.evaluate(()=>new Promise(requestAnimationFrame));
          const state=await page.evaluate(()=>{const d=document.querySelector('.blessing-dialog'),h=d.querySelector('.blessing-scroll-hint');const visible=!h.hidden;h.hidden=true;const overflow=d.scrollHeight>d.clientHeight+1;h.hidden=!visible;return {visible,overflow};});
          assert.equal(state.visible,state.overflow,`${region}: scroll hint must reflect actual overflow`);
        }
        await capture(`${region}-blessings`);
        const lastBlessing = page.locator('#blessingChoices button').last();
        await lastBlessing.scrollIntoViewIfNeeded();assert.equal(await lastBlessing.isVisible(),true);await lastBlessing.click();
        await page.evaluate(s=>localStorage.setItem('legendEternalSave',s),original);await resume();
        if(region==='beach') {
          await page.evaluate(async()=>{
            const {createRuntimeEnemyGroup}=await import('/src/core/enemyGroups.js');
            const {buildScaledEnemy}=await import('/src/core/combat.js');
            const {getEnemyDefinition}=await import('/src/data/enemies/index.js');
            const {regionDefinitions}=await import('/src/data/regions/index.js');
            const {getRouteDefinition,getRouteGroup}=await import('/src/data/routes/index.js');
            const d=JSON.parse(localStorage.getItem('legendEternalSave')),s=d.activeRun.state;
            s.activeRouteId='coast-cave';s.battleSource='route';s.routeEncounterIndex=5;s.turn=1;s.log=[];
            s.enemies=createRuntimeEnemyGroup(getRouteGroup(getRouteDefinition('coast-cave'),'cave-support-mix').members.map(m=>({enemy:buildScaledEnemy(getEnemyDefinition(m.enemyId),regionDefinitions.beach,5),statScale:m.statScale,rewardScale:m.rewardScale})));
            s.targetEnemyId=s.enemies[0].runtimeId;localStorage.setItem('legendEternalSave',JSON.stringify(d));
          });await resume();await capture('cave-support');
          assert.match(await page.locator('#enemyRoster').innerText(),/前衛|輔助/);
          assert.match(await page.locator('#enemyRoster').innerText(),/下回合：替前衛防禦 \+3、恢復最大生命 35%/);
          if(width<821) {
            const box=await page.locator('#nextButton').boundingBox();
            assert.ok(box.y+box.height <= (width===320?800:844),`Cave attack outside initial viewport: ${JSON.stringify(box)}`);
            assert.equal(await page.locator('.enemy-list-scroll-hint').isVisible(),true);
            assert.ok(await page.locator('#enemyRoster').evaluate(e=>e.scrollHeight>e.clientHeight));
          }
          async function assertTargetHeading() {
            await page.waitForFunction(() => {
              const list=document.querySelector('#enemyRoster'), mark=list?.querySelector('.enemy-card.is-target .enemy-card-heading');
              if(!mark)return false;const a=list.getBoundingClientRect(),b=mark.getBoundingClientRect();
              return b.top>=a.top-1 && b.bottom<=a.bottom+1;
            });
          }
          await page.locator('#enemyRoster .enemy-card').last().click();await assertTargetHeading();await capture('cave-support-selected');
          await page.locator('#enemyRoster .enemy-card').first().click();await assertTargetHeading();
          await page.locator('#enemyRoster .enemy-card').last().click();await assertTargetHeading();
          await page.evaluate(async()=>{
            const {blessingPoolDefinitions}=await import('/src/data/blessings/index.js');
            const d=JSON.parse(localStorage.getItem('legendEternalSave')),s=d.activeRun.state;
            s.awaitingBlessing=true;s.blessingChoices=blessingPoolDefinitions.cave.blessings.slice(0,3);localStorage.setItem('legendEternalSave',JSON.stringify(d));
          });await resume();await capture('cave-blessings');
          const last=page.locator('#blessingChoices button').last();await last.scrollIntoViewIfNeeded();await last.click();
          const eventBase=await page.evaluate(()=>localStorage.getItem('legendEternalSave'));
          for(const [eventId,choice,kind] of [['cave-rockspring','短暫休息','rest'],['cave-rockspring','撈起完整殼片','gather'],['cave-deep-tide-altar','收手，沿岩壁繞開','leave']]) {
            await page.evaluate(({eventBase,eventId})=>{
              const d=JSON.parse(eventBase),s=d.activeRun.state;
              s.awaitingBlessing=false;s.blessingChoices=[];s.phase='event';s.eventContext={eventId,choiceId:null,battleIndex:0};s.hero.hp=50;
              localStorage.setItem('legendEternalSave',JSON.stringify(d));
            },{eventBase,eventId});
            await resume();await page.locator('#eventChoices button').first().waitFor({state:'visible'});await capture(`cave-event-${kind}`);
            const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('legendEternalSave')));
            await page.locator('#eventChoices button').filter({hasText:choice}).click();
            await page.waitForFunction(()=>JSON.parse(localStorage.getItem('legendEternalSave')).activeRun?.state.eventContext?.result);
            const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('legendEternalSave')));
            if(kind==='rest')assert.equal(after.activeRun.state.hero.hp,50+Math.round(after.activeRun.state.hero.maxHp*.15));
            else assert.equal(after.activeRun.state.hero.hp,50);
            const delta=(after.inventory.materials.cave_shell_fragment?.quantity||0)-(before.inventory.materials.cave_shell_fragment?.quantity||0);
            assert.equal(delta,kind==='gather'?2:0);
            await resume();assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('legendEternalSave')))).inventory.materials.cave_shell_fragment?.quantity||0,after.inventory.materials.cave_shell_fragment?.quantity||0);
          }
        } else if(region==='forest') {
          for(const [idx,label] of [[4,'mid'],[8,'deep'],[13,'heart']]) {
            await page.evaluate(idx=>{const d=JSON.parse(localStorage.getItem('legendEternalSave'));d.activeRun.state.encounterIndex=idx;localStorage.setItem('legendEternalSave',JSON.stringify(d));},idx);
            await resume();assert.equal(await page.evaluate(()=>document.body.dataset.regionDepth),label);await capture(`forest-${label}`);
          }
        }
      }
      assert.deepEqual(errors,[]);await context.close();
    }
    await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(`${results.length} captures, no page errors or overflow`);
  } finally {if(browser)await browser.close();if(server.exitCode===null){server.kill();await once(server,'exit');}}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
