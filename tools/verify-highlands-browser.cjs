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
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
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
        if (/battle|critical|three-enemies/.test(name) && await page.locator('#nextButton').isVisible()) {
          const attack = await page.locator('#nextButton').boundingBox();
          assert.ok(attack.height >= 44 && attack.y + attack.height <= height, `${name}: action outside first viewport`);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
      }
      async function check(name, action) {
        await action(); assert.deepEqual(errors, []);
        results.push({ width, name, status: 'PASS' }); console.log(`PASS ${name} ${width}`);
        await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(results, null, 2));
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
            if (state?.encounterIndex >= 11 && state?.enemies?.filter(enemy => enemy.hp > 0).length === 3) {
              await capture('summit-three-enemies'); capturedThreeEnemies = true;
            }
          }
          if (await condition()) return;
          if (await page.locator('#blessingPanel').isVisible()) await page.locator('#blessingChoices button').first().click();
          else if (await page.locator('#eventLayout').isVisible() && await page.locator('#eventChoices button:visible').count()) {
            if (!capturedEventChoices) { await capture('event-choices'); capturedEventChoices = true; }
            await page.locator('#eventChoices button:visible').first().click();
          }
          else if (await page.locator('#eventContinueButton').isVisible()) await page.click('#eventContinueButton');
          else if (await page.locator('#continueButton').isVisible()) await page.click('#continueButton');
          else if (await page.locator('#nextButton').isVisible()) await page.click('#nextButton');
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
          await advanceUntil(async () => (await save(page)).activeRun?.state.encounterIndex >= 12 && await page.locator('#nextButton').isVisible());
          await capture('summit-battle');
          const snapshot = await save(page);
          await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('legendEternalSave')); d.activeRun.state.hero.hp = 1;
            localStorage.setItem('legendEternalSave', JSON.stringify(d));
          }); await resume(); await capture('summit-critical');
          await page.evaluate(d => localStorage.setItem('legendEternalSave', JSON.stringify(d)), snapshot); await resume();
          await advanceUntil(async () => (await save(page)).activeRun?.state.phase === 'routeEnding');
          await capture('ending');
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
      } catch (error) {
        await capture('failure').catch(() => {});
        console.error(JSON.stringify({ serverExitCode: server.exitCode, serverSignal: server.signalCode, serverLog, errors, networkErrors, locks: await page.evaluate(() => navigator.locks.query()), body: (await page.locator('body').innerText()).slice(-2200) })); throw error;
      } finally { await context.close(); }
    }
  } finally { if (browser) await browser.close(); if (server.exitCode === null) { server.kill(); await once(server, 'exit'); } }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
