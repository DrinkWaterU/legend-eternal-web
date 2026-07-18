import assert from "node:assert/strict";

import { characterDefinitions } from "../src/data/characters/index.js";
import { achievementDefinitions } from "../src/data/achievements.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { buildCharacterSkillModel, filterCharacterSkills, getSkillUpgradeLabel } from "../src/ui/characterSkillsView.js";
import { filterEquipmentWeapons } from "../src/ui/characterEquipmentView.js";
import { getVisibleAchievementEntries, formatAchievementDate } from "../src/ui/achievementView.js";
import { buildMaterialUsageIndex, getMaterialUsageCounts, getMaterialUsages } from "../src/ui/materialUsage.js";
import { getEscapeSummary, getOutcomeDistribution } from "../src/ui/statisticsMetrics.js";

const archerSkills = buildCharacterSkillModel(characterDefinitions.archer, { level: 25 });
assert.equal(archerSkills.learnedSkills.length, 8, "弓箭手 Lv.25 應整合為 8 條技能鏈");
assert.equal(archerSkills.learnedSkills.filter((skill) => skill.upgradeTier > 0).length, 4, "弓箭手應有 4 條第一階強化技能鏈");
assert.equal(filterCharacterSkills(archerSkills.learnedSkills, { stageFilter: "upgraded" }).length, 4);
assert.equal(getSkillUpgradeLabel(3), "強化 III");
assert.equal(getSkillUpgradeLabel(4), "強化 IV");

const weapons = Object.values(weaponDefinitions);
assert.ok(filterEquipmentWeapons(weapons, { searchQuery: "短弓" }).every((weapon) => weapon.name.includes("短弓")));
assert.ok(filterEquipmentWeapons(weapons, { categoryFilter: "bow" }).every((weapon) => weapon.categoryId === "bow"));

const usageIndex = buildMaterialUsageIndex({ regionDefinitions, weaponDefinitions });
assert.deepEqual(getMaterialUsageCounts(usageIndex, "spider_silk"), { all: 5, preparation: 1, weapon: 4 });
assert.equal(getMaterialUsages(usageIndex, "spider_silk", "preparation")[0].title, "林地繃帶");
assert.equal(getMaterialUsages(usageIndex, "spider_silk", "weapon").length, 4);

const outcomes = getOutcomeDistribution({ totalRuns: 10, totalClears: 2, totalRetreats: 3, totalDefeats: 4 });
assert.equal(outcomes.other, 1, "未結算冒險不得算入敗北");
assert.equal(outcomes.items.reduce((sum, item) => sum + item.value, 0), 10);
const escape = getEscapeSummary({
  fleeAttempts: 3,
  fleeSuccesses: 1,
  fleeFailures: 1,
  safeEscapes: 1,
  counterEscapes: 1,
  evacuationEscapes: 1
});
assert.equal(escape.successes, 3, "成功脫離應相容詳細分類比舊總數更完整的存檔");
assert.equal(escape.attempts, 4);

const hiddenLockedState = {
  plains_trial: { unlocked: true, unlockedAt: "2026-07-01T10:00:00.000Z" },
  forest_trial: { unlocked: false, unlockedAt: null },
  goblin_camp_clear: { unlocked: false, unlockedAt: null }
};
assert.equal(getVisibleAchievementEntries({ definitions: achievementDefinitions, achievementState: hiddenLockedState }).length, 3, "未解鎖隱藏成就不可洩漏");
hiddenLockedState.goblin_camp_clear.unlocked = true;
assert.equal(getVisibleAchievementEntries({ definitions: achievementDefinitions, achievementState: hiddenLockedState }).length, 4);
assert.notEqual(formatAchievementDate("not-a-date"), "Invalid Date");

console.log("v0.2.5.2 UI model and compatibility tests passed.");
