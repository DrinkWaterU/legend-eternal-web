import assert from "node:assert/strict";
import { installTestDocument, TestNode } from "./dom-test-stub.mjs";
installTestDocument();
// Application imports require the selector registry but no instance is created.
globalThis.document.querySelectorAll = () => [];
const { startGame } = await import("../src/app/startGame.js");
const { saveGame, deleteStoredSave } = await import("../src/core/storage.js");
const { createDefaultSave } = await import("../src/core/saveDefaults.js");
let held = false;
const locks = { async request(name, options, callback) {
  assert.equal(options.ifAvailable, true);
  if (held) return callback(null);
  held = true;
  try { return await callback({ name }); } finally { held = false; }
} };
function environment() {
  const events = new Map();
  const nodes = [];
  let reloads = 0;
  return { nodes, events, get reloads() { return reloads; },
    documentRef: { body: { append(node) { nodes.push(node); } }, createElement(tag) {
      const node = new TestNode(tag); node.showModal = () => { node.open = true; }; return node;
    } },
    windowRef: { addEventListener(name, callback) { events.set(name, callback); }, location: { reload() { reloads++; } } }
  };
}
let starts = 0;
const createApp = () => ({ start() { starts++; } });
const a = environment();
await startGame({ ...a, navigatorRef: { locks }, createApp });
assert.equal(starts, 1);
const b = environment();
await startGame({ ...b, navigatorRef: { locks }, createApp });
assert.equal(starts, 1, "Blocked tab cannot load or migrate a save");
assert.equal(b.nodes[0].open, true);
a.events.get("pagehide")();
await new Promise(resolve => setTimeout(resolve, 0));
const c = environment();
await startGame({ ...c, navigatorRef: { locks }, createApp });
assert.equal(starts, 2, "A fresh document can acquire a released lock");
c.events.get("pagehide")();
assert.equal(saveGame(createDefaultSave()), false, "A hidden/released document cannot write even via a legacy API");
assert.throws(() => deleteStoredSave(), /寫入權/);
c.events.get("pageshow")({ persisted: true });
assert.equal(c.reloads, 1, "bfcache documents must reload instead of reusing stale memory");
const unsupported = environment();
await startGame({ ...unsupported, navigatorRef: {}, createApp });
assert.equal(starts, 2);
assert.equal(unsupported.nodes[0].open, true);
const insecure = environment();
insecure.windowRef.isSecureContext = false;
await startGame({ ...insecure, navigatorRef: {}, createApp });
assert.match(insecure.nodes[0].children[1].textContent, /HTTPS.*localhost/);
console.log("Writer lock: exclusive startup, blocked migration, release/reload, unsupported browser and stale write prevention passed.");
