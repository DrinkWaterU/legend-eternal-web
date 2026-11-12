// Safe-route preview, pre-phoenix death embers and the phoenix payoff line.
import assert from "node:assert/strict";
import { describeUpcomingEncounter } from "../../src/core/upcomingEncounter.js";
import { getPhoenixPayoffLine, getPrePhoenixDeathEmberLine, insertPhoenixPayoffLine } from "../../src/core/phoenixForeshadowing.js";
import { regionDefinitions } from "../../src/data/regions/index.js";

// Upcoming encounter follows the fixed plan type and never names enemies.
assert.equal(describeUpcomingEncounter({ encounterType: "normal", encounterNumber: 2, encounterCount: 8 }), "前方：一般遭遇（第 2 / 8 場）。");
const elite = describeUpcomingEncounter({ encounterType: "elite", encounterNumber: 4, encounterCount: 8 });
assert.match(elite, /^前方：精英戰（第 4 \/ 8 場）。/);
assert.match(elite, /撤退/, "elite preview reminds that retreat is available");
const boss = describeUpcomingEncounter({ encounterType: "boss", encounterNumber: 8, encounterCount: 8 });
assert.match(boss, /首領戰/);
assert.match(boss, /無法逃跑/, "boss preview matches the no-flee rule");
assert.match(describeUpcomingEncounter({ encounterType: "elite", encounterNumber: 4, encounterCount: 8, eventPending: true }), /^前方似乎有些動靜，之後是精英戰/);
assert.equal(describeUpcomingEncounter({ resumingThreat: true, encounterType: "boss", encounterNumber: 8, encounterCount: 8 }), "前方：剛才逃離的敵人還在等你。");
assert.equal(describeUpcomingEncounter({ encounterType: null, encounterNumber: 9, encounterCount: 8 }), "", "past the plan there is nothing to preview");

// The plains plan used by the first-region preview: battle 4 is an elite, battle 8 the boss.
const plainsPlan = regionDefinitions.plains.encounterPlan.map((entry) => typeof entry === "string" ? entry : entry.type);
assert.equal(plainsPlan[3], "elite");
assert.equal(plainsPlan.at(-1), "boss");

// Embers grow with each pre-phoenix death.
assert.equal(getPrePhoenixDeathEmberLine(0), "");
const embers = [1, 2, 3, 9].map(getPrePhoenixDeathEmberLine);
assert.ok(embers.every(Boolean));
assert.notEqual(embers[0], embers[1]);
assert.notEqual(embers[1], embers[2]);
assert.equal(embers[2], embers[3], "three or more deaths share the strongest hint");

// Payoff names the death count and is inserted before the closing line of the story.
assert.match(getPhoenixPayoffLine(3), /倒下 3 次/);
assert.doesNotMatch(getPhoenixPayoffLine(0), /倒下 0 次/);
const storyLines = regionDefinitions.plains.clearStory.lines;
const withPayoff = insertPhoenixPayoffLine(storyLines, 2);
assert.equal(withPayoff.length, storyLines.length + 1);
assert.equal(withPayoff.at(-1), storyLines.at(-1), "the phoenix return stays the closing line");
assert.match(withPayoff.at(-2), /倒下 2 次/);
assert.deepEqual(insertPhoenixPayoffLine([], 2), []);

console.log("Run foreshadowing tests passed.");
