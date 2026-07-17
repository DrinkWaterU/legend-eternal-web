export function createSaveActions({ state, saveStore, addFixedLog }) {
  function saveGameSafe() {
    return saveStore.persist({
      onError: () => {
        if (state.hero) addFixedLog("system", "瀏覽器無法保存目前進度。");
      }
    });
  }

  function setDialogueStoryFlag(key, value) {
    if (!Object.prototype.hasOwnProperty.call(saveStore.current.storyFlags, key) || typeof value !== "boolean") {
      return false;
    }
    const previousValue = saveStore.current.storyFlags[key];
    saveStore.current.storyFlags[key] = value;
    if (saveGameSafe()) return true;
    saveStore.current.storyFlags[key] = previousValue;
    return false;
  }

  return Object.freeze({ saveGameSafe, setDialogueStoryFlag });
}
