// Safe-route preview, pre-phoenix death embers and the phoenix payoff line.
import assert from "node:assert/strict";
import { describeUpcomingEncounter } from "../../src/core/upcomingEncounter.js";
import { getPhoenixPayoffLine, getPrePhoenixDeathEmberLine, insertPhoenixPayoffLine } from "../../src/core/phoenixForeshadowing.js";
import { planTypewriterTimeline } from "../../src/ui/storyTypewriter.js";
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

// Story cues: scene beats fire on the words that describe them, in story order,
// and the phoenix fire only appears on the closing line.
const beatOrder = withPayoff.flatMap((line) => [...line.matchAll(/data-beat="([a-z]+)"/g)].map((match) => match[1]));
assert.deepEqual(beatOrder, ["gaze", "death", "ember", "phoenix"]);
assert.match(storyLines[1], /data-beat="gaze" data-fx="quake">睜開</, "the eye opens on 睜開 and shakes the panel");
assert.match(storyLines[2], /data-beat="death"[^>]*>死亡</);
assert.match(withPayoff.at(-1), /data-beat="phoenix"/);
withPayoff.slice(0, -1).forEach((line) => assert.doesNotMatch(line, /data-beat="phoenix"/));
assert.match(getPhoenixPayoffLine(0), /data-fx="flare"/);
assert.match(getPhoenixPayoffLine(2), /data-fx="flare"/);
const stripTags = (html) => html.replace(/<[^>]+>/g, "");
assert.equal(stripTags(storyLines[1]), "平原的風停了，你在星穹之外看見某個存在睜開了眼。", "cue markup must not change the text");

// Typewriter timeline: characters advance in order, punctuation and cue words hold longer,
// lines pause between each other, and the finish button comes after the last character.
const timing = { charDelayMs: 100, linePauseMs: 500, cueHoldMs: 700, finishDelayMs: 900 };
const step = (char, extra = {}) => ({ char, beat: "", fx: "", cueEnd: false, ...extra });
const plan = planTypewriterTimeline([
  [step("風"), step("停", { fx: "still" }), step("。")],
  [step("睜", { beat: "gaze", fx: "quake" }), step("開", { cueEnd: true }), step("了")]
], timing);
assert.deepEqual(plan.events.map((event) => event.at), [0, 100, 200, 1040, 1140, 1940]);
assert.equal(plan.events[3].beat, "gaze");
assert.equal(plan.events[3].fx, "quake");
assert.equal(plan.events[1].fx, "still");
assert.equal(plan.finishAt, 1940 + 100 + 900, "。 holds 3.4× a character, 開 ends a cue (+700)");
assert.deepEqual(planTypewriterTimeline([], timing), { events: [], finishAt: 900 });

console.log("Run foreshadowing tests passed.");
