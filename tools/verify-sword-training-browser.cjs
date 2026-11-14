// Exercises the real screens with synthetic saves in isolated browser contexts.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const port = 4197;
const base = `http://127.0.0.1:${port}`;
const server = spawn('python', ['-u', 'tools/dev-server.py', '--port', String(port)], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let browser;
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await pause(100); }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await page.evaluate(async () => {
        const { createDefaultSave } = await import('/src/core/saveDefaults.js');
        const save = createDefaultSave();
        save.settings.musicEnabled = false;
        save.settings.currentSafeAreaId = 'anping-town';
        save.progression.safeAreas['anping-town'] = { unlocked: true, unlockedAt: new Date().toISOString(), visitedAt: new Date().toISOString() };
        for (const flag of ['phoenixBlessingUnlocked', 'metAnpingBlacksmith', 'knowsAnpingBlacksmithName', 'metAnpingGuildReceptionist', 'knowsAnpingGuildReceptionistName', 'registeredAtAnpingGuild', 'guildQuestIntroductionSeen']) save.storyFlags[flag] = true;
        save.inventory.weapons['windbreak-sword'] = true;
        save.weaponTraining = { regions: { forest: true, beach: true, highlands: true }, unlocked: false, mode: 'steady' };
        localStorage.setItem('legendEternalSave', JSON.stringify(save));
      });
      await page.reload();
      await page.click('#openRegionButton');
      await page.click('#campPlacesButton');
      await page.locator('#facilityList button').filter({ hasText: /瑟琳|公會接待員/ }).click();
      await page.locator('#dialogueChoices button').filter({ hasText: '查看公會委託' }).click();
      assert.match(await page.locator('#guildQuestContent').innerText(), /守隘劍專精/);
      assert.match(await page.locator('#guildQuestContent').innerText(), /斷風高地：已完成/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (process.env.GAME_TEST_OUTPUT) await page.screenshot({ path: `${process.env.GAME_TEST_OUTPUT}/guild-${width}.png`, fullPage: true });
      await page.reload();
      await page.click('#openRegionButton');
      await page.click('#campPlacesButton');
      await page.locator('#facilityList button').filter({ hasText: /羅根|鐵匠/ }).click();
      await page.locator('#dialogueChoices button').filter({ hasText: /鍛造|打造/ }).first().click();
      await page.locator('#blacksmithWeaponList button').filter({ hasText: '斷風守隘劍' }).click();
      await page.getByRole('button', { name: '解鎖冒險反攻', exact: true }).click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')).weaponTraining.unlocked), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (process.env.GAME_TEST_OUTPUT) await page.screenshot({ path: `${process.env.GAME_TEST_OUTPUT}/smith-${width}.png`, fullPage: true });
      await page.reload();
      await page.click('#openCharacterButton');
      await page.locator('#characterChoiceList [data-character-id="adventurer"]').click();
      await page.click('#openCharacterEquipmentButton');
      await page.locator('#equipmentWeaponGrid button').filter({ hasText: '斷風守隘劍' }).click();
      await page.getByRole('button', { name: '選擇冒險反攻', exact: true }).click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')).weaponTraining.mode), 'swift');
      assert.match(await page.locator('#equipmentPreview').innerText(), /已選擇：冒險反攻/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (process.env.GAME_TEST_OUTPUT) await page.screenshot({ path: `${process.env.GAME_TEST_OUTPUT}/equipment-${width}.png`, fullPage: true });
      await page.reload();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')).weaponTraining.mode), 'swift');
      assert.deepEqual(errors, []);
      console.log(`PASS sword training screens ${width}px`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
