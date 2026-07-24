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

export function createQuestRuntime({
  saveStore,
  questDefinitions,
  materialDefinitions,
  random = Math.random,
  saveGameSafe
}) {
  function normalize() {
    saveStore.current.quests = normalizeQuestState(saveStore.current.quests, questDefinitions);
    return saveStore.current.quests;
  }

  function populateBoard(quests, { persist = true } = {}) {
    if (quests.board.questIds.length === 4) return [...quests.board.questIds];
    const previousBoard = clone(quests.board);
    quests.board.questIds = generateQuestBoard(questDefinitions, {
      random,
      excludedQuestId: quests.board.excludedQuestId
    });
    quests.board.generatedAtCompletionCount = quests.statistics.completedTotal;
    if (persist && !saveGameSafe()) {
      quests.board = previousBoard;
      return [];
    }
    return [...quests.board.questIds];
  }

  function ensureBoard({ persist = true } = {}) {
    return populateBoard(normalize(), { persist });
  }

  function acceptQuest(questId) {
    const quests = normalize();
    const snapshot = clone(quests);
    populateBoard(quests, { persist: false });
    if (quests.active || !quests.board.questIds.includes(questId) || !questDefinitions[questId]) {
      return { ok: false, reason: quests.active ? "已有進行中的委託。" : "這項委託目前不在看板上。" };
    }
    quests.active = {
      questId,
      progress: 0,
      acceptedAtCompletionCount: quests.statistics.completedTotal
    };
    if (!saveGameSafe()) {
      saveStore.current.quests = snapshot;
      return { ok: false, reason: "目前無法保存委託進度。" };
    }
    return { ok: true, quest: questDefinitions[questId] };
  }

  function abandonQuest() {
    const quests = normalize();
    if (!quests.active) return { ok: false, reason: "目前沒有進行中的委託。" };
    const snapshot = clone(quests);
    quests.active = null;
    quests.statistics.abandonedTotal = sumSafeIntegers(quests.statistics.abandonedTotal, 1);
    if (!saveGameSafe()) {
      saveStore.current.quests = snapshot;
      return { ok: false, reason: "目前無法保存放棄紀錄。" };
    }
    return { ok: true };
  }

  function recordEnemyDefeated(event) {
    const quests = normalize();
    const quest = questDefinitions[quests.active?.questId];
    if (!quest || !matchEnemyObjective(quest.objective, event)) return false;
    const target = quest.objective.target;
    const previous = quests.active.progress;
    quests.active.progress = Math.min(target, previous + 1);
    return quests.active.progress !== previous;
  }

  function recordRunCleared(event) {
    const quests = normalize();
    const quest = questDefinitions[quests.active?.questId];
    if (!quest || !matchClearObjective(quest.objective, event)) return false;
    const target = quest.objective.target;
    const previous = quests.active.progress;
    quests.active.progress = Math.min(target, previous + 1);
    return quests.active.progress !== previous;
  }

  function reportQuest() {
    const quests = normalize();
    const quest = questDefinitions[quests.active?.questId];
    if (!quest) return { ok: false, reason: "目前沒有可回報的委託。" };
    const context = { quest, active: quests.active, inventory: saveStore.current.inventory };
    const missing = getMissingDeliveryMaterials(context);
    if (!isQuestComplete(context) || missing.length > 0) {
      return { ok: false, reason: missing.length > 0 ? "交付素材尚未備齊。" : "委託目標尚未完成。" };
    }

    const snapshot = {
      quests: clone(quests),
      inventory: clone(saveStore.current.inventory)
    };
    const reward = buildQuestRewardPlan(quest);
    consumeDeliveryMaterials(quest);
    applyRewards(reward);
    completeQuestRecord(quest, reward, quests);
    quests.active = null;
    quests.board.excludedQuestId = quest.id;
    quests.board.questIds = generateQuestBoard(questDefinitions, { random, excludedQuestId: quest.id });
    quests.board.generatedAtCompletionCount = quests.statistics.completedTotal;

    if (!saveGameSafe()) {
      saveStore.current.quests = snapshot.quests;
      saveStore.current.inventory = snapshot.inventory;
      return { ok: false, reason: "目前無法完成委託回報。" };
    }
    return { ok: true, quest, reward };
  }

  function getSnapshot() {
    const quests = normalize();
    populateBoard(quests);
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

  function consumeDeliveryMaterials(quest) {
    if (quest.objective.type !== "deliverMaterials") return;
    quest.objective.materials.forEach((entry) => {
      const item = saveStore.current.inventory.materials[entry.id];
      item.quantity -= entry.quantity;
      if (item.quantity <= 0) delete saveStore.current.inventory.materials[entry.id];
    });
  }

  function applyRewards(reward) {
    saveStore.current.inventory.gold = sumSafeIntegers(
      saveStore.current.inventory.gold,
      reward.gold
    );
    reward.materials.forEach((entry) => {
      const material = materialDefinitions[entry.id];
      const current = saveStore.current.inventory.materials[entry.id] || {
        id: entry.id,
        name: material?.name || entry.id,
        quantity: 0
      };
      current.quantity = sumSafeIntegers(current.quantity, entry.quantity);
      saveStore.current.inventory.materials[entry.id] = current;
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
