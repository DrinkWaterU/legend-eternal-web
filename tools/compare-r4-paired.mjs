// Compare two R4 paired outputs (e.g. the saved baseline and the R5-01 rerun).
// Usage: node tools/compare-r4-paired.mjs <before.json.gz> <after.json.gz>
// Prints categories, move counts, wins, changed pairs/scenes and protected-target breach decisions.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const [beforeFile, afterFile] = process.argv.slice(2);
if (!beforeFile || !afterFile) { console.error("usage: node tools/compare-r4-paired.mjs <before.json.gz> <after.json.gz>"); process.exit(2); }
const load = (file) => JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
const before = load(beforeFile), after = load(afterFile);

const countBy = (items, key) => items.reduce((acc, item) => { const k = key(item); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
function stats(data) {
  const modes = {};
  for (const row of data.rows) {
    const m = modes[row.mode] ||= { runs: 0, wins: 0, turns: 0, endHp: 0, actions: {} };
    m.runs++; m.wins += row.won ? 1 : 0; m.turns += row.turns; m.endHp += row.endHp;
    for (const [type, n] of Object.entries(row.actions)) m.actions[type] = (m.actions[type] || 0) + n;
  }
  const protectedBreach = data.rows.flatMap((row) => row.decisions
    .filter((d) => d.selected.type === "breach" && d.before.enemies.find((e) => e.id === d.selected.target)?.protected)
    .map((d) => ({ mode: row.mode, build: row.build, path: row.path, seed: row.seed, battle: d.index + 1, turn: d.before.turn, target: d.before.enemies.find((e) => e.id === d.selected.target) })));
  const sceneActions = {};
  for (const scene of data.scenes) for (const [type, n] of Object.entries(scene.actions)) {
    const key = `${scene.mode}:${type}`; sceneActions[key] = (sceneActions[key] || 0) + n;
  }
  return {
    waveRatio: data.waveRatio,
    source: data.source?.label || "(no source label: pre-R5-02 output)",
    categories: countBy(data.pairs, (p) => p.category),
    sceneCategories: countBy(data.scenePairs, (p) => p.category),
    modes,
    sceneActions,
    protectedBreach
  };
}
const pairKey = (p) => `${p.build}/${p.path}/seed${p.seed}`;
const sceneKey = (p) => `${p.region}#${p.index}/opt${p.option}/${p.build}/seed${p.seed}`;
function changed(listA, listB, key) {
  const mapB = new Map(listB.map((p) => [key(p), p]));
  return listA.map((a) => ({ key: key(a), a, b: mapB.get(key(a)) }))
    .filter(({ a, b }) => b && (a.category !== b.category || a.breach.turns !== b.breach.turns || a.wave.turns !== b.wave.turns || a.breach.endHp !== b.breach.endHp || a.wave.endHp !== b.wave.endHp))
    .map(({ key: k, a, b }) => ({ case: k, category: a.category === b.category ? a.category : `${a.category} -> ${b.category}`,
      breach: `${a.breach.won ? "W" : "L"} ${a.breach.turns}t/${a.breach.endHp}hp -> ${b.breach.won ? "W" : "L"} ${b.breach.turns}t/${b.breach.endHp}hp`,
      wave: `${a.wave.won ? "W" : "L"} ${a.wave.turns}t/${a.wave.endHp}hp -> ${b.wave.won ? "W" : "L"} ${b.wave.turns}t/${b.wave.endHp}hp` }));
}
console.log(JSON.stringify({
  before: stats(before),
  after: stats(after),
  changedPairs: changed(before.pairs, after.pairs, pairKey),
  changedScenes: changed(before.scenePairs, after.scenePairs, sceneKey)
}, null, 1));
