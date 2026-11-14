import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createDefaultSave } from "../../src/core/saveDefaults.js";
import { migrateSaveData, normalizeLastRunSummary } from "../../src/core/saveMigrations.js";

// 最近一次冒險摘要存在 statistics.lastRun；舊存檔沒有這個欄位時補 null，格式不對就丟掉。
assert.equal(createDefaultSave().statistics.lastRun, null, "新存檔沒有最近一次冒險");
assert.equal(migrateSaveData({ schemaVersion: 1, statistics: {} }).statistics.lastRun, null, "舊存檔補成 null");

const valid = { result: "撤退", sourceName: "海岸", reachedEncounter: 12, encounterTotal: 16, runLevel: 25, endedAt: "2026-11-14T03:00:00.000Z" };
assert.deepEqual(normalizeLastRunSummary(valid), valid);
assert.deepEqual(
  migrateSaveData({ schemaVersion: 1, statistics: { lastRun: valid } }).statistics.lastRun,
  valid,
  "遷移後保留合法的最近一次冒險"
);
assert.equal(normalizeLastRunSummary({ ...valid, result: "<b>假</b>" }), null, "不認得的結果丟掉");
assert.equal(normalizeLastRunSummary({ ...valid, encounterTotal: 0 }), null, "總場數不合理時丟掉");
assert.equal(normalizeLastRunSummary({ ...valid, sourceName: "" }), null, "沒有地點時丟掉");
assert.equal(normalizeLastRunSummary({ ...valid, reachedEncounter: 99 }).reachedEncounter, 16, "抵達場數截在總場數");
assert.equal(normalizeLastRunSummary({ ...valid, endedAt: "not a date" }).endedAt, null, "時間格式錯誤時只清掉時間");

// 寫入必須在結算存檔的同一個操作裡（finishRunOperation），不能在結算畫面另外存一次。
const controller = (await readFile(new URL("../../src/features/adventure/runResultController.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
assert.match(controller, /function finishRunOperation[\s\S]*?recordRunFinished\(outcome, options\);\n\s*recordLastRunSummary\(outcome\);[\s\S]*?afterAdventureSaved\(/);
assert.doesNotMatch(controller.slice(controller.indexOf("function renderEndSummary")), /statistics\.lastRun\s*=/, "結算畫面不得另外寫入存檔");

// 營地重新整理後改讀存檔裡的紀錄。
const camp = (await readFile(new URL("../../src/features/safeArea/campController.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
assert.match(camp, /state\.lastRunSummary \|\| saveStore\.current\.statistics\?\.lastRun/);

console.log("Last run summary persistence tests passed.");
