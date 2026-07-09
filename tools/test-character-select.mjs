import assert from "node:assert/strict";

import { characterDefinitions } from "../src/data/characters/index.js";
import { renderCharacterCards } from "../src/ui/characterSelectView.js";

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

  toggle(name, force) {
    const shouldAdd = force ?? !this.values.has(name);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
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
    this.dataset = {};
    this.textContent = "";
    this.className = "";
    this.type = "";
    this.alt = "";
    this.src = "";
    this.listeners = new Map();
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  remove() {}

  click() {
    this.listeners.get("click")?.();
  }
}

globalThis.document = {
  createElement: (tagName) => new TestNode(tagName)
};

function flattenText(node) {
  return [node.textContent, ...node.children.map(flattenText)].filter(Boolean).join(" ");
}

const container = new TestNode();
let openedCharacterId = null;
let lockedHintCount = 0;
const characterProgression = {
  adventurer: { unlocked: true, level: 25 },
  archer: { unlocked: false, level: 1 }
};

renderCharacterCards({
  element: container,
  characterDefinitions,
  characterProgression,
  selectedCharacterId: "adventurer",
  onCharacterClick: (characterId) => {
    openedCharacterId = characterId;
  },
  onLockedCharacterClick: () => {
    lockedHintCount += 1;
  }
});

assert.equal(container.children.length, 2, "角色列表應依 characterDefinitions 建立兩張角色卡");
assert.match(flattenText(container.children[0]), /冒險者/);
assert.doesNotMatch(flattenText(container.children[1]), /弓箭手/, "未解鎖角色卡不得提前暴雷角色名稱");
assert.match(flattenText(container.children[1]), /尚未相遇/);
container.children[1].click();
assert.equal(lockedHintCount, 1, "鎖定角色卡應只開啟未知角色提示");
assert.equal(openedCharacterId, null, "鎖定角色卡不得進角色詳情");

characterProgression.archer.unlocked = true;
renderCharacterCards({
  element: container,
  characterDefinitions,
  characterProgression,
  selectedCharacterId: "adventurer",
  onCharacterClick: (characterId) => {
    openedCharacterId = characterId;
  },
  onLockedCharacterClick: () => {
    lockedHintCount += 1;
  }
});

assert.match(flattenText(container.children[1]), /弓箭手/);
assert.match(flattenText(container.children[1]), /精準・追擊/);
assert.match(flattenText(container.children[1]), /Lv\. 1/);
container.children[1].click();
assert.equal(openedCharacterId, "archer", "已解鎖角色卡應進入對應角色詳情");

console.log("Character card renderer tests passed.");
