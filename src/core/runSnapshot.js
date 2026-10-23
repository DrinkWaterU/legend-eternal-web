import { GAME_VERSION } from "../config.js";

const TRANSIENT = new Set(["storyTimer", "anpingArrivalTimerIds", "achievementToastTimer", "activeAchievementToastId", "eventTransitionToken"]);
const PHASES = new Set(["danger", "combat", "safe", "event", "segmentChoice", "campSelection", "campReady", "story", "routeEnding", "highlandChoice"]);
const replacer = (key, value) => key === "battleHooks" ? undefined : value instanceof Set ? { $runSet: [...value] } : value;
const reviver = (key, value) => value && Object.keys(value).length === 1 && Array.isArray(value.$runSet) ? new Set(value.$runSet) : value;

export function captureRunSnapshot(state) {
  if (!state.hero || state.debugBuildRun || state.runResumeFinished || !PHASES.has(state.phase)) return null;
  const runtime = Object.fromEntries(Object.entries(state).filter(([key]) => !TRANSIENT.has(key)));
  return { format: 1, gameVersion: GAME_VERSION, state: JSON.parse(JSON.stringify(runtime, replacer)) };
}

export function readRunSnapshot(snapshot, { regions, characters, routes, events } = {}) {
  if (!snapshot) return { ok: false, reason: "沒有待續的冒險。" };
  if (snapshot.format !== 1 || snapshot.gameVersion !== GAME_VERSION) {
    return { ok: false, reason: "這段旅程來自不同版本。請先匯出備份，再選擇結束旅程；已保存的成長不會被扣除。" };
  }
  try {
    const text = JSON.stringify(snapshot.state);
    if (text.length > 2000000) throw new Error();
    const s = JSON.parse(text, reviver);
    if (!s || !PHASES.has(s.phase) || !s.hero || !validTacticalState(s) || (!s.runStats && s.battleSource !== "duel") || !Array.isArray(s.enemies)
      || !Number.isFinite(s.hero.hp) || !Number.isFinite(s.hero.maxHp) || s.hero.maxHp <= 0
      || !Number.isInteger(s.encounterIndex) || s.encounterIndex < 0 || !Number.isInteger(s.turn) || s.turn < 0
      || !Number.isInteger(s.runRandomState) || s.runRandomState < 0 || s.runRandomState > 0xffffffff
      || !Array.isArray(s.blessingChoices) || !Array.isArray(s.blessingInstances) || !Array.isArray(s.log)
      || !Array.isArray(s.hero.skills) || !Array.isArray(s.hero.blessings)
      || (s.runStats && (!Array.isArray(s.runStats.levelUps) || !Array.isArray(s.runStats.learnedSkills) || !Array.isArray(s.runStats.unlockedCharacters)))
      || s.hero.characterId !== s.selectedHeroId
      || (s.battleSource === "duel" && typeof s.specialDuelContext?.duelId !== "string")
      || s.enemies.some(enemy => !enemy || !Number.isFinite(enemy.hp) || !Number.isFinite(enemy.maxHp) || !enemy.runtimeId)
      || (s.awaitingBlessing && s.blessingChoices.length === 0)
      || (s.phase === "event" && !s.eventContext?.eventId)
      || (s.phase === "event" && events && !events(s.eventContext.eventId))
      || s.blessingChoices.some(choice => !choice || typeof choice.name !== "string" || !Array.isArray(choice.effects))
      || s.blessingInstances.some(instance => !instance?.instanceId || !instance.definition || typeof instance.definition.name !== "string")
      || s.log.some(entry => !entry || typeof entry.type !== "string" || typeof entry.text !== "string")
      || (s.runPreparation?.reducedEnemiesThisBattle && !(s.runPreparation.reducedEnemiesThisBattle instanceof Set))
      || (s.phase === "routeEnding" && (!s.routeEndingContext || !Number.isInteger(s.routeEndingContext.pageIndex)
        || s.routeEndingContext.pageIndex < 0 || (routes && !routes(s.routeEndingContext.routeId))))
      || (s.phase === "campSelection" && !Array.isArray(s.campSelection?.selectedInstanceIds))
      || (regions && !Object.hasOwn(regions, s.selectedRegionId)) || (characters && !Object.hasOwn(characters, s.selectedHeroId))
      || (s.activeRouteId && routes && routes(s.activeRouteId)?.id !== s.activeRouteId)) throw new Error();
    return { ok: true, state: s };
  } catch {
    return { ok: false, reason: "這段旅程的資料不完整。請先匯出備份，再結束旅程；永久進度會保留。" };
  }
}

function validTacticalState(s) {
  const col = n => Number.isInteger(n) && n >= 0 && n <= 2;
  const battleValid = (b, heroColumn, enemies) => !b || (
    Array.isArray(b.rocks) && b.rocks.length === 3 && b.rocks.every(n => Number.isInteger(n) && n >= 0 && n <= 3)
    && Array.isArray(b.pattern) && b.pattern.length > 0 && b.pattern.length <= 12
    && b.pattern.every(n => Number.isInteger(n) && n >= -2 && n <= 2)
    && col(heroColumn) && Array.isArray(enemies) && enemies.every(e => col(e.battleColumn))
    && (!b.intents || (Array.isArray(b.intents) && b.intents.length <= 3 && b.intents.every(i => i && typeof i.id === "string"
      && ["track", "move", "charge", "anchor", "gust", "build", "rally", "flurry"].includes(i.kind)
      && (!["move", "charge", "build"].includes(i.kind) || col(i.column))
      && (i.kind !== "track" || [1, 2].includes(i.range))
      && (i.kind !== "gust" || [-2, 2].includes(i.direction)))))
    && (!b.windOverrides || (typeof b.windOverrides === "object" && !Array.isArray(b.windOverrides)
      && Object.entries(b.windOverrides).every(([key, value]) => /^\d+$/.test(key) && [-2, -1, 0, 1, 2].includes(value)))));
  if (!battleValid(s.highlandBattle, s.hero?.battleColumn, s.enemies)) return false;
  if (s.pendingThreat && !battleValid(s.pendingThreat.highlandBattle, s.pendingThreat.heroBattleColumn, s.pendingThreat.enemies)) return false;
  const r = s.hero?.weaponRuntime;
  if (r && ![[r.charge, 3], [r.weight, 4], [r.impact, 3], [r.chain, 2]].every(([n, max]) => Number.isInteger(n) && n >= 0 && n <= max)) return false;
  for (const h of [s.hero, s.pendingThreat?.heroCombat].filter(Boolean)) {
    if (h.highlandOpportunities && (Array.isArray(h.highlandOpportunities) || typeof h.highlandOpportunities !== "object"
      || !Object.entries(h.highlandOpportunities).every(([key, value]) => ["wind", "ride", "break"].includes(key) && Number.isFinite(value) && value >= 0 && value <= 16))) return false;
  }
  if (s.highlandChoices && (Array.isArray(s.highlandChoices) || typeof s.highlandChoices !== "object"
    || !Object.entries(s.highlandChoices).every(([key, value]) => ["0", "4", "8"].includes(key) && ["shelter", "gale"].includes(value)))) return false;
  return s.phase !== "highlandChoice" || (s.selectedRegionId === "highlands" && [0, 4, 8].includes(s.routeEncounterIndex)
    && !s.highlandChoices?.[s.routeEncounterIndex]);
}

export function restoreRunSnapshot(target, snapshot, definitions) {
  const result = readRunSnapshot(snapshot, definitions);
  if (!result.ok) throw new Error(result.reason);
  // Only restore fields owned by the runtime; imported object keys cannot add
  // properties or change the prototype of the long-lived application state.
  for (const key of Object.keys(target)) {
    if (!TRANSIENT.has(key) && Object.hasOwn(result.state, key)) target[key] = result.state[key];
  }
  target.storyTimer = null;
  target.achievementToastTimer = null;
  target.activeAchievementToastId = null;
  target.anpingArrivalTimerIds = [];
  target.eventInputLocked = false;
  target.blessingInputLocked = false;
  if (target.campSelection) target.campSelection.locked = false;
  if (target.hero && target.runPreparation) target.hero.activePreparation = target.runPreparation;
  return target;
}

export function withRunRandom(state, action) {
  let seed = Number.isInteger(state.runRandomState) ? state.runRandomState >>> 0 : Math.floor(Math.random() * 0x100000000) >>> 0;
  const original = Math.random;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  try { return action(); }
  finally {
    Math.random = original;
    if (state.hero) state.runRandomState = seed;
  }
}
