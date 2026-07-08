import assert from "node:assert/strict";
import { getRouteDefinition } from "../src/data/routes/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import {
  renderEventResultView,
  renderRouteEndingView
} from "../src/ui/eventView.js";

function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    toArray: () => [...values]
  };
}

function createNode() {
  const children = [];
  return {
    hidden: false,
    disabled: false,
    textContent: "",
    classList: createClassList(),
    append: (...nodes) => children.push(...nodes),
    replaceChildren: (...nodes) => {
      children.length = 0;
      children.push(...nodes);
    },
    querySelectorAll: () => [],
    get children() {
      return children;
    }
  };
}

const route = getRouteDefinition("goblin-camp");
const ending = route?.ending;
assert.ok(ending, "哥布林營地 Route 應直接持有 ending content");
assert.equal(ending.title, "營地深處");
assert.equal(ending.pages.length, 4, "弓箭手 Route Ending 應固定四頁");
assert.equal(ending.pages[2].tone, "archer");
assert.deepEqual(
  ending.pages[2].lines.map((line) => line.role),
  ["archer", "narration", "archer", "archer", "player", "archer", "archer", "archer"]
);
assert.deepEqual(
  ending.pages.at(-1).lines.at(-1),
  { role: "ending", text: "「等我能重新拉弓，我會去找你。」" }
);

const plainsStory = regionDefinitions.plains?.clearStory;
assert.ok(plainsStory, "平原正式劇情應放在 Region data");
assert.equal(plainsStory.lines.length, 5);
assert.match(plainsStory.lines[0], /story-mark-star/);
assert.match(plainsStory.lines.at(-1), /story-mark-phoenix/);

const panel = createNode();
const eventNarrative = createNode();
eventNarrative.closest = (selector) => selector === ".event-panel" ? panel : null;

globalThis.document = {
  createElement: () => createNode()
};

const els = {
  combatLayout: createNode(),
  eventLayout: createNode(),
  eventEyebrow: createNode(),
  eventTitle: createNode(),
  eventNarrative,
  eventPrompt: createNode(),
  eventReward: createNode(),
  eventChoices: createNode(),
  eventContinueButton: createNode()
};

renderRouteEndingView({
  els,
  eyebrow: ending.eyebrow,
  title: ending.title,
  tone: ending.pages[2].tone,
  narrative: ending.pages[2].lines,
  actionLabel: "繼續"
});

assert.equal(panel.classList.contains("route-ending-panel"), true);
assert.equal(panel.classList.contains("route-ending-tone-archer"), true);
assert.equal(eventNarrative.classList.contains("route-ending-narrative"), true);
assert.deepEqual(
  eventNarrative.children.map((node) => node.classList.toArray()),
  ending.pages[2].lines.map((line) => ["route-ending-line", `route-ending-line-${line.role}`])
);
assert.equal(eventNarrative.children.some((node) => node.classList.contains("event-narrative-emphasis")), false);
assert.equal(els.eventContinueButton.textContent, "繼續");

renderEventResultView({
  els,
  event: { title: "林間營火" },
  narrative: ["第一段", "一般事件最後一段"],
  rewardLines: [],
  followUpChoices: [],
  onFollowUp: () => {},
  hasDefaultTarget: true,
  defaultActionLabel: "繼續森林"
});

assert.equal(panel.classList.contains("route-ending-panel"), false);
assert.equal(panel.classList.contains("route-ending-tone-archer"), false);
assert.equal(eventNarrative.classList.contains("route-ending-narrative"), false);
assert.equal(eventNarrative.children.at(-1).classList.contains("event-narrative-emphasis"), true);

console.log("Route ending presentation and content ownership tests passed.");
