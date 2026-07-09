import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { renderBlessingChoices } from "../src/ui/renderHelpers.js";

class TestClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

class TestNode {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.classList = new TestClassList();
    this.children = [];
    this.className = "";
    this.type = "";
    this.innerHTML = "";
    this.disabled = false;
    this.listeners = new Map();
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  click() {
    if (!this.disabled) {
      this.listeners.get("click")?.();
    }
  }
}

globalThis.document = {
  createElement: (tagName) => new TestNode(tagName)
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const blessings = [
  { name: "祝福一", eventTitle: "一", eventText: "一", flavorText: "一", effectText: "一", rarity: "common" },
  { name: "祝福二", eventTitle: "二", eventText: "二", flavorText: "二", effectText: "二", rarity: "common" },
  { name: "祝福三", eventTitle: "三", eventText: "三", flavorText: "三", effectText: "三", rarity: "common" }
];

const container = new TestNode();
const chosen = [];
let revealCompleteCount = 0;

renderBlessingChoices(
  container,
  blessings,
  (blessing) => chosen.push(blessing.name),
  {
    reveal: true,
    revealIntervalMs: 20,
    revealDurationMs: 20,
    onRevealComplete: () => {
      revealCompleteCount += 1;
    }
  }
);

assert.equal(container.children.length, 3, "應一次建立全部祝福卡，避免 Grid 在揭露期間重排");
assert.ok(container.children.every((button) => button.disabled), "揭露期間全部祝福卡都應 disabled");
assert.ok(container.children.every((button) => button.classList.contains("is-revealing")), "揭露期間應套用 revealing 狀態");
container.children[0].click();
assert.deepEqual(chosen, [], "揭露期間點擊不得選取祝福");

await wait(5);
assert.equal(container.children[0].classList.contains("is-revealed"), true, "第一張祝福應先揭露");
assert.equal(container.children[1].classList.contains("is-revealed"), false, "第二張祝福不應與第一張同時揭露");

await wait(22);
assert.equal(container.children[1].classList.contains("is-revealed"), true, "第二張祝福應依序揭露");
assert.equal(container.children[2].classList.contains("is-revealed"), false, "第三張祝福應等待自己的揭露時機");

await wait(38);
assert.ok(container.children.every((button) => !button.disabled), "全部動畫完成後才應解除卡片 disabled");
assert.ok(container.children.every((button) => !button.classList.contains("is-revealing")), "揭露完成後應移除 revealing 狀態");
assert.equal(revealCompleteCount, 1, "揭露完成 callback 應只執行一次");
container.children[0].click();
assert.deepEqual(chosen, ["祝福一"], "解除鎖定後應可正常選擇祝福");

const gameSource = await readFile(new URL("../game.js", import.meta.url), "utf8");
assert.match(gameSource, /state\.blessingInputLocked = true;[\s\S]*renderBlessingChoices\(/, "showBlessings 應先鎖定祝福輸入");
assert.match(gameSource, /function chooseBlessing\(blessing\) \{\s*if \(state\.blessingInputLocked\) \{\s*return;\s*\}\s*state\.blessingInputLocked = true;/, "chooseBlessing 應具備 runtime lock guard 與雙擊防護");

console.log("Blessing reveal and input lock tests passed.");
