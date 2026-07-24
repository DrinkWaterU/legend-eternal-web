import kaigeDuelData from "./kaige.json" with { type: "json" };

const definitions = Object.freeze({
  [kaigeDuelData.id]: Object.freeze(structuredClone(kaigeDuelData))
});

export function getDuelDefinition(duelId) {
  return definitions[duelId] || null;
}

export function assertDuelDefinitions(duels = definitions) {
  Object.entries(duels).forEach(([duelId, duel]) => {
    if (!duel || duel.id !== duelId) {
      throw new Error(`特殊決鬥 definition id 不一致：${duelId}`);
    }
    const opponent = duel.opponent;
    if (!opponent || !String(opponent.id || "").trim() || !String(opponent.name || "").trim()) {
      throw new Error(`特殊決鬥 ${duelId} 缺少 opponent。`);
    }
    ["maxHp", "attack", "defense"].forEach((field) => {
      if (!Number.isFinite(opponent[field]) || opponent[field] < 0) {
        throw new Error(`特殊決鬥 ${duelId} opponent.${field} 無效。`);
      }
    });
    if (!(opponent.critChance >= 0 && opponent.critChance <= 1)) {
      throw new Error(`特殊決鬥 ${duelId} opponent.critChance 無效。`);
    }
    const fury = opponent.duelFury;
    if (!Number.isSafeInteger(fury?.max) || fury.max < 1) {
      throw new Error(`特殊決鬥 ${duelId} duelFury.max 無效。`);
    }
    if (!(fury.lowHpThreshold > 0 && fury.lowHpThreshold < 1)) {
      throw new Error(`特殊決鬥 ${duelId} duelFury.lowHpThreshold 無效。`);
    }
    if (!(fury.heavyMultiplier > 0)) {
      throw new Error(`特殊決鬥 ${duelId} duelFury.heavyMultiplier 無效。`);
    }
  });
  return true;
}

export const duelDefinitions = definitions;
