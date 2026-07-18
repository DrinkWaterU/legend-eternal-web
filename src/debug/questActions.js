import {
  createDefaultQuestState,
  formatQuestObjective,
  generateQuestBoard,
  getQuestProgress,
  getQuestTarget,
  normalizeQuestState
} from "../core/questRules.js";
import { materialDefinitions as defaultMaterialDefinitions } from "../data/materials.js";
import { getQuestRarity } from "../data/questRarities.js";
import { questDefinitions as defaultQuestDefinitions } from "../data/quests.js";
import { ANPING_TOWN_SAFE_AREA_ID } from "../data/safeAreas.js";
import { markSafeAreaVisited, setCurrentSafeArea } from "../core/safeAreaProgression.js";
import { clone } from "../utils.js";

const GUILD_RECEPTIONIST_FLAGS = Object.freeze({
  metAnpingGuildReceptionist: true,
  knowsAnpingGuildReceptionistName: true,
  registeredAtAnpingGuild: true
});

export function createDebugQuestActions({
  getSaveData,
  saveGameSafe,
  syncSafeAreaUiFromSave = () => {},
  showGuildQuestIntroduction,
  showGuildQuestFacility,
  questDefinitions = defaultQuestDefinitions,
  materialDefinitions = defaultMaterialDefinitions,
  random = Math.random
}) {
  function getQuestOptions() {
    return Object.values(questDefinitions).map((quest) => ({
      id: quest.id,
      name: quest.name,
      rarity: quest.rarity,
      rarityLabel: getQuestRarity(quest.rarity)?.label || quest.rarity,
      objective: formatQuestObjective(quest, materialDefinitions),
      rewardGold: quest.rewards.gold
    }));
  }

  function getQuestDebugSnapshot() {
    const saveData = requireSaveData();
    const quests = normalizeQuestState(saveData.quests, questDefinitions);
    const activeQuest = questDefinitions[quests.active?.questId] || null;
    return {
      boardQuestIds: [...quests.board.questIds],
      activeQuestId: activeQuest?.id || null,
      activeQuestName: activeQuest?.name || null,
      activeProgress: activeQuest
        ? getQuestProgress({ quest: activeQuest, active: quests.active, inventory: saveData.inventory })
        : 0,
      activeTarget: activeQuest ? getQuestTarget(activeQuest) : 0,
      introductionSeen: Boolean(saveData.storyFlags?.guildQuestIntroductionSeen)
    };
  }

  function replayGuildQuestIntroduction() {
    requireFunction(showGuildQuestIntroduction, "無法開啟公會委託首次導覽。");
    mutateQuestSave((saveData) => {
      prepareGuildContext(saveData, { introductionSeen: false });
    });
    syncSafeAreaUiFromSave();
    showGuildQuestIntroduction();
    return "已重設並播放公會委託首次導覽。";
  }

  function openGuildQuestBoard() {
    requireFunction(showGuildQuestFacility, "無法開啟公會委託欄。");
    mutateQuestSave((saveData) => {
      prepareGuildContext(saveData, { introductionSeen: true });
      const quests = normalizeQuestState(saveData.quests, questDefinitions);
      if (quests.board.questIds.length !== 4) {
        quests.board.questIds = generateQuestBoard(questDefinitions, { random });
        quests.board.generatedAtCompletionCount = quests.statistics.completedTotal;
      }
      saveData.quests = quests;
    });
    syncSafeAreaUiFromSave();
    showGuildQuestFacility();
    return "已開啟公會委託欄。";
  }

  function prepareSelectedQuest(questId, progressMode = "start") {
    const quest = requireQuest(questId);
    requireFunction(showGuildQuestFacility, "無法開啟公會委託欄。");
    mutateQuestSave((saveData) => {
      prepareGuildContext(saveData, { introductionSeen: true });
      const quests = normalizeQuestState(saveData.quests, questDefinitions);
      quests.board.questIds = buildDebugBoard(quest.id);
      quests.board.excludedQuestId = null;
      quests.board.generatedAtCompletionCount = quests.statistics.completedTotal;
      quests.active = {
        questId: quest.id,
        progress: resolveDebugProgress(quest, progressMode),
        acceptedAtCompletionCount: quests.statistics.completedTotal
      };
      applyDeliveryProgress(saveData, quest, progressMode);
      saveData.quests = quests;
    });
    syncSafeAreaUiFromSave();
    showGuildQuestFacility();
    return `已將「${quest.name}」設為${describeProgressMode(progressMode)}。`;
  }

  function clearActiveQuest() {
    mutateQuestSave((saveData) => {
      prepareGuildContext(saveData, { introductionSeen: true });
      const quests = normalizeQuestState(saveData.quests, questDefinitions);
      quests.active = null;
      saveData.quests = quests;
    });
    syncSafeAreaUiFromSave();
    if (typeof showGuildQuestFacility === "function") showGuildQuestFacility();
    return "已清除目前進行中的委託，看板與統計保持不變。";
  }

  function refreshQuestBoard() {
    mutateQuestSave((saveData) => {
      prepareGuildContext(saveData, { introductionSeen: true });
      const quests = normalizeQuestState(saveData.quests, questDefinitions);
      quests.active = null;
      quests.board.excludedQuestId = null;
      quests.board.questIds = generateQuestBoard(questDefinitions, { random });
      quests.board.generatedAtCompletionCount = quests.statistics.completedTotal;
      saveData.quests = quests;
    });
    syncSafeAreaUiFromSave();
    if (typeof showGuildQuestFacility === "function") showGuildQuestFacility();
    return "已清除目前委託並重新抽選四項委託看板。";
  }

  function resetQuestData() {
    mutateQuestSave((saveData) => {
      prepareGuildContext(saveData, { introductionSeen: true });
      saveData.quests = createDefaultQuestState();
    });
    syncSafeAreaUiFromSave();
    if (typeof showGuildQuestFacility === "function") showGuildQuestFacility();
    return "已重設委託進度、完成紀錄與統計；進入委託欄時會建立新看板。";
  }

  function mutateQuestSave(mutator) {
    const saveData = requireSaveData();
    const snapshot = {
      quests: clone(saveData.quests),
      inventory: clone(saveData.inventory),
      storyFlags: clone(saveData.storyFlags),
      progression: clone(saveData.progression),
      settings: clone(saveData.settings)
    };
    mutator(saveData);
    if (!saveGameSafe()) {
      saveData.quests = snapshot.quests;
      saveData.inventory = snapshot.inventory;
      saveData.storyFlags = snapshot.storyFlags;
      saveData.progression = snapshot.progression;
      saveData.settings = snapshot.settings;
      throw new Error("無法保存委託 Debug 狀態。");
    }
  }

  function prepareGuildContext(saveData, { introductionSeen }) {
    saveData.storyFlags ||= {};
    Object.assign(saveData.storyFlags, GUILD_RECEPTIONIST_FLAGS, {
      guildQuestIntroductionSeen: Boolean(introductionSeen)
    });
    markSafeAreaVisited(saveData, ANPING_TOWN_SAFE_AREA_ID);
    setCurrentSafeArea(saveData, ANPING_TOWN_SAFE_AREA_ID);
  }

  function buildDebugBoard(selectedQuestId) {
    const enabled = Object.values(questDefinitions).filter((quest) => quest.enabled === true);
    const selectedQuest = requireQuest(selectedQuestId);
    const board = [selectedQuest];
    if (selectedQuest.rarity !== "advanced") {
      const advanced = enabled.find((quest) => quest.rarity === "advanced" && quest.id !== selectedQuestId);
      if (advanced) board.push(advanced);
    }
    for (const quest of enabled) {
      if (board.length >= 4) break;
      if (board.some((entry) => entry.id === quest.id)) continue;
      if (quest.rarity === "rare" && board.some((entry) => entry.rarity === "rare")) continue;
      board.push(quest);
    }
    if (board.length !== 4 || !board.some((quest) => quest.rarity === "advanced")) {
      throw new Error("無法建立符合規則的 Debug 委託看板。");
    }
    return board.map((quest) => quest.id);
  }

  function applyDeliveryProgress(saveData, quest, progressMode) {
    if (quest.objective.type !== "deliverMaterials") return;
    saveData.inventory.materials ||= {};
    quest.objective.materials.forEach((entry) => {
      const targetQuantity = progressMode === "ready"
        ? entry.quantity
        : progressMode === "half"
          ? Math.floor(entry.quantity / 2)
          : 0;
      const current = saveData.inventory.materials[entry.id];
      const currentQuantity = Math.max(0, Math.floor(Number(current?.quantity) || 0));
      if (targetQuantity <= currentQuantity) return;

      saveData.inventory.materials[entry.id] = {
        id: entry.id,
        name: current?.name || materialDefinitions[entry.id]?.name || entry.id,
        quantity: targetQuantity
      };
    });
  }

  function resolveDebugProgress(quest, progressMode) {
    if (quest.objective.type === "deliverMaterials") return 0;
    const target = getQuestTarget(quest);
    if (progressMode === "ready") return target;
    if (progressMode === "half") return Math.max(1, Math.floor(target / 2));
    return 0;
  }

  function requireQuest(questId) {
    const quest = questDefinitions[questId];
    if (!quest) throw new Error("請先選擇有效的委託。");
    return quest;
  }

  function requireSaveData() {
    const saveData = getSaveData?.();
    if (!saveData) throw new Error("目前無法讀取存檔。");
    return saveData;
  }

  return Object.freeze({
    getQuestOptions,
    getQuestDebugSnapshot,
    replayGuildQuestIntroduction,
    openGuildQuestBoard,
    prepareSelectedQuest,
    clearActiveQuest,
    refreshQuestBoard,
    resetQuestData
  });
}

function describeProgressMode(progressMode) {
  if (progressMode === "ready") return "可回報狀態";
  if (progressMode === "half") return "約半程進度";
  return "剛承接狀態";
}

function requireFunction(value, message) {
  if (typeof value !== "function") throw new Error(message);
}
