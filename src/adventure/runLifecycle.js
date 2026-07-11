const RUN_STATE_DEFAULTS = Object.freeze({
  encounterIndex: 0,
  turn: 0,
  hero: null,
  selectedBoss: null,
  phase: "camp",
  awaitingBlessing: false,
  ended: true,
  defeatedEnemies: 0,
  defeatedBoss: false,
  deathCause: null,
  runStats: null,
  runPreparation: null,
  canRest: false,
  hasRested: false,
  ambushAdvantage: false,
  blessingContext: "normal",
  blessingInputLocked: false,
  battleSource: "main",
  battleEncounterType: null,
  debugBuildRun: false,
  runResultRecorded: false
});

/**
 * Reset state owned by a single adventure run.
 * Enemy-group, event, and route state stay with their existing controllers.
 */
export function resetAdventureRunState(state, options = {}) {
  if (!state || typeof state !== "object") {
    throw new TypeError("resetAdventureRunState 需要可修改的 state 物件。");
  }

  const { clearLastRunSummary = false } = options;
  Object.assign(state, RUN_STATE_DEFAULTS);
  state.log = [];

  if (clearLastRunSummary) {
    state.lastRunSummary = null;
  }

  return state;
}
