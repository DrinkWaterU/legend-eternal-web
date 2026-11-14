export const RUN_STARTING_FLEES = 2;
export const NORMAL_FLEE_CHANCE = 0.8;
export const ELITE_FLEE_CHANCE = 0.55;
export const SAFE_ESCAPE_ENEMY_HEAL_RATIO = 0.05;
export const COUNTER_ESCAPE_ENEMY_HEAL_RATIO = 0.05;
export const COUNTER_ESCAPE_HEAL_RATIO = 0.1;
export const COUNTER_ESCAPE_SCALING_OFFSET = 3;
export const TACTICAL_FLEE_RESULTS = Object.freeze([
  { id: "safe", weight: 75 },
  { id: "counter", weight: 25 }
]);
export const LAST_BAG_FLOW_WEIGHT_MULTIPLIER = 0.6;
export const REST_HEAL_RATIO = 0.15;
export const PLAINS_TRIAL_ACHIEVEMENT_ID = "plains_trial";
export const FOREST_TRIAL_ACHIEVEMENT_ID = "forest_trial";
export const GOBLIN_CAMP_CLEAR_ACHIEVEMENT_ID = "goblin_camp_clear";
export const BEACH_TRIAL_ACHIEVEMENT_ID = "beach_trial";
export const COAST_TRIAL_ACHIEVEMENT_ID = "coast_trial";
// Phoenix awakening typewriter: per-character delay, pause between lines,
// hold after a cue word, and the wait before the finish button appears.
export const STORY_TYPEWRITER_TIMING = Object.freeze({
  charDelayMs: 72,
  linePauseMs: 750,
  cueHoldMs: 700,
  finishDelayMs: 900
});
export const ACHIEVEMENT_TOAST_DURATION_MS = 4600;
