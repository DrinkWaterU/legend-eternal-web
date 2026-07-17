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

class TestScheduler {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.tasks = [];
  }

  setTimeout(callback, delay = 0) {
    const task = {
      id: this.nextId,
      runAt: this.now + Math.max(0, Number(delay) || 0),
      callback
    };
    this.nextId += 1;
    this.tasks.push(task);
    this.tasks.sort((left, right) => left.runAt - right.runAt || left.id - right.id);
    return task.id;
  }

  advanceTo(targetTime) {
    while (this.tasks.length > 0 && this.tasks[0].runAt <= targetTime) {
      const task = this.tasks.shift();
      this.now = task.runAt;
      task.callback();
    }
    this.now = targetTime;
  }
}
const blessings = [
  { name: "祝福一", eventTitle: "一", eventText: "一", flavorText: "一", effectText: "一", rarity: "common" },
  { name: "祝福二", eventTitle: "二", eventText: "二", flavorText: "二", effectText: "二", rarity: "common" },
  { name: "祝福三", eventTitle: "三", eventText: "三", flavorText: "三", effectText: "三", rarity: "common" }
];

const container = new TestNode();
const chosen = [];
let revealCompleteCount = 0;
const scheduler = new TestScheduler();
const nativeSetTimeout = globalThis.setTimeout;

try {
  globalThis.setTimeout = (callback, delay) => scheduler.setTimeout(callback, delay);

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

  scheduler.advanceTo(0);
  assert.equal(container.children[0].classList.contains("is-revealed"), true, "第一張祝福應先揭露");
  assert.equal(container.children[1].classList.contains("is-revealed"), false, "第二張祝福不應與第一張同時揭露");

  scheduler.advanceTo(20);
  assert.equal(container.children[1].classList.contains("is-revealed"), true, "第二張祝福應依序揭露");
  assert.equal(container.children[2].classList.contains("is-revealed"), false, "第三張祝福應等待自己的揭露時機");

  scheduler.advanceTo(40);
  assert.equal(container.children[2].classList.contains("is-revealed"), true, "第三張祝福應在自己的揭露時機顯示");
  assert.ok(container.children.every((button) => button.disabled), "最後一張開始揭露時仍不可立即操作");

  scheduler.advanceTo(60);
  assert.ok(container.children.every((button) => !button.disabled), "全部動畫完成後才應解除卡片 disabled");
  assert.ok(container.children.every((button) => !button.classList.contains("is-revealing")), "揭露完成後應移除 revealing 狀態");
  assert.equal(revealCompleteCount, 1, "揭露完成 callback 應只執行一次");
  container.children[0].click();
  assert.deepEqual(chosen, ["祝福一"], "解除鎖定後應可正常選擇祝福");
} finally {
  globalThis.setTimeout = nativeSetTimeout;
}

const blessingControllerSource = await readFile(new URL("../src/features/blessing/blessingController.js", import.meta.url), "utf8");
assert.match(blessingControllerSource, /state\.blessingInputLocked = true;[\s\S]*renderBlessingChoices\(/, "showBlessings 應先鎖定祝福輸入");
assert.match(blessingControllerSource, /function chooseBlessing\(blessing\) \{\s*if \(state\.blessingInputLocked\) return;\s*state\.blessingInputLocked = true;/, "chooseBlessing 應具備 runtime lock guard 與雙擊防護");

console.log("Blessing reveal and input lock tests passed.");
