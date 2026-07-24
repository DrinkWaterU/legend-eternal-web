import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { regionDefinitions } from "../src/data/regions/index.js";
import { renderRegionChoiceList } from "../src/ui/regionChoiceView.js";

function createElement(tagName) {
  const listeners = {};
  return {
    tagName,
    children: [],
    styleValues: {},
    style: {
      setProperty(name, value) {
        this.owner.styleValues[name] = value;
      },
      owner: null
    },
    append(...children) {
      this.children.push(...children);
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    click() {
      listeners.click?.();
    }
  };
}

const documentRef = {
  baseURI: "https://example.test/legend-eternal/",
  createElement(tagName) {
    const element = createElement(tagName);
    element.style.owner = element;
    return element;
  }
};
const list = {
  children: [],
  replaceChildren() {
    this.children = [];
  },
  append(element) {
    this.children.push(element);
  }
};
let selectedRegionId = null;
renderRegionChoiceList({
  element: list,
  regions: regionDefinitions,
  documentRef,
  onSelect: (regionId) => {
    selectedRegionId = regionId;
  }
});

assert.equal(list.children.length, Object.keys(regionDefinitions).length);
const forestCard = list.children.find((button) => button.children[0].children[0].textContent === "森林");
assert.ok(forestCard);
assert.equal(forestCard.className, "choice-button region-choice-card");
assert.equal(
  forestCard.styleValues["--region-choice-background-desktop"],
  'url("https://example.test/legend-eternal/assets/images/regions/forest/forest-outer.jpg")'
);
assert.equal(
  forestCard.styleValues["--region-choice-background-mobile"],
  'url("https://example.test/legend-eternal/assets/images/regions/forest/forest-outer-mobile.jpg")'
);
assert.doesNotMatch(
  forestCard.styleValues["--region-choice-background-desktop"],
  /src\/styles\/assets/
);
assert.equal(forestCard.children[0].children[1].textContent, "進階｜Lv.15+");
assert.match(forestCard.children[1].textContent, /16 場遭遇/);
forestCard.click();
assert.equal(selectedRegionId, "forest");

const coastCard = list.children.find((button) => button.children[0].children[0].textContent === "海岸");
assert.ok(coastCard, "第三地區玩家可見名稱應為海岸");
assert.match(coastCard.children[1].textContent, /海灘段落｜16 場遭遇/);

const root = new URL("../", import.meta.url);
const [uiCss, responsiveCss] = await Promise.all([
  readFile(new URL("src/styles/ui-refresh.css", root), "utf8"),
  readFile(new URL("src/styles/responsive.css", root), "utf8")
]);
assert.match(uiCss, /\.region-choice-card\s*\{[\s\S]*--region-choice-background-desktop/);
assert.match(uiCss, /\.region-choice-card:hover\s*\{[\s\S]*?transform: scale\(0\.99\)/);
assert.match(
  uiCss,
  /\.region-choice-card:hover,[\s\S]*?background-position: center;[\s\S]*?background-repeat: no-repeat;[\s\S]*?background-size: cover;/
);
assert.match(
  responsiveCss,
  /\.choice-button\.region-choice-card\s*\{[\s\S]*?--region-choice-background-current:[\s\S]*?--region-choice-background-mobile/
);
assert.match(uiCss, /\.statistics-region-detail-heading > div:first-child\s*\{[\s\S]*display: grid/);
assert.match(uiCss, /\.statistics-region-detail-heading p\s*\{[\s\S]*overflow-wrap: anywhere/);

console.log("地區圖片選擇卡與冒險紀錄標題排版測試通過。");
