import { buildScaledEnemy } from "../core/combat.js";
import { createRunPreparation } from "../core/preparations.js";
import { regionDefinitions } from "../data/regions/index.js";

export function createDebugRegionScenarioActions({
  state,
  prepareRunForRegion,
  applyScenarioBuild,
  setScenarioHp,
  beginBattleRuntime,
  addFixedLog,
  logCurrentEnemyGroupEncounter,
  addLog,
  render
}) {
  function startRegionEnemyScenario({ scenario, options, buildSlots, selections, debugHero }) {
    const region = regionDefinitions[scenario.regionId];
    if (!region) throw new Error(`找不到 Debug 地區：${scenario.regionId}`);
    const encounterIndex = Math.max(0, Math.min(
      region.encounterPlan.length - 1,
      Number(scenario.encounterIndex) || 0
    ));
    prepareRunForRegion(region.id, encounterIndex, {
      hero: debugHero,
      debugBuildRun: true,
      persistSelection: false
    });
    applyScenarioBuild(buildSlots, selections);
    setScenarioHp(options.hpPercent);
    state.runPreparation = scenario.preparationId
      ? createRunPreparation(region, scenario.preparationId, { enhanced: scenario.preparationEnhanced === true })
      : null;

    const definitions = Array.isArray(region.enemies) ? region.enemies : [];
    const descriptors = (scenario.enemyEntries || [{ enemyId: scenario.enemyId }]).map((entry) => {
      const definition = definitions.find((enemy) => enemy.id === entry.enemyId);
      if (!definition) throw new Error(`找不到 ${region.name} Debug 敵人：${entry.enemyId}`);
      const enemy = buildScaledEnemy(definition, region, encounterIndex);
      Object.assign(enemy, scenario.enemyOverrides || {});
      enemy.poison = 0;
      return {
        enemy,
        statScale: entry.statScale,
        attackScale: entry.attackScale,
        rewardScale: entry.rewardScale
      };
    });

    beginBattleRuntime({
      enemies: descriptors,
      source: "main",
      encounterType: "normal"
    });
    addFixedLog(
      "system",
      `調試：${scenario.name} Sandbox；${state.runPreparation ? `已裝備${state.runPreparation.name}` : "未裝備整備"}。`
    );
    logCurrentEnemyGroupEncounter();
    if (state.hero.shield > 0) {
      addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
    }
    render();
    return `已進入「${scenario.name}」；正式存檔不會記錄本次結果。`;
  }

  return Object.freeze({ startRegionEnemyScenario });
}
