import {
  consumePreparationEntangleRetry,
  recordPreparationEntangleRetryResult,
  resolvePostEncounterPreparation,
  resolvePreparationIncomingDirectDamage,
  resolvePreparationPoisonDamage,
  runPreparationOpeningAction
} from "../../core/preparations.js";
import { resolveHeroAction } from "../../core/combat.js";
import {
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../../characters/skills/index.js";
import { getHeroBattleHealingMultiplier } from "../../core/combatStatusEffects.js";

export function createPreparationBattleEffects({ state, addFixedLog }) {
  function runHeroPlayerAction({ target, log }) {
    return runPreparationOpeningAction({
      preparation: state.runPreparation,
      hero: state.hero,
      encounterType: state.battleEncounterType,
      onTrigger: ({ attackBonus }) => {
        const preparationName = state.runPreparation?.name || "冒險整備";
        log.fixed("status", `整備｜${preparationName}讓這次出手更有威力，攻擊提高 ${attackBonus} 點。`);
      },
      action: () => {
        const characterAction = resolveCharacterPlayerAction({
          hero: state.hero,
          enemies: state.enemies,
          targetEnemyId: state.targetEnemyId,
          log
        });
        if (!characterAction.handled) {
          resolveHeroAction({ hero: state.hero, enemy: target, enemies: state.enemies, log });
        }
        return characterAction;
      }
    });
  }

  function modifyIncomingDirectDamage(context) {
    const characterModifiedDamage = modifyCharacterIncomingDirectDamage(context);
    const result = resolvePreparationIncomingDirectDamage({
      preparation: state.runPreparation,
      enemy: context.enemy,
      damage: characterModifiedDamage
    });
    if (result.triggered) {
      const preparationName = state.runPreparation?.name || "冒險整備";
      context.log.fixed("status", `整備｜${preparationName}減輕了這次攻勢，少受到 ${result.preventedDamage} 點傷害。`);
    }
    return result.damage;
  }

  function consumeEntangleRetry(log) {
    const consumed = consumePreparationEntangleRetry(state.runPreparation);
    if (consumed) {
      const preparationName = state.runPreparation?.name || "冒險整備";
      log.fixed("status", `整備｜${preparationName}割開纏絲，再次嘗試掙脫。`);
    }
    return consumed;
  }

  function recordEntangleRetryResult({ success }) {
    recordPreparationEntangleRetryResult({
      preparation: state.runPreparation,
      success
    });
  }

  function modifyPoisonDamage(damage) {
    const result = resolvePreparationPoisonDamage({
      preparation: state.runPreparation,
      damage
    });
    if (result.triggered) {
      const preparationName = state.runPreparation?.name || "冒險整備";
      addFixedLog("status", `整備｜${preparationName}減輕毒性侵蝕，少受到 ${result.preventedDamage} 點傷害。`);
    }
    return result.damage;
  }

  function resolvePostEncounter({ isFinalEncounter = false } = {}) {
    const result = resolvePostEncounterPreparation({
      preparation: state.runPreparation,
      hero: state.hero,
      isFinalEncounter,
      healingMultiplier: getHeroBattleHealingMultiplier(state.hero)
    });
    if (result.triggered) {
      const preparationName = state.runPreparation?.name || "冒險整備";
      addFixedLog("heal", `整備｜${preparationName}發揮作用，恢復 ${result.healing} 點生命。`);
    }
  }

  return Object.freeze({
    runHeroPlayerAction,
    modifyIncomingDirectDamage,
    consumeEntangleRetry,
    recordEntangleRetryResult,
    modifyPoisonDamage,
    resolvePostEncounter
  });
}
