// Re-run the R4 paired review against an isolated copy of the source with a fixed wave ratio.
// Usage: node tools/r4-reproduce-source.mjs <45|100> [rounds=12] [--workdir=<dir>] [--compare]
//
// The script copies src/ and the two R4 tool files into a work directory, applies the ratio
// patch there (45 uses tools/patches/r4-wave-ratio-45.patch; 100 is the current source),
// and runs tools/analyze-r4-gameplay.mjs inside the copy. Outputs stay in the copy's
// tools/verification-artifacts/. The project working tree and its baselines are not written.
// --compare checks the copy's outputs against the project's saved r4-paired-<ratio> files,
// ignoring the "source" label that newer outputs add.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { isDeepStrictEqual } from "node:util";
import os from "node:os";
import path from "node:path";

const SOURCES = {
  45: { label: "wave-ratio-45-patch", patch: "tools/patches/r4-wave-ratio-45.patch" },
  100: { label: "wave-ratio-100-current", patch: null }
};
const COPIED_TOOLS = ["tools/analyze-r4-gameplay.mjs", "tools/r3-review-harness.mjs", "tools/r4-policy-damage.mjs"];

const fail = (message) => { console.error(`r4-reproduce-source: ${message}`); process.exit(1); };
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const workdirFlag = args.find((a) => a.startsWith("--workdir="))?.slice("--workdir=".length);
const compare = args.includes("--compare");
const unknown = args.filter((a) => a.startsWith("--") && a !== "--compare" && !a.startsWith("--workdir="));
if (unknown.length) fail(`unknown option ${unknown.join(" ")}`);
const tag = positional[0];
const source = SOURCES[tag];
if (!source) fail(`first argument must be one of ${Object.keys(SOURCES).join(", ")}`);
const rounds = positional[1] || "12";
if (!/^\d+$/.test(rounds)) fail(`rounds must be an integer, got "${rounds}"`);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let workdir;
if (workdirFlag) {
  workdir = path.resolve(workdirFlag);
  const inside = path.relative(projectRoot, workdir);
  if (!inside.startsWith("..") && !path.isAbsolute(inside)) fail("--workdir must be outside the project so the copy cannot touch project files");
  if (existsSync(workdir) && readdirSync(workdir).length) fail(`--workdir ${workdir} is not empty`);
  mkdirSync(workdir, { recursive: true });
} else {
  workdir = mkdtempSync(path.join(os.tmpdir(), `r4-source-${tag}-`));
}

const git = (cwd, ...gitArgs) => execFileSync("git", gitArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
let baseHead = null;
let baseDirty = null;
try { baseHead = git(projectRoot, "rev-parse", "HEAD"); baseDirty = git(projectRoot, "status", "--porcelain") !== ""; } catch { /* not a git checkout */ }

cpSync(path.join(projectRoot, "src"), path.join(workdir, "src"), { recursive: true });
for (const file of COPIED_TOOLS) cpSync(path.join(projectRoot, file), path.join(workdir, file), { recursive: true });

if (source.patch) {
  const patchFile = path.join(projectRoot, source.patch);
  // git apply works outside a repository; --check fails if the patch context no longer matches.
  try {
    git(workdir, "apply", "--check", patchFile);
    git(workdir, "apply", patchFile);
  } catch (error) {
    fail(`${source.patch} does not apply to the current src/. The source has moved on; rebuild the patch before reproducing.\n${error.stderr || error.message}`);
  }
}

console.log(`Work directory: ${workdir}`);
console.log(`Source: ${source.label}${source.patch ? ` (${source.patch})` : ""}, base ${baseHead ?? "unknown"}${baseDirty ? " + uncommitted changes" : ""}`);
const run = spawnSync(process.execPath, ["tools/analyze-r4-gameplay.mjs", rounds, tag], {
  cwd: workdir,
  stdio: "inherit",
  env: {
    ...process.env,
    R4_SOURCE_LABEL: source.label,
    R4_SOURCE_PATCH: source.patch || "",
    R4_SOURCE_BASE_HEAD: baseHead || "",
    R4_SOURCE_BASE_DIRTY: baseDirty === null ? "" : String(baseDirty)
  }
});
if (run.status !== 0) fail(`analysis exited with ${run.status}`);

if (compare) {
  const strip = ({ source: _ignored, ...rest }) => rest;
  const pairsToCompare = [
    [`r4-paired-${tag}-summary.json`, (buf) => JSON.parse(buf.toString("utf8"))],
    [`r4-paired-${tag}.json.gz`, (buf) => JSON.parse(gunzipSync(buf).toString("utf8"))]
  ];
  let allSame = true;
  for (const [name, parse] of pairsToCompare) {
    const saved = path.join(projectRoot, "tools", "verification-artifacts", name);
    if (!existsSync(saved)) { console.log(`compare ${name}: no saved file in project`); allSame = false; continue; }
    const same = isDeepStrictEqual(strip(parse(readFileSync(saved))), strip(parse(readFileSync(path.join(workdir, "tools", "verification-artifacts", name)))));
    console.log(`compare ${name}: ${same ? "identical to saved baseline (ignoring source label)" : "DIFFERENT from saved baseline"}`);
    allSame &&= same;
  }
  process.exitCode = allSame ? 0 : 3;
}
