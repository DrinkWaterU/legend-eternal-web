import { getPendingHighlandPaths, getChosenHighlandPath } from "../../data/highlandPaths.js";
import { buildEnemy, buildEnemyGroup, buildScaledEnemy } from "../../core/combat.js";
import { createRuntimeEnemyGroup, getEnemyDisplayName, getLivingEnemies } from "../../core/enemyGroups.js";
import { getEnemyDefinition } from "../../data/enemies/index.js";
import { getRouteGroup } from "../../data/routes/index.js";
import { getRegionEncounterGroupOption } from "../../data/regions/regionDefinition.js";
import { showCombatLayout } from "../../ui/eventView.js";

export function createEncounterController({
  state,
  els,
  currentRegion,
  currentRoute,
  getAdventureEncounterEntry,
  getAdventureEncounterType,
  getAdventureSourceName,
  beginBattleRuntime,
  setCombatActionState,
  applySceneContext,
  addLog,
  addFixedLog,
  logCurrentEnemyGroupEncounter,
  render,
  runSaveOperation = action => action()
}) {
  function applyEnemyAmbushes() {
    getLivingEnemies(state.enemies).forEach((enemy) => {
      const amount = Number(enemy.ambushDamage) || 0;
      if (amount <= 0 || state.hero.hp <= 1) return;
      const damage = Math.min(amount, state.hero.hp - 1);
      state.hero.hp -= damage;
      addFixedLog("enemy-damage", `${getEnemyDisplayName(enemy)} 伏擊了你，造成 ${damage} 點傷害。`);
    });
  }

  function startEncounter() {
    const region = currentRegion();
    const route = currentRoute();
    const encounterEntry = getAdventureEncounterEntry();
    const encounterType = getAdventureEncounterType();
    state.adventureProgressLocked = false;
    state.eventInputLocked = false;
    showCombatLayout(els);
    applySceneContext("gameScreen");

    state.battleSource = "main";
    const paths = getPendingHighlandPaths(state);
    if (paths.length) {
      state.phase = "highlandChoice";
      state.highlandBattle = null;
      state.enemies = [];
      render();
      return;
    }
    let battleEnemies;
    let restoreEnemies = false;
    if (route) {
      const chosenPath = getChosenHighlandPath(state);
      const isForkEncounter = state.routeEncounterIndex % 4 === 0;
      const group = getRouteGroup(route, isForkEncounter && chosenPath ? chosenPath.groupId : encounterEntry?.groupId);
      if (!group) throw new Error(`找不到 Route enemy group：${encounterEntry?.groupId || "(empty)"}`);
      const entries = group.members.map((member) => {
        const enemy = buildScaledEnemy(getEnemyDefinition(member.enemyId), region, state.encounterIndex);
        enemy.poison = 0;
        return { enemy, statScale: member.statScale, rewardScale: member.rewardScale * (chosenPath?.rewardScale || 1) };
      });
      battleEnemies = createRuntimeEnemyGroup(entries);
      restoreEnemies = true;
    } else {
      const groupOption = getRegionEncounterGroupOption(encounterEntry);
      if (groupOption) {
        battleEnemies = createRuntimeEnemyGroup(buildEnemyGroup(
          region,
          state.encounterIndex,
          state.hero,
          groupOption
        ));
        restoreEnemies = true;
      } else {
        const enemy = buildEnemy(region, state.encounterIndex, state.hero, { boss: state.selectedBoss });
        enemy.poison = 0;
        battleEnemies = [enemy];
      }
    }

    beginBattleRuntime({ enemies: battleEnemies, restoreEnemies, source: "main", encounterType });
    els.blessingPanel.classList.remove("is-visible");
    setCombatActionState();
    if (encounterType === "boss") addLog("system", "boss", { region: getAdventureSourceName() });
    logCurrentEnemyGroupEncounter();
    applyEnemyAmbushes();
    if (state.hero.shield > 0) addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
    render();
  }

  function chooseHighlandPath(id) {
    if (state.phase !== "highlandChoice" || !getPendingHighlandPaths(state).some(p => p.id === id)) return;
    return runSaveOperation(() => {
      state.highlandChoices = { ...(state.highlandChoices || {}), [state.routeEncounterIndex]: id };
      startEncounter();
    });
  }
  return Object.freeze({ startEncounter, applyEnemyAmbushes, chooseHighlandPath });
}
