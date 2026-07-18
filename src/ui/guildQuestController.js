import { renderStandaloneDialogueText } from "./dialogueView.js";
import { renderGuildQuestView } from "./guildQuestView.js";

const SPEECH = Object.freeze({
  idle: "今天能接的單子都在這裡了。先掂量一下自己的斤兩再決定，別被上面寫的數字沖昏頭喔。",
  active: "你手上的活兒還沒辦完呢。進度姊姊都替你記著了，別急，按著自己的步調來，活著回來最重要。",
  ready: "哎呀，看來麻煩已經順利解決了呢。拿來讓姊姊確認一下吧，少不了你的好處喔。",
  materials: "還差了一點呢。目前的數量可填不滿公會的胃口，現在回報的話，我可沒辦法幫你結案喔。",
  accepted: "委託已經登記好了。先把內容記清楚，再出發也不遲。",
  abandoned: "好了，這單已經替你劃掉了。等你把裝備和腦袋都重新磨利了，再來挑件真正適合自己的活兒。",
  completed: "內容核對無誤，這單正式結案。辛苦啦，你的賞金也已經結清囉。"
});

export function createGuildQuestController({
  els,
  questRuntime,
  questDefinitions,
  materialDefinitions,
  npcDefinition,
  getSave
}) {
  let notice = "";
  let noticeType = "status";
  let speechOverride = "";
  let pendingAbandonQuestId = null;

  function reset() {
    notice = "";
    noticeType = "status";
    speechOverride = "";
    pendingAbandonQuestId = null;
    closeAbandonConfirm();
  }

  function render() {
    const runtimeSnapshot = questRuntime.getSnapshot();
    const snapshot = {
      ...runtimeSnapshot,
      inventory: getSave().inventory,
      inventoryGold: getSave().inventory.gold,
      notice,
      noticeType
    };
    renderSpeaker(npcDefinition);
    renderGuildQuestView({
      els,
      snapshot,
      questDefinitions,
      materialDefinitions,
      onAccept: acceptQuest,
      onReport: reportQuest,
      onAbandon: openAbandonConfirm
    });
    renderSpeech(snapshot);
  }

  function acceptQuest(questId) {
    const result = questRuntime.acceptQuest(questId);
    setResult(result, result.ok ? "委託已承接。" : result.reason);
    if (result.ok) speechOverride = SPEECH.accepted;
    render();
  }

  function reportQuest() {
    const result = questRuntime.reportQuest();
    setResult(result, result.ok ? `委託完成，獲得 ${result.reward.gold} G。` : result.reason);
    if (result.ok) speechOverride = SPEECH.completed;
    render();
  }

  function openAbandonConfirm(questId) {
    pendingAbandonQuestId = questId;
    const quest = questDefinitions[questId];
    els.guildQuestAbandonTitle.textContent = quest?.name || "目前委託";
    els.guildQuestAbandonMeta.textContent = "放棄後，本次累積進度會全部作廢；公會委託榜不會因此刷新。";
    els.guildQuestAbandonPanel.classList.add("is-visible");
  }

  function confirmAbandon() {
    if (!pendingAbandonQuestId) return;
    const result = questRuntime.abandonQuest();
    closeAbandonConfirm();
    setResult(result, result.ok ? "已放棄目前委託。" : result.reason);
    if (result.ok) speechOverride = SPEECH.abandoned;
    render();
  }

  function closeAbandonConfirm() {
    pendingAbandonQuestId = null;
    els.guildQuestAbandonPanel.classList.remove("is-visible");
  }

  function renderSpeech(snapshot) {
    const text = speechOverride || resolveSpeech(snapshot);
    renderStandaloneDialogueText({
      els: {
        dialogueTextRegion: els.guildQuestDialogueTextRegion,
        dialogueSkipButton: els.guildQuestDialogueSkipButton,
        dialogueText: els.guildQuestDialogueText
      },
      text,
      animateText: true,
      pageKey: `guild-quest:${snapshot.active?.questId || "none"}:${snapshot.activeProgress}:${text}`
    });
    speechOverride = "";
  }

  function resolveSpeech(snapshot) {
    if (!snapshot.activeQuest) return SPEECH.idle;
    const target = snapshot.activeQuest.objective.type === "deliverMaterials"
      ? snapshot.activeQuest.objective.materials.reduce((sum, entry) => sum + entry.quantity, 0)
      : snapshot.activeQuest.objective.target;
    if (snapshot.activeProgress >= target) return SPEECH.ready;
    if (snapshot.activeQuest.objective.type === "deliverMaterials") return SPEECH.materials;
    return SPEECH.active;
  }

  function renderSpeaker(npc) {
    const displayName = npc?.name || "瑟琳";
    els.guildQuestSpeakerTitle.textContent = npc?.title || "冒險者公會資深接待員";
    els.guildQuestSpeakerName.textContent = displayName;
    els.guildQuestSpeakerPortraitFallback.textContent = displayName;
    const portrait = String(npc?.portrait || "");
    if (!portrait) return;
    els.guildQuestSpeakerPortraitImage.alt = `${displayName}的立繪`;
    els.guildQuestSpeakerPortraitImage.onload = () => {
      els.guildQuestSpeakerPortraitImage.hidden = false;
      els.guildQuestSpeakerPortraitFallback.hidden = true;
    };
    els.guildQuestSpeakerPortraitImage.onerror = () => {
      els.guildQuestSpeakerPortraitImage.hidden = true;
      els.guildQuestSpeakerPortraitFallback.hidden = false;
    };
    els.guildQuestSpeakerPortraitImage.src = portrait;
  }

  function setResult(result, message) {
    notice = message || "";
    noticeType = result.ok ? "status" : "error";
  }

  return Object.freeze({
    reset,
    render,
    acceptQuest,
    reportQuest,
    openAbandonConfirm,
    confirmAbandon,
    closeAbandonConfirm
  });
}
