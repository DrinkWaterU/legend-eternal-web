import { GAME_VERSION } from "../config.js";

const TRANSIENT = new Set(["storyTimer", "anpingArrivalTimerIds", "achievementToastTimer", "activeAchievementToastId", "eventTransitionToken"]);
const PHASES = new Set(["danger", "combat", "safe", "event", "segmentChoice", "campSelection", "campReady", "story", "routeEnding"]);
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
    if (!s || !PHASES.has(s.phase) || !s.hero || (!s.runStats && s.battleSource !== "duel") || !Array.isArray(s.enemies)
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
