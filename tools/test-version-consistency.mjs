import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { GAME_VERSION, SAVE_SCHEMA_VERSION } from "../src/config.js";

const [
  versionFile,
  readme,
  html,
  styleIndex,
  editorSource
] = await Promise.all([
  readFile(new URL("../VERSION", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("./content-editor.js", import.meta.url), "utf8")
]);

const officialVersion = versionFile.trim();
const cacheVersion = officialVersion.replace(/^v/, "");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

assert.match(officialVersion, /^v\d+\.\d+\.\d+(?:\.\d+)?-[a-z0-9.-]+$/i, "VERSION 格式無效");
assert.equal(GAME_VERSION, officialVersion, "src/config.js 的 GAME_VERSION 必須與 VERSION 一致");
assert.equal(SAVE_SCHEMA_VERSION, 6, "本版不應提高 Save Schema");
assert.match(readme, new RegExp("目前版本：`" + escapeRegExp(officialVersion) + "`"), "README 目前版本未同步");
assert.match(html, new RegExp(`<p class="version-label">${escapeRegExp(officialVersion)}</p>`), "主選單版本標籤未同步");

const htmlCacheVersions = [...html.matchAll(/(?:styles\.css|game\.js)\?v=([^"']+)/g)].map((match) => match[1]);
assert.equal(htmlCacheVersions.length, 2, "index.html 應有 styles.css 與 game.js 兩個 cache version");
assert.deepEqual([...new Set(htmlCacheVersions)], [cacheVersion], "index.html cache version 未同步");

const styleCacheVersions = [...styleIndex.matchAll(/\?v=([^"\)]+)/g)].map((match) => match[1]);
assert.equal(styleCacheVersions.length, 6, "styles.css 應維持 6 個內部樣式 import");
assert.deepEqual([...new Set(styleCacheVersions)], [cacheVersion], "內部 CSS cache version 未同步");

const editorVersion = editorSource.match(/const DEFAULT_GAME_VERSION = "([^"]+)"/)?.[1] || null;
assert.equal(editorVersion, officialVersion, "Content Editor 預設遊戲版本未同步");

console.log(`Version consistency tests passed: ${officialVersion}`);
