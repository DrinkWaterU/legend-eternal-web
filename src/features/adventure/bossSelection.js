import { clone, weightedRandomItem } from "../../utils.js";

export function createBossSelection({ state }) {
  function getRegionBosses(region) {
    return Array.isArray(region.bosses) && region.bosses.length > 0
      ? region.bosses
      : [region.boss].filter(Boolean);
  }

  function selectRunBoss(region, bossId = null) {
    const bosses = getRegionBosses(region);
    const selected = bossId ? bosses.find((boss) => boss.id === bossId) : null;
    const boss = selected || weightedRandomItem(bosses, (candidate) => Number(candidate.weight) || 100);
    return clone(boss);
  }

  function recordSelectedBossInRunStats() {
    if (!state.runStats || !state.selectedBoss) return;
    state.runStats.bossId = state.selectedBoss.id;
    state.runStats.bossName = state.selectedBoss.name;
  }

  return Object.freeze({
    getRegionBosses,
    selectRunBoss,
    recordSelectedBossInRunStats
  });
}
