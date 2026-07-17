import { parseDebugBlessingList } from "./debugBlessingParser.js";
import { runDebugPanelActionSafely, setDebugPanelStatus } from "./debugPanelActions.js";

export function initializeDebugScenarioPanel(context) {
  bindScenarioEvents(context);
  populateScenarioCatalog(context);
  populateCharacterOptions(context);
  syncDebugScenario(context, { applyDefaultProfile: true });
}

function bindScenarioEvents(context) {
  context.scenarioSelect.addEventListener("change", () => {
    syncDebugScenario(context, { applyDefaultProfile: true });
    setDebugPanelStatus(context.status, "已切換場景並套用預設混合 Build。", "ok");
  });
  context.routeEntrySelect.addEventListener("change", () => {
    syncDebugBuildSlots(context, { applyDefaultProfile: true });
    setDebugPanelStatus(context.status, "已依 Route 進入時機重建 Blessing 取得位置。", "ok");
  });
  context.midChoiceSelect.addEventListener("change", () => {
    syncDebugBuildSlots(context, { applyDefaultProfile: true });
    setDebugPanelStatus(context.status, "已依中段選擇重建 Blessing 取得位置。", "ok");
  });
  context.buildParseButton.addEventListener("click", () => parseBlessingBuildInput(context));
  context.scenarioStartButton.addEventListener("click", () => startSelectedScenario(context));
}

function populateScenarioCatalog(context) {
  context.catalog = typeof context.actions.getScenarioCatalog === "function"
    ? context.actions.getScenarioCatalog()
    : [];
  context.scenarioSelect.replaceChildren();

  const groups = new Map();
  context.catalog.forEach((scenario) => {
    if (!groups.has(scenario.category)) {
      const optionGroup = document.createElement("optgroup");
      optionGroup.label = scenario.category;
      groups.set(scenario.category, optionGroup);
      context.scenarioSelect.append(optionGroup);
    }
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.name;
    groups.get(scenario.category).append(option);
  });

  const routeEntries = typeof context.actions.getRouteEntryOptions === "function"
    ? context.actions.getRouteEntryOptions()
    : [6, 7, 8];
  context.routeEntrySelect.replaceChildren();
  routeEntries.forEach((encounterNumber) => {
    const option = document.createElement("option");
    option.value = String(encounterNumber);
    option.textContent = `森林第 ${encounterNumber} 場前`;
    context.routeEntrySelect.append(option);
  });

  const midChoices = typeof context.actions.getMidChoices === "function"
    ? context.actions.getMidChoices()
    : [];
  context.midChoiceSelect.replaceChildren();
  midChoices.forEach((choice) => {
    const option = document.createElement("option");
    option.value = choice.id;
    option.textContent = choice.label;
    context.midChoiceSelect.append(option);
  });
}

function populateCharacterOptions(context) {
  const characters = typeof context.actions.getCharacterOptions === "function"
    ? context.actions.getCharacterOptions()
    : [];
  context.characterSelect.replaceChildren();
  characters.forEach((character) => {
    const option = document.createElement("option");
    option.value = character.id;
    option.textContent = character.name;
    context.characterSelect.append(option);
  });
  context.characterSelect.disabled = characters.length === 0;
}

function runDebugAction(action, context) {
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
    camp: () => context.actions.returnToCamp(),
    "delete-save": () => confirmDanger("要刪除目前存檔嗎？這個動作無法復原。") && context.actions.deleteSave()
  };

  runDebugPanelActionSafely(context, actionMap[action]);
}

function syncDebugScenario(context, options = {}) {
  const scenario = getSelectedScenario(context);
  const supportsRouteEntry = Boolean(scenario?.supportsRouteEntry);
  const supportsMidChoice = Boolean(scenario?.supportsMidChoice);
  const supportsBuild = Boolean(scenario?.supportsBuild);
  const supportsHp = !["plainsStory", "goblinEnding"].includes(scenario?.kind);

  const scenarioDescription = scenario?.description || "沒有可用的場景。";
  context.scenarioNote.textContent = supportsMidChoice
    ? `${scenarioDescription} 直接跳場時，中段回血不額外疊加；最終 HP 以下方進場 HP 為準。`
    : scenarioDescription;
  context.routeEntryRow.hidden = !supportsRouteEntry;
  context.midChoiceRow.hidden = !supportsMidChoice;
  context.hpRow.hidden = !supportsHp;
  context.buildSection.hidden = !supportsBuild;
  context.scenarioStartButton.disabled = !scenario;

  if (supportsBuild) {
    syncDebugBuildSlots(context, options);
  } else {
    context.buildSlots = [];
    context.buildSelections = {};
    renderDebugBuildSlots(context);
  }
}

function syncDebugBuildSlots(context, options = {}) {
  const { applyDefaultProfile = false } = options;
  const scenario = getSelectedScenario(context);
  context.buildSlots = scenario && typeof context.actions.getScenarioBuildSlots === "function"
    ? context.actions.getScenarioBuildSlots(scenario.id, getScenarioOptions(context))
    : [];

  if (applyDefaultProfile) {
    context.buildSelections = typeof context.actions.createBuildProfile === "function"
      ? context.actions.createBuildProfile(context.buildSlots, "mixed")
      : {};
  } else {
    const validSelections = {};
    context.buildSlots.forEach((slot) => {
      const selected = context.buildSelections[slot.id];
      if (slot.blessings.some((blessing) => blessing.id === selected)) {
        validSelections[slot.id] = selected;
      }
    });
    context.buildSelections = validSelections;
  }

  renderBuildProfiles(context);
  renderDebugBuildSlots(context);
}

function renderBuildProfiles(context) {
  const profiles = typeof context.actions.getBuildProfiles === "function"
    ? context.actions.getBuildProfiles()
    : [];
  context.buildProfiles.replaceChildren();
  profiles.forEach((profile) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = profile.label;
    button.addEventListener("click", () => {
      context.buildSelections = context.actions.createBuildProfile(context.buildSlots, profile.id);
      renderDebugBuildSlots(context);
      setDebugPanelStatus(context.status, `已套用「${profile.label}」快速 Build。`, "ok");
    });
    context.buildProfiles.append(button);
  });
}

function renderDebugBuildSlots(context) {
  context.buildList.replaceChildren();

  if (context.buildSlots.length === 0) {
    const empty = document.createElement("p");
    empty.className = "debug-build-empty";
    empty.textContent = "此場景不需要 Blessing Build。";
    context.buildList.append(empty);
  }

  context.buildSlots.forEach((slot, index) => {
    const item = document.createElement("label");
    item.className = "debug-build-slot";
    item.setAttribute("role", "listitem");

    const heading = document.createElement("span");
    heading.className = "debug-build-slot-heading";
    const gapText = slot.battleVictoriesAfter > 0
      ? `｜後續 ${slot.battleVictoriesAfter} 次 Battle Victory`
      : "";
    heading.textContent = `${String(index + 1).padStart(2, "0")}｜${slot.label}${gapText}`;

    const select = document.createElement("select");
    select.dataset.slotId = slot.id;
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "— 留空 —";
    select.append(emptyOption);
    slot.blessings.forEach((blessing) => {
      const option = document.createElement("option");
      option.value = blessing.id;
      option.textContent = `${blessing.name}｜${blessing.primaryFlow || "unknown"}｜${blessing.rarity || ""}`;
      select.append(option);
    });
    select.value = context.buildSelections[slot.id] || "";
    select.addEventListener("change", () => {
      if (select.value) {
        context.buildSelections[slot.id] = select.value;
      } else {
        delete context.buildSelections[slot.id];
      }
      updateBuildCount(context);
    });

    item.append(heading, select);
    context.buildList.append(item);
  });

  updateBuildCount(context);
}

function updateBuildCount(context) {
  const selectedCount = context.buildSlots.filter((slot) => Boolean(context.buildSelections[slot.id])).length;
  context.buildCount.textContent = `${selectedCount} / ${context.buildSlots.length}`;
}

function parseBlessingBuildInput(context) {
  const allBlessings = uniqueBlessings(context.buildSlots.flatMap((slot) => slot.blessings));
  const result = parseDebugBlessingList(context.buildPaste.value, allBlessings);
  const selections = {};
  const incompatibleNames = [];
  let slotCursor = 0;

  result.blessingIds.forEach((blessingId) => {
    const blessing = allBlessings.find((item) => item.id === blessingId);
    let matchedIndex = -1;
    for (let index = slotCursor; index < context.buildSlots.length; index += 1) {
      if (context.buildSlots[index].blessings.some((item) => item.id === blessingId)) {
        matchedIndex = index;
        break;
      }
    }
    if (matchedIndex < 0) {
      incompatibleNames.push(blessing?.name || blessingId);
      return;
    }
    selections[context.buildSlots[matchedIndex].id] = blessingId;
    slotCursor = matchedIndex + 1;
  });

  context.buildSelections = selections;
  renderDebugBuildSlots(context);

  const messages = [`已依正式取得位置解析 ${Object.keys(selections).length} 個 Blessing。`];
  if (result.unknownNames.length > 0) {
    messages.push(`無法解析：${result.unknownNames.join("、")}。`);
  }
  if (incompatibleNames.length > 0) {
    messages.push(`後續沒有相容取得位置：${incompatibleNames.join("、")}。`);
  }
  const hasWarning = result.unknownNames.length > 0 || incompatibleNames.length > 0;
  setDebugPanelStatus(context.status, messages.join(" "), hasWarning ? "warn" : "ok");
}

function startSelectedScenario(context) {
  const scenario = getSelectedScenario(context);
  if (!scenario) {
    setDebugPanelStatus(context.status, "沒有可開始的 Debug 場景。", "error");
    return;
  }

  runDebugPanelActionSafely(context, () => context.actions.startScenario({
    scenarioId: scenario.id,
    characterId: context.characterSelect.value || undefined,
    ...getScenarioOptions(context),
    hpPercent: Number(context.hpInput.value),
    selections: context.buildSlots
      .filter((slot) => Boolean(context.buildSelections[slot.id]))
      .map((slot) => ({ slotId: slot.id, blessingId: context.buildSelections[slot.id] }))
  }));
}

function getScenarioOptions(context) {
  return {
    routeEntryEncounter: Number(context.routeEntrySelect.value) || 6,
    midChoice: context.midChoiceSelect.value || "heal"
  };
}

function getSelectedScenario(context) {
  return context.catalog.find((scenario) => scenario.id === context.scenarioSelect.value)
    || context.catalog[0]
    || null;
}

function uniqueBlessings(blessings) {
  const byId = new Map();
  blessings.forEach((blessing) => {
    if (!byId.has(blessing.id)) {
      byId.set(blessing.id, blessing);
    }
  });
  return [...byId.values()];
}
