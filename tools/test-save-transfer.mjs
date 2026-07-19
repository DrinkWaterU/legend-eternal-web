import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createDefaultSave } from "../src/core/storage.js";
import {
  createLegacySaveTransferCode,
  createSaveTransferCode,
  createSaveTransferFileName,
  downloadSaveTransferFile,
  parseSaveTransferCode,
  readSaveTransferFile
} from "../src/ui/saveTools.js";

const save = createDefaultSave();
save.inventory.gold = 12345;
for (let index = 0; index < 40; index += 1) {
  const id = `test_material_${index}`;
  save.inventory.materials[id] = { id, name: `測試素材 ${index}`, quantity: index + 1 };
}

const legacyCode = createLegacySaveTransferCode(save, "v0.2.7.0.1-alpha");
const compressedCode = await createSaveTransferCode(save, "v0.2.7.0.2-alpha");
assert.match(legacyCode, /^LE_SAVE_1:/);
assert.match(compressedCode, /^LE_SAVE_2:/);
assert.ok(compressedCode.length < legacyCode.length * 0.6, "壓縮碼應顯著短於舊版 Base64 存檔碼");

const legacyPayload = await parseSaveTransferCode(legacyCode);
const compressedPayload = await parseSaveTransferCode(compressedCode);
assert.equal(legacyPayload.format, 1);
assert.equal(compressedPayload.format, 2);
assert.deepEqual(legacyPayload.save, save);
assert.deepEqual(compressedPayload.save, save);

await assert.rejects(() => parseSaveTransferCode("LE_SAVE_2:broken"), /無法解析/);
await assert.rejects(() => parseSaveTransferCode("UNKNOWN:value"), /無法解析/);
assert.equal(await readSaveTransferFile({ text: async () => ` \n${compressedCode}\n ` }), compressedCode);
await assert.rejects(() => readSaveTransferFile({ text: async () => "  " }), /內容空白/);

const fileName = createSaveTransferFileName("v0.2.7.0.2-alpha", new Date("2026-07-19T00:00:00.000Z"));
assert.equal(fileName, "傳說永恆_v0.2.7.0.2-alpha_2026-07-19.lesave");

let clicked = false;
let appended = false;
let removed = false;
let createdBlob = null;
let revokedUrl = null;
const anchor = {
  click() { clicked = true; },
  remove() { removed = true; }
};
const documentRef = {
  body: {
    append(element) {
      appended = element === anchor;
    }
  },
  createElement(tagName) {
    assert.equal(tagName, "a");
    return anchor;
  }
};
class FakeBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
    createdBlob = this;
  }
}
const urlApi = {
  createObjectURL(blob) {
    assert.equal(blob, createdBlob);
    return "blob:test-save";
  },
  revokeObjectURL(url) {
    revokedUrl = url;
  }
};
const downloadedName = downloadSaveTransferFile(compressedCode, "v0.2.7.0.2-alpha", {
  documentRef,
  urlApi,
  BlobCtor: FakeBlob
});
assert.equal(downloadedName, createSaveTransferFileName("v0.2.7.0.2-alpha"));
assert.deepEqual(createdBlob.parts, [compressedCode]);
assert.equal(anchor.href, "blob:test-save");
assert.equal(anchor.download, downloadedName);
assert.equal(appended, true);
assert.equal(clicked, true);
assert.equal(removed, true);
assert.equal(revokedUrl, "blob:test-save");

const root = new URL("../", import.meta.url);
const [html, dom, saveTransferDom, bindings, application, controller] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("src/ui/dom.js", root), "utf8"),
  readFile(new URL("src/ui/saveTransferDom.js", root), "utf8"),
  readFile(new URL("src/app/eventBindings.js", root), "utf8"),
  readFile(new URL("src/app/createApplication.js", root), "utf8"),
  readFile(new URL("src/features/profile/saveTransferController.js", root), "utf8")
]);
for (const id of ["downloadSaveFileButton", "importSaveFileInput", "chooseSaveFileButton"]) {
  assert.match(html, new RegExp(`id="${id}"`));
  assert.match(saveTransferDom, new RegExp(`${id}:`));
}
assert.match(dom, /getSaveTransferElements\(document\)/);
for (const action of ["downloadSaveFile", "chooseSaveFile", "handleSaveFileSelected"]) {
  assert.match(bindings, new RegExp(action));
  assert.match(application, new RegExp(action));
  assert.match(controller, new RegExp(`function ${action}\\(`));
}

console.log("LE_SAVE_1／LE_SAVE_2 與 .lesave 存檔移轉測試通過。");
