import plainsData from "./plains.json" with { type: "json" };

export const plainsEnemies = plainsData.enemies;
export const plainsElites = plainsData.elites;
export const plainsBoss = plainsData.boss;
export const plainsEncounterPlan = plainsData.encounterPlan;
export const plainsBlessings = plainsData.blessings;

export const plainsRegion = {
  id: plainsData.id,
  name: plainsData.name,
  description: plainsData.description,
  audio: plainsData.audio,
  visual: plainsData.visual,
  clearStory: plainsData.clearStory,
  encounterCount: plainsData.encounterPlan.length,
  bossName: plainsData.boss.name,
  difficulty: plainsData.difficulty,
  preparations: plainsData.preparations || [],
  encounterPlan: plainsData.encounterPlan,
  enemies: plainsData.enemies,
  elites: plainsData.elites,
  boss: plainsData.boss,
  blessings: plainsData.blessings
};
