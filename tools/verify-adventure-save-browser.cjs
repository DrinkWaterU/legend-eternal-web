// Disposable local server, browser contexts and synthetic saves. Never touches
// a player's browser profile, a public server or production progress.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.GAME_TEST_PORT || 4193);
const base = `http://127.0.0.1:${port}`;
const evidence = path.join(__dirname, 'verification-artifacts', 'adventure-save');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const readSave = page => page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')));

async function seed(page, { blessing = true, level = 30 } = {}) {
  await page.goto(base);
  await page.evaluate(async ({ blessing, level }) => {
    const { createDefaultSave } = await import('/src/core/saveDefaults.js');
    const save = createDefaultSave();
    save.settings.musicEnabled = false;
    save.storyFlags.phoenixBlessingUnlocked = blessing;
    save.storyFlags.plainsBossStorySeen = blessing;
    save.progression.characters.adventurer.level = level;
    save.inventory.gold = 1000;
    save.quests.board.questIds = ['broad-monster-control', 'route-patrol', 'elite-suppression', 'plains-boss-trophy'];
    save.quests.active = { questId: 'broad-monster-control', progress: 0, acceptedAtCompletionCount: 0 };
    localStorage.setItem('legendEternalSave', JSON.stringify(save));
  }, { blessing, level });
  await page.reload();
  await page.click('#openRegionButton');
  await page.click('#campStartButton');
}

async function injectFailure(page) {
  return page.evaluate(() => {
    window.__failWrites = true;
    window.__attempts = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'legendEternalSave') {
        window.__attempts.push(JSON.parse(value));
        if (window.__failWrites) throw new DOMException('Injected test quota', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
    return localStorage.getItem('legendEternalSave');
  });
}

async function verifyPending(page, before) {
  const modal = page.locator('.save-transaction-dialog');
  await modal.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('legendEternalSave')), before);
  await page.keyboard.press('Escape');
  assert.equal(await modal.evaluate(el => el.matches(':modal')), true);
  await page.keyboard.press('Tab');
  assert.equal(await modal.evaluate(el => el.contains(document.activeElement)), true);
  const bounds = await modal.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
  await page.screenshot({ path: path.join(evidence, `pending-${viewport.width}.png`) });
}

async function retry(page, before) {
  const modal = page.locator('.save-transaction-dialog');
  await verifyPending(page, before);
  await modal.getByRole('button', { name: '重試保存', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('legendEternalSave')), before);
  await page.evaluate(() => { window.__failWrites = false; });
  await modal.getByRole('button', { name: '重試保存', exact: true }).click();
  assert.equal(await modal.evaluate(el => el.open), false);
  const attempts = await page.evaluate(() => window.__attempts);
  assert.equal(attempts.length, 3);
  for (const attempt of attempts) {
    // Storage owns timestamps; gameplay results must remain identical.
    delete attempt.profile.updatedAt;
    assert.deepEqual(attempt, attempts[0]);
  }
  return readSave(page);
}

async function playTo(page, selector) {
  for (let action = 0; action < 300; action++) {
    if (await page.locator(selector).isVisible()) return;
    const choices = page.locator('#blessingChoices button');
    if (await page.locator('#blessingPanel').isVisible()) {
      await choices.first().click();
    } else if (await page.locator('#continueButton').isVisible() && await page.locator('#continueButton').isEnabled()) {
      await page.click('#continueButton');
    } else if (await page.locator('#nextButton').isVisible() && await page.locator('#nextButton').isEnabled()) {
      await page.click('#nextButton');
    } else {
      throw new Error(`Unexpected player state: ${(await page.locator('body').innerText()).slice(-1400)}`);
    }
  }
  throw new Error(`Did not reach ${selector}`);
}

async function main() {
  await fs.mkdir(evidence, { recursive: true });
  const server = spawn(process.env.PYTHON || 'python', ['-u', 'tools/dev-server.py', '--port', String(port)], { cwd: root, windowsHide: true, stdio: 'ignore' });
  let browser;
  const results = [];
  try {
    for (let count = 0; count < 50; count++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      if (server.exitCode !== null) throw new Error('Test server exited');
      await wait(100);
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [390, 1440]) {
      for (const scenario of ['start', 'kill', 'clear', 'death', 'retreat', 'phoenix', 'discard']) {
        const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
        try {
          const page = await context.newPage();
          page.setDefaultTimeout(10000);
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.addInitScript(() => { Math.random = () => 0.2; });
          await seed(page, { blessing: !['phoenix', 'death'].includes(scenario), level: scenario === 'death' ? 1 : 30 });
          let before;
          if (scenario === 'start') {
            before = await injectFailure(page);
            await page.click('#startButton');
            assert.equal(await page.locator('#gameScreen').isVisible(), false);
            const saved = await retry(page, before);
            assert.equal(saved.statistics.totalRuns, 1);
            assert.equal(await page.locator('#gameScreen').isVisible(), true);
          } else {
            await page.click('#startButton');
            if (scenario === 'kill' || scenario === 'discard') {
              before = await injectFailure(page);
              await playTo(page, '.save-transaction-dialog[open]');
              if (scenario === 'discard') {
                await verifyPending(page, before);
                page.once('dialog', dialog => dialog.accept());
                await page.getByRole('button', { name: '重新載入最後存檔', exact: true }).click();
                await page.waitForLoadState();
                assert.equal((await readSave(page)).statistics.totalEnemiesDefeated, JSON.parse(before).statistics.totalEnemiesDefeated);
                assert.equal(await page.locator('#menuScreen').isVisible(), true);
              } else {
                const saved = await retry(page, before);
                assert.equal(saved.statistics.totalEnemiesDefeated, 1);
                assert.equal(saved.quests.active.progress, 1);
                assert.equal(saved.inventory.gold, JSON.parse(before).inventory.gold);
                assert.ok(Object.keys(saved.inventory.materials).length > 0);
                assert.ok(saved.progression.characters.adventurer.exp > 0);
              }
            } else if (scenario === 'retreat') {
              await playTo(page, '#blessingPanel');
              await page.locator('#blessingChoices button').first().click();
              before = await injectFailure(page);
              await page.click('#retreatButton');
              assert.equal(await page.locator('#endPanel').isVisible(), false);
              const saved = await retry(page, before);
              assert.equal(saved.statistics.totalRetreats, 1);
              assert.equal(await page.locator('#endPanel').isVisible(), true);
            } else {
              if (scenario === 'clear' || scenario === 'death') {
                // Fail precisely the action that first attempts a clear record.
                await page.evaluate(scenario => {
                  const original = Storage.prototype.setItem;
                  window.__attempts = [];
                  window.__failWrites = true;
                  Storage.prototype.setItem = function(key, value) {
                    const data = key === 'legendEternalSave' ? JSON.parse(value) : null;
                    if (data && (scenario === 'death' ? data.statistics.totalDefeats > 0 : data.statistics.totalClears > 0)) {
                      window.__attempts.push(data);
                      if (window.__failWrites) throw new DOMException('Injected test quota', 'QuotaExceededError');
                    }
                    return original.call(this, key, value);
                  };
                }, scenario);
                await playTo(page, '.save-transaction-dialog[open]');
                before = await page.evaluate(() => localStorage.getItem('legendEternalSave'));
                assert.equal(await page.locator('#endPanel').isVisible(), false);
                const saved = await retry(page, before);
                assert.equal(scenario === 'death' ? saved.statistics.totalDefeats : saved.statistics.totalClears, 1);
                assert.equal(await page.locator('#endPanel').isVisible(), true);
              } else {
                await playTo(page, '#storyPanel');
                before = await injectFailure(page);
                await page.click('#revealStoryButton');
                await page.click('#finishStoryButton');
                assert.equal(await page.locator('#storyPanel').isVisible(), true);
                const saved = await retry(page, before);
                assert.equal(saved.storyFlags.phoenixBlessingUnlocked, true);
                assert.equal(await page.locator('#campScreen').isVisible(), true);
              }
            }
          }
          await page.screenshot({ path: path.join(evidence, `${scenario}-${width}.png`) });
          if (['clear', 'death', 'retreat'].includes(scenario)) {
            // Review the actual phone flow: the end dialog must scroll to its
            // return button, and saving/retrying must not leave the player stuck.
            await page.click('#retryButton');
            assert.equal(await page.locator('#campScreen').isVisible(), true);
          }
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
          const saved = await readSave(page);
          await page.reload();
          const reloaded = await readSave(page);
          for (const key of ['inventory', 'progression', 'statistics', 'quests', 'storyFlags', 'achievements']) assert.deepEqual(reloaded[key], saved[key]);
          assert.deepEqual(errors, []);
          results.push({ scenario, width, status: 'PASS' });
          console.log(`PASS ${scenario} ${width}px`);
        } catch (error) {
          const page = context.pages()[0];
          if (page) {
            await page.screenshot({ path: path.join(evidence, `failure-${scenario}-${width}.png`) }).catch(() => {});
            console.error((await page.locator('body').innerText()).slice(-1400));
          }
          throw error;
        } finally { await context.close(); }
      }
    }
    await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({ results, limitations: ['Synthetic saves and deterministic randomness', 'No interruption resume or multi-tab locking claimed'] }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill();
    if (server.exitCode === null) await once(server, 'exit');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
