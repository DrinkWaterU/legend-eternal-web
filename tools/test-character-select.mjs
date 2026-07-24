import assert from "node:assert/strict";

import { characterDefinitions } from "../src/data/characters/index.js";
import { renderCharacterCards } from "../src/ui/characterSelectView.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

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

assert.equal(container.children.length, 3, "角色列表應依 characterDefinitions 建立三張角色卡");
assert.match(flattenText(container.children[0]), /冒險者/);
assert.doesNotMatch(flattenText(container.children[1]), /弓箭手/, "未解鎖角色卡不得提前暴雷角色名稱");
assert.match(flattenText(container.children[1]), /尚未相遇/);
assert.doesNotMatch(flattenText(container.children[2]), /凱哥/, "未解鎖角色卡不得提前暴雷凱哥名稱");
assert.match(flattenText(container.children[2]), /尚未相遇/);
container.children[1].click();
assert.equal(lockedHintCount, 1, "鎖定角色卡應只開啟未知角色提示");
assert.equal(openedCharacterId, null, "鎖定角色卡不得進角色詳情");

characterProgression.archer.unlocked = true;
characterProgression.kaige = { unlocked: true, level: 1 };
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
const kaigePortrait = container.children[2].children[0].children[0].children[0];
assert.equal(kaigePortrait.style.objectPosition, "50% 24%");
assert.equal(kaigePortrait.style.transform, "scale(1.35)");
assert.equal(kaigePortrait.style.transformOrigin, "50% 24%");

console.log("Character card renderer tests passed.");
