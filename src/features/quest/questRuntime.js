import {
  buildQuestRewardPlan,
  generateQuestBoard,
  getMissingDeliveryMaterials,
  getQuestProgress,
  isQuestComplete,
  matchClearObjective,
  matchEnemyObjective,
  normalizeQuestState
} from "../../core/questRules.js";
import { clone, sumSafeIntegers, toSafeInteger } from "../../utils.js";
import { getRegionAccess } from "../../core/regionAccess.js";
import { regionDefinitions } from "../../data/regions/index.js";

export function createQuestRuntime({
  saveStore,
  questDefinitions,
  materialDefinitions,
  random = Math.random,
  commitSaveChange
}) {
  function normalize() {
    return normalizeQuestState(saveStore.current.quests, questDefinitions);
  }

  function availableDefinitions(save = saveStore.current) {
    return Object.fromEntries(Object.entries(questDefinitions).filter(([, quest]) =>
      !quest.requiredRegionId || getRegionAccess(regionDefinitions[quest.requiredRegionId], save).unlocked));
  }

  function populateBoard(quests) {
    if (quests.board.questIds.length === 4) return [...quests.board.questIds];
    quests.board.questIds = generateQuestBoard(availableDefinitions(), {
      random,
      excludedQuestId: quests.board.excludedQuestId
    });
    quests.board.generatedAtCompletionCount = quests.statistics.completedTotal;
    return [...quests.board.questIds];
  }

  function transactQuest(change, onSaved) {
    let result;
    try {
      const transaction = commitSaveChange((draft) => {
        draft.quests = normalizeQuestState(draft.quests, questDefinitions);
        result = change(draft);
      }, () => onSaved?.(result));
      return transaction.status === "saved" ? result : { ok: false, pending: true, reason: "請先完成待保存的操作。" };
    } catch (error) {
      return { ok: false, reason: error.message || "委託操作失敗。" };
    }
  }

  function ensureBoard({ onSaved } = {}) {
    const quests = normalize();
    if (quests.board.questIds.length === 4) return [...quests.board.questIds];
    const result = transactQuest((draft) => ({ ok: true, ids: populateBoard(draft.quests) }), onSaved);
    return result.ok ? result.ids : [];
  }

  function acceptQuest(questId, onSaved) {
    return transactQuest((draft) => {
      const quests = draft.quests;
      populateBoard(quests);
      if (quests.active || !quests.board.questIds.includes(questId) || !availableDefinitions(draft)[questId]) {
        throw new Error(quests.active ? "已有進行中的委託。" : "這項委託目前不在看板上。");
      }
      quests.active = {
        questId,
        progress: 0,
        acceptedAtCompletionCount: quests.statistics.completedTotal
      };
      return { ok: true, quest: questDefinitions[questId] };
    }, onSaved);
  }

  function abandonQuest(onSaved) {
    return transactQuest((draft) => {
      const quests = draft.quests;
      if (!quests.active) throw new Error("目前沒有進行中的委託。");
      quests.active = null;
      quests.statistics.abandonedTotal = sumSafeIntegers(quests.statistics.abandonedTotal, 1);
      return { ok: true };
    }, onSaved);
  }

  function recordEnemyDefeated(event) {
    if (saveStore.hasPendingTransaction) return false;
    const quests = normalize();
    const quest = questDefinitions[quests.active?.questId];
    if (!quest || !matchEnemyObjective(quest.objective, event)) return false;
    const target = quest.objective.target;
    const previous = quests.active.progress;
    quests.active.progress = Math.min(target, previous + 1);
    saveStore.current.quests = quests;
    return quests.active.progress !== previous;
  }

  function recordRunCleared(event) {
    if (saveStore.hasPendingTransaction) return false;
    const quests = normalize();
    const quest = questDefinitions[quests.active?.questId];
    if (!quest || !matchClearObjective(quest.objective, event)) return false;
    const target = quest.objective.target;
    const previous = quests.active.progress;
    quests.active.progress = Math.min(target, previous + 1);
    saveStore.current.quests = quests;
    return quests.active.progress !== previous;
  }

  function reportQuest(onSaved) {
    return transactQuest((draft) => {
      const quests = draft.quests;
      const quest = questDefinitions[quests.active?.questId];
      if (!quest) throw new Error("目前沒有可回報的委託。");
      const context = { quest, active: quests.active, inventory: draft.inventory };
      const missing = getMissingDeliveryMaterials(context);
      if (!isQuestComplete(context) || missing.length > 0) {
        throw new Error(missing.length > 0 ? "交付素材尚未備齊。" : "委託目標尚未完成。");
      }

      const reward = buildQuestRewardPlan(quest);
      consumeDeliveryMaterials(quest, draft.inventory);
      applyRewards(reward, draft.inventory);
      completeQuestRecord(quest, reward, quests);
      quests.active = null;
      quests.board.excludedQuestId = quest.id;
      quests.board.questIds = generateQuestBoard(availableDefinitions(draft), { random, excludedQuestId: quest.id });
      quests.board.generatedAtCompletionCount = quests.statistics.completedTotal;

      return { ok: true, quest, reward };
    }, onSaved);
  }

  function getSnapshot() {
    const quests = normalize();
    const activeQuest = questDefinitions[quests.active?.questId] || null;
    return {
      boardQuestIds: [...quests.board.questIds],
      active: quests.active ? { ...quests.active } : null,
      activeQuest,
      activeProgress: activeQuest ? getQuestProgress({
        quest: activeQuest,
        active: quests.active,
        inventory: saveStore.current.inventory
      }) : 0,
      statistics: clone(quests.statistics),
      completions: clone(quests.completions)
    };
  }

  function consumeDeliveryMaterials(quest, inventory) {
    if (quest.objective.type !== "deliverMaterials") return;
    quest.objective.materials.forEach((entry) => {
      const item = inventory.materials[entry.id];
      item.quantity -= entry.quantity;
      if (item.quantity <= 0) delete inventory.materials[entry.id];
    });
  }

  function applyRewards(reward, inventory) {
    inventory.gold = sumSafeIntegers(
      inventory.gold,
      reward.gold
    );
    reward.materials.forEach((entry) => {
      const material = materialDefinitions[entry.id];
      const current = inventory.materials[entry.id] || {
        id: entry.id,
        name: material?.name || entry.id,
        quantity: 0
      };
      current.quantity = sumSafeIntegers(current.quantity, entry.quantity);
      inventory.materials[entry.id] = current;
    });
  }

  function completeQuestRecord(quest, reward, quests) {
    quests.statistics.completedTotal = sumSafeIntegers(quests.statistics.completedTotal, 1);
    quests.statistics.completedByRarity[quest.rarity] = sumSafeIntegers(
      quests.statistics.completedByRarity[quest.rarity],
      1
    );
    quests.statistics.rewardGoldTotal = sumSafeIntegers(
      quests.statistics.rewardGoldTotal,
      reward.gold
    );
    reward.materials.forEach((entry) => {
      quests.statistics.rewardMaterials[entry.id] = sumSafeIntegers(
        quests.statistics.rewardMaterials[entry.id],
        entry.quantity
      );
    });
    const completion = quests.completions[quest.id] || { count: 0, lastCompletedAtCompletionCount: 0 };
    completion.count = sumSafeIntegers(completion.count, 1);
    completion.lastCompletedAtCompletionCount = quests.statistics.completedTotal;
    quests.completions[quest.id] = completion;
  }

  return Object.freeze({
    normalize,
    ensureBoard,
    acceptQuest,
    abandonQuest,
    recordEnemyDefeated,
    recordRunCleared,
    reportQuest,
    getSnapshot
  });
}
