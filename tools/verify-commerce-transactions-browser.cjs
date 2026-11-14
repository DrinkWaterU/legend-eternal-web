// Real DOM acceptance with synthetic saves in disposable browser contexts only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const materials = require('../src/data/materials.json');

async function seed(page, scenario) {
  await page.goto('http://127.0.0.1:4186/');
  await page.evaluate(async scenario => {
    const { createDefaultSave } = await import('/src/core/saveDefaults.js');
    const save = createDefaultSave();
    save.settings.musicEnabled = false;
    save.storyFlags.phoenixBlessingUnlocked = true;
    for (const flag of ['metAnpingGuildReceptionist', 'knowsAnpingGuildReceptionistName', 'registeredAtAnpingGuild', 'guildQuestIntroductionSeen']) save.storyFlags[flag] = true;
    if (!scenario.startsWith('merchant')) {
      save.settings.currentSafeAreaId = 'anping-town';
      save.progression.safeAreas['anping-town'] = { unlocked: true, unlockedAt: new Date().toISOString(), visitedAt: new Date().toISOString() };
    }
    save.inventory.gold = 1000;
    save.inventory.materials = { slime_gel: { quantity: 20 }, soft_hide: { quantity: 10 }, tainted_tusk: { quantity: 3 } };
    if (scenario !== 'board') save.quests.board.questIds = ['broad-monster-control', 'route-patrol', 'elite-suppression', 'plains-boss-trophy'];
    if (scenario === 'report') save.quests.active = { questId: 'plains-boss-trophy', progress: 0, acceptedAtCompletionCount: 0 };
    if (scenario === 'abandon') save.quests.active = { questId: 'broad-monster-control', progress: 7, acceptedAtCompletionCount: 0 };
    localStorage.setItem('legendEternalSave', JSON.stringify(save));
  }, scenario);
  await page.reload();
  await page.click('#openRegionButton');
  await page.click('#campPlacesButton');
  await page.locator('#facilityList button').first().click();
  // Anping lists Logan before the guild; select the actual guild entry instead.
}
async function injectFailure(page) {
  return page.evaluate(() => {
    window.__failWrites = true;
    window.__candidates = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'legendEternalSave') {
        window.__candidates.push(JSON.parse(value));
        if (window.__failWrites) throw new DOMException('Test quota exhausted', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
    return localStorage.getItem('legendEternalSave');
  });
}
async function retryAndVerify(page, before) {
  const modal = page.locator('.save-transaction-dialog');
  await modal.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('legendEternalSave')), before);
  await page.keyboard.press('Escape');
  assert.equal(await modal.evaluate(d => d.matches(':modal')), true);
  await modal.getByRole('button', { name: '重試保存', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('legendEternalSave')), before);
  await page.evaluate(() => { window.__failWrites = false; });
  await modal.getByRole('button', { name: '重試保存', exact: true }).click();
  assert.equal(await modal.evaluate(d => d.open), false);
  const candidates = await page.evaluate(() => window.__candidates);
  assert.equal(candidates.length, 3);
  for (const candidate of candidates.slice(1)) {
    assert.deepEqual(candidate.inventory, candidates[0].inventory);
    assert.deepEqual(candidate.quests, candidates[0].quests);
  }
  return page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')));
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const scenario of ['merchant-single', 'merchant-batch', 'bulk', 'board', 'accept', 'abandon', 'report']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      // Seed first, then navigate solely through the application's DOM handlers.
      await seed(page, scenario);
      if (!scenario.startsWith('merchant')) {
        // Return from Logan without completing any story, then open the guild.
        await page.click('#dialogueBackButton');
        await page.locator('#facilityList button').filter({ hasText: /瑟琳|公會接待員/ }).click();
      }
      let before;
      if (scenario.startsWith('merchant')) {
        if (scenario === 'merchant-batch') await page.click('#merchantBatchToggleButton');
        await page.locator('#merchantGrid button').filter({ hasText: materials.slime_gel.name }).click();
        if (scenario === 'merchant-batch') {
          await page.locator('#merchantGrid button').filter({ hasText: materials.soft_hide.name }).click();
          await page.click('#confirmMerchantBatchButton');
        }
        before = await injectFailure(page);
        await page.click('#confirmMerchantSaleButton');
        assert.doesNotMatch(await page.locator('#merchantNotice').textContent(), /已出售/);
      } else if (scenario === 'bulk') {
        await page.locator('#dialogueChoices button').filter({ hasText: '交付冒險物資' }).click();
        await page.locator('[data-material-id="slime_gel"] .add-material-button').click();
        const quantity = page.locator('[data-material-id="slime_gel"] input');
        await quantity.fill('20');
        await quantity.press('Tab');
        await page.click('#confirmGuildBulkDraftButton');
        before = await injectFailure(page);
        await page.click('#confirmGuildBulkSaleButton');
        assert.doesNotMatch(await page.locator('#guildBulkNotice').textContent(), /已交付/);
      } else {
        if (scenario === 'board') before = await injectFailure(page);
        await page.locator('#dialogueChoices button').filter({ hasText: '查看公會委託' }).click();
        if (scenario !== 'board') before = await injectFailure(page);
        if (scenario === 'accept') await page.locator('.guild-quest-board button').first().click();
        if (scenario === 'report') await page.getByRole('button', { name: '回報委託', exact: true }).click();
        if (scenario === 'abandon') {
          await page.getByRole('button', { name: '放棄委託', exact: true }).click();
          await page.click('#confirmGuildQuestAbandonButton');
        }
        assert.doesNotMatch(await page.locator('#guildQuestNotice').textContent(), /委託已承接|委託完成|已放棄/);
      }
      const after = await retryAndVerify(page, before);
      if (scenario === 'merchant-single') {
        assert.equal(after.inventory.materials.slime_gel.quantity, 19);
        assert.equal(after.inventory.gold, 1000 + materials.slime_gel.sellPrice);
      }
      if (scenario === 'merchant-batch') {
        assert.equal(after.inventory.materials.slime_gel, undefined);
        assert.equal(after.inventory.materials.soft_hide, undefined);
        assert.equal(after.inventory.gold, 1000 + 20 * materials.slime_gel.sellPrice + 10 * materials.soft_hide.sellPrice);
      }
      if (scenario === 'bulk') {
        assert.equal(after.inventory.materials.slime_gel, undefined);
        assert.equal(after.inventory.materials.soft_hide.quantity, 10);
        assert(after.inventory.gold > 1000 + 20 * materials.slime_gel.sellPrice);
        assert.match(await page.locator('#guildBulkNotice').textContent(), /已交付/);
      }
      if (scenario === 'board') assert.equal(await page.locator('.guild-quest-board .guild-quest-card').count(), 4);
      if (scenario === 'accept') {
        assert(after.quests.active);
        assert.match(await page.locator('#guildQuestNotice').textContent(), /委託已承接/);
      }
      if (scenario === 'abandon') {
        assert.equal(after.quests.active, null);
        assert.equal(after.quests.statistics.abandonedTotal, 1);
        assert.deepEqual(after.quests.board, JSON.parse(before).quests.board);
        assert.match(await page.locator('#guildQuestNotice').textContent(), /已放棄/);
      }
      if (scenario === 'report') {
        assert.equal(after.inventory.gold, 1055);
        assert.equal(after.inventory.materials.tainted_tusk, undefined);
        assert.equal(after.quests.statistics.completedTotal, 1);
        assert.equal(after.quests.board.questIds.includes('plains-boss-trophy'), false);
        assert.equal(after.quests.active, null);
        assert.match(await page.locator('#guildQuestNotice').textContent(), /委託完成/);
      }
      await page.reload();
      const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('legendEternalSave')));
      assert.deepEqual(restored.inventory, after.inventory);
      assert.deepEqual(restored.quests, after.quests);
      assert.deepEqual(errors, []);
      console.log(`PASS ${scenario}: real DOM, two failures, one success, candidate unchanged, reload retained`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
