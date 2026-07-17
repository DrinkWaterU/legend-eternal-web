import questData from "./quests.json" with { type: "json" };
import { QUEST_RARITIES } from "./questRarities.js";

const OBJECTIVE_TYPES = new Set(["defeatEnemies", "clearAdventure", "deliverMaterials"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const definitions = questData.map((quest) => deepFreeze(structuredClone(quest)));

export const questDefinitions = Object.freeze(Object.fromEntries(
  definitions.map((quest) => [quest.id, quest])
));

export function getQuestDefinition(questId) {
  return questDefinitions[questId] || null;
}

export function assertQuestDefinitions(quests = questDefinitions, references = {}) {
  const ids = new Set();
  Object.entries(quests).forEach(([questId, quest]) => {
    if (!quest || quest.id !== questId) throw new Error(`Quest definition id 不一致：${questId}`);
    if (ids.has(questId)) throw new Error(`Quest id 重複：${questId}`);
    ids.add(questId);
    if (!String(quest.name || "").trim()) throw new Error(`Quest ${questId} 缺少 name。`);
    if (!QUEST_RARITIES[quest.rarity]) throw new Error(`Quest ${questId} rarity 無效：${quest.rarity}`);
    if (!OBJECTIVE_TYPES.has(quest.objective?.type)) {
      throw new Error(`Quest ${questId} objective.type 無效：${quest.objective?.type || "(empty)"}`);
    }
    if (!Number.isFinite(quest.weight) || quest.weight <= 0) throw new Error(`Quest ${questId} weight 必須 > 0。`);
    if (quest.enabled !== true) throw new Error(`Quest ${questId} 第一版必須啟用。`);
    assertObjective(questId, quest.objective, references);
    assertRewards(questId, quest.rewards, references.materialDefinitions || {});
  });
  if (ids.size !== 6) throw new Error(`第一版 Quest definition 必須正好 6 項，目前為 ${ids.size} 項。`);
  return true;
}

function assertObjective(questId, objective, references) {
  if (objective.type === "deliverMaterials") {
    const materials = Array.isArray(objective.materials) ? objective.materials : [];
    if (materials.length === 0) throw new Error(`Quest ${questId} deliverMaterials 不可為空。`);
    materials.forEach((entry) => {
      if (!references.materialDefinitions?.[entry.id]) throw new Error(`Quest ${questId} 引用未知素材：${entry.id}`);
      if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1) {
        throw new Error(`Quest ${questId} 素材數量必須是正整數。`);
      }
    });
    return;
  }

  if (!Number.isSafeInteger(objective.target) || objective.target < 1) {
    throw new Error(`Quest ${questId} objective.target 必須是正整數。`);
  }
  validateIds(questId, objective.regionIds, references.regionDefinitions, "地區");
  validateIds(questId, objective.routeIds, references.routeDefinitions, "路線");
  if (objective.type === "defeatEnemies") {
    validateEnemyReferences(questId, objective, references.enemyDefinitions || {});
  }
}

function validateIds(questId, ids, registry, label) {
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    if (registry && !registry[id]) throw new Error(`Quest ${questId} 引用未知${label}：${id}`);
  });
}

function validateEnemyReferences(questId, objective, enemyDefinitions) {
  (objective.enemyIds || []).forEach((id) => {
    if (!enemyDefinitions[id]) throw new Error(`Quest ${questId} 引用未知敵人：${id}`);
  });
  const knownKinds = new Set(Object.values(enemyDefinitions).map((enemy) => enemy.kind).filter(Boolean));
  const knownFamilies = new Set(Object.values(enemyDefinitions).map((enemy) => enemy.family).filter(Boolean));
  (objective.enemyKinds || []).forEach((kind) => {
    if (!knownKinds.has(kind)) throw new Error(`Quest ${questId} 引用未知敵人種類：${kind}`);
  });
  (objective.enemyFamilies || []).forEach((family) => {
    if (!knownFamilies.has(family)) throw new Error(`Quest ${questId} 引用未知敵人家族：${family}`);
  });
}

function assertRewards(questId, rewards = {}, materialDefinitions) {
  const gold = Number(rewards.gold) || 0;
  const materials = Array.isArray(rewards.materials) ? rewards.materials : [];
  if (!Number.isSafeInteger(gold) || gold < 0) throw new Error(`Quest ${questId} rewards.gold 無效。`);
  materials.forEach((entry) => {
    if (!materialDefinitions[entry.id]) throw new Error(`Quest ${questId} 獎勵引用未知素材：${entry.id}`);
    if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1) {
      throw new Error(`Quest ${questId} 獎勵素材數量必須是正整數。`);
    }
  });
  if (gold === 0 && materials.length === 0) throw new Error(`Quest ${questId} 獎勵不可為空。`);
}
