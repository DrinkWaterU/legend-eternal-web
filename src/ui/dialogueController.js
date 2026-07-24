import {
  getVisibleDialogueChoices,
  getVisibleDialoguePages,
  resolveDialogueEntryNode
} from "../core/dialogue.js";
import { resolveNpcDisplayName } from "../data/npcs.js";
import {
  cancelDialogueTextAnimation,
  isDialogueTextAnimating,
  renderDialogueView,
  revealDialogueTextImmediately
} from "./dialogueView.js";

export function createDialogueController(options = {}) {
  const {
    els,
    npcDefinitions,
    dialogueDefinitions,
    getStoryFlags,
    getDialogueContext = () => ({}),
    setStoryFlag,
    onOpenFacility,
    onStartDuel,
    onReturnToFacilityList,
    onEndDialogue = onReturnToFacilityList,
    textAnimationOptions = {}
  } = options;

  if (!els || typeof els !== "object") {
    throw new Error("Dialogue controller 需要有效的 els。");
  }
  if (typeof getStoryFlags !== "function") {
    throw new Error("Dialogue controller 需要 getStoryFlags callback。");
  }
  if (typeof setStoryFlag !== "function") {
    throw new Error("Dialogue controller 需要 setStoryFlag callback。");
  }

  const state = {
    npcId: null,
    dialogueId: null,
    nodeId: null,
    pageIndex: 0,
    notice: "",
    noticeType: "status"
  };
  let pendingAnimateText = false;

  function reset() {
    cancelDialogueTextAnimation(els);
    state.npcId = null;
    state.dialogueId = null;
    state.nodeId = null;
    state.pageIndex = 0;
    state.notice = "";
    state.noticeType = "status";
    pendingAnimateText = false;
  }

  function open(npcId, options = {}) {
    const {
      animateText = true,
      renderAfter = true
    } = options;
    const npc = npcDefinitions[npcId];
    const dialogue = npc && dialogueDefinitions[npc.dialogueId];
    if (!npc || !dialogue) {
      throw new Error(`找不到 NPC 對話：${npcId || "(empty)"}`);
    }
    cancelDialogueTextAnimation(els);
    state.npcId = npc.id;
    state.dialogueId = dialogue.id;
    state.nodeId = resolveDialogueEntryNode(dialogue, getContext());
    state.pageIndex = 0;
    state.notice = "";
    state.noticeType = "status";
    pendingAnimateText = Boolean(animateText);
    if (renderAfter) {
      render({ preserveScroll: true });
    }
    return state.nodeId;
  }

  function reopenCurrentNpc(options = {}) {
    if (!state.npcId) {
      return false;
    }
    open(state.npcId, options);
    return true;
  }

  function advance() {
    if (revealDialogueTextImmediately(els)) {
      return;
    }
    const node = getCurrentNode();
    if (!node) {
      return;
    }
    const pages = getCurrentPages();
    const lastPageIndex = Math.max(0, pages.length - 1);
    if (state.pageIndex < lastPageIndex) {
      state.pageIndex += 1;
      state.notice = "";
      render({ preserveScroll: true, resetDialogueScroll: true, animateText: true });
      return;
    }

    const visibleChoices = getVisibleDialogueChoices(node, getContext());
    if (visibleChoices.length > 0) {
      render({ preserveScroll: true });
      return;
    }

    if (!completeNode(node)) {
      return;
    }
    if (node.nextNodeId) {
      gotoNode(node.nextNodeId);
      return;
    }
    onEndDialogue?.();
  }

  function choose(choiceId) {
    if (isDialogueTextAnimating(els)) {
      return false;
    }
    const node = getCurrentNode();
    const choice = getVisibleDialogueChoices(node, getContext())
      .find((candidate) => candidate.id === choiceId);
    if (!choice) {
      return false;
    }
    state.notice = "";
    return executeAction(choice.action);
  }

  function gotoNode(nodeId) {
    const dialogue = getCurrentDialogue();
    if (!dialogue?.nodes?.[nodeId]) {
      throw new Error(`找不到 Dialogue node：${nodeId || "(empty)"}`);
    }
    state.nodeId = nodeId;
    state.pageIndex = 0;
    state.notice = "";
    state.noticeType = "status";
    render({ preserveScroll: true, resetDialogueScroll: true, animateText: true });
    return true;
  }

  function completeNode(node) {
    for (const action of node.actionsOnComplete || []) {
      if (!executeAction(action, { renderAfter: false })) {
        state.notice = "目前無法保存對話進度，請重新嘗試。";
        state.noticeType = "error";
        render({ preserveScroll: true });
        return false;
      }
    }
    return true;
  }

  function executeAction(action, options = {}) {
    const { renderAfter = true } = options;
    switch (action?.type) {
      case "gotoNode":
        return gotoNode(action.nodeId);
      case "setStoryFlag": {
        const saved = setStoryFlag(action.key, action.value);
        if (!saved) {
          return false;
        }
        if (renderAfter) {
          render({ preserveScroll: true });
        }
        return true;
      }
      case "openFacility":
        cancelDialogueTextAnimation(els);
        onOpenFacility?.(action.facilityId, state.npcId);
        return true;
      case "startDuel": {
        const result = onStartDuel?.(action.duelId, state.npcId);
        if (result === true || result?.ok === true) {
          cancelDialogueTextAnimation(els);
          return true;
        }
        state.notice = result?.message || "目前無法開始切磋，請重新確認角色狀態。";
        state.noticeType = "error";
        if (renderAfter) {
          render({ preserveScroll: true });
        }
        return false;
      }
      case "returnToFacilityList":
        cancelDialogueTextAnimation(els);
        onReturnToFacilityList?.();
        return true;
      case "endDialogue":
        cancelDialogueTextAnimation(els);
        onEndDialogue?.();
        return true;
      default:
        throw new Error(`無法處理 Dialogue action：${action?.type || "(empty)"}`);
    }
  }

  function render(options = {}) {
    const {
      preserveScroll = false,
      resetDialogueScroll = false
    } = options;
    const animateText = Object.prototype.hasOwnProperty.call(options, "animateText")
      ? Boolean(options.animateText)
      : pendingAnimateText;
    pendingAnimateText = false;

    const npc = getCurrentNpc();
    const node = getCurrentNode();
    if (!npc || !node) {
      return;
    }
    const scrollY = preserveScroll && typeof window !== "undefined" ? window.scrollY : null;
    renderDialogueView({
      els,
      npc,
      displayName: node.speakerLabel || resolveNpcDisplayName(npc, getContext()),
      node: { ...node, pages: getCurrentPages() },
      pageIndex: state.pageIndex,
      visibleChoices: state.pageIndex >= getCurrentPages().length - 1
        ? getVisibleDialogueChoices(node, getContext())
        : [],
      notice: state.notice,
      noticeType: state.noticeType,
      onAdvance: advance,
      onChoice: choose,
      animateText,
      pageKey: `${state.dialogueId}:${state.nodeId}:${state.pageIndex}`,
      typewriterOptions: textAnimationOptions
    });
    if (resetDialogueScroll) {
      els.dialogueTextRegion.scrollTop = 0;
    }
    if (scrollY !== null && typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: scrollY, behavior: "instant" });
    }
  }

  function getContext() {
    const extraContext = getDialogueContext() || {};
    return {
      ...extraContext,
      storyFlags: getStoryFlags() || extraContext.storyFlags || {}
    };
  }

  function getCurrentPages() {
    return getVisibleDialoguePages(getCurrentNode(), getContext());
  }

  function getCurrentNpc() {
    return npcDefinitions[state.npcId] || null;
  }

  function getCurrentDialogue() {
    return dialogueDefinitions[state.dialogueId] || null;
  }

  function getCurrentNode() {
    return getCurrentDialogue()?.nodes?.[state.nodeId] || null;
  }

  function getState() {
    return { ...state };
  }

  return Object.freeze({
    reset,
    open,
    reopenCurrentNpc,
    advance,
    choose,
    gotoNode,
    render,
    getState
  });
}
