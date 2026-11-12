async (page) => {
  page.setDefaultTimeout(12000);
  const results = [];
  async function enterGuild() {
    await page.locator('#menuScreen .run-resume-panel').waitFor({ state: 'attached' });
    await page.click('#openRegionButton');
    await page.click('#campPlacesButton');
    await page.locator('#facilityList button').filter({ hasText: /瑟琳|公會接待員/ }).click();
    await page.locator('#dialogueChoices button').filter({ hasText: '查看公會委託' }).click();
  }
  async function inspect(width, stage, motion, prefix='guildQuest') {
    const regionId=prefix+'DialogueTextRegion',skipId=prefix+'DialogueSkipButton';
    let skipped = false;
    if (motion === 'no-preference' && stage !== 'accept' && await page.locator('#'+skipId).isVisible()) {
      await page.click('#'+skipId); skipped = true;
    }
    await page.waitForFunction(id => !document.getElementById(id).classList.contains('is-typing'),regionId);
    await page.locator('#'+regionId).focus();
    await page.keyboard.press('End');
    await page.waitForFunction(id => {const b=document.getElementById(id);return b.scrollTop >= b.scrollHeight-b.clientHeight-1;},regionId);
    await page.keyboard.press('Home');
    await page.waitForFunction(id => document.getElementById(id).scrollTop <= 1,regionId);
    const geometry = await page.evaluate(prefix => {
      const box = document.getElementById(prefix+'DialogueTextRegion');
      const paragraph = document.getElementById(prefix+'DialogueText');
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walker.nextNode()) if (walker.currentNode.length) nodes.push(walker.currentNode);
      const rectOf = (node, offset) => { const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + 1); return range.getBoundingClientRect(); };
      box.scrollTop = 0;
      const bounds = box.getBoundingClientRect(), first = rectOf(nodes[0], 0);
      const firstReadable = first.top >= bounds.top + box.clientTop - 1 && first.bottom <= bounds.top + box.clientTop + box.clientHeight + 1;
      box.scrollTop = box.scrollHeight;
      const tail = nodes.at(-1), last = rectOf(tail, tail.length - 1);
      const lastReadable = last.bottom <= bounds.top + box.clientTop + box.clientHeight + 1 && last.top >= bounds.top + box.clientTop - 1;
      box.scrollTop = 0;
      return { text: paragraph.textContent, firstReadable, lastReadable, firstTop: first.top - bounds.top, boxHeight: box.clientHeight, textHeight: paragraph.getBoundingClientRect().height, scrollHeight: box.scrollHeight, noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth };
    },prefix);
    await page.screenshot({ path: `tools/verification-artifacts/r3-guild-${width}-${motion}-${stage}.png`, fullPage: true });
    results.push({ width, stage, motion, skipped, keyboardScroll: true, ...geometry });
  }
  for (const motion of ['reduce', 'no-preference']) for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('http://127.0.0.1:4197/');
    await page.locator('#menuScreen .run-resume-panel').waitFor({ state: 'attached' });
    await page.evaluate(async () => {
      const { createDefaultSave } = await import('/src/core/saveDefaults.js');
      const save = createDefaultSave();
      save.settings.musicEnabled = false;
      save.settings.currentSafeAreaId = 'anping-town';
      save.progression.safeAreas['anping-town'] = { unlocked: true, unlockedAt: new Date().toISOString(), visitedAt: new Date().toISOString() };
      for (const flag of ['phoenixBlessingUnlocked','metAnpingGuildReceptionist','knowsAnpingGuildReceptionistName','registeredAtAnpingGuild','guildQuestIntroductionSeen']) save.storyFlags[flag] = true;
      save.quests.board.questIds = ['broad-monster-control','route-patrol','forest-insect-control','plains-boss-trophy'];
      save.quests.board.generatedAtCompletionCount = 0;
      save.inventory.weapons['cairn-warhammer'] = true;
      localStorage.setItem('legendEternalSave', JSON.stringify(save));
    });
    await page.reload(); await enterGuild(); await inspect(width, 'entry', motion);
    await page.locator('.guild-quest-card button').first().click();
    await inspect(width, 'accept', motion);
    await page.evaluate(() => { const save = JSON.parse(localStorage.getItem('legendEternalSave')); save.quests.active.progress = 30; localStorage.setItem('legendEternalSave', JSON.stringify(save)); });
    await page.reload(); await enterGuild();
    await page.getByRole('button', { name: '回報委託', exact: true }).click();
    await inspect(width, 'report', motion);
  }
  await page.setViewportSize({width:320,height:900});
  await page.click('#guildQuestBackButton');
  await page.locator('#dialogueChoices button').filter({hasText:'交付冒險物資'}).click();
  await inspect(320,'bulk-entry','no-preference','guildBulk');
  const passed = results.every(r => r.firstReadable && r.lastReadable && r.noHorizontalOverflow);
  if (!passed) throw new Error(JSON.stringify(results));
  return { passed, results };
}
