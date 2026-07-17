import { syncSafeAreaUnlocks } from "../../core/safeAreaProgression.js";
import { clone } from "../../utils.js";

export function createRunRecords({
  state,
  saveStore,
  currentRegion,
  currentRoute,
  questRuntime,
  saveGameSafe
}) {
  function recordRunStarted() {
    const stats = saveStore.current.statistics;
    const regionStats = stats.regions[state.selectedRegionId];
    const characterStats = stats.characters[state.selectedHeroId];
    const characterProgress = saveStore.current.progression.characters[state.selectedHeroId];

    stats.totalRuns += 1;
    regionStats.runs += 1;
    characterStats.runs += 1;
    characterProgress.runs += 1;
    saveGameSafe();
  }

  function captureRunStartPermanentState() {
    const regionId = state.selectedRegionId;
    const characterId = state.selectedHeroId;
    return {
      regionId,
      characterId,
      gold: saveStore.current.inventory.gold,
      materials: clone(saveStore.current.inventory.materials),
      totalRuns: saveStore.current.statistics.totalRuns,
      regionRuns: saveStore.current.statistics.regions[regionId].runs,
      characterRuns: saveStore.current.statistics.characters[characterId].runs,
      characterProgressRuns: saveStore.current.progression.characters[characterId].runs
    };
  }

  function restoreRunStartPermanentState(snapshot) {
    if (!snapshot) return;
    saveStore.current.inventory.gold = snapshot.gold;
    saveStore.current.inventory.materials = clone(snapshot.materials);
    saveStore.current.statistics.totalRuns = snapshot.totalRuns;
    saveStore.current.statistics.regions[snapshot.regionId].runs = snapshot.regionRuns;
    saveStore.current.statistics.characters[snapshot.characterId].runs = snapshot.characterRuns;
    saveStore.current.progression.characters[snapshot.characterId].runs = snapshot.characterProgressRuns;
  }

  function recordEnemyDefeated(isBoss, enemy = null) {
    if (state.debugBuildRun) return;
    saveStore.current.statistics.totalEnemiesDefeated += 1;
    if (isBoss) {
      saveStore.current.statistics.bossesDefeated += 1;
    }
    questRuntime?.recordEnemyDefeated({
      enemyId: enemy?.id || null,
      enemyKind: enemy?.kind || (isBoss ? "首領" : null),
      enemyFamily: enemy?.family || null,
      regionId: state.selectedRegionId,
      routeId: state.activeRouteId || null,
      debugBuildRun: false
    });
    saveGameSafe();
  }

  function recordRunFinished(outcome) {
    if (state.debugBuildRun || state.runResultRecorded) return;

    const stats = saveStore.current.statistics;
    const regionStats = stats.regions[state.selectedRegionId];
    const characterStats = stats.characters[state.selectedHeroId];
    const regionProgress = saveStore.current.progression.regions[state.selectedRegionId];
    const characterProgress = saveStore.current.progression.characters[state.selectedHeroId];
    const cleared = outcome === "clear";
    const retreated = outcome === "retreat";
    const evacuated = retreated && Boolean(state.runStats?.evacuated);
    const bestEncounter = cleared ? currentRegion().encounterCount : state.encounterIndex + 1;

    regionStats.bestEncounter = Math.max(regionStats.bestEncounter, bestEncounter);
    regionProgress.bestEncounter = Math.max(regionProgress.bestEncounter, bestEncounter);
    stats.highestRunLevel = Math.max(stats.highestRunLevel, state.runStats?.endLevel || 1);
    characterStats.highestRunLevel = Math.max(characterStats.highestRunLevel, state.runStats?.endLevel || 1);
    stats.fleeAttempts += state.runStats?.fleeAttempts || 0;
    stats.fleeSuccesses += state.runStats?.fleeSuccesses || 0;
    stats.fleeFailures += state.runStats?.fleeFailures || 0;
    stats.safeEscapes += state.runStats?.safeEscapes || 0;
    stats.counterEscapes += state.runStats?.counterEscapes || 0;
    stats.evacuationEscapes += state.runStats?.evacuationEscapes || 0;

    applyOutcomeCounters({ cleared, retreated, evacuated, stats, regionStats, characterStats, regionProgress, characterProgress });
    if (cleared) {
      questRuntime?.recordRunCleared({
        regionId: state.selectedRegionId,
        routeId: state.activeRouteId || null,
        clearSourceId: currentRoute()?.clearSourceId || "main",
        debugBuildRun: false
      });
    }
    syncSafeAreaUnlocks(saveStore.current);
    state.runResultRecorded = true;
    saveGameSafe();
  }

  function applyOutcomeCounters({
    cleared,
    retreated,
    evacuated,
    stats,
    regionStats,
    characterStats,
    regionProgress,
    characterProgress
  }) {
    if (cleared) {
      stats.totalClears += 1;
      regionStats.clears += 1;
      characterStats.clears += 1;
      regionProgress.clears += 1;
      characterProgress.clears += 1;
      if (state.selectedRegionId === "forest" && regionStats.routeClears) {
        const routeKey = currentRoute()?.clearSourceId === "goblinCamp" ? "goblinCamp" : "main";
        regionStats.routeClears[routeKey] = (regionStats.routeClears[routeKey] || 0) + 1;
      }
      return;
    }
    if (retreated && !evacuated) {
      stats.totalRetreats += 1;
      regionStats.retreats += 1;
      characterStats.retreats += 1;
      return;
    }
    stats.totalDefeats += 1;
  }

  return Object.freeze({
    recordRunStarted,
    captureRunStartPermanentState,
    restoreRunStartPermanentState,
    recordEnemyDefeated,
    recordRunFinished
  });
}
