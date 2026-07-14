function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function getOutcomeDistribution(stats = {}) {
  const totalRuns = safeCount(stats.totalRuns);
  const clears = safeCount(stats.totalClears);
  const retreats = safeCount(stats.totalRetreats);
  const defeats = safeCount(stats.totalDefeats);
  const resolved = clears + retreats + defeats;
  const other = Math.max(0, totalRuns - resolved);
  const denominator = Math.max(1, totalRuns || resolved);
  return {
    totalRuns,
    resolved,
    clears,
    retreats,
    defeats,
    other,
    items: [
      { id: "clear", label: "通關", value: clears, ratio: clears / denominator },
      { id: "retreat", label: "主動撤退", value: retreats, ratio: retreats / denominator },
      { id: "defeat", label: "冒險失敗", value: defeats, ratio: defeats / denominator },
      { id: "other", label: "其他／未結算", value: other, ratio: other / denominator }
    ]
  };
}

export function getEscapeSummary(stats = {}) {
  const safeEscapes = safeCount(stats.safeEscapes);
  const counterEscapes = safeCount(stats.counterEscapes);
  const evacuationEscapes = safeCount(stats.evacuationEscapes);
  const typedSuccesses = safeEscapes + counterEscapes + evacuationEscapes;
  const recordedSuccesses = safeCount(stats.fleeSuccesses);
  const successes = Math.max(recordedSuccesses, typedSuccesses);
  const failures = safeCount(stats.fleeFailures);
  const recordedAttempts = safeCount(stats.fleeAttempts);
  const attempts = Math.max(recordedAttempts, successes + failures);
  return {
    attempts,
    successes,
    failures,
    safeEscapes,
    counterEscapes,
    evacuationEscapes,
    successRate: attempts > 0 ? successes / attempts : 0
  };
}

export function getAverageEnemiesPerRun(stats = {}) {
  const runs = safeCount(stats.totalRuns);
  const defeated = safeCount(stats.totalEnemiesDefeated);
  return runs > 0 ? defeated / runs : 0;
}

export function getCharacterOtherRuns(characterStats = {}) {
  const runs = safeCount(characterStats.runs);
  const clears = safeCount(characterStats.clears);
  const retreats = safeCount(characterStats.retreats);
  return Math.max(0, runs - clears - retreats);
}

export function clampProgress(value, maximum) {
  const max = Math.max(0, safeCount(maximum));
  if (max === 0) {
    return { current: 0, maximum: 0, ratio: 0 };
  }
  const current = Math.min(max, safeCount(value));
  return { current, maximum: max, ratio: current / max };
}

export function safeStatisticCount(value) {
  return safeCount(value);
}
