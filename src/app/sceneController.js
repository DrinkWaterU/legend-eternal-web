export function createSceneController({
  state,
  uiState,
  documentRef = document,
  defaultSafeAreaId,
  getNavigationContext,
  getCurrentSafeArea,
  currentAdventureSource,
  getAdventureEncounterIndex,
  musicManager,
  ambientManager
}) {
  function resolveSceneMusicTrackId(screenId) {
    if (uiState.navigationContext === "story") {
      return undefined;
    }
    if (screenId === "gameScreen" || uiState.navigationContext === "adventure") {
      return currentAdventureSource()?.audio?.bgmId ?? null;
    }
    if (uiState.navigationContext === "camp") {
      return getCurrentSafeArea()?.audio?.bgmId || "camp";
    }
    if (uiState.navigationContext === "menu") {
      return "menu";
    }
    return null;
  }

  function resolveSceneAmbientTrackId(screenId) {
    if (uiState.navigationContext === "story") {
      return undefined;
    }
    if (screenId === "campScreen" || uiState.navigationContext === "camp") {
      return getCurrentSafeArea()?.audio?.ambientId || null;
    }
    return null;
  }

  function syncSceneAudio(screenId) {
    const musicTrackId = resolveSceneMusicTrackId(screenId);
    const ambientTrackId = resolveSceneAmbientTrackId(screenId);
    if (musicTrackId !== undefined) {
      void musicManager.requestTrack(musicTrackId);
    }
    if (ambientTrackId !== undefined) {
      void ambientManager.requestTrack(ambientTrackId);
    }
  }

  function applySceneContext(screenId) {
    const context = getNavigationContext();
    const scene = screenId === "gameScreen"
      ? "region"
      : screenId === "campScreen"
        ? "camp"
        : screenId === "menuScreen"
          ? null
          : context.scene;

    if (scene) {
      documentRef.body.dataset.scene = scene;
    } else {
      delete documentRef.body.dataset.scene;
    }

    if (scene === "region") {
      delete documentRef.body.dataset.safeArea;
      documentRef.body.style.removeProperty("--safe-area-bg-mobile");
      documentRef.body.style.removeProperty("--safe-area-bg-desktop");
      documentRef.body.dataset.region = state.selectedRegionId;
      if (state.activeRouteId) {
        documentRef.body.dataset.route = state.activeRouteId;
      } else {
        delete documentRef.body.dataset.route;
      }
      applyRegionBackgroundStage();
    } else {
      delete documentRef.body.dataset.region;
      delete documentRef.body.dataset.route;
      delete documentRef.body.dataset.regionDepth;
      documentRef.body.style.removeProperty("--region-bg-mobile");
      documentRef.body.style.removeProperty("--region-bg-desktop");
      if (scene === "camp") {
        applySafeAreaBackground();
      } else {
        delete documentRef.body.dataset.safeArea;
        documentRef.body.style.removeProperty("--safe-area-bg-mobile");
        documentRef.body.style.removeProperty("--safe-area-bg-desktop");
      }
    }

    syncSceneAudio(screenId);
  }

  function applySafeAreaBackground() {
    const safeArea = getCurrentSafeArea();
    const mobile = safeArea?.visual?.background?.mobile || safeArea?.visual?.background?.desktop || "";
    const desktop = safeArea?.visual?.background?.desktop || safeArea?.visual?.background?.mobile || "";
    documentRef.body.dataset.safeArea = safeArea?.id || defaultSafeAreaId;
    setBackgroundProperty("--safe-area-bg-mobile", mobile);
    setBackgroundProperty("--safe-area-bg-desktop", desktop);
  }

  function applyRegionBackgroundStage() {
    const source = currentAdventureSource();
    const stage = getAdventureBackgroundStage(source, getAdventureEncounterIndex());

    if (stage?.id) {
      documentRef.body.dataset.regionDepth = stage.id;
    } else {
      delete documentRef.body.dataset.regionDepth;
    }

    const mobile = stage?.mobile || stage?.desktop || source?.visual?.background?.mobile || source?.visual?.background?.desktop || "";
    const desktop = stage?.desktop || stage?.mobile || source?.visual?.background?.desktop || source?.visual?.background?.mobile || "";
    setBackgroundProperty("--region-bg-mobile", mobile);
    setBackgroundProperty("--region-bg-desktop", desktop);
  }

  function setBackgroundProperty(propertyName, path) {
    if (path) {
      documentRef.body.style.setProperty(propertyName, `url("${resolveAssetUrl(path)}")`);
    } else {
      documentRef.body.style.removeProperty(propertyName);
    }
  }

  function resolveAssetUrl(path) {
    try {
      return new URL(path, documentRef.baseURI).href;
    } catch {
      return path;
    }
  }

  function getAdventureBackgroundStage(source, encounterIndex) {
    const encounterCount = source?.encounterCount || source?.encounterPlan?.length || 1;
    const encounterNumber = Math.max(1, Math.min(encounterCount, encounterIndex + 1));
    const stages = source?.visual?.backgroundStages;
    if (!Array.isArray(stages) || stages.length === 0) {
      return source?.visual?.background || null;
    }
    return stages.find((stage) => (
      encounterNumber >= (stage.fromEncounter || 1)
      && encounterNumber <= (stage.toEncounter || encounterCount || encounterNumber)
    )) || source?.visual?.background || null;
  }

  return Object.freeze({
    applySceneContext,
    applySafeAreaBackground,
    applyRegionBackgroundStage,
    resolveSceneMusicTrackId,
    resolveSceneAmbientTrackId,
    syncSceneAudio,
    getAdventureBackgroundStage
  });
}
