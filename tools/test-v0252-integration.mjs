import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const normalize = (source) => source.replace(/\r\n?/g, "\n");
const root = new URL("../", import.meta.url);
const [html, game, dom, style, achievementView, storageView, statisticsView] = (await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  Promise.all(["src/features/profile/achievementController.js", "src/features/adventure/adventureAchievements.js", "src/app/createApplication.js", "src/app/createProfileFeatures.js"].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n")),
  readFile(new URL("src/ui/dom.js", root), "utf8"),
  readFile(new URL("src/styles/ui-refresh.css", root), "utf8"),
  readFile(new URL("src/ui/achievementView.js", root), "utf8"),
  readFile(new URL("src/ui/storageView.js", root), "utf8"),
  readFile(new URL("src/ui/statisticsView.js", root), "utf8")
])).map(normalize);

for (const id of [
  "characterSkillDetail", "equipmentSearchInput", "storageDetailPanel", "storageUsageList",
  "statisticsJourneySummary", "statisticsCharacterDetail", "statisticsRegionDetail",
  "achievementBrowser", "achievementDetail", "achievementUnlockToast"
]) {
  assert.match(html, new RegExp(`id="${id}"`), `index.html 缺少 ${id}`);
}
for (const id of [
  "characterSkillDetail", "equipmentSearchInput", "storageUsageList",
  "statisticsJourneySummary", "statisticsCharacterDetail", "statisticsRegionDetail",
  "achievementBrowser", "achievementDetail", "achievementUnlockToast"
]) {
  assert.match(dom, new RegExp(`${id}: document\\.querySelector\\("#${id}"\\)`), `dom.js 缺少 ${id}`);
}
assert.doesNotMatch(dom, /storageDetailPanel: document\.querySelector/, "倉庫詳情根節點不應保留未使用的 registry 欄位");

assert.doesNotMatch(html, /id="materialInfoPanel"/, "素材資訊應整合進倉庫，不應保留雙軌彈窗");
assert.doesNotMatch(html, /id="skillInfoPanel"/, "技能資訊應整合進角色詳情，不應保留雙軌彈窗");
assert.doesNotMatch(game, /showMaterialDetail|closeMaterialDetail|materialInfoPanel/, "game.js 不應保留舊素材彈窗流程");
assert.match(game, /queueAchievementUnlock\(forestTrialAchievementId\)/);
assert.match(game, /if \(achievement\.unlocked\) return false;/, "重複成就解鎖必須回傳 false");
assert.match(game, /unlockAchievement: profile\.unlockAchievement[\s\S]*plainsTrialAchievementId: PLAINS_TRIAL_ACHIEVEMENT_ID/, "Debug Runtime 應保留純資料解鎖函式");
assert.match(storageView, /overflow|renderUsageList/);
assert.match(statisticsView, /\["overview", "characters", "regions", "save"\]/);
assert.match(achievementView, /hiddenUntilUnlocked/);
assert.match(style, /\.storage-workspace[\s\S]*grid-template-columns/);
assert.match(style, /\.upgrade-tier-1[^{]*\{[^}]*#63d58e/);
assert.match(style, /prefers-reduced-motion/);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const idSet = new Set(ids);
assert.equal(idSet.size, ids.length, "index.html 不可有重複 ID");

const domIdSelectors = [...dom.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map((match) => match[1]);
for (const id of domIdSelectors) {
  assert.ok(idSet.has(id), `dom.js selector #${id} 必須存在於 index.html`);
}
const domProperties = new Set([...dom.matchAll(/^  ([A-Za-z0-9_]+):/gm)].map((match) => match[1]));
const gameElementProperties = new Set([...game.matchAll(/\bels\.([A-Za-z0-9_]+)/g)].map((match) => match[1]));
for (const property of gameElementProperties) {
  assert.ok(domProperties.has(property), `game.js 使用的 els.${property} 必須由 dom.js 定義`);
}

console.log("v0.2.5.2 DOM, UI wiring, and stable-boundary integration tests passed.");
