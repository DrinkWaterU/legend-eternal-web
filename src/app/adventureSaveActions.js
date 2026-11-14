// A synchronous player action owns all of its permanent changes, including
// nested combat, rewards, quests and story flags. Retry only writes its candidate.
import { captureRunSnapshot, withRunRandom } from "../core/runSnapshot.js";

export function createAdventureSaveActions({ saveStore, commitSaveChange, state }) {
  let collecting = false;
  let effects = null;

  function afterAdventureSaved(effect) {
    if (effects) effects.push(effect);
    else effect();
  }

  function runSaveOperation(action) {
    if (collecting) return action();
    if (saveStore.hasPendingTransaction) return undefined;
    let value;
    const completionEffects = [];
    commitSaveChange((draft) => {
      collecting = true;
      effects = completionEffects;
      try {
        value = saveStore.withOperationDraft(draft, () => state ? withRunRandom(state, action) : action());
        if (value && typeof value.then === "function") throw new TypeError("冒險保存操作必須同步完成。");
        if (state && !state.debugBuildRun && (state.hero || state.runResumeFinished)) draft.activeRun = captureRunSnapshot(state);
      } finally {
        collecting = false;
        effects = null;
      }
    }, () => {
      // Finish every presentation effect even if one view fails after saving.
      let failure;
      for (const effect of completionEffects) {
        try { effect(); } catch (error) { failure ||= error; }
      }
      if (failure) throw failure;
    }, { skipUnchanged: true });
    return value;
  }

  return Object.freeze({ runSaveOperation, afterAdventureSaved });
}
