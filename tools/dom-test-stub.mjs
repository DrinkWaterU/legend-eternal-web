export class TestClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    const shouldAdd = force ?? !this.values.has(name);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
  contains(name) { return this.values.has(name); }
}

export class TestNode {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.classList = new TestClassList();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.value = "";
    this.className = "";
    this.onclick = null;
    this.oninput = null;
    this.onchange = null;
    this.listeners = new Map();
    this.isConnected = true;
  }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      this.dataset[key] = String(value);
    }
  }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      delete this.dataset[key];
    }
  }
  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      if (selector === "[data-scene-step]" && node.dataset?.sceneStep !== undefined) {
        matches.push(node);
      }
      node.children?.forEach?.(visit);
    };
    this.children.forEach(visit);
    return matches;
  }
  remove() { this.removed = true; this.isConnected = false; }
  focus() { this.focused = true; }
}

export function installTestDocument() {
  globalThis.document = {
    createElement: (tagName) => new TestNode(tagName)
  };
}

export function createElementMap(ids = []) {
  return Object.fromEntries(ids.map((id) => [id, new TestNode()]));
}
