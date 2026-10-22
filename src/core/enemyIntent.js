export function getScheduledSpecialAttack(enemy, turn) {
  const specialAttack = enemy?.specialAttack;
  const everyTurns = Math.max(0, Math.floor(Number(specialAttack?.everyTurns) || 0));
  return everyTurns > 0 && turn > 0 && turn % everyTurns === 0 ? specialAttack : null;
}

export function getEnemyIntent(enemy, completedTurn) {
  if (!enemy || enemy.hp <= 0 || enemy.combatRole === "support") return null;
  const nextTurn = Math.max(0, Math.floor(Number(completedTurn) || 0)) + 1;
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
