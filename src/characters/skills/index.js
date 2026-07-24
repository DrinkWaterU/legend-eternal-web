import * as archerCombat from "./archer/combat.js";
import * as kaigeCombat from "./kaige/combat.js";

const CHARACTER_SKILL_RUNTIMES = Object.freeze({
  archer: archerCombat,
  kaige: kaigeCombat
});

export function initializeCharacterBattleState(hero) {
  getCharacterRuntime(hero)?.initializeBattleState?.({ hero });
}

export function resolveCharacterPlayerAction(context) {
  const runtime = getCharacterRuntime(context?.hero);
  if (!runtime?.resolvePlayerAction) {
    return { handled: false };
  }
  return runtime.resolvePlayerAction(context);
}

export function modifyCharacterIncomingDirectDamage(context) {
  const runtime = getCharacterRuntime(context?.hero);
  return runtime?.modifyIncomingDirectDamage
    ? runtime.modifyIncomingDirectDamage(context)
    : context.damage;
}

export function getCharacterCombatStatusEntries(hero) {
  return getCharacterRuntime(hero)?.getStatusEntries?.(hero) || [];
}

function getCharacterRuntime(hero) {
  return CHARACTER_SKILL_RUNTIMES[hero?.characterId] || null;
}
