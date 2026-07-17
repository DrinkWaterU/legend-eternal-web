import assert from "node:assert/strict";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...tokens) {
    tokens.forEach((token) => this.values.add(String(token)));
  }

  remove(...tokens) {
    tokens.forEach((token) => this.values.delete(String(token)));
  }

  toggle(token, force) {
    const key = String(token);
    if (force === true) {
      this.values.add(key);
      return true;
    }
    if (force === false) {
      this.values.delete(key);
      return false;
    }
    if (this.values.has(key)) {
      this.values.delete(key);
      return false;
    }
    this.values.add(key);
    return true;
  }

  contains(token) {
    return this.values.has(String(token));
  }
}

class FakeElement {
  constructor({ id = "", tagName = "div" } = {}) {
    this.id = id;
    this.tagName = String(tagName).toUpperCase();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {
      setProperty() {},
      removeProperty() {}
    };
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.className = "";
    this.src = "";
    this.alt = "";
    this.title = "";
    this.type = "";
    this.min = "";
    this.max = "";
    this.step = "";
    this.scrollTop = 0;
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  get firstElementChild() {
    return this.children[0] ?? null;
  }

  get childElementCount() {
    return this.children.length;
  }

  append(...nodes) {
    this.children.push(...nodes.filter(Boolean));
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }

  prepend(...nodes) {
    this.children.unshift(...nodes.filter(Boolean));
  }

  replaceChildren(...nodes) {
    this.children = nodes.filter(Boolean);
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    return node;
  }

  remove() {}

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((entry) => entry !== listener));
  }

  dispatchEvent(event) {
    const listeners = this.listeners.get(event?.type) ?? [];
    listeners.forEach((listener) => listener.call(this, event));
    return true;
  }

  querySelector(selector) {
    if (selector.startsWith("#")) return getElement(selector.slice(1));
    return new FakeElement();
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }

  contains(node) {
    return node === this || this.children.includes(node);
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attributes.get(String(name)) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  toggleAttribute(name, force) {
    if (force === false) {
      this.removeAttribute(name);
      return false;
    }
    this.setAttribute(name, "");
    return true;
  }

  focus() {}
  select() {}
  scrollIntoView() {}
  setSelectionRange() {}

  getBoundingClientRect() {
    return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  cloneNode() {
    return new FakeElement({ id: this.id, tagName: this.tagName });
  }
}

const elements = new Map();

function getElement(id) {
  if (!elements.has(id)) elements.set(id, new FakeElement({ id }));
  return elements.get(id);
}

const screenIds = [
  "menuScreen",
  "campScreen",
  "regionScreen",
  "characterScreen",
  "statisticsScreen",
  "achievementScreen",
  "storageScreen",
  "safeAreaTravelScreen",
  "facilityScreen",
  "gameScreen"
];

const statisticsTabs = ["overview", "characters", "regions", "save"].map((statisticsView) => {
  const element = new FakeElement({ tagName: "button" });
  element.dataset.statisticsView = statisticsView;
  return element;
});

const documentListeners = new Map();
const documentRef = {
  body: getElement("body"),
  documentElement: getElement("documentElement"),
  querySelector(selector) {
    if (selector.startsWith("#")) return getElement(selector.slice(1).split(/[ .:[>]/u)[0]);
    return getElement(`selector:${selector}`);
  },
  querySelectorAll(selector) {
    if (selector === ".screen") return screenIds.map(getElement);
    if (selector === "[data-statistics-view]") return statisticsTabs;
    if (selector === "#anpingArrivalPanel .anping-arrival-progress i") {
      return [new FakeElement(), new FakeElement(), new FakeElement()];
    }
    return [];
  },
  createElement(tagName) {
    return new FakeElement({ tagName });
  },
  createTextNode(text) {
    const node = new FakeElement({ tagName: "#text" });
    node.textContent = String(text);
    return node;
  },
  addEventListener(type, listener) {
    const listeners = documentListeners.get(type) ?? [];
    listeners.push(listener);
    documentListeners.set(type, listeners);
  },
  removeEventListener() {}
};

const memoryStorage = new Map();
const localStorageRef = {
  getItem(key) {
    return memoryStorage.has(String(key)) ? memoryStorage.get(String(key)) : null;
  },
  setItem(key, value) {
    memoryStorage.set(String(key), String(value));
  },
  removeItem(key) {
    memoryStorage.delete(String(key));
  },
  clear() {
    memoryStorage.clear();
  }
};

class FakeAudio {
  constructor(src = "") {
    this.src = src;
    this.paused = true;
    this.volume = 1;
    this.loop = false;
    this.preload = "";
    this.currentTime = 0;
  }

  load() {}
  removeAttribute() {}
  pause() {
    this.paused = true;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
}

const windowRef = {
  location: { search: "" },
  localStorage: localStorageRef,
  scrollY: 0,
  setTimeout,
  clearTimeout,
  requestAnimationFrame(callback) {
    callback(0);
    return 1;
  },
  cancelAnimationFrame() {},
  scrollTo() {},
  confirm() {
    return true;
  },
  matchMedia() {
    return {
      matches: false,
      addEventListener() {},
      removeEventListener() {}
    };
  },
  addEventListener() {},
  removeEventListener() {}
};

globalThis.document = documentRef;
globalThis.window = windowRef;
globalThis.localStorage = localStorageRef;
globalThis.Audio = FakeAudio;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    clipboard: {
      async writeText() {}
    }
  }
});
globalThis.requestAnimationFrame = windowRef.requestAnimationFrame;
globalThis.cancelAnimationFrame = windowRef.cancelAnimationFrame;

await import(`../game.js?bootstrap=${Date.now()}`);

assert.equal(documentRef.body.dataset.scene, undefined, "主選單啟動時不應殘留冒險或營地場景");
assert.ok(documentListeners.has("click"), "應完成全域互動事件綁定");
assert.ok(getElement("openRegionButton").listeners.has("click"), "應完成主選單按鈕事件綁定");

getElement("campPlacesButton").disabled = false;
getElement("campPlacesButton").dispatchEvent({ type: "click" });
assert.ok(
  getElement("facilityScreen").classList.contains("is-active"),
  "四處看看應能透過 World API 開啟設施列表"
);

console.log("Application bootstrap smoke test passed.");
