export function populateDebugSafeAreaOptions(context) {
  const options = typeof context.actions.getSafeAreaOptions === "function"
    ? context.actions.getSafeAreaOptions()
    : [];
  const previousValue = context.safeAreaSelect.value;
  context.safeAreaSelect.replaceChildren();
  options.forEach((safeArea) => {
    const option = document.createElement("option");
    option.value = safeArea.id;
    const status = safeArea.visited
      ? "已造訪"
      : safeArea.unlocked
        ? "已解鎖／未造訪"
        : "未解鎖";
    option.textContent = `${safeArea.name}｜${status}${safeArea.current ? "｜目前" : ""}`;
    context.safeAreaSelect.append(option);
  });
  if ([...context.safeAreaSelect.options].some((option) => option.value === previousValue)) {
    context.safeAreaSelect.value = previousValue;
  }
  context.safeAreaSelect.disabled = options.length === 0;
  syncDebugSafeAreaNote(context, options);
}

export function syncDebugSafeAreaNote(context, options = null) {
  const safeAreas = options || (typeof context.actions.getSafeAreaOptions === "function"
    ? context.actions.getSafeAreaOptions()
    : []);
  const selected = safeAreas.find((safeArea) => safeArea.id === context.safeAreaSelect.value);
  if (!selected) {
    context.safeAreaNote.textContent = "沒有可用的安全區資料。";
    return;
  }
  const status = selected.visited
    ? "已造訪"
    : selected.unlocked
      ? "已解鎖但尚未造訪"
      : "尚未解鎖";
  context.safeAreaNote.textContent = `${selected.name}：${status}${selected.current ? "，目前所在據點" : ""}。`;
}

export function populateDebugQuestOptions(context) {
  const options = typeof context.actions.getQuestOptions === "function"
    ? context.actions.getQuestOptions()
    : [];
  const previousValue = context.questSelect.value;
  context.questSelect.replaceChildren();
  options.forEach((quest) => {
    const option = document.createElement("option");
    option.value = quest.id;
    option.textContent = `${quest.rarityLabel}｜${quest.name}`;
    context.questSelect.append(option);
  });
  if ([...context.questSelect.options].some((option) => option.value === previousValue)) {
    context.questSelect.value = previousValue;
  }
  context.questSelect.disabled = options.length === 0;
  syncDebugQuestNote(context, options);
}

export function syncDebugQuestNote(context, options = null) {
  const quests = options || (typeof context.actions.getQuestOptions === "function"
    ? context.actions.getQuestOptions()
    : []);
  const selected = quests.find((quest) => quest.id === context.questSelect.value);
  if (!selected) {
    context.questNote.textContent = "沒有可用的委託資料。";
    return;
  }
  const snapshot = typeof context.actions.getQuestDebugSnapshot === "function"
    ? context.actions.getQuestDebugSnapshot()
    : null;
  const activeText = snapshot?.activeQuestId
    ? `目前：${snapshot.activeQuestName} ${snapshot.activeProgress}/${snapshot.activeTarget}`
    : "目前沒有進行中的委託";
  context.questNote.textContent = `${selected.objective}｜${selected.rewardGold} G｜${activeText}。`;
}

export function runDebugPanelAction(action, context) {
  const actionMap = {
    "set-level": () => context.actions.setLevel(Number(context.levelInput.value)),
    "set-exp": () => context.actions.setExp(Number(context.expInput.value)),
    heal: () => context.actions.healHero(),
    "unlock-phoenix": () => context.actions.unlockPhoenix(),
    "remove-phoenix": () => confirmDanger("要移除鳳凰加護並重置平原劇情旗標嗎？") && context.actions.removePhoenix(),
    "clear-inventory": () => confirmDanger("要清空金幣與素材嗎？") && context.actions.clearInventory(),
    "give-blacksmith-resources": () => context.actions.giveBlacksmithResources(),
    "give-all-weapons": () => context.actions.giveAllWeapons(),
    "clear-all-weapons": () => confirmDanger("要清空全部武器並卸下所有角色目前裝備嗎？")
      && context.actions.clearAllWeapons(),
    "prepare-safe-area": () => runSafeAreaAction(context, () => context.actions.prepareSafeArea(context.safeAreaSelect.value)),
    "visit-safe-area": () => runSafeAreaAction(context, () => context.actions.visitSafeArea(context.safeAreaSelect.value)),
    "travel-safe-area": () => runSafeAreaAction(context, () => context.actions.travelSafeArea(context.safeAreaSelect.value)),
    "open-safe-area-travel": () => context.actions.openSafeAreaTravel(),
    "reset-safe-area": () => confirmDanger("要重設這個據點的解鎖與造訪狀態嗎？")
      && runSafeAreaAction(context, () => context.actions.resetSafeArea(context.safeAreaSelect.value)),
    "play-anping-arrival": () => runSafeAreaAction(context, () => context.actions.playAnpingArrival()),
    "replay-guild-quest-intro": () => runQuestAction(context, () => context.actions.replayGuildQuestIntroduction()),
    "open-guild-quests": () => runQuestAction(context, () => context.actions.openGuildQuestBoard()),
    "prepare-selected-quest": () => runQuestAction(context, () => (
      context.actions.prepareSelectedQuest(context.questSelect.value, "start")
    )),
    "set-selected-quest-half": () => runQuestAction(context, () => (
      context.actions.prepareSelectedQuest(context.questSelect.value, "half")
    )),
    "set-selected-quest-ready": () => runQuestAction(context, () => (
      context.actions.prepareSelectedQuest(context.questSelect.value, "ready")
    )),
    "clear-active-quest": () => runQuestAction(context, () => context.actions.clearActiveQuest()),
    "refresh-quest-board": () => confirmDanger("要清除目前委託並重新抽選四項委託看板嗎？")
      && runQuestAction(context, () => context.actions.refreshQuestBoard()),
    "reset-quest-data": () => confirmDanger("要重設委託看板、進度、完成紀錄與委託統計嗎？")
      && runQuestAction(context, () => context.actions.resetQuestData()),
    camp: () => context.actions.returnToCamp(),
    "delete-save": () => confirmDanger("要刪除目前存檔嗎？這個動作無法復原。") && context.actions.deleteSave()
  };

  runDebugPanelActionSafely(context, actionMap[action]);
}

export function runDebugPanelActionSafely(context, action) {
  if (typeof action !== "function") {
    setDebugPanelStatus(context.status, "找不到指定 Debug 操作。", "error");
    return;
  }
  try {
    const result = action();
    if (result === false) {
      setDebugPanelStatus(context.status, "操作已取消。", "warn");
      return;
    }
    setDebugPanelStatus(context.status, result || "操作完成。", "ok");
  } catch (error) {
    setDebugPanelStatus(context.status, `操作失敗：${error?.message || "未知錯誤"}`, "error");
  }
}

export function setDebugPanelStatus(element, message, type) {
  element.textContent = message;
  element.dataset.type = type;
}

function runSafeAreaAction(context, action) {
  const result = action();
  populateDebugSafeAreaOptions(context);
  return result;
}

function runQuestAction(context, action) {
  const result = action();
  syncDebugQuestNote(context);
  return result;
}

function confirmDanger(message) {
  return window.confirm(message);
}
