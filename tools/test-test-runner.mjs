import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  classifyTestFiles,
  discoverTestFiles,
  formatHelp,
  isModelTestFile,
  isTestFile,
  parseCliArguments,
  runTestFile,
  runTestSuite
} from "./run-tests.mjs";

assert.equal(isTestFile("test-commerce.mjs"), true);
assert.equal(isTestFile("analyze-v0243-economy.mjs"), false);
assert.equal(isTestFile("test-commerce.js"), false);
assert.equal(isModelTestFile("test-archer-forest-model.mjs"), true);
assert.equal(isModelTestFile("test-preparation-models.mjs"), true);
assert.equal(isModelTestFile("test-commerce.mjs"), false);

const classified = classifyTestFiles([
  "test-zeta.mjs",
  "README.md",
  "test-archer-forest-model.mjs",
  "test-alpha.mjs",
  "test-preparation-models.mjs",
  "test-alpha.mjs",
  "analyze-v0243-economy.mjs"
]);
assert.deepEqual(classified.quick, ["test-alpha.mjs", "test-zeta.mjs"]);
assert.deepEqual(classified.model, ["test-archer-forest-model.mjs", "test-preparation-models.mjs"]);
assert.deepEqual(classified.full, [
  "test-alpha.mjs",
  "test-zeta.mjs",
  "test-archer-forest-model.mjs",
  "test-preparation-models.mjs"
]);
assert.equal(new Set(classified.full).size, classified.full.length);

assert.deepEqual(parseCliArguments([]), { mode: "quick", help: false, error: null });
assert.deepEqual(parseCliArguments(["quick"]), { mode: "quick", help: false, error: null });
assert.deepEqual(parseCliArguments(["model"]), { mode: "model", help: false, error: null });
assert.deepEqual(parseCliArguments(["full"]), { mode: "full", help: false, error: null });
assert.deepEqual(parseCliArguments(["--help"]), { mode: null, help: true, error: null });
assert.match(parseCliArguments(["fast"]).error, /未知測試模式/);
assert.match(parseCliArguments(["quick", "extra"]).error, /不支援額外參數/);
assert.match(formatHelp(), /quick/);
assert.match(formatHelp(), /model/);
assert.match(formatHelp(), /full/);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "legend runner path with spaces "));
try {
  const passScript = path.join(temporaryRoot, "test-pass.mjs");
  const failScript = path.join(temporaryRoot, "test-fail.mjs");
  const ignoredScript = path.join(temporaryRoot, "analyze-ignore.mjs");
  writeFileSync(passScript, "console.log('pass-output');\n", "utf8");
  writeFileSync(failScript, "console.error('fail-output'); process.exitCode = 3;\n", "utf8");
  writeFileSync(ignoredScript, "throw new Error('must not run');\n", "utf8");

  assert.deepEqual(discoverTestFiles(temporaryRoot).sort(), ["test-fail.mjs", "test-pass.mjs"]);

  const passResult = runTestFile(passScript, { cwd: temporaryRoot });
  assert.equal(passResult.status, 0);
  assert.match(passResult.stdout, /pass-output/);
  assert.equal(passResult.error, null);

  const failResult = runTestFile(failScript, { cwd: temporaryRoot });
  assert.equal(failResult.status, 3);
  assert.match(failResult.stderr, /fail-output/);

  let suiteOutput = "";
  let suiteErrorOutput = "";
  const suiteResult = runTestSuite({
    mode: "quick",
    toolsDirectory: temporaryRoot,
    output: { write(chunk) { suiteOutput += chunk; } },
    errorOutput: { write(chunk) { suiteErrorOutput += chunk; } }
  });
  assert.equal(suiteResult.passed, 1);
  assert.equal(suiteResult.failed, 1);
  assert.equal(suiteResult.exitCode, 1);
  assert.match(suiteOutput, /\[PASS\] test-pass\.mjs/);
  assert.match(suiteOutput, /\[FAIL\] test-fail\.mjs/);
  assert.match(suiteErrorOutput, /fail-output/);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("Test runner classification, CLI parsing, and cross-platform process execution passed.");
