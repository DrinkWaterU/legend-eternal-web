import { getLivingEnemies } from "./enemyGroups.js";

export function canTakeBattleAction(state) {
  return Boolean(state.hero)
    && !state.ended
    && !state.awaitingBlessing
    && !state.eventInputLocked
    && !state.adventureProgressLocked
    && (state.phase === "danger" || state.phase === "combat")
    && getLivingEnemies(state.enemies).length > 0;
}
