import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { renderBlessingChoices } from "../src/ui/renderHelpers.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

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
  { id: "blessing-one", name: "祝福一", eventTitle: "一", eventText: "一", flavorText: "一", effectText: "一", rarity: "common" },
  { id: "blessing-two", name: "祝福二", eventTitle: "二", eventText: "二", flavorText: "二", effectText: "二", rarity: "common" },
  { id: "blessing-three", name: "祝福三", eventTitle: "三", eventText: "三", flavorText: "三", effectText: "三", rarity: "common" }
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
      ownedCounts: { "blessing-one": 3 },
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
  assert.equal(container.children[0].classList.contains("has-owned-count"), true, "已持有祝福卡應標記數量狀態");
  assert.equal(container.children[0].children[0].textContent, "×3", "已持有祝福應顯示實際數量");
  assert.equal(container.children[0].attributes["aria-label"], "祝福一，目前持有 3 個", "可存取名稱應包含持有數量");
  assert.equal(container.children[1].children.length, 0, "未持有祝福不得顯示 ×0");
  assert.equal(container.children[1].attributes["aria-label"], "祝福二", "未持有祝福不朗讀 0 個");
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
assert.match(blessingControllerSource, /instance\?\.blessingId/, "祝福持有數量應依 blessingId 計算");
assert.match(blessingControllerSource, /ownedCounts: getOwnedBlessingCounts\(\)/, "祝福三選一應傳入目前持有數量");

console.log("Blessing reveal and input lock tests passed.");
