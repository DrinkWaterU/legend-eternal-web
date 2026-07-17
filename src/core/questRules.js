import { questDefinitions as defaultQuestDefinitions } from "../data/quests.js";
import { QUEST_RARITIES } from "../data/questRarities.js";
import { getRouteDefinition } from "../data/routes/index.js";
import { toSafeInteger } from "../utils.js";

export const QUEST_BOARD_SIZE = 4;
export const QUEST_RARE_BOARD_CHANCE = 0.35;

const REGION_LABELS = Object.freeze({
  plains: "平原",
  forest: "森林"
});

const ENEMY_FAMILY_LABELS = Object.freeze({
  slime: "史萊姆系",
  insect: "蟲類",
  plant: "植物系",
  beast: "野獸系",
  goblin: "哥布林系"
});

export function createDefaultQuestState() {
  return {
    board: {
      questIds: [],
      generatedAtCompletionCount: 0,
      excludedQuestId: null
    },
    active: null,
    statistics: {
      completedTotal: 0,
      completedByRarity: { common: 0, advanced: 0, rare: 0 },
      abandonedTotal: 0,
      rewardGoldTotal: 0,
      rewardMaterials: {}
    },
    completions: {}
  };
}

export function normalizeQuestState(rawQuests, questDefinitions = defaultQuestDefinitions) {
  const result = createDefaultQuestState();
  const raw = rawQuests && typeof rawQuests === "object" && !Array.isArray(rawQuests) ? rawQuests : {};
  const stats = raw.statistics || {};
  result.statistics.completedTotal = toSafeInteger(stats.completedTotal);
  result.statistics.abandonedTotal = toSafeInteger(stats.abandonedTotal);
  result.statistics.rewardGoldTotal = toSafeInteger(stats.rewardGoldTotal);
  Object.keys(result.statistics.completedByRarity).forEach((rarityId) => {
    result.statistics.completedByRarity[rarityId] = toSafeInteger(stats.completedByRarity?.[rarityId]);
  });
  Object.entries(stats.rewardMaterials || {}).forEach(([materialId, quantity]) => {
    const normalized = toSafeInteger(quantity);
    if (normalized > 0) result.statistics.rewardMaterials[materialId] = normalized;
  });

  result.board.excludedQuestId = questDefinitions[raw.board?.excludedQuestId]
    ? raw.board.excludedQuestId
    : null;
  const boardIds = normalizeQuestIds(raw.board?.questIds, questDefinitions);
  result.board.questIds = isValidQuestBoard(boardIds, questDefinitions, result.board.excludedQuestId)
    ? boardIds
    : [];
  result.board.generatedAtCompletionCount = toSafeInteger(raw.board?.generatedAtCompletionCount);

  const activeQuestId = raw.active?.questId;
  if (questDefinitions[activeQuestId]) {
    const definition = questDefinitions[activeQuestId];
    result.active = {
      questId: activeQuestId,
      progress: definition.objective.type === "deliverMaterials"
        ? 0
        : Math.min(getQuestTarget(definition), toSafeInteger(raw.active?.progress)),
      acceptedAtCompletionCount: toSafeInteger(raw.active?.acceptedAtCompletionCount)
    };
  }

  Object.entries(raw.completions || {}).forEach(([questId, entry]) => {
    if (!questDefinitions[questId]) return;
    const count = toSafeInteger(entry?.count);
    if (count <= 0) return;
    result.completions[questId] = {
      count,
      lastCompletedAtCompletionCount: Math.min(
        result.statistics.completedTotal,
        toSafeInteger(entry?.lastCompletedAtCompletionCount)
      )
    };
  });
  return result;
}

export function generateQuestBoard(
  questDefinitions = defaultQuestDefinitions,
  { random = Math.random, excludedQuestId = null, rareChance = QUEST_RARE_BOARD_CHANCE } = {}
) {
  const candidates = Object.values(questDefinitions).filter((quest) => (
    quest.enabled === true && quest.id !== excludedQuestId
  ));
  const advanced = candidates.filter((quest) => quest.rarity === "advanced");
  const rare = candidates.filter((quest) => quest.rarity === "rare");
  const selected = [];
  const includeRare = rare.length > 0 && clampRandom(random()) < rareChance;
  const eligibleCandidates = includeRare
    ? candidates
    : candidates.filter((quest) => quest.rarity !== "rare");

  if (advanced.length === 0) throw new Error("委託看板缺少可用的進階委託。");
  if (includeRare) selected.push(weightedPick(rare, random));
  selected.push(weightedPick(advanced, random));

  while (selected.length < QUEST_BOARD_SIZE) {
    const remaining = eligibleCandidates.filter((quest) => !selected.some((entry) => entry.id === quest.id));
    if (remaining.length === 0) throw new Error("可用委託不足，無法產生四項看板。");
    selected.push(weightedPick(remaining, random));
  }
  return selected.map((quest) => quest.id);
}

export function matchEnemyObjective(objective, event) {
  if (objective?.type !== "defeatEnemies" || !event || event.debugBuildRun) return false;
  return matchOptionalList(objective.regionIds, event.regionId)
    && matchOptionalList(objective.routeIds, event.routeId)
    && matchOptionalList(objective.enemyIds, event.enemyId)
    && matchOptionalList(objective.enemyKinds, event.enemyKind)
    && matchOptionalList(objective.enemyFamilies, event.enemyFamily);
}

export function matchClearObjective(objective, event) {
  if (objective?.type !== "clearAdventure" || !event || event.debugBuildRun) return false;
  return matchOptionalList(objective.regionIds, event.regionId)
    && matchOptionalList(objective.routeIds, event.routeId)
    && matchOptionalList(objective.clearSourceIds, event.clearSourceId);
}

export function getQuestTarget(quest) {
  if (quest?.objective?.type === "deliverMaterials") {
    return (quest.objective.materials || []).reduce(
      (sum, entry) => addSafeQuestIntegers(sum, entry.quantity),
      0
    );
  }
  return Math.max(1, toSafeInteger(quest?.objective?.target, 1));
}

export function getQuestProgress({ quest, active, inventory }) {
  if (!quest || active?.questId !== quest.id) return 0;
  if (quest.objective.type !== "deliverMaterials") {
    return Math.min(getQuestTarget(quest), toSafeInteger(active.progress));
  }
  return (quest.objective.materials || []).reduce((sum, entry) => {
    const held = toSafeInteger(inventory?.materials?.[entry.id]?.quantity);
    return addSafeQuestIntegers(sum, Math.min(entry.quantity, held));
  }, 0);
}

export function isQuestComplete(context) {
  return getQuestProgress(context) >= getQuestTarget(context.quest);
}

export function getMissingDeliveryMaterials({ quest, inventory }) {
  if (quest?.objective?.type !== "deliverMaterials") return [];
  return quest.objective.materials.map((entry) => {
    const held = toSafeInteger(inventory?.materials?.[entry.id]?.quantity);
    return { ...entry, held, missing: Math.max(0, entry.quantity - held) };
  }).filter((entry) => entry.missing > 0);
}

export function buildQuestRewardPlan(quest) {
  return {
    gold: toSafeInteger(quest?.rewards?.gold),
    materials: (quest?.rewards?.materials || []).map((entry) => ({
      id: entry.id,
      quantity: toSafeInteger(entry.quantity)
    })).filter((entry) => entry.id && entry.quantity > 0)
  };
}

export function formatQuestObjective(quest, materialDefinitions = {}) {
  const objective = quest?.objective || {};
  if (objective.type === "deliverMaterials") {
    return objective.materials.map((entry) => (
      `${materialDefinitions[entry.id]?.name || entry.id} ×${entry.quantity}`
    )).join("、");
  }
  if (objective.type === "clearAdventure") {
    const route = objective.routeIds?.length === 1
      ? getRouteDefinition(objective.routeIds[0])
      : null;
    if (route) {
      return `完成${route.name}正式冒險 ${objective.target} 次`;
    }
    const region = getRegionLabel(objective) || "任意";
    return `完成${region}正式冒險 ${objective.target} 次`;
  }
  if (objective.enemyKinds?.length === 1) return `擊敗任意${objective.enemyKinds[0]}敵人 ${objective.target} 隻`;
  if (objective.enemyFamilies?.length === 1) {
    const familyLabel = ENEMY_FAMILY_LABELS[objective.enemyFamilies[0]] || `${objective.enemyFamilies[0]}系`;
    const regionLabel = getRegionLabel(objective);
    return `${regionLabel ? `在${regionLabel}` : ""}擊敗${familyLabel}敵人 ${objective.target} 隻`;
  }
  return `擊敗任意正式敵人 ${objective.target} 隻`;
}

function getRegionLabel(objective) {
  if (objective?.regionIds?.length !== 1) return "";
  return REGION_LABELS[objective.regionIds[0]] || "指定地區";
}

function isValidQuestBoard(boardIds, questDefinitions, excludedQuestId) {
  if (boardIds.length !== QUEST_BOARD_SIZE || boardIds.includes(excludedQuestId)) return false;
  const quests = boardIds.map((questId) => questDefinitions[questId]).filter(Boolean);
  const advancedCount = quests.filter((quest) => quest.rarity === "advanced").length;
  const rareCount = quests.filter((quest) => quest.rarity === "rare").length;
  return quests.length === QUEST_BOARD_SIZE && advancedCount >= 1 && rareCount <= 1;
}

function addSafeQuestIntegers(...values) {
  let total = 0;
  for (const value of values) {
    const normalized = toSafeInteger(value);
    if (normalized > Number.MAX_SAFE_INTEGER - total) return Number.MAX_SAFE_INTEGER;
    total += normalized;
  }
  return total;
}

function normalizeQuestIds(rawIds, questDefinitions) {
  const seen = new Set();
  return (Array.isArray(rawIds) ? rawIds : []).filter((questId) => {
    if (!questDefinitions[questId] || seen.has(questId)) return false;
    seen.add(questId);
    return true;
  });
}

function weightedPick(candidates, random) {
  const weights = candidates.map((quest) => Math.max(0, Number(quest.weight) || QUEST_RARITIES[quest.rarity]?.weight || 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!(total > 0)) throw new Error("委託抽選權重總和必須大於 0。");
  let cursor = clampRandom(random()) * total;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return candidates[index];
  }
  return candidates.at(-1);
}

function matchOptionalList(values, actual) {
  return !Array.isArray(values) || values.length === 0 || values.includes(actual);
}

function clampRandom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(0.999999999999, Math.max(0, numeric));
}
