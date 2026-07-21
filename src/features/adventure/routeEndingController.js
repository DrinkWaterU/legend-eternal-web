import { canCompleteRouteEncounter } from "../../core/routeRules.js";
import { getRouteDefinition } from "../../data/routes/index.js";
import { renderRouteEndingView, showCombatLayout } from "../../ui/eventView.js";

export function createRouteEndingController({
  state,
  saveStore,
  els,
  characterDefinitions,
  currentRoute,
  clearPendingThreat,
  closeAbilityInfoPanel,
  closeBlessingInfoPanel,
  unlockAdventureClearAchievements,
  unlockCoastClearAchievement,
  recordRunFinished,
  finishRun,
  render,
  getEventRuntime
}) {
  function showRouteEnding(route = currentRoute(), { endingKey: requestedEndingKey = "ending" } = {}) {
    const endingKey = route?.[requestedEndingKey]?.pages?.length ? requestedEndingKey : "ending";
    const ending = route?.[endingKey];
    if (!ending?.pages?.length) {
      finishRun("clear", getRunCompletionOptions(route));
      return;
    }
    state.ended = true;
    state.awaitingBlessing = false;
    state.phase = "routeEnding";
    state.routeEndingContext = { routeId: route.id, endingKey, pageIndex: 0 };
    state.blessingContext = "normal";
    state.blessingPoolOverrideId = null;
    clearPendingThreat();
    els.nextButton.disabled = true;
    els.blessingPanel.classList.remove("is-visible");
    els.endPanel.classList.remove("is-visible");
    closeAbilityInfoPanel();
    closeBlessingInfoPanel();
    renderRouteEndingPage();
    render();
  }

  function completeRoute() {
    const route = currentRoute();
    if (!canCompleteRouteEncounter({
      route,
      routeEncounterIndex: state.routeEncounterIndex,
      battleEncounterType: state.battleEncounterType,
      enemies: state.enemies
    })) {
      throw new Error(`${route?.name || "Route"} completion 條件尚未成立。`);
    }

    let endingKey = "ending";
    if (!state.debugBuildRun) {
      endingKey = applyRouteCompletionPolicy(route);
    }
    showRouteEnding(route, { endingKey });
  }

  function applyRouteCompletionPolicy(route) {
    if (route.clearSourceId === "goblinCamp") {
      const archerProgress = saveStore.current.progression.characters.archer;
      const alreadyRescued = Boolean(saveStore.current.storyFlags.archerRescued || archerProgress?.unlocked);
      const unlockedArcher = Boolean(archerProgress && !archerProgress.unlocked);
      const endingKey = alreadyRescued ? "repeatEnding" : "ending";
      saveStore.current.storyFlags.archerRescued = true;
      if (archerProgress) archerProgress.unlocked = true;
      if (unlockedArcher) state.runStats.unlockedCharacters.push(characterDefinitions.archer.name);
      unlockAdventureClearAchievements({ regionId: "forest", routeId: route.id });
      recordRunFinished("clear");
      return endingKey;
    }

    if (route.clearSourceId === "coastCave") {
      unlockCoastClearAchievement();
      return "ending";
    }

    unlockAdventureClearAchievements({ regionId: route.regionId, routeId: route.id });
    return "ending";
  }

  function getActiveRouteEnding() {
    const routeId = state.routeEndingContext?.routeId || state.activeRouteId;
    const endingKey = state.routeEndingContext?.endingKey || "ending";
    const route = getRouteDefinition(routeId);
    return route?.[endingKey] || route?.ending || null;
  }

  function renderRouteEndingPage() {
    const ending = getActiveRouteEnding();
    const pageIndex = state.routeEndingContext?.pageIndex || 0;
    const page = ending?.pages?.[pageIndex];
    if (!page) {
      finishRun("clear", getRunCompletionOptions(getRouteDefinition(state.activeRouteId)));
      return;
    }
    renderRouteEndingView({
      els,
      eyebrow: ending.eyebrow || "冒險結尾",
      title: ending.title || "旅途結尾",
      narrative: page.lines,
      tone: page.tone,
      actionLabel: pageIndex >= ending.pages.length - 1 ? "完成冒險" : "繼續"
    });
    els.resultLabel.textContent = ending.title || "旅途結尾";
  }

  function continueRouteEnding() {
    if (state.phase !== "routeEnding" || !state.routeEndingContext) return;
    const ending = getActiveRouteEnding();
    state.routeEndingContext.pageIndex += 1;
    if (!ending || state.routeEndingContext.pageIndex >= ending.pages.length) {
      state.routeEndingContext = null;
      showCombatLayout(els);
      finishRun("clear", getRunCompletionOptions(getRouteDefinition(state.activeRouteId)));
      return;
    }
    renderRouteEndingPage();
  }

  function getRunCompletionOptions(route) {
    return route?.regionId === "beach"
      ? { completedEncounterCount: state.encounterIndex }
      : {};
  }

  function handleEventContinueButton() {
    if (state.phase === "routeEnding") {
      continueRouteEnding();
      return;
    }
    getEventRuntime()?.continueEventResult();
  }

  return Object.freeze({ completeRoute, showRouteEnding, handleEventContinueButton });
}
