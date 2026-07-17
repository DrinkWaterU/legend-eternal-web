import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertDialogueDefinitions } from "../src/core/dialogue.js";
import { createDefaultSave } from "../src/core/storage.js";
import { dialogueDefinitions } from "../src/data/dialogues.js";
import { facilityDefinitions } from "../src/data/facilities.js";
import { assertNpcDefinitions, npcDefinitions } from "../src/data/npcs.js";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(toolsDir);
const npcDir = path.join(root, "src/data/npcs");
const dialogueDir = path.join(root, "src/data/dialogues");
const celineSourcePath = path.join(root, "企劃/v0.2.6/v0.2.6.1-alpha/瑟琳對話.txt");

const [npcFiles, dialogueFiles, npcAdapter, dialogueAdapter, celineSource] = await Promise.all([
  readdir(npcDir),
  readdir(dialogueDir),
  readFile(path.join(root, "src/data/npcs.js"), "utf8"),
  readFile(path.join(root, "src/data/dialogues.js"), "utf8"),
  readFile(celineSourcePath, "utf8")
]);

assert.deepEqual(npcFiles.filter((name) => name.endsWith(".json")).sort(), [
  "anping-blacksmith.json",
  "anping-guild-receptionist.json"
]);
assert.deepEqual(dialogueFiles.filter((name) => name.endsWith(".json")).sort(), [
  "anping-blacksmith.json",
  "anping-guild-receptionist.json"
]);

const rawNpcs = await loadJsonFiles(npcDir, npcFiles);
const rawDialogues = await loadJsonFiles(dialogueDir, dialogueFiles);
rawNpcs.forEach(({ fileName, data }) => {
  assert.equal(`${data.id}.json`, fileName, `NPC JSON 檔名應與 id 一致：${fileName}`);
  assertDeclarativeData(data, `NPC ${data.id}`);
});
rawDialogues.forEach(({ fileName, data }) => {
  const expectedFile = data.id.replace(/-main$/, "") + ".json";
  assert.equal(expectedFile, fileName, `Dialogue JSON 檔名應與 id 一致：${fileName}`);
  assertDeclarativeData(data, `Dialogue ${data.id}`);
});

const storyFlagKeys = Object.keys(createDefaultSave().storyFlags);
assert.equal(assertNpcDefinitions(npcDefinitions, { storyFlagKeys, dialogueDefinitions }), true);
assert.equal(assertDialogueDefinitions(dialogueDefinitions, {
  npcDefinitions,
  storyFlagKeys,
  facilityDefinitions
}), true);

for (const forbiddenText of ["……有事？", "當然可以。到了陌生地方懂得先摸清底細"]) {
  assert.doesNotMatch(npcAdapter, new RegExp(escapeRegExp(forbiddenText)), "NPC adapter 不應保存 NPC 文本");
  assert.doesNotMatch(dialogueAdapter, new RegExp(escapeRegExp(forbiddenText)), "Dialogue adapter 不應保存 NPC 文本");
}

const celine = dialogueDefinitions["anping-guild-receptionist-main"];
const sourceSections = [
  {
    start: "對「先告訴我這裡能做什麼。」的回應",
    end: "對「一定要登記嗎？」的回應",
    nodeId: "first-feature-overview",
    count: 4
  },
  {
    start: "詢問冒險者公會\n\n第一頁",
    end: "話題結束後返回一般選項。",
    nodeId: "about-guild",
    count: 5,
    startIncludesFirstPage: true
  },
  {
    start: "關於妳的工作\n\n第一頁",
    end: "話題結束後返回聊天選單。",
    nodeId: "about-work",
    count: 4,
    startIncludesFirstPage: true
  },
  {
    start: "妳一直都在安平鎮嗎？\n\n第一頁",
    end: "話題結束後返回聊天選單。",
    nodeId: "about-anping",
    count: 4,
    startIncludesFirstPage: true
  }
];

sourceSections.forEach((section) => {
  const sourcePages = extractPages(celineSource, section);
  const jsonPages = celine.nodes[section.nodeId].pages.map((page) => normalizeText(page.text));
  assert.equal(sourcePages.length, section.count, `${section.nodeId} 來源頁數錯誤`);
  assert.equal(jsonPages.length, section.count, `${section.nodeId} JSON 頁數錯誤`);
  assert.deepEqual(jsonPages, sourcePages, `${section.nodeId} 必須逐頁對齊瑟琳對話.txt`);
});

console.log("NPC/Dialogue raw JSON contracts, adapter separation, and Celine source synchronization tests passed.");

async function loadJsonFiles(directory, fileNames) {
  return Promise.all(fileNames.filter((name) => name.endsWith(".json")).map(async (fileName) => ({
    fileName,
    data: JSON.parse(await readFile(path.join(directory, fileName), "utf8"))
  })));
}

function assertDeclarativeData(value, source, seen = new Set()) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return;
  assert.notEqual(typeof value, "function", `${source} 不得包含 function`);
  assert.equal(typeof value, "object", `${source} 只能包含 JSON 資料`);
  if (seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(key, /callback|handler|expression|script|function/iu, `${source} 不得包含可執行欄位：${key}`);
    assertDeclarativeData(child, `${source}.${key}`, seen);
  }
}

function extractPages(source, { start, end, count, startIncludesFirstPage = false }) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `找不到來源章節：${start}`);
  const contentStart = startIncludesFirstPage
    ? startIndex + start.indexOf("第一頁")
    : startIndex + start.length;
  const endIndex = source.indexOf(end, contentStart);
  assert.notEqual(endIndex, -1, `找不到來源章節結尾：${end}`);
  const section = source.slice(contentStart, endIndex);
  const markers = ["第一頁", "第二頁", "第三頁", "第四頁", "第五頁"].slice(0, count);
  return markers.map((marker, index) => {
    const markerIndex = section.indexOf(marker);
    assert.notEqual(markerIndex, -1, `找不到頁面標記：${start} ${marker}`);
    const bodyStart = markerIndex + marker.length;
    const nextMarker = markers[index + 1];
    const bodyEnd = nextMarker ? section.indexOf(nextMarker, bodyStart) : section.length;
    assert.ok(bodyEnd >= bodyStart, `頁面範圍無效：${start} ${marker}`);
    return normalizeText(section.slice(bodyStart, bodyEnd));
  });
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/gu, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
