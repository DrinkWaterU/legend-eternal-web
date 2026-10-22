const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'verification-artifacts', 'run-resume');
const port = Number(process.env.GAME_TEST_PORT || 4194);
const base = `http://127.0.0.1:${port}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')));
const results = [];

async function seed(page, region = 'plains', blessing = true) {
  await page.goto(base);
  await page.evaluate(async ({ region, blessing }) => {
    const { createDefaultSave } = await import('/src/core/saveDefaults.js');
    const data = createDefaultSave();
    data.settings.musicEnabled = false;
    data.settings.selectedRegionId = region;
    data.storyFlags.phoenixBlessingUnlocked = blessing;
    data.storyFlags.plainsBossStorySeen = blessing;
    data.progression.characters.adventurer.level = 30;
    data.inventory.gold = 1000;
    localStorage.setItem('legendEternalSave', JSON.stringify(data));
  }, { region, blessing });
  await page.reload();
  await page.click('#openRegionButton');
  await page.click('#campStartButton');
  await page.click('#startButton');
  assert.ok((await save(page)).activeRun);
}
async function resume(page) {
  await page.reload();
  const button = page.locator('#menuScreen .resume-run-button');
  await button.waitFor({ state: 'visible' });
  await button.click();
  assert.equal(await page.locator('#gameScreen').isVisible(), true);
}
async function playUntil(page, condition) {
  for (let i = 0; i < 400; i++) {
    if (await condition()) return;
    if (await page.locator('#blessingPanel').isVisible()) await page.locator('#blessingChoices button').first().click();
    else if (await page.locator('#eventLayout').isVisible() && await page.locator('#eventChoices button').count()) await page.locator('#eventChoices button').first().click();
    else if (await page.locator('#eventContinueButton').isVisible()) await page.click('#eventContinueButton');
    else if (await page.locator('#continueButton').isVisible() && await page.locator('#continueButton').isEnabled()) await page.click('#continueButton');
    else if (await page.locator('#nextButton').isVisible() && await page.locator('#nextButton').isEnabled()) await page.click('#nextButton');
    else if (await page.locator('#endPanel').isVisible()) throw new Error('Unexpected run end');
    else await wait(30);
  }
  throw new Error('Player traversal exceeded action limit');
}
async function boostSnapshot(page) {
  // Synthetic high-stat fixture to reach later formal stages quickly. No
  // production content, player data, or game rules are changed on disk.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('legendEternalSave'));
    Object.assign(data.activeRun.state.hero, { attack: 9999, hp: 100000, maxHp: 100000 });
    localStorage.setItem('legendEternalSave', JSON.stringify(data));
  });
  await resume(page);
}
function withoutTime(data) { const next = structuredClone(data); delete next.profile.updatedAt; return next; }

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = spawn('python', ['-u', 'tools/dev-server.py', '--port', String(port)], { cwd: root, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch {} await wait(100); }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { Math.random = () => 0.2; });
      async function check(name, action) {
        await action();
        assert.deepEqual(errors, []);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        results.push({ name, width, status: 'PASS' });
        await fs.writeFile(path.join(output, 'progress.json'), JSON.stringify(results, null, 2));
        console.log(`PASS ${name} ${width}px`);
      }
      try {
        await check('new-player-locks-and-death-cleanup', async () => {
          await page.goto(base);
          await page.evaluate(async () => {
            const { createDefaultSave } = await import('/src/core/saveDefaults.js');
            const data = createDefaultSave(); data.settings.musicEnabled = false;
            localStorage.setItem('legendEternalSave', JSON.stringify(data));
          });
          await page.reload();
          await page.click('#openRegionButton');
          assert.equal(await page.locator('#campStorageButton').isVisible(), false);
          assert.equal(await page.locator('#campPlacesButton').isVisible(), false);
          assert.equal(await page.locator('#campScreen .resume-run-button').isVisible(), false);
          assert.equal(await page.evaluate(() => scrollY), 0);
          await page.screenshot({ path: path.join(output, `camp-new-A-${width}.png`) });
          await page.click('#campStartButton'); await page.click('#startButton');
          for (let i = 0; i < 100 && !(await page.locator('#endPanel').isVisible()); i++) await page.click('#guardButton');
          assert.equal((await save(page)).statistics.totalDefeats, 1);
          assert.equal((await save(page)).activeRun, null);
          await page.reload();
          assert.equal(await page.locator('#menuScreen .resume-run-button').isVisible(), false);
        });
        await seed(page);
        await check('battle-roundtrip-and-random-replay', async () => {
          await page.click('#guardButton');
          const before = await save(page);
          assert.equal(before.activeRun.state.turn, 1);
          const logsBefore = await page.locator('#battleLog li').allTextContents();
          await resume(page);
          assert.ok(logsBefore.length > 0);
          assert.deepEqual(await page.locator('#battleLog li').allTextContents(), logsBefore, 'Stored combat history must actually be rendered after resume');
          assert.ok((await page.locator('#battleLogTitle').boundingBox()).height < 55, 'Battle title must not collapse into vertical text');
          assert.deepEqual(withoutTime(await save(page)), withoutTime(before), 'Restoration cannot grant rewards or advance the stored turn');
          await page.click('#nextButton');
          const branch = await save(page);
          await page.evaluate(data => localStorage.setItem('legendEternalSave', JSON.stringify(data)), before);
          await resume(page);
          await page.click('#nextButton');
          assert.deepEqual(withoutTime(await save(page)), withoutTime(branch), 'Same restored random state must give the same action result');
        });
        await check('pending-failure-reload', async () => {
          const before = await save(page);
          await page.evaluate(() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
              if (key === 'legendEternalSave') throw new DOMException('Test quota', 'QuotaExceededError');
              return original.call(this, key, value);
            };
          });
          if (await page.locator('#blessingPanel').isVisible()) await page.locator('#blessingChoices button').first().click();
          else await page.click('#guardButton');
          await page.locator('.save-transaction-dialog').waitFor({ state: 'visible' });
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.save-transaction-dialog').evaluate(el => el.matches(':modal')), true);
          await page.keyboard.press('Tab');
          assert.equal(await page.locator('.save-transaction-dialog').evaluate(el => el.contains(document.activeElement)), true);
          await page.screenshot({ path: path.join(output, `pending-${width}.png`) });
          assert.deepEqual(await save(page), before);
          await resume(page);
          assert.deepEqual(withoutTime(await save(page)), withoutTime(before));
        });
        await check('blessing-options-not-rerolled', async () => {
          await playUntil(page, () => page.locator('#blessingPanel').isVisible());
          const before = await save(page);
          const options = await page.locator('#blessingChoices button').allTextContents();
          await resume(page);
          assert.deepEqual(await page.locator('#blessingChoices button').allTextContents(), options);
          await page.locator('#blessingChoices button').first().click();
          const chosen = await save(page);
          assert.equal(chosen.activeRun.state.hero.blessings.length, before.activeRun.state.hero.blessings.length + 1);
          await resume(page);
          assert.equal(await page.locator('#blessingPanel').isVisible(), false);
          assert.deepEqual(withoutTime(await save(page)), withoutTime(chosen));
        });
        await check('menu-no-overwrite-and-confirmed-abandon', async () => {
          await page.click('#combatHomeButton');
          const before = await save(page);
          await page.click('#openRegionButton');
          assert.equal(await page.evaluate(() => scrollY), 0);
          await page.screenshot({ path: path.join(output, `camp-A-${width}.png`) });
          await page.click('#campStartButton');
          assert.equal(await page.locator('#gameScreen').isVisible(), true);
          assert.deepEqual((await save(page)).activeRun, before.activeRun);
          await page.click('#combatHomeButton');
          await page.click('#openRegionButton');
          await page.click('#campRegionButton');
          await page.locator('#regionChoiceList button').filter({ hasText: '海岸' }).click();
          await page.click('#startButton');
          assert.deepEqual((await save(page)).activeRun, before.activeRun);
          assert.match(await page.locator('#regionStartNotice').innerText(), /已有待續/);
          await page.reload();
          page.once('dialog', dialog => dialog.dismiss());
          await page.locator('#menuScreen .discard-run-button').click();
          assert.deepEqual((await save(page)).activeRun, before.activeRun);
          page.once('dialog', dialog => dialog.accept());
          await page.locator('#menuScreen .discard-run-button').click();
          assert.equal((await save(page)).activeRun, null);
          assert.equal((await save(page)).statistics.totalRetreats, before.statistics.totalRetreats + 1);
        });
        await check('multi-tab-write-exclusion', async () => {
          const before = await save(page);
          const other = await context.newPage();
          await other.goto(base);
          await other.locator('.writer-lock-dialog').waitFor({ state: 'visible' });
          assert.deepEqual(await save(other), before);
          assert.equal(await other.evaluate(async () => {
            const { saveGame, createDefaultSave } = await import('/src/core/storage.js');
            return saveGame(createDefaultSave());
          }), false);
          assert.deepEqual(await save(page), before);
          await other.screenshot({ path: path.join(output, `writer-blocked-${width}.png`) });
          await other.close();
          const replacement = await context.newPage();
          await replacement.goto(base);
          await replacement.locator('.writer-lock-dialog').waitFor({ state: 'visible' });
          // Release the original document; replacement must acquire on reload.
          await page.goto('about:blank');
          await replacement.getByRole('button', { name: '重新載入並繼續', exact: true }).click();
          await replacement.locator('#openRegionButton').waitFor({ state: 'visible' });
          assert.equal(await replacement.locator('.writer-lock-dialog').count(), 0);
          assert.deepEqual((await save(replacement)).inventory, before.inventory);
          await replacement.close();
          await page.goto(base);
        });
        await check('incompatible-snapshot-safe-discard', async () => {
          await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('legendEternalSave'));
            data.activeRun = { format: 900, gameVersion: 'future', state: {} };
            localStorage.setItem('legendEternalSave', JSON.stringify(data));
          });
          await page.reload();
          assert.equal(await page.locator('#menuScreen .resume-run-button').isDisabled(), true);
          const before = await save(page);
          page.once('dialog', dialog => dialog.accept());
          await page.locator('#menuScreen .discard-run-button').click();
          const after = await save(page);
          assert.equal(after.activeRun, null);
          for (const key of ['inventory', 'progression', 'statistics']) assert.deepEqual(after[key], before[key]);
        });
        await seed(page, 'forest');
        await boostSnapshot(page);
        await check('forest-event-restoration', async () => {
          await playUntil(page, async () => (await save(page)).activeRun?.state.phase === 'event');
          await resume(page);
          await page.locator('#eventChoices button').first().waitFor({ state: 'visible' });
          const choices = await page.locator('#eventChoices button').allTextContents();
          await resume(page);
          assert.deepEqual(await page.locator('#eventChoices button').allTextContents(), choices);
          await page.locator('#eventChoices button').first().click();
          await playUntil(page, async () => Boolean((await save(page)).activeRun?.state.eventContext?.result));
          const before = await save(page);
          await resume(page);
          assert.deepEqual(withoutTime(await save(page)), withoutTime(before));
          assert.equal(await page.locator('#eventLayout').isVisible(), true);
        });
        await seed(page, 'beach');
        await boostSnapshot(page);
        await check('coast-checkpoint-selection-and-cave', async () => {
          await playUntil(page, async () => (await save(page)).activeRun?.state.phase === 'segmentChoice');
          const before = await save(page);
          assert.equal(before.statistics.totalClears, 0);
          await resume(page);
          await page.locator('#eventChoices button').filter({ hasText: '扎營並前往海岸洞穴' }).click();
          const cards = page.locator('#campTransitionBlessingGrid button');
          for (let index = 0; index < 4; index++) await cards.nth(index).click();
          const selected = (await save(page)).activeRun.state.campSelection.selectedInstanceIds;
          await resume(page);
          assert.equal(await page.locator('#campTransitionSelectionCount').innerText(), '已選 4 / 8');
          assert.deepEqual((await save(page)).activeRun.state.campSelection.selectedInstanceIds, selected);
          for (let index = 4; index < 8; index++) await cards.nth(index).click();
          await page.click('#campTransitionConfirmButton');
          const cave = await save(page);
          assert.equal(cave.activeRun.state.activeRouteId, 'coast-cave');
          assert.equal(cave.activeRun.state.blessingInstances.length, 8);
          await resume(page);
          assert.deepEqual(withoutTime(await save(page)), withoutTime(cave));
          await page.screenshot({ path: path.join(output, `battle-A-${width}.png`) });
        });
        await check('coast-full-clear-terminal-cleanup', async () => {
          await boostSnapshot(page);
          await playUntil(page, () => page.locator('#endPanel').isVisible());
          const finished = await save(page);
          assert.equal(finished.statistics.totalClears, 1);
          assert.equal(finished.statistics.regions.beach.clears, 1);
          assert.equal(finished.statistics.regions.beach.bestEncounter, 32);
          assert.equal(finished.activeRun, null);
          await page.reload();
          assert.equal((await save(page)).statistics.totalClears, 1);
        });
        await seed(page, 'forest');
        await check('goblin-ending-no-double-clear', async () => {
          // Inject an already-completed formal Route fixture; test restoration
          // and page advancement, not a second reward computation.
          await page.evaluate(async () => {
            const { getRouteDefinition } = await import('/src/data/routes/index.js');
            const route = getRouteDefinition('goblin-camp');
            const data = JSON.parse(localStorage.getItem('legendEternalSave'));
            Object.assign(data.activeRun.state, { activeRouteId: route.id, routeEncounterIndex: route.encounterPlan.length,
              encounterIndex: 16, phase: 'routeEnding', ended: true, runResultRecorded: true, enemies: [], awaitingBlessing: false,
              routeEndingContext: { routeId: route.id, endingKey: 'ending', pageIndex: 2 } });
            data.statistics.totalClears = 1;
            data.statistics.regions.forest.clears = 1;
            data.statistics.regions.forest.routeClears.goblinCamp = 1;
            data.progression.characters.archer.unlocked = true;
            data.storyFlags.archerRescued = true;
            localStorage.setItem('legendEternalSave', JSON.stringify(data));
          });
          await resume(page);
          assert.equal(await page.locator('#eventLayout').isVisible(), true);
          const before = await save(page);
          await page.click('#eventContinueButton');
          assert.equal((await save(page)).activeRun.state.routeEndingContext.pageIndex, 3);
          await resume(page);
          await page.click('#eventContinueButton');
          const finished = await save(page);
          assert.equal(finished.activeRun, null);
          assert.equal(finished.statistics.totalClears, 1);
          assert.equal(finished.statistics.regions.forest.routeClears.goblinCamp, 1);
          assert.deepEqual(finished.inventory, before.inventory);
        });
        await check('kaige-duel-hook-and-unlock-resume', async () => {
          await page.evaluate(async () => {
            const { createDefaultSave } = await import('/src/core/saveDefaults.js');
            const data = createDefaultSave();
            data.settings.musicEnabled = false;
            data.settings.currentSafeAreaId = 'anping-town';
            data.progression.safeAreas['anping-town'] = { unlocked: true, unlockedAt: new Date().toISOString(), visitedAt: new Date().toISOString() };
            data.progression.characters.adventurer.level = 30;
            data.statistics.regions.forest.routeClears.main = 1;
            data.storyFlags.metKaige = true;
            data.storyFlags.knowsKaigeName = true;
            data.storyFlags.phoenixBlessingUnlocked = true;
            data.storyQuests.records['kaige-challenge'] = { status: 'active', stageId: 'defeat-kaige' };
            localStorage.setItem('legendEternalSave', JSON.stringify(data));
          });
          await page.reload();
          await page.click('#openRegionButton');
          await page.click('#campPlacesButton');
          await page.locator('#facilityList button').filter({ hasText: '凱哥' }).click();
          await page.locator('#dialogueChoices button').filter({ hasText: '接受切磋' }).click();
          for (let i = 0; i < 10; i++) {
            if (await page.locator('#dialogueChoices button').filter({ hasText: '開始切磋' }).isVisible()) break;
            if (await page.locator('#dialogueSkipButton').isVisible()) await page.click('#dialogueSkipButton');
            if (await page.locator('#dialogueAdvanceButton').isVisible()) await page.click('#dialogueAdvanceButton');
          }
          await page.locator('#dialogueChoices button').filter({ hasText: '開始切磋' }).click();
          assert.equal((await save(page)).activeRun.state.battleSource, 'duel');
          await resume(page);
          await page.click('#nextButton');
          assert.ok((await save(page)).activeRun.state.enemies[0].duelFuryValue > 0, 'Restored duel must keep its direct-hit hook');
          await boostSnapshot(page);
          await page.click('#nextButton');
          const finished = await save(page);
          assert.equal(finished.activeRun, null);
          assert.equal(finished.progression.characters.kaige.unlocked, true);
          assert.equal(finished.inventory.weapons['worn-battle-axe'], true);
          assert.equal(finished.statistics.totalEnemiesDefeated, 0);
          await page.reload();
          assert.equal((await save(page)).storyQuests.records['kaige-challenge'].status, 'completed');
        });
        await seed(page, 'plains', false);
        await check('phoenix-story-resume-and-terminal-clear', async () => {
          await playUntil(page, () => page.locator('#storyPanel').isVisible());
          const before = await save(page);
          assert.equal(before.activeRun.state.phase, 'story');
          await resume(page);
          assert.equal(await page.locator('#storyPanel').isVisible(), true);
          assert.equal((await save(page)).statistics.totalClears, 1);
          await page.click('#finishStoryButton');
          assert.equal((await save(page)).activeRun, null);
          await page.reload();
          assert.equal((await save(page)).storyFlags.phoenixBlessingUnlocked, true);
          assert.equal(await page.locator('#menuScreen .resume-run-button').isVisible(), false);
        });
      } catch (error) {
        await page.screenshot({ path: path.join(output, `failure-${width}.png`) }).catch(() => {});
        console.error((await page.locator('body').innerText()).slice(-2000));
        throw error;
      } finally { await context.close(); }
    }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results,
      limitations: ['Isolated Edge contexts and synthetic saves', 'High-stat synthetic fixture used only to reach forest/coast stages quickly', 'No human playtest, physical mobile or power-loss test'] }, null, 2));
  } finally { if (browser) await browser.close(); server.kill(); if (server.exitCode === null) await once(server, 'exit'); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
