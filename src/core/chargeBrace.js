// 撐住衝鋒：敵人資料帶有 chargeBrace 時，玩家在衝鋒回合採取守勢會得到更高的減傷，
// 並讓該敵人失衡。失衡只加成玩家下一次對牠的主攻（source === "original"），用掉就消失。
//
// 觸發來源：玩家守勢 + 帶 chargeBrace 的敵人衝鋒命中。
// 頻率：每次衝鋒最多一次（由敵人的 chargeEvery 決定）。
// 疊加：不疊加；再次撐住只會刷新。
// 連鎖：加成只乘在主攻的基礎傷害上（之後仍可重擊、暴擊）；追擊、反攻與武器追加傷害不吃加成，
//       也不會因此再觸發一次。

export function getChargeBrace(enemy) {
  const brace = enemy?.chargeBrace;
  if (!brace || typeof brace !== "object") return null;
  const damageReduction = Math.max(0, Math.min(0.9, Number(brace.damageReduction) || 0));
  const staggerDamageBonus = Math.max(0, Number(brace.staggerDamageBonus) || 0);
  return damageReduction > 0 || staggerDamageBonus > 0 ? { damageReduction, staggerDamageBonus } : null;
}

export function isChargeTurn(enemy, turn) {
  const every = Math.max(0, Math.floor(Number(enemy?.chargeEvery) || 0));
  return every > 0 && turn > 0 && turn % every === 0;
}

export function applyStagger(enemy, brace) {
  if (!enemy || !(brace?.staggerDamageBonus > 0)) return null;
  enemy.stagger = { damageBonus: brace.staggerDamageBonus };
  return enemy.stagger;
}

export function getStaggerDamageBonus(enemy) {
  return Math.max(0, Number(enemy?.stagger?.damageBonus) || 0);
}

export function consumeStagger(enemy) {
  const bonus = getStaggerDamageBonus(enemy);
  if (enemy) enemy.stagger = null;
  return bonus;
}
