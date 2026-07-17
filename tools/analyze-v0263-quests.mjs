import plainsData from "../src/data/regions/plains.json" with { type: "json" };
import forestData from "../src/data/regions/forest.json" with { type: "json" };
import goblinData from "../src/data/enemies/goblin.json" with { type: "json" };
import goblinCampData from "../src/data/routes/goblinCamp.json" with { type: "json" };
import materialData from "../src/data/materials.json" with { type: "json" };

const ROUNDS = Math.max(10_000, Number(process.argv[2]) || 200_000);
const rng = createSeededRandom(0x0263c0de);

const FORMAL_MODEL = Object.freeze({
  plainsWeaponClearRatio: 0.8888,
  plainsWeaponAverageReached: 8.0,
  forestArcherClearRatio: 0.755,
  forestArcherAverageReached: 15.54,
  forestArcherWeaponClearRatio: 0.8898,
  forestArcherWeaponAverageReached: 15.88
});

const QUEST_CANDIDATES = Object.freeze([
  Object.freeze({ id: "broad-monster-control", rarity: "common", target: 30, rewardGold: 20 }),
  Object.freeze({ id: "route-patrol", rarity: "common", target: 2, rewardGold: 20 }),
  Object.freeze({ id: "elite-suppression", rarity: "common", target: 5, rewardGold: 25 }),
  Object.freeze({ id: "forest-insect-control", rarity: "advanced", target: 18, rewardGold: 35 }),
  Object.freeze({ id: "boss-threat-removal", rarity: "advanced", target: 3, rewardGold: 30 }),
  Object.freeze({ id: "plains-boss-trophy", rarity: "rare", target: 3, rewardGold: 55 })
]);

const plains = simulateRegion(plainsData, ROUNDS, rng);
const forest = simulateRegion(forestData, ROUNDS, rng);
const goblinRoute = simulateGoblinRoute(ROUNDS, rng, { includeForestApproach: true, includeCampfireBattles: true });
const insectQuest = simulateForestFamilyQuest({ target: 18, family: "insect", rounds: ROUNDS, rng });
const board = simulateBoards(ROUNDS, rng);

const estimatedKillsPerAttempt = {
  plainsWeapon: estimateDefeatedEnemiesPerAttempt({
    averageReached: FORMAL_MODEL.plainsWeaponAverageReached,
    clearRatio: FORMAL_MODEL.plainsWeaponClearRatio
  }),
  forestArcher: estimateDefeatedEnemiesPerAttempt({
    averageReached: FORMAL_MODEL.forestArcherAverageReached,
    clearRatio: FORMAL_MODEL.forestArcherClearRatio
  }),
  forestArcherWeapon: estimateDefeatedEnemiesPerAttempt({
    averageReached: FORMAL_MODEL.forestArcherWeaponAverageReached,
    clearRatio: FORMAL_MODEL.forestArcherWeaponClearRatio
  })
};

console.log("v0.2.6.3 公會委託隔離模型");
console.log(`Rounds: ${ROUNDS}`);
console.log("");
printRegion("平原完整通關", plains);
printRegion("森林主線完整通關", forest);
printRegion("森林前段＋營火戰＋哥布林營地通關", goblinRoute);

console.log("正式戰鬥模型換算（擊殺進度會在失敗後保留）");
console.log(`平原成熟配置：平均 ${estimatedKillsPerAttempt.plainsWeapon.toFixed(2)} 隻／次嘗試，30 隻約 ${(30 / estimatedKillsPerAttempt.plainsWeapon).toFixed(2)} 次嘗試`);
console.log(`森林 Lv.25 弓箭手：平均 ${estimatedKillsPerAttempt.forestArcher.toFixed(2)} 隻／次嘗試，30 隻約 ${(30 / estimatedKillsPerAttempt.forestArcher).toFixed(2)} 次嘗試`);
console.log(`森林 Lv.25 弓箭手＋武器：平均 ${estimatedKillsPerAttempt.forestArcherWeapon.toFixed(2)} 隻／次嘗試，30 隻約 ${(30 / estimatedKillsPerAttempt.forestArcherWeapon).toFixed(2)} 次嘗試`);
console.log("");

console.log("森林蟲類 18 隻完成分布（以完整森林流程抽樣）");
console.log(`平均 ${insectQuest.meanRuns.toFixed(2)} 次完整森林，P50=${insectQuest.p50}、P90=${insectQuest.p90}`);
console.log(`2 次內 ${(insectQuest.within2 * 100).toFixed(2)}%，3 次內 ${(insectQuest.within3 * 100).toFixed(2)}%，4 次內 ${(insectQuest.within4 * 100).toFixed(2)}%`);
console.log("");

console.log("看板抽選分布（稀有出現率 35%，至少一項進階，稀有最多一項）");
console.log(`含稀有看板：${(board.rareBoardRatio * 100).toFixed(2)}%`);
console.log(`平均普通 ${board.averageCommon.toFixed(2)}、進階 ${board.averageAdvanced.toFixed(2)}、稀有 ${board.averageRare.toFixed(2)}`);
Object.entries(board.questInclusionRatios).forEach(([questId, ratio]) => {
  console.log(`${questId}: ${(ratio * 100).toFixed(2)}%`);
});
console.log("");

console.log("候選委託與經濟比例");
QUEST_CANDIDATES.forEach((quest) => printQuestEconomy(quest, { plains, forest }));

function simulateRegion(region, rounds, randomFn) {
  const values = [];
  const materials = new Map();
  const enemies = new Map();
  const kinds = new Map();
  const families = new Map();

  for (let round = 0; round < rounds; round += 1) {
    const runMaterials = new Map();
    for (const encounterType of region.encounterPlan) {
      const enemy = encounterType === "normal"
        ? weightedPick(region.enemies, (entry) => entry.weight ?? 100, randomFn)
        : encounterType === "elite"
          ? weightedPick(region.elites, (entry) => entry.weight ?? 100, randomFn)
          : weightedPick(region.bosses || [region.boss], (entry) => entry.weight ?? 100, randomFn);
      increment(enemies, enemy.id, 1);
      increment(kinds, enemy.kind, 1);
      increment(families, enemy.family, 1);
      rollMaterials(enemy, runMaterials, randomFn, 1);
    }
    mergeCounts(materials, runMaterials);
    values.push(getReferenceValue(runMaterials));
  }

  return summarizeSimulation({
    rounds,
    values,
    materials,
    enemies,
    kinds,
    families,
    killCount: region.encounterPlan.length
  });
}

function simulateGoblinRoute(rounds, randomFn, { includeForestApproach, includeCampfireBattles }) {
  const enemyById = Object.fromEntries(goblinData.enemies.map((enemy) => [enemy.id, enemy]));
  const groupById = Object.fromEntries(goblinCampData.groups.map((group) => [group.id, group]));
  const values = [];
  const materials = new Map();
  const enemies = new Map();
  const kinds = new Map();
  const families = new Map();
  let totalKills = 0;

  for (let round = 0; round < rounds; round += 1) {
    const runMaterials = new Map();
    let kills = 0;

    if (includeForestApproach) {
      const triggerBeforeEncounter = [6, 7, 8][Math.floor(randomFn() * 3)];
      for (let index = 0; index < triggerBeforeEncounter - 1; index += 1) {
        const enemy = weightedPick(forestData.enemies, (entry) => entry.weight ?? 100, randomFn);
        trackEnemy(enemy, { enemies, kinds, families });
        rollMaterials(enemy, runMaterials, randomFn, 1);
        kills += 1;
      }
    }

    if (includeCampfireBattles) {
      for (let index = 0; index < 2; index += 1) {
        const enemy = enemyById["goblin-warrior"];
        trackEnemy(enemy, { enemies, kinds, families });
        rollMaterials(enemy, runMaterials, randomFn, 1);
        kills += 1;
      }
    }

    for (const encounter of goblinCampData.encounterPlan) {
      const group = groupById[encounter.groupId];
      for (const member of group.members) {
        const enemy = enemyById[member.enemyId];
        trackEnemy(enemy, { enemies, kinds, families });
        rollMaterials(enemy, runMaterials, randomFn, member.rewardScale ?? 1);
        kills += 1;
      }
    }

    mergeCounts(materials, runMaterials);
    values.push(getReferenceValue(runMaterials));
    totalKills += kills;
  }

  return summarizeSimulation({
    rounds,
    values,
    materials,
    enemies,
    kinds,
    families,
    killCount: totalKills / rounds
  });
}

function simulateForestFamilyQuest({ target, family, rounds, rng: randomFn }) {
  const runsToComplete = [];
  for (let round = 0; round < rounds; round += 1) {
    let progress = 0;
    let runs = 0;
    while (progress < target && runs < 20) {
      runs += 1;
      for (const encounterType of forestData.encounterPlan) {
        const enemy = encounterType === "normal"
          ? weightedPick(forestData.enemies, (entry) => entry.weight ?? 100, randomFn)
          : encounterType === "elite"
            ? weightedPick(forestData.elites, (entry) => entry.weight ?? 100, randomFn)
            : weightedPick(forestData.bosses, (entry) => entry.weight ?? 100, randomFn);
        if (enemy.family === family) progress += 1;
      }
    }
    runsToComplete.push(runs);
  }
  const sorted = [...runsToComplete].sort((left, right) => left - right);
  return {
    meanRuns: mean(runsToComplete),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    within2: runsToComplete.filter((value) => value <= 2).length / rounds,
    within3: runsToComplete.filter((value) => value <= 3).length / rounds,
    within4: runsToComplete.filter((value) => value <= 4).length / rounds
  };
}

function simulateBoards(rounds, randomFn) {
  const common = QUEST_CANDIDATES.filter((quest) => quest.rarity === "common");
  const advanced = QUEST_CANDIDATES.filter((quest) => quest.rarity === "advanced");
  const rare = QUEST_CANDIDATES.find((quest) => quest.rarity === "rare");
  const inclusion = new Map(QUEST_CANDIDATES.map((quest) => [quest.id, 0]));
  let rareBoards = 0;
  let totalCommon = 0;
  let totalAdvanced = 0;
  let totalRare = 0;

  for (let round = 0; round < rounds; round += 1) {
    const board = [];
    if (randomFn() < 0.35) {
      board.push(rare);
      rareBoards += 1;
    }

    board.push(randomItem(advanced, randomFn));
    const available = [...common, ...advanced].filter((quest) => !board.includes(quest));
    while (board.length < 4) {
      const selected = weightedPick(
        available,
        (quest) => quest.rarity === "common" ? 100 : 70,
        randomFn
      );
      board.push(selected);
      available.splice(available.indexOf(selected), 1);
    }

    const counts = countBy(board, (quest) => quest.rarity);
    totalCommon += counts.common || 0;
    totalAdvanced += counts.advanced || 0;
    totalRare += counts.rare || 0;
    board.forEach((quest) => increment(inclusion, quest.id, 1));
  }

  return {
    rareBoardRatio: rareBoards / rounds,
    averageCommon: totalCommon / rounds,
    averageAdvanced: totalAdvanced / rounds,
    averageRare: totalRare / rounds,
    questInclusionRatios: Object.fromEntries(
      [...inclusion.entries()].map(([questId, count]) => [questId, count / rounds])
    )
  };
}

function printQuestEconomy(quest, simulations) {
  let referenceValue;
  let note;
  switch (quest.id) {
    case "broad-monster-control":
      referenceValue = Math.min(
        simulations.plains.meanValue * (quest.target / simulations.plains.killCount),
        simulations.forest.meanValue * (quest.target / simulations.forest.killCount)
      );
      note = "以完整流程每隻敵人的素材價值估算；失敗仍保留擊殺進度";
      break;
    case "route-patrol":
      referenceValue = simulations.plains.meanValue * quest.target;
      note = "以玩家選擇較快的平原完成估算";
      break;
    case "elite-suppression":
      referenceValue = simulations.plains.meanValue * Math.ceil(quest.target / 2);
      note = "平原與森林主線每次完整流程各有 2 場精英";
      break;
    case "forest-insect-control":
      referenceValue = simulations.forest.meanValue * insectQuest.meanRuns;
      note = "依森林蟲類隨機分布估算";
      break;
    case "boss-threat-removal":
      referenceValue = simulations.plains.meanValue * quest.target;
      note = "以較快的平原首領路徑估算";
      break;
    case "plains-boss-trophy": {
      const deliveryValue = quest.target * materialData.tainted_tusk.sellPrice;
      referenceValue = simulations.plains.meanValue * quest.target;
      const premium = quest.rewardGold - deliveryValue;
      const ratio = premium / referenceValue;
      console.log(`${quest.id}: ${quest.target} 個魔化獠牙，獎勵 ${quest.rewardGold} 金幣；放棄售價 ${deliveryValue}，淨溢價 ${premium}（占三次平原素材價值 ${(ratio * 100).toFixed(1)}%）`);
      return;
    }
    default:
      return;
  }
  console.log(`${quest.id}: 目標 ${quest.target}，獎勵 ${quest.rewardGold}；約占對應正常素材價值 ${(quest.rewardGold / referenceValue * 100).toFixed(1)}%｜${note}`);
}

function printRegion(label, result) {
  console.log(label);
  console.log(`敵人數：${result.killCount.toFixed(2)}`);
  console.log(`素材參考售價：平均 ${result.meanValue.toFixed(2)}，P10=${result.p10}、P50=${result.p50}、P90=${result.p90}`);
  console.log(`敵人種類：${formatMap(result.enemyMeans)}`);
  console.log(`素材期望：${formatMap(result.materialMeans)}`);
  console.log("");
}

function summarizeSimulation({ rounds, values, materials, enemies, kinds, families, killCount }) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    rounds,
    killCount,
    meanValue: mean(values),
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    materialMeans: divideMap(materials, rounds),
    enemyMeans: divideMap(enemies, rounds),
    kindMeans: divideMap(kinds, rounds),
    familyMeans: divideMap(families, rounds)
  };
}

function estimateDefeatedEnemiesPerAttempt({ averageReached, clearRatio }) {
  return averageReached - (1 - clearRatio);
}

function rollMaterials(enemy, target, randomFn, rewardScale) {
  for (const material of enemy.rewards?.materials || []) {
    const chance = Math.max(0, Math.min(1, (material.chance ?? 1) * rewardScale));
    if (randomFn() >= chance) continue;
    const minimum = Math.max(0, Math.floor(material.min || 0));
    const maximum = Math.max(minimum, Math.floor(material.max ?? minimum));
    const quantity = minimum + Math.floor(randomFn() * (maximum - minimum + 1));
    increment(target, material.id, quantity);
  }
}

function getReferenceValue(materials) {
  let total = 0;
  for (const [materialId, quantity] of materials.entries()) {
    total += (materialData[materialId]?.sellPrice || 0) * quantity;
  }
  return total;
}

function trackEnemy(enemy, maps) {
  increment(maps.enemies, enemy.id, 1);
  increment(maps.kinds, enemy.kind, 1);
  increment(maps.families, enemy.family, 1);
}

function weightedPick(items, getWeight, randomFn) {
  const weights = items.map((item) => Math.max(0, Number(getWeight(item)) || 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = randomFn() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return items[index];
  }
  return items.at(-1);
}

function randomItem(items, randomFn) {
  return items[Math.floor(randomFn() * items.length)];
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function increment(map, key, amount) {
  map.set(key, (map.get(key) || 0) + amount);
}

function mergeCounts(target, source) {
  for (const [key, value] of source.entries()) increment(target, key, value);
}

function divideMap(map, divisor) {
  return Object.fromEntries([...map.entries()]
    .map(([key, value]) => [key, value / divisor])
    .sort((left, right) => right[1] - left[1]));
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function formatMap(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value.toFixed(2)}`)
    .join("、");
}
