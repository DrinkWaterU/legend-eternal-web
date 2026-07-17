const NAVIGATION_CONTEXTS = Object.freeze({
  menu: { scene: null, returnTarget: "menuScreen" },
  camp: { scene: "camp", returnTarget: "campScreen" },
  adventure: { scene: "region", returnTarget: null },
  story: { scene: null, returnTarget: null }
});

const ROOT_SCREEN_CONTEXTS = Object.freeze({
  menuScreen: "menu",
  campScreen: "camp",
  gameScreen: "adventure"
});

export function createNavigationContext({ uiState, showScreen }) {
  function getNavigationContext(contextId = uiState.navigationContext) {
    return NAVIGATION_CONTEXTS[contextId] || NAVIGATION_CONTEXTS.menu;
  }

  function setNavigationContext(contextId) {
    uiState.navigationContext = NAVIGATION_CONTEXTS[contextId] ? contextId : "menu";
  }

  function getNavigationReturnTarget() {
    return getNavigationContext().returnTarget || "menuScreen";
  }

  function showScreenInContext(screenId, contextId) {
    setNavigationContext(contextId);
    showScreen(screenId);
  }

  function syncRootScreenContext(screenId) {
    const contextId = ROOT_SCREEN_CONTEXTS[screenId];
    if (contextId) {
      setNavigationContext(contextId);
    }
  }

  return Object.freeze({
    getNavigationContext,
    setNavigationContext,
    getNavigationReturnTarget,
    showScreenInContext,
    syncRootScreenContext
  });
}
