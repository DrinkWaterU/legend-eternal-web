import forestData from "./forest.json" with { type: "json" };

export const forestEnemies = forestData.enemies;
export const forestElites = forestData.elites;
export const forestBosses = forestData.bosses;
export const forestEncounterPlan = forestData.encounterPlan;
export const forestBlessings = forestData.blessings;

export const forestRegion = {
  id: forestData.id,
  name: forestData.name,
  description: forestData.description,
  note: forestData.note,
  visual: forestData.visual,
  encounterCount: forestData.encounterPlan.length,
  bossName: forestData.bosses.map((boss) => boss.name).join(" / "),
  difficulty: forestData.difficulty,
  recommendedLevel: forestData.recommendedLevel,
  scaling: forestData.scaling,
  encounterPlan: forestData.encounterPlan,
  enemies: forestData.enemies,
  elites: forestData.elites,
  bosses: forestData.bosses,
  boss: forestData.bosses[0],
  blessings: forestData.blessings
};
