import { getEnemySupportPlan } from "./enemySupport.js";

export function getScheduledSpecialAttack(enemy, turn) {
  const specialAttack = enemy?.specialAttack;
  const everyTurns = Math.max(0, Math.floor(Number(specialAttack?.everyTurns) || 0));
  return everyTurns > 0 && turn > 0 && turn % everyTurns === 0 ? specialAttack : null;
}

export function getEnemyIntent(enemy, completedTurn, enemies = []) {
  if (!enemy || enemy.hp <= 0) return null;
  const nextTurn = Math.max(0, Math.floor(Number(completedTurn) || 0)) + 1;
  if (enemy.combatRole === "support") {
    const plan = getEnemySupportPlan({ enemies, actor: enemy, turn: nextTurn });
    if (!plan) return "下回合：攻擊。";
    const gain = [plan.attackGain && `攻擊 +${plan.attackGain}`, plan.defenseGain && `防禦 +${plan.defenseGain}`,
      plan.healMaxHpRatio && `恢復最大生命 ${Math.round(plan.healMaxHpRatio * 100)}%`].filter(Boolean).join("、");
    const target = plan.targetCombatRole === "frontline" ? "前衛" : "同伴";
    return `下回合：替${target}${gain}（剩 ${plan.remainingUses} 次）。${target}全倒就改為攻擊。`;
  }
  const special = getScheduledSpecialAttack(enemy, nextTurn);
  if (special) {
    const text = String(special.telegraphText || "").trim();
    return text ? `下回合：${special.name || "特殊攻擊"}。${text}` : null;
  }
  if (enemy.chargeEvery > 0 && nextTurn % enemy.chargeEvery === 0) {
    return "下回合：衝鋒。可考慮守勢減輕直接傷害，或優先擊倒敵人。";
  }
  return null;
}
