// Isolated browser acceptance; fixture storage belongs only to this context.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4186/');
    await page.evaluate(async () => {
      const { createDefaultSave } = await import('/src/core/saveDefaults.js');
      const { materialDefinitions } = await import('/src/data/materials.js');
      const save = createDefaultSave();
      save.settings.musicEnabled = false;
      save.settings.currentSafeAreaId = 'anping-town';
      save.progression.safeAreas['anping-town'] = { unlocked: true, unlockedAt: new Date().toISOString(), visitedAt: new Date().toISOString() };
      save.storyFlags.phoenixBlessingUnlocked = true;
      save.storyFlags.metAnpingBlacksmith = true;
      save.storyFlags.knowsAnpingBlacksmithName = true;
      save.inventory.gold = 1000;
      for (const id of Object.keys(materialDefinitions)) save.inventory.materials[id] = { quantity: 100 };
      localStorage.setItem('legendEternalSave', JSON.stringify(save));
    });
    await page.reload();
    await page.click('#openRegionButton');
    await page.click('#campPlacesButton');
    console.log('Facilities:', await page.locator('#facilityList button').allTextContents());
    await page.locator('#facilityList button').filter({ hasText: /鐵匠|羅根/ }).click();
    console.log('Dialogue buttons:', await page.locator('#dialogueChoices button').allTextContents());
    await page.locator('#dialogueChoices button').filter({ hasText: /製作|鍛造|武器/ }).first().click();
    await page.click('#blacksmithCraftButton');
    const before = await page.evaluate(() => localStorage.getItem('legendEternalSave'));
    await page.evaluate(() => {
      window.__writeCount = 0;
      window.__failWrites = true;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'legendEternalSave') {
          window.__writeCount++;
          if (window.__failWrites) throw new DOMException('Test quota exhausted', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    await page.click('#confirmBlacksmithCraftButton');
    const dialog = page.locator('.save-transaction-dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => localStorage.getItem('legendEternalSave')), before);
    await page.keyboard.press('Escape');
    assert.equal(await dialog.evaluate(d => d.open), true);
    assert.equal(await dialog.evaluate(d => d.matches(':modal')), true);
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(d => d.contains(document.activeElement)), true);
    const output = path.join(__dirname, 'verification-artifacts', 'save-transactions');
    fs.mkdirSync(output, { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await dialog.evaluate(d => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
      await page.screenshot({ path: path.join(output, `pending-${width}.png`) });
    }
    await dialog.getByRole('button', { name: '重試保存', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('legendEternalSave')), before);
    await page.evaluate(() => { window.__failWrites = false; });
    await dialog.getByRole('button', { name: '重試保存', exact: true }).click();
    assert.equal(await dialog.evaluate(d => d.open), false);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')));
    assert.equal(after.inventory.gold, 900);
    assert.equal(after.inventory.weapons['iron-longsword'], true);
    assert.equal(await page.locator('#blacksmithGold').textContent(), '900');
    assert.match(await page.locator('#blacksmithNotice').textContent(), /已製作/);
    assert.equal(await page.evaluate(() => window.__writeCount), 3);
    await page.reload();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')).inventory.gold), 900);
    assert.deepEqual(errors, []);
    console.log('PASS: real blacksmith DOM flow, failure isolation, modal lock, Escape, focus, 3 widths, exact-once retry, reload persistence.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
