import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";

const VALID_MODES = new Set(["quick", "model", "full"]);
const TEST_FILE_PATTERN = /^test-.*\.mjs$/;
const MODEL_TEST_FILE_PATTERN = /-models?\.mjs$/;

export function isTestFile(fileName) {
  return TEST_FILE_PATTERN.test(String(fileName || ""));
}

export function isModelTestFile(fileName) {
  return isTestFile(fileName) && MODEL_TEST_FILE_PATTERN.test(fileName);
}

export function classifyTestFiles(fileNames) {
  const all = [...new Set(fileNames.filter(isTestFile))].sort((left, right) => left.localeCompare(right, "en"));
  const model = all.filter(isModelTestFile);
  const quick = all.filter((fileName) => !isModelTestFile(fileName));

  return {
    quick,
    model,
    full: [...quick, ...model]
  };
}

export function discoverTestFiles(toolsDirectory) {
  return readdirSync(toolsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isTestFile);
}

export function matchesTestFilter(fileName, match = "") {
  const normalizedMatch = String(match || "").trim().toLowerCase();
  return !normalizedMatch || String(fileName || "").toLowerCase().includes(normalizedMatch);
}

export function parseCliArguments(args = []) {
  const remaining = [...args];
  if (remaining[0] === "--help" || remaining[0] === "-h") {
    return { mode: null, match: "", help: true, error: null };
  }
  let mode = "quick";
  let match = "";
  if (remaining[0] && !remaining[0].startsWith("-")) {
    const requestedMode = remaining.shift();
    if (!VALID_MODES.has(requestedMode)) {
      return {
        mode: null,
        match: "",
        help: false,
        error: `未知測試模式：${requestedMode}`
      };
    }
    mode = requestedMode;
  }
  if (remaining.length === 0) {
    return { mode, match, help: false, error: null };
  }
  if (remaining[0] !== "--match") {
    return {
      mode: null,
      match: "",
      help: false,
      error: `不支援額外參數：${remaining.join(" ")}`
    };
  }
  remaining.shift();
  match = String(remaining.shift() || "").trim();
  if (!match) {
    return {
      mode: null,
      match: "",
      help: false,
      error: "--match 需要提供測試名稱片段"
    };
  }
  if (remaining.length > 0) {
    return {
      mode: null,
      match: "",
      help: false,
      error: `不支援額外參數：${remaining.join(" ")}`
    };
  }
  return { mode, match, help: false, error: null };
}

export function runTestFile(testFilePath, options = {}) {
  const startedAt = process.hrtime.bigint();
  const result = spawnSync(options.nodePath || process.execPath, [testFilePath], {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env || process.env,
    shell: false,
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024
  });
  const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

  return {
    filePath: testFilePath,
    status: typeof result.status === "number" ? result.status : 1,
    signal: result.signal || null,
    error: result.error || null,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    durationSeconds
  };
}

export function formatHelp() {
  return [
    "用法：node tools/run-tests.mjs [quick|model|full]",
    "",
    "模式：",
    "  quick  執行所有一般 test-*.mjs，排除 *-model.mjs 與 *-models.mjs（預設）",
    "  model  只執行正式平衡模型測試",
    "  full   先執行 quick，再執行 model",
    "",
    "篩選：",
    "  --match <文字>  只執行檔名包含指定文字的測試；找不到時以錯誤結束",
    "",
    "範例：",
    "  node tools/run-tests.mjs",
    "  node tools/run-tests.mjs quick",
    "  node tools/run-tests.mjs quick --match blacksmith",
    "  node tools/run-tests.mjs model",
    "  node tools/run-tests.mjs full"
  ].join("\n");
}

export function runTestSuite({
  mode,
  match = "",
  toolsDirectory,
  output = process.stdout,
  errorOutput = process.stderr
}) {
  const classified = classifyTestFiles(discoverTestFiles(toolsDirectory));
  const selectedTests = (classified[mode] || []).filter((fileName) => matchesTestFilter(fileName, match));
  const startedAt = process.hrtime.bigint();
  const results = [];

  output.write(`Mode: ${mode}\n`);
  if (match) {
    output.write(`Match: ${match}\n`);
  }
  output.write(`Tests: ${selectedTests.length}\n\n`);
  if (selectedTests.length === 0) {
    errorOutput.write(`找不到符合條件的測試：${match || mode}\n`);
    return {
      mode,
      match,
      selectedTests,
      results,
      passed: 0,
      failed: 0,
      durationSeconds: 0,
      exitCode: 2
    };
  }

  for (const fileName of selectedTests) {
    const testFilePath = path.join(toolsDirectory, fileName);
    const result = runTestFile(testFilePath, { cwd: path.dirname(toolsDirectory) });
    results.push({ fileName, ...result });

    const durationLabel = `${result.durationSeconds.toFixed(2)}s`.padStart(8);
    const passed = result.status === 0 && !result.error;

    if (isModelTestFile(fileName) && result.stdout.trim()) {
      output.write(`--- ${fileName} ---\n${result.stdout.trimEnd()}\n`);
    }

    if (passed) {
      output.write(`[PASS] ${fileName.padEnd(40)} ${durationLabel}\n`);
      continue;
    }

    output.write(`[FAIL] ${fileName.padEnd(40)} ${durationLabel}\n`);
    if (result.stdout.trim()) {
      errorOutput.write(`\n[stdout] ${fileName}\n${result.stdout.trimEnd()}\n`);
    }
    if (result.stderr.trim()) {
      errorOutput.write(`\n[stderr] ${fileName}\n${result.stderr.trimEnd()}\n`);
    }
    if (result.error) {
      errorOutput.write(`\n[spawn error] ${fileName}\n${result.error.stack || result.error.message}\n`);
    }
    if (result.signal) {
      errorOutput.write(`\n[signal] ${fileName}: ${result.signal}\n`);
    }
  }

  const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  const failed = results.filter((result) => result.status !== 0 || result.error);
  const passed = results.length - failed.length;

  output.write("\n");
  output.write(`Mode: ${mode}\n`);
  output.write(`Passed: ${passed}\n`);
  output.write(`Failed: ${failed.length}\n`);
  output.write(`Duration: ${durationSeconds.toFixed(2)}s\n`);

  if (failed.length > 0) {
    output.write(`Failed tests: ${failed.map((result) => result.fileName).join(", ")}\n`);
  }

  return {
    mode,
    match,
    selectedTests,
    results,
    passed,
    failed: failed.length,
    durationSeconds,
    exitCode: failed.length === 0 ? 0 : 1
  };
}

export function main(args = process.argv.slice(2)) {
  const parsed = parseCliArguments(args);
  if (parsed.help) {
    console.log(formatHelp());
    return 0;
  }
  if (parsed.error) {
    console.error(parsed.error);
    console.error("");
    console.error(formatHelp());
    return 2;
  }

  const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
  return runTestSuite({ mode: parsed.mode, match: parsed.match, toolsDirectory }).exitCode;
}

const isDirectExecution = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  process.exitCode = main();
}
