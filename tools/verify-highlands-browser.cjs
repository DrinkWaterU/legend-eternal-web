const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'verification-artifacts/highlands');
const port = Number(process.env.GAME_TEST_PORT || 4196);
const base = `http://127.0.0.1:${port}`;
const pause = ms => new Promise(r => setTimeout(r, ms));
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')));
const results = [];
async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = spawn('python', ['-u', 'tools/dev-server.py', '--port', String(port)], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = "";
  for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { serverLog = (serverLog + chunk).slice(-6000); });
  let browser;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch {} await pause(100); }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of (process.env.GAME_TEST_WIDTHS || '320,390,1440').split(',').map(Number)) {
      const height = width === 320 ? 800 : width === 390 ? 844 : 900;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width < 960, isMobile: width < 960 });
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      const errors = [];
      const networkErrors = [];
      page.on('console', message => { if (message.type() === 'error') networkErrors.push(message.text()); });
      page.on('requestfailed', request => networkErrors.push({ path: new URL(request.url()).pathname, failure: request.failure() }));
      let capturedEventChoices = false;
      let capturedThreeEnemies = false;
      page.on('pageerror', error => errors.push(error.message));
      async function ready() { await page.locator('#menuScreen .run-resume-panel').waitFor({ state: 'attached' }); }
      async function capture(name) {
        await page.waitForFunction(() => {
          const transition = document.querySelector('#eventTransition');
          return !transition || (!transition.classList.contains('is-visible') && Number(getComputedStyle(transition).opacity) === 0);
        });
        await page.evaluate(() => scrollTo(0, 0));
        if (/battle|critical|three-enemies|full-build-actions|wind-intro/.test(name) && await page.locator('#nextButton').isVisible()) {
          const attack = await page.locator('#nextButton').boundingBox();
          assert.ok(attack.height >= 44 && attack.y + attack.height <= height, `${name}: action outside first viewport ${JSON.stringify(attack)}`);
        }
        const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && e.getBoundingClientRect().width > 0).map(e => ({tag:e.tagName,id:e.id,cls:e.className,width:e.getBoundingClientRect().width,min:getComputedStyle(e).minWidth})).slice(-20));
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) console.error(JSON.stringify({name,width,overflow}));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
      }
      async function check(name, action) {
        if (process.env.GAME_TEST_SCENARIOS && !process.env.GAME_TEST_SCENARIOS.split(",").includes(name)) return;
        await action(); assert.deepEqual(errors, []);
        results.push({ width, name, status: 'PASS' }); console.log(`PASS ${name} ${width}`);
        await fs.writeFile(path.join(output, process.env.GAME_TEST_RESULTS || 'browser-results.json'), JSON.stringify(results, null, 2));
      }
      async function seed(unlocked) {
        await page.goto(base); await ready();
        await page.evaluate(async unlocked => {
          const { createDefaultSave } = await import('/src/core/saveDefaults.js');
          const { materialDefinitions } = await import('/src/data/materials.js');
          const data = createDefaultSave(); data.settings.musicEnabled = false;
          data.settings.selectedRegionId = 'highlands';
          data.settings.currentSafeAreaId = 'anping-town';
          data.progression.safeAreas['anping-town'] = { unlocked: true, unlockedAt: new Date().toISOString(), visitedAt: new Date().toISOString() };
          data.storyFlags.phoenixBlessingUnlocked = true; data.storyFlags.plainsBossStorySeen = true;
          for (const flag of ['metAnpingBlacksmith', 'knowsAnpingBlacksmithName', 'metAnpingGuildReceptionist', 'knowsAnpingGuildReceptionistName', 'registeredAtAnpingGuild', 'guildQuestIntroductionSeen']) data.storyFlags[flag] = true;
          data.statistics.regions.beach.clears = unlocked ? 1 : 0;
          data.quests.board.questIds = ['highlands-patrol', 'highlands-signals', 'highlands-survey', 'highlands-supplies'];
          if (unlocked) data.quests.active = { questId: 'highlands-survey', progress: 0, acceptedAtCompletionCount: 0 };
          data.progression.characters.adventurer.level = 30;
          data.inventory.gold = 5000;
          for (const id of Object.keys(materialDefinitions)) data.inventory.materials[id] = { quantity: 30 };
          localStorage.setItem('legendEternalSave', JSON.stringify(data));
        }, unlocked);
        await page.reload(); await ready();
      }
      async function resume() { await page.reload(); await ready(); await page.locator('#menuScreen .resume-run-button').click(); }
      async function advanceUntil(condition) {
        for (let i = 0; i < 700; i++) {
          if (!capturedThreeEnemies && await page.locator('#nextButton').isVisible()) {
            const state = (await save(page)).activeRun?.state;
            if (state?.encounterIndex >= 6 && state?.enemies?.filter(enemy => enemy.hp > 0).length === 3) {
              await capture('summit-three-enemies'); capturedThreeEnemies = true;
            }
          }
          if (await condition()) return;
          if (await page.locator('.highland-path-choice:visible').count()) await page.locator('.highland-path-choice:visible').first().click();
          else if (await page.locator('#blessingPanel').isVisible()) await page.locator('#blessingChoices button').first().click();
          else if (await page.locator('#eventLayout').isVisible() && await page.locator('#eventChoices button:visible').count()) {
            if (!capturedEventChoices) { await capture('event-choices'); capturedEventChoices = true; }
            await page.locator('#eventChoices button:visible').first().click();
          }
          else if (await page.locator('#eventContinueButton').isVisible()) await page.click('#eventContinueButton');
          else if (await page.locator('#continueButton').isVisible()) await page.click('#continueButton');
          else if (await page.locator('#nextButton').isVisible()) {
            if (await page.locator('#nextButton').isEnabled()) await page.click('#nextButton');
            else { if (!await page.locator("#tacticalActions > details").evaluate(e => e.open)) await page.locator("#tacticalActions > details > summary").click(); await page.locator('#tacticalActions [data-tactic-column="1"]').click(); await page.locator('#tacticalActions button[data-preview-only][data-action-type=move][data-column="1"]').click(); await page.locator('[data-action-confirm]').click(); }
          }
          else if (await page.locator('#endPanel').isVisible()) throw new Error('Unexpected terminal result');
          else await pause(30);
        }
        throw new Error('Traversal exceeded 700 actions');
      }
      try {
        await check('locked-entry', async () => {
          await seed(false); await page.click('#openRegionButton'); await page.click('#campStartButton');
          assert.equal(await page.locator('#startButton').isDisabled(), true);
          assert.match(await page.locator('#regionStartNotice').textContent(), /完整通關海岸/);
          await capture('locked');
        });
        await check('departure-and-natural-guard', async () => {
          await seed(true); await page.click('#openRegionButton'); await page.click('#campRegionButton');
          await capture('regions');
          await page.locator('#regionChoiceList button').filter({ hasText: '斷風高地' }).click();
          await capture('departure');
          await page.click('#startButton');
          assert.equal((await save(page)).activeRun.state.activeRouteId, 'windbreak-ascent');
          await page.locator('.highland-path-choice').first().click();
          await page.click('#guardButton');
          assert.match(await page.locator('#battleLog').textContent(), /守勢/);
          await capture('outer-battle');
          const before = await save(page); await resume();
          assert.deepEqual((await save(page)).activeRun, before.activeRun);
        });
        await check('synthetic-route-events-and-ending', async () => {
          // High stats only accelerate traversal; balance is tested separately
          // using unboosted characters and production turn-controller models.
          await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('legendEternalSave'));
            Object.assign(data.activeRun.state.hero, { hp: 100000, maxHp: 100000, attack: 9999 });
            localStorage.setItem('legendEternalSave', JSON.stringify(data));
          }); await resume();
          await advanceUntil(() => page.locator('#eventLayout').isVisible());
          await capture('event');
          const event = (await save(page)).activeRun.state.eventContext;
          await resume(); assert.deepEqual((await save(page)).activeRun.state.eventContext, event);
          await advanceUntil(async () => (await save(page)).activeRun?.state.encounterIndex >= 6 && await page.locator('#nextButton').isVisible());
          await capture('summit-battle');
          const snapshot = await save(page);
          await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('legendEternalSave')); d.activeRun.state.hero.hp = 1;
            localStorage.setItem('legendEternalSave', JSON.stringify(d));
          }); await resume(); await capture('summit-critical');
          await page.evaluate(d => localStorage.setItem('legendEternalSave', JSON.stringify(d)), snapshot); await resume();
          await advanceUntil(async () => (await save(page)).activeRun?.state.phase === 'routeEnding');
          await capture('ending');
          const endState=(await save(page)).activeRun.state;
          assert.deepEqual(Object.keys(endState.highlandChoices),['0','4','8']);
          assert.equal(new Set(endState.runEventRecords.map(e=>e.eventId)).size,2,'Exactly two distinct exploration events must complete');
          assert.ok(capturedThreeEnemies, 'Must inspect three-enemy summit layout');
          const before = await save(page); await resume();
          assert.deepEqual((await save(page)).inventory, before.inventory);
          await page.click('#eventContinueButton');
          const finished = await save(page);
          assert.equal(finished.activeRun, null);
          assert.equal(finished.statistics.regions.highlands.clears, 1);
          assert.equal(finished.quests.active.progress, 1);
          await page.reload(); await ready();
          assert.equal((await save(page)).statistics.regions.highlands.clears, 1);
        });
        await check('highlands-guild-report', async () => {
          await page.click('#openRegionButton'); await page.click('#campPlacesButton');
          await page.locator('#facilityList button').filter({ hasText: /瑟琳|公會接待員/ }).click();
          await page.locator('#dialogueChoices button').filter({ hasText: '查看公會委託' }).click();
          await capture('guild-quest');
          const before = await save(page);
          await page.getByRole('button', { name: '回報委託', exact: true }).click();
          const after = await save(page);
          assert.equal(after.quests.active, null);
          assert.equal(after.inventory.gold, before.inventory.gold + 75);
          assert.equal(after.quests.completions['highlands-survey'].count, 1);
        });
        await check('blacksmith-new-weapons', async () => {
          await seed(true); await page.click('#openRegionButton'); await page.click('#campPlacesButton');
          await page.locator('#facilityList button').filter({ hasText: /羅根|鐵匠/ }).click();
          const choice = page.locator('#dialogueChoices button').filter({ hasText: /鍛造|打造/ }).first();
          await choice.click();
          await page.locator('#blacksmithWeaponList button').filter({ hasText: '斷風守隘劍' }).click();
          await capture('blacksmith');
          await page.click('#blacksmithCraftButton'); await page.click('#confirmBlacksmithCraftButton');
          assert.ok((await save(page)).inventory.weapons['windbreak-sword']);
          for (const [id, name] of [['windbreak-sword', '斷風守隘劍'], ['ridgewind-bow', '脊風獵弓'], ['cairn-warhammer', '鎮隘岩鎚'], ['gale-dagger', '掠風短刃'], ['stormsplit-axe', '破隘長斧']]) {
            await page.locator('#blacksmithWeaponList button').filter({ hasText: name }).screenshot({ path: path.join(output, `weapon-card-${id}-${width}.png`) });
          }
          await page.reload(); await ready(); await page.click('#openCharacterButton');
          await page.locator('#characterChoiceList [data-character-id="adventurer"]').click();
          await page.click('#openCharacterEquipmentButton');
          await page.locator('#equipmentWeaponGrid button').filter({ hasText: '斷風守隘劍' }).click();
          await page.click('#equipWeaponButton');
          assert.equal((await save(page)).progression.characters.adventurer.equipment.weaponId, 'windbreak-sword');
          await capture('equipment');
        });
        await check('wind-danger-and-preview', async () => {
          await seed(true); await page.click('#openRegionButton'); await page.click('#campStartButton');
          await page.click('#startButton'); await page.locator('.highland-path-choice').first().click();
          await capture('wind-intro');
          const original = await save(page);
          await page.getByRole('button',{name:'看守勢後',exact:true}).click();
          assert.equal(await page.getByRole('button',{name:'看守勢後',exact:true}).getAttribute('aria-pressed'),'true');
          assert.match(await page.locator('.highland-preview-label').innerText(),/守勢/);
          assert.match(await page.locator('.highland-forecast').innerText(),/仍會吃到/);
          assert.deepEqual((await save(page)).activeRun,original.activeRun,'Preview must not spend a turn or random draw');
          await page.getByRole('button',{name:'看攻擊後',exact:true}).click();
          assert.match(await page.locator('.highland-forecast').innerText(),/風剛好/);
          await page.click('#nextButton');
          assert.equal((await save(page)).activeRun.state.hero.hp,original.activeRun.state.hero.hp);
          async function controlled(mode) {
            await page.evaluate(({original,mode})=>{
              const d=structuredClone(original),s=d.activeRun.state,b=s.highlandBattle,e=s.enemies[0];
              s.encounterIndex=s.routeEncounterIndex=2;s.turn=0;s.hero.battleColumn=mode==='rock'?0:1;s.hero.shield=0;
              e.hp=e.maxHp;e.attack=30;e.battleColumn=1;
              b.rocks=mode==='rock'?[2,0,0]:[0,0,0];b.pattern=[1];b.intentTurn=0;
              b.intents=mode==='tracking'?[{id:e.runtimeId,kind:'track',range:2,text:'◎ 盯著你打：會追人'}]:[{id:e.runtimeId,kind:'strike',columns:[mode==='rock'?0:2],attackRatio:1,friendly:false,text:'⚔ 打這裡，不追人'}];
              localStorage.setItem('legendEternalSave',JSON.stringify(d));
            },{original,mode});await resume();
          }
          await controlled('intercept');await capture('wind-danger');
          assert.match(await page.locator('.highland-forecast').innerText(),/仍會吃到/);
          await page.getByRole('button',{name:'看守勢後',exact:true}).click();
          assert.match(await page.locator('.highland-forecast').innerText(),/能避開/);
          await capture('wind-guard-preview');
          await controlled('rock');await capture('wind-rock-trap');
          assert.match(await page.locator('.highland-forecast').innerText(),/岩石擋住/);
          await page.locator('#tacticalActions > details > summary').click();
          await page.locator('#tacticalActions [data-tactic-column="0"]').click();
          await page.locator('#tacticalActions [data-preview-only][data-action-type="break"][data-column="0"]').click();
          assert.match(await page.locator('.highland-forecast').innerText(),/能避開/);
          await capture('wind-break-preview');
          const rockBefore=await save(page);await page.locator('#tacticalActions [data-preview-only][data-action-type="break"][data-column="0"]').click();
          assert.deepEqual((await save(page)).activeRun,rockBefore.activeRun,'Selecting a terrain action only previews it');
          await page.locator('[data-action-confirm]').click();
          assert.equal((await save(page)).activeRun.state.hero.hp,rockBefore.activeRun.state.hero.hp);
          await controlled('tracking');await capture('wind-tracking');
          assert.match(await page.locator('.highland-forecast').innerText(),/盯著你追/);
          const trackedHp=(await save(page)).activeRun.state.hero.hp;await page.click('#nextButton');
          assert.ok((await save(page)).activeRun.state.hero.hp<trackedHp);
        });
        await check('production-blessings-and-full-build', async () => {
          await seed(true); await page.click('#openRegionButton'); await page.click('#campStartButton');
          await page.click('#startButton'); await capture('path-choice'); await page.locator('.highland-path-choice').first().click();
          await page.evaluate(async () => {
            const { highlandsRegion } = await import('/src/data/regions/highlands.js');
            const { applyBlessingEffects } = await import('/src/core/blessings.js');
            const { createRunPreparation } = await import('/src/core/preparations.js');
            const d = JSON.parse(localStorage.getItem('legendEternalSave'));
            for (const b of highlandsRegion.blessings) applyBlessingEffects(d.activeRun.state.hero,b);
            d.activeRun.state.runPreparation = createRunPreparation(highlandsRegion, 'ridge-whetstone', {enhanced:true});
            localStorage.setItem('legendEternalSave',JSON.stringify(d));
          }); await resume(); await page.locator('#tacticalActions > details > summary').click(); await capture('full-build-actions');
          const cardHeights={};
          for (let offset=0;offset<18;offset+=3) {
            await page.evaluate(async offset => {
              const { highlandsRegion } = await import('/src/data/regions/highlands.js');
              const d=JSON.parse(localStorage.getItem('legendEternalSave')); const s=d.activeRun.state;
              s.awaitingBlessing=true; s.blessingChoices=highlandsRegion.blessings.slice(offset,offset+3);
              localStorage.setItem('legendEternalSave',JSON.stringify(d));
            },offset); await resume();
            assert.equal(await page.locator('#blessingChoices .blessing-card').count(),3);
            assert.equal(await page.locator('#blessingChoices .blessing-card em').count(),0,'No duplicated blue flavor layer');
            for (const c of await page.locator('#blessingChoices .blessing-card').evaluateAll(cards=>cards.map(c=>({name:c.querySelector('.blessing-heading strong').textContent,height:c.getBoundingClientRect().height,children:c.children.length,dy:Math.abs(c.querySelector('.blessing-heading strong').getBoundingClientRect().y-c.querySelector('.blessing-heading i').getBoundingClientRect().y)})))) {
              assert.equal(c.children,3,'Only header(name+rarity), story and effect');assert.ok(c.dy<=8,'Name and rarity share a row');cardHeights[c.name]=c.height;
            }
            await capture(`blessings-${offset/3+1}`);
            await page.locator('#blessingPanel .blessing-dialog').evaluate(e => { e.scrollTop=e.scrollHeight; });
            await capture(`blessings-${offset/3+1}-bottom`);
          }
          assert.ok(cardHeights['乾糧分配']<cardHeights['留步借勢'],'Short blessings must not inherit a fixed tall card');
          await page.evaluate(async()=>{
            const { highlandsRegion } = await import('/src/data/regions/highlands.js');
            const d=JSON.parse(localStorage.getItem('legendEternalSave')),s=d.activeRun.state;
            s.awaitingBlessing=false;s.blessingChoices=[];s.hero.blessings=highlandsRegion.blessings.map(b=>b.name);
            localStorage.setItem('legendEternalSave',JSON.stringify(d));
          });await resume();await page.click('#viewBlessingsButton');
          assert.equal(await page.locator('#blessingInfoList .blessing-info-card').count(),18);
          for(const c of await page.locator('#blessingInfoList .blessing-info-card').evaluateAll(cards=>cards.map(c=>({children:c.children.length,names:c.querySelectorAll('strong').length,stories:c.querySelectorAll('.blessing-info-story').length,flavors:c.querySelectorAll('em').length})))) {
            assert.deepEqual(c,{children:3,names:1,stories:1,flavors:0});
          }
          await capture('owned-blessings');
          for(const dy of await page.locator('#blessingInfoList .blessing-info-card').evaluateAll(cards=>cards.map(c=>Math.abs(c.querySelector('strong').getBoundingClientRect().y-c.querySelector('.blessing-info-rarity-tag').getBoundingClientRect().y)))) assert.ok(dy<=8,'Owned blessing name and rarity share a row');
          await page.locator('#blessingInfoPanel .combat-info-body').evaluate(e=>{e.scrollTop=e.scrollHeight;});
          await capture('owned-blessings-bottom');
        });
        await check('touch-tactics-and-interrupt', async () => {
          await seed(true);await page.click('#openRegionButton');await page.click('#campStartButton');await page.click('#startButton');await page.locator('.highland-path-choice').first().click();
          await page.evaluate(async()=>{
            const { highlandsRegion }=await import('/src/data/regions/highlands.js');
            const { applyBlessingEffects }=await import('/src/core/blessings.js');
            const { createRunPreparation }=await import('/src/core/preparations.js');
            const d=JSON.parse(localStorage.getItem('legendEternalSave')),s=d.activeRun.state;
            for(const b of highlandsRegion.blessings) applyBlessingEffects(s.hero,b);
            s.runPreparation=createRunPreparation(highlandsRegion,'ridge-whetstone',{enhanced:true});
            s.encounterIndex=s.routeEncounterIndex=5;s.turn=2;s.hero.battleColumn=1;
            s.enemies[0].windRole='boss';s.enemies[0].battleColumn=1;
            s.highlandBattle.rocks=[3,0,2];s.highlandBattle.pattern=[1];
            const { lockHighlandIntents }=await import('/src/core/highlandBattle.js');lockHighlandIntents(s);
            localStorage.setItem('legendEternalSave',JSON.stringify(d));
          });await resume();
          const prepared=await save(page), press=async locator=>width<960?locator.tap():locator.click();
          async function select(type,column) {
            if(!await page.locator('#tacticalActions > details').evaluate(e=>e.open)) await press(page.locator('#tacticalActions > details > summary'));
            await press(page.locator(`[data-tactic-column="${column}"]`));
            const before=await save(page);
            await press(page.locator(`[data-preview-only][data-action-type="${type}"][data-column="${column}"]`));
            assert.deepEqual((await save(page)).activeRun,before.activeRun,'Touch selection must not commit a turn or charge');
            assert.equal(await page.locator('.tactical-selection').isVisible(),true);
          }
          await select('shove',0);assert.match(await page.locator('.tactical-selection').innerText(),/打斷/);
          if(width>=960) {
            await page.locator('#guardButton').hover();assert.equal(await page.locator('.tactical-selection').isVisible(),false,'Changing the shown action cancels a different pending confirmation');
            await select('shove',0);
          }
          await capture('touch-shove-preview');
          await press(page.locator('[data-action-confirm]'));
          const interrupted=await save(page);assert.equal(interrupted.activeRun.state.highlandBattle.rocks[0],0);assert.equal(interrupted.activeRun.state.turn,prepared.activeRun.state.turn+1);
          for(const type of ['ride','slip','tool-step']) {
            await page.evaluate(d=>localStorage.setItem('legendEternalSave',JSON.stringify(d)),prepared);await resume();
            await select(type,0);await capture(`touch-${type}-preview`);await press(page.locator('[data-action-confirm]'));
            const result=await save(page);assert.equal(result.activeRun.state.turn,prepared.activeRun.state.turn+(type==='ride'?1:0));
            if(type==='slip') assert.equal(result.activeRun.state.highlandBattle.slipUsed,true);
            if(type==='tool-step') assert.equal(result.activeRun.state.runPreparation.remainingCharges,prepared.activeRun.state.runPreparation.remainingCharges-1);
          }
          await page.evaluate(d=>{
            d.activeRun.state.highlandBattle.intents=[{id:d.activeRun.state.enemies[0].runtimeId,kind:'anchor',text:'站穩護衛：本回合不攻擊'}];
            localStorage.setItem('legendEternalSave',JSON.stringify(d));
          },prepared);await resume();
          assert.match(await page.locator('.highland-forecast').innerText(),/這回合敵人不攻擊/);
          await select('move',0);assert.match(await page.locator('.tactical-selection').innerText(),/敵人本回合不攻擊/);
          await capture('no-attack-preview');
          await page.evaluate(d=>{d.activeRun.state.highlandBattle.rocks=[0,0,0];localStorage.setItem('legendEternalSave',JSON.stringify(d));},prepared);await resume();
          await select('move',0);assert.match(await page.locator('.tactical-selection').innerText(),/抵住1格風/);await capture('touch-resist-preview');
          const beforeHold=await save(page);await press(page.locator('[data-preview-only][data-action-type="hold"]'));
          assert.deepEqual((await save(page)).activeRun,beforeHold.activeRun);assert.match(await page.locator('.tactical-selection').innerText(),/固定住/);await capture('touch-hold-preview');
        });
      } catch (error) {
        await capture('failure').catch(() => {});
        console.error(JSON.stringify({ serverExitCode: server.exitCode, serverSignal: server.signalCode, serverLog, errors, networkErrors, locks: await page.evaluate(() => navigator.locks.query()), body: (await page.locator('body').innerText()).slice(-2200) })); throw error;
      } finally { await context.close(); }
    }
  } finally { if (browser) await browser.close(); if (server.exitCode === null) { server.kill(); await once(server, 'exit'); } }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
