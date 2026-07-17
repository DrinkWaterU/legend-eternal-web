import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const reviewedWarningFiles = new Set([
  "src/audio/musicManager.js", // 單一 BGM 狀態機；切割會分散 transition token 與 Audio lifecycle。
  "src/features/facility/facilityController.js", // 安全區設施總協調器；只負責既有子控制器 routing 與返回脈絡。
  "src/ui/debugScenarioPanel.js", // 單一 Debug 情境編輯器；接近 300 行目標且無玩家 Runtime 責任。
  "src/ui/dom.js", // 純 DOM selector registry；集中維持 HTML 對照比拆散更容易查找。
  "src/ui/guildAdventureRecordView.js", // 單一公會資歷視圖；含同一頁的無障礙收合動畫與內容渲染。
  "src/ui/merchantController.js" // 單一旅行商人交易流程，單筆與批次共享同一交易視窗狀態。
]);

const sourceFiles = await collectJavaScriptFiles(sourceRoot);
const gamePath = path.join(root, "game.js");
const gameSource = await readFile(gamePath, "utf8");
const gameLines = countLines(gameSource);
assert.ok(gameLines <= 300, `game.js 不得超過 300 行，目前 ${gameLines} 行`);
assert.doesNotMatch(gameSource, /function\s+(?:startEncounter|runTurn|showCharacter|showFacility|saveGame)/,
  "game.js 不得重新收納具體玩法流程");

const warningFiles = [];
for (const filePath of sourceFiles) {
  const source = await readFile(filePath, "utf8");
  const lines = countLines(source);
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  assert.ok(lines <= 400, `${relativePath} 超過 400 行硬性上限：${lines}`);
  assert.doesNotMatch(source, /(?:from|import\s*)\s*["'][^"']*game\.js["']/,
    `${relativePath} 不得反向 import game.js`);
  if (lines > 300) warningFiles.push(relativePath);
}

assert.deepEqual(
  warningFiles.sort(),
  [...reviewedWarningFiles].sort(),
  "301～400 行檔案必須列入明確審查清單；請拆分或補上單一責任理由"
);

console.log(`Architecture boundaries passed: game.js ${gameLines} lines, ${sourceFiles.length} source modules, ${warningFiles.length} reviewed warning files.`);

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(fullPath));
    } else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function countLines(source) {
  if (!source) return 0;
  return source.replace(/\n$/, "").split("\n").length;
}
