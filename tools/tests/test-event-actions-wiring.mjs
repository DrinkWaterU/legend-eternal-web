import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 事件綁定從 actions 解構出的每個函式，都必須由 createEventActions 提供。
// 漏傳時 addEventListener 會綁到 undefined：按鈕點了沒反應，也不會報錯。
// （2026-11-14：營地「任務紀錄」就是這樣失效的。）
const root = new URL("../../", import.meta.url);
const normalize = (source) => source.replace(/\r\n?/g, "\n");
const [bindings, application] = (await Promise.all([
  readFile(new URL("src/app/eventBindings.js", root), "utf8"),
  readFile(new URL("src/app/createApplication.js", root), "utf8")
])).map(normalize);

const destructure = bindings.match(/export function bindApplicationEvents[\s\S]*?const \{([\s\S]*?)\} = actions;/);
assert.ok(destructure, "找不到 bindApplicationEvents 對 actions 的解構");
const requiredNames = destructure[1]
  .split(",")
  .map((part) => part.trim().split(/[\s:=]/)[0])
  .filter(Boolean);
assert.ok(requiredNames.length > 20, "解構出的 action 數量異常，可能是比對規則失效");

const actionsStart = application.indexOf("function createEventActions(");
assert.ok(actionsStart >= 0, "找不到 createEventActions");
const actionsBody = application.slice(actionsStart, application.indexOf("\n}\n", actionsStart));
const providedNames = new Set([...actionsBody.matchAll(/^\s{4}(\w+):/gm)].map((match) => match[1]));

const missing = requiredNames.filter((name) => !providedNames.has(name));
assert.deepEqual(missing, [], `createEventActions 缺少：${missing.join("、")}`);

console.log(`Event action wiring tests passed (${requiredNames.length} actions).`);
