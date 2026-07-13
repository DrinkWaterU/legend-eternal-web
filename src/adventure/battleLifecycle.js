const BATTLE_ENTRY_DEFAULTS = Object.freeze({
  turn: 0,
  awaitingBlessing: false,
  phase: "danger",
  canRest: false,
  hasRested: false,
  ambushAdvantage: false,
  battleSource: "main",
  battleEncounterType: null
});

/**
 * Reset state owned by one battle entry.
 * Enemy creation, hero battle state, Preparation, skills, encounter log entries,
 * and rendering remain with their existing coordinators.
 */
export function resetBattleEntryState(state, options = {}) {
  if (!state || typeof state !== "object") {
    throw new TypeError("resetBattleEntryState 需要可修改的 state 物件。");
  }

  const {
    source = BATTLE_ENTRY_DEFAULTS.battleSource,
    encounterType = BATTLE_ENTRY_DEFAULTS.battleEncounterType,
    ambushAdvantage = BATTLE_ENTRY_DEFAULTS.ambushAdvantage
  } = options;

  Object.assign(state, BATTLE_ENTRY_DEFAULTS, {
    ambushAdvantage: Boolean(ambushAdvantage),
    battleSource: source || BATTLE_ENTRY_DEFAULTS.battleSource,
    battleEncounterType: encounterType || null
  });
  state.log = [];

  return state;
}
