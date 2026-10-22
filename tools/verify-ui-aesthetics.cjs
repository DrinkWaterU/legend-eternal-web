// Production UI review, isolated saves and browser profile; no real player data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const stage = process.argv[2] || 'after';
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'verification-artifacts/ui-aesthetic-review', stage);
const base = 'http://127.0.0.1:4195';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = spawn('python', ['-u', 'tools/dev-server.py', '--port', '4195'], { cwd: root, windowsHide: true, stdio: 'ignore' });
  let browser;
  const results = [];
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch {} await pause(100); }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of (stage === 'before' ? [390, 768, 1440] : [320, 390, 768, 1440])) {
      const height = stage === 'before' || width >= 768 ? 900 : width === 320 ? 800 : 844;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      async function capture(name, primary) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
        const metrics = await page.evaluate(selector => {
          const rect = selector ? document.querySelector(selector)?.getBoundingClientRect() : null;
          return { overflow: document.documentElement.scrollWidth > innerWidth,
            topbarHeight: document.querySelector('.topbar').getBoundingClientRect().height,
            primaryBottom: rect?.bottom, primaryHeight: rect?.height };
        }, primary);
        assert.equal(metrics.overflow, false, `${name}: horizontal overflow at ${width}`);
        if (stage === 'after' && primary) {
          assert.ok(metrics.primaryHeight >= 44, `${name}: touch target`);
          assert.ok(metrics.primaryBottom <= height, `${name}: primary action must be in first viewport (${metrics.primaryBottom})`);
        }
        results.push({ name, width, viewportHeight: height, ...metrics });
      }
      async function reset(unlocked) {
        await page.goto(base);
        // Static menu buttons exist before asynchronous writer-lock startup
        // binds their handlers. Wait for the application-created view first.
        await page.locator('#menuScreen .run-resume-panel').waitFor({ state: 'attached' });
        await page.evaluate(async unlocked => {
          const { createDefaultSave } = await import('/src/core/saveDefaults.js');
          const save = createDefaultSave();
          save.settings.musicEnabled = false;
          save.storyFlags.phoenixBlessingUnlocked = unlocked;
          save.storyFlags.plainsBossStorySeen = unlocked;
          save.progression.characters.adventurer.level = unlocked ? 30 : 1;
          save.inventory.gold = 1000;
          if (unlocked) save.inventory.materials = { slime_gel: { quantity: 20 }, soft_hide: { quantity: 10 } };
          localStorage.setItem('legendEternalSave', JSON.stringify(save));
        }, unlocked);
        await page.reload();
        await page.locator('#menuScreen .run-resume-panel').waitFor({ state: 'attached' });
      }
      try {
        await reset(false);
        await capture('menu', '#openRegionButton');
        await page.click('#openRegionButton');
        await capture('camp-new', '#campStartButton');
        await page.click('#campRegionButton');
        await capture('region');
        await reset(true);
        await page.click('#openCharacterButton');
        await capture('character');
        await page.click('#characterListView [data-target="menuScreen"]');
        await page.click('#openRegionButton');
        await capture('camp', '#campStartButton');
        await page.click('#campStorageButton');
        await capture('storage');
        await page.click('#storageBackButton');
        await page.click('#campPlacesButton');
        await capture('facilities');
        await page.locator('#facilityList button').first().click();
        await capture('merchant');
        await reset(true);
        await page.click('#openRegionButton');
        await page.click('#campStartButton');
        await capture('departure');
        await page.click('#startButton');
        await capture('battle', '#nextButton');
        await page.click('#guardButton');
        await page.keyboard.press('Tab');
        await capture('battle-focus', '#nextButton');
        await page.reload();
        await capture('menu-resume', '#menuScreen .resume-run-button');
        await page.click('#openRegionButton');
        await capture('camp-resume', '#campStartButton');
        if (stage === 'after') {
          assert.equal(await page.locator('#campScreen .resume-run-button').isVisible(), false, 'One primary resume action in camp');
          await page.click('#campStartButton');
          assert.equal(await page.locator('#gameScreen').isVisible(), true);
          assert.ok(await page.locator('#battleLog li').count());
          await page.locator('.music-settings summary').click();
          await page.locator('#musicVolumeInput').fill('0.5');
          assert.equal(await page.locator('#musicVolumeValue').textContent(), '50%');
          const musicBox = await page.locator('.music-controls').boundingBox();
          assert.ok(musicBox.x >= 0 && musicBox.x + musicBox.width <= width);
          await capture('music-open');
          await page.locator('.music-settings summary').click();
          await page.locator('#guardButton').focus();
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.locator('#nextButton').evaluate(el => el.matches(':focus-visible')), true);
          await capture('keyboard-focus');
          // Deliberately awkward synthetic data: three enemies, low HP, long
          // target name and history. Reload still uses the real resume renderer.
          await page.evaluate(() => {
            const save = JSON.parse(localStorage.getItem('legendEternalSave'));
            const state = save.activeRun.state;
            state.hero.hp = 1;
            const enemy = state.enemies[0];
            state.enemies = [enemy, { ...enemy, runtimeId: 'ui-long-2', name: '沉睡於海岸洞穴深處的遠古巨型守衛者', displayName: '沉睡於海岸洞穴深處的遠古巨型守衛者' }, { ...enemy, runtimeId: 'ui-long-3' }];
            state.targetEnemyId = 'ui-long-2';
            state.log.push({ type: 'info', text: '洞穴深處傳來漫長的回聲。'.repeat(20) });
            localStorage.setItem('legendEternalSave', JSON.stringify(save));
          });
          await page.reload();
          await page.locator('#menuScreen .resume-run-button').click();
          assert.equal(await page.locator('#enemyRoster .enemy-card').count(), 3);
          assert.match(await page.locator('#heroHealthText').textContent(), /生命危急/);
          assert.equal(await page.locator('.enemy-card.is-target [data-enemy-name]').evaluate(el => getComputedStyle(el).whiteSpace), 'normal');
          await capture('battle-stress', '#nextButton');
          await page.locator('#enemyRoster .enemy-card').last().click();
          assert.equal(await page.locator('#enemyRoster .enemy-card').last().getAttribute('aria-pressed'), 'true');
          await capture('battle-target-switch', '#nextButton');
        }
        assert.deepEqual(errors, []);
      } catch (error) {
        await page.screenshot({ path: path.join(output, `failure-${width}.png`), fullPage: true }).catch(() => {});
        await fs.writeFile(path.join(output, `failure-${width}.json`), JSON.stringify({ errors, body: await page.locator('body').innerText(), message: error.message }, null, 2));
        throw error;
      } finally { await context.close(); }
    }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ stage, captures: results.length, overflows: results.filter(r => r.overflow).length }));
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
