import { restoreRunSnapshot, readRunSnapshot } from "../core/runSnapshot.js";
import { createRunResumeView } from "../ui/runResumeView.js";
import { regionDefinitions } from "../data/regions/index.js";
import { characterDefinitions } from "../data/characters/index.js";
import { getRouteDefinition } from "../data/routes/index.js";
import { getEventDefinition } from "../data/events/index.js";
import { showCombatLayout } from "../ui/eventView.js";

export function createRunResumeController({ foundation, battle, adventure, eventRuntime, screen, els,
  documentRef = document, windowRef = window }) {
  const { state, saveStore } = foundation;
  let failedSnapshot = null;
  const definitions = { regions: regionDefinitions, characters: characterDefinitions, routes: getRouteDefinition, events: getEventDefinition };
  const inspect = () => failedSnapshot && failedSnapshot === saveStore.current.activeRun
    ? { ok: false, reason: "這段旅程無法完整恢復。請先匯出備份，再結束旅程；永久進度會保留。" }
    : readRunSnapshot(saveStore.current.activeRun, definitions);
  const view = createRunResumeView({ documentRef, onResume: resume, onDiscard: discard });

  function refresh() {
    const result = inspect();
    const s = result.state;
    const description = result.ok
      ? `${characterDefinitions[s.selectedHeroId].name}・${regionDefinitions[s.selectedRegionId].name}・已完成 ${s.encounterIndex} 場。戰鬥、選項與獎勵會從最後保存的位置接續。`
      : result.reason;
    view.render({ exists: Boolean(saveStore.current.activeRun), valid: result.ok, description });
  }

  function restore() {
    adventure.closeStoryPanel();
    adventure.resetAdventureRunRuntime();
    restoreRunSnapshot(state, saveStore.current.activeRun, definitions);
    adventure.duelController.restoreDuelRuntime?.();
  }

  function resume() {
    if (saveStore.hasPendingTransaction || !inspect().ok) return;
    try { restoreView(); }
    catch {
      failedSnapshot = saveStore.current.activeRun;
      adventure.resetAdventureRunRuntime();
      screen.showScreen("menuScreen");
      refresh();
    }
  }

  function restoreView() {
    restore();
    showCombatLayout(els);
    screen.showScreen("gameScreen");
    els.endPanel.classList.remove("is-visible");
    els.storyPanel.classList.remove("is-visible");
    els.blessingPanel.classList.remove("is-visible");
    if (state.phase === "story") {
      foundation.setNavigationContext("story");
      adventure.plainsStoryController.restoreStoryView();
    } else if (state.phase === "routeEnding") adventure.routeEndingController.renderRouteEndingPage();
    else if (state.awaitingBlessing) adventure.blessingController.restoreBlessingChoices();
    else if (state.phase === "event") eventRuntime.restoreEventView();
    else if (state.phase === "segmentChoice") adventure.showBeachSegmentChoice();
    else if (state.phase === "campSelection") adventure.campTransitionController.renderCampSelection();
    battle.render();
    battle.renderLog();
  }

  function discard() {
    if (!saveStore.current.activeRun || saveStore.hasPendingTransaction) return;
    if (!windowRef.confirm("結束這段旅程？已保存的角色成長與素材會保留，這次冒險將無法再續玩。")) return;
    const snapshot = inspect();
    if (snapshot.ok && snapshot.state.phase !== "story") {
      restore();
      foundation.runSaveOperation(() => {
        const routeComplete = snapshot.state.phase === "routeEnding";
        adventure.finishRun(routeComplete ? "clear" : "retreat", routeComplete ? { completedEncounterCount: state.encounterIndex } : {});
        foundation.afterAdventureSaved(() => adventure.returnToRunOriginSafeArea());
      });
    } else {
      // Incompatible/terminal snapshots are discarded without executing their
      // rules, resetting permanent progress, or counting a second completion.
      foundation.commitSaveChange(draft => { draft.activeRun = null; }, () => {
        adventure.resetAdventureRunRuntime();
        screen.showScreen("menuScreen");
      });
    }
  }

  return Object.freeze({ start() { saveStore.subscribe(refresh); refresh(); }, resume, discard, refresh });
}
