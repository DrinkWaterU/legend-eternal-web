export function applyEnemyDefeatReactions({ enemies = [], defeatedEnemy }) {
  const reactions = [];
  if (!defeatedEnemy) {
    return reactions;
  }

  (Array.isArray(enemies) ? enemies : []).forEach((source) => {
    const sacrifice = source?.bloodSacrifice;
    if (!sacrifice || source === defeatedEnemy || source.hp <= 0) {
      return;
    }
    if (sacrifice.family && defeatedEnemy.family !== sacrifice.family) {
      return;
    }

    const attackGain = Math.max(0, Number(sacrifice.attackGain) || 0);
    const critChanceGain = Math.max(0, Number(sacrifice.critChanceGain) || 0);
    const healMaxHpRatio = Math.max(0, Number(sacrifice.healMaxHpRatio) || 0);
    const beforeHp = source.hp;

    source.attack += attackGain;
    source.critChance = (source.critChance || 0) + critChanceGain;
    source.hp = Math.min(source.maxHp, source.hp + Math.round(source.maxHp * healMaxHpRatio));

    reactions.push({
      type: "bloodSacrifice",
      source,
      defeatedEnemy,
      attackGain,
      critChanceGain,
      healed: source.hp - beforeHp
    });
  });

  return reactions;
}
