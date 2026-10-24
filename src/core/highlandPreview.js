import { highlandIntents, projectHighlandWind, actOnHighland, resolveHighlandWind, resolveHighlandEnemyIntent } from "./highlandBattle.js";
import { projectedHighlandThreats } from "./highlandTelegraphs.js";

// Reuse terrain and intent resolution, without attacking, rolling RNG or touching
// the live run. These are conditional consequences if the casters survive.
export function previewHighlandTurn(state, action = { type: "attack" }) {
  if (!state.highlandBattle) return null;
  const intents = highlandIntents(state), wind = projectHighlandWind(state, action, intents);
  const simulation = { ...state, hero: { ...state.hero, highlandOpportunities: { ...state.hero.highlandOpportunities } },
    enemies: state.enemies.map(e => ({ ...e })), highlandBattle: structuredClone(state.highlandBattle),
    runPreparation: state.runPreparation ? { ...state.runPreparation } : null };
  const b = simulation.highlandBattle, log = { fixed() {} }, free = ["slip", "tool-step"].includes(action.type);
  if (free) return { wind, final: wind, threats: [], collateral: [], interrupted: null, free: true };
  b.actionOriginColumn = simulation.hero.battleColumn;
  b.baselineWind = Object.fromEntries(projectHighlandWind(state).slice(1).map(p => [p.unit.runtimeId, p.destination]));
  simulation.turn++;
  if (["move", "ride", "break", "demolish", "gust-break", "shove", "tool-brace", "tool-rock"].includes(action.type)) actOnHighland(simulation, action, log);
  if (action.type === "lunge") simulation.hero.battleColumn = simulation.enemies.find(e => e.runtimeId === state.targetEnemyId)?.battleColumn;
  resolveHighlandWind(simulation, action, intents, log);
  const collateral = [], threats = [];
  for (const enemy of simulation.enemies) {
    if (enemy.hp <= 0) continue;
    const hp = new Map(simulation.enemies.map(e => [e.runtimeId, e.hp]));
    const intent = intents.find(i => i.id === enemy.runtimeId);
    if (!resolveHighlandEnemyIntent(simulation, enemy, intent, action, log)) threats.push(intent);
    for (const target of simulation.enemies) if (target.hp < hp.get(target.runtimeId)) collateral.push({
      actorId: enemy.runtimeId, targetId: target.runtimeId, damage: hp.get(target.runtimeId) - target.hp, defeated: target.hp <= 0 });
  }
  // A player attack might kill the ally-damage caster, leaving its victim alive
  // to attack. Never promise safety based on that conditional collateral kill.
  const possibleThreats = ["attack", "lunge", "sweep", "cleave", "breach"].includes(action.type) ? projectedHighlandThreats(state, wind, intents) : threats;
  return { wind, final: [simulation.hero, ...simulation.enemies].map((unit, n) => ({ unit: n ? state.enemies[n - 1] : state.hero,
    destination: unit.battleColumn, hp: unit.hp })), threats: possibleThreats, collateral, interrupted: b.interruptedEnemyTurn === simulation.turn ? b.interruptedEnemyId : null, free: false };
}
