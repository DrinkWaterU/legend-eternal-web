export function initDebugPanel({ enabled, actions }) {
  if (!enabled || !actions) {
    return;
  }

  const panel = document.createElement("aside");
  panel.className = "debug-panel";
  panel.innerHTML = `
    <button class="debug-toggle" type="button" aria-expanded="false">調試</button>
    <div class="debug-body" hidden>
      <div class="debug-header">
        <strong>調試模式</strong>
        <small>?debug=1</small>
      </div>

      <section class="debug-section" aria-labelledby="debugSaveToolsTitle">
        <div class="debug-section-heading">
          <strong id="debugSaveToolsTitle">角色與存檔</strong>
          <small>會修改正式存檔</small>
        </div>
        <div class="debug-input-pair">
          <label>
            等級
            <input class="debug-level" type="number" min="1" max="30" value="1" />
          </label>
          <label>
            EXP
            <input class="debug-exp" type="number" min="0" value="0" />
          </label>
        </div>
        <div class="debug-grid">
          <button type="button" data-action="set-level">設定等級</button>
          <button type="button" data-action="set-exp">設定 EXP</button>
          <button type="button" data-action="heal">補滿 HP</button>
          <button type="button" data-action="unlock-phoenix">解鎖加護</button>
          <button type="button" data-action="remove-phoenix">移除加護</button>
          <button type="button" data-action="clear-inventory">清空資源</button>
        </div>
        <div class="debug-material-row">
          <label>
            素材來源
            <select class="debug-material-group"></select>
          </label>
          <button class="debug-material-give" type="button">給予素材</button>
        </div>
        <div class="debug-grid">
          <button type="button" data-action="camp">回營地</button>
          <button type="button" data-action="delete-save">刪除存檔</button>
        </div>
      </section>

      <section class="debug-section debug-scenario-section" aria-labelledby="debugScenarioTitle">
        <div class="debug-section-heading">
          <strong id="debugScenarioTitle">冒險場景測試</strong>
          <small>Sandbox，不寫正式進度</small>
        </div>
        <div class="debug-input-pair">
          <label>
            場景
            <select class="debug-scenario-select"></select>
          </label>
          <label>
            測試角色
            <select class="debug-character-select"></select>
          </label>
        </div>
        <small class="debug-scenario-note"></small>

        <div class="debug-scenario-options">
          <label class="debug-route-entry-row" hidden>
            Route 進入
            <select class="debug-route-entry"></select>
          </label>
          <label class="debug-mid-choice-row" hidden>
            中段選擇
            <select class="debug-mid-choice"></select>
          </label>
          <label class="debug-hp-row">
            測試場景進場 HP（%）
            <input class="debug-scenario-hp" type="number" min="1" max="100" value="75" />
          </label>
        </div>

        <section class="debug-build-section" aria-labelledby="debugBuildTitle">
          <div class="debug-build-heading">
            <strong id="debugBuildTitle">場景 Build 時序</strong>
            <small class="debug-build-count">0 / 0</small>
          </div>
          <small class="debug-build-note">場景測試固定使用目前角色的滿等能力；Blessing 依正式取得位置與限場效果時序套用。</small>
          <div class="debug-build-profiles" aria-label="快速 Build"></div>
          <div class="debug-build-list" role="list"></div>
          <label>
            貼上祝福列表
            <textarea class="debug-build-paste" rows="4" placeholder="孢子調息、樹皮加固、劣質狂藥、趁亂下手"></textarea>
          </label>
          <button class="debug-build-parse" type="button">解析 Blessing 列表</button>
        </section>

        <button class="debug-scenario-start" type="button">開始場景測試</button>
      </section>

      <p class="debug-status" role="status">待命中。</p>
    </div>
  `;

  document.body.append(panel);

  const context = createDebugContext(panel, actions);
  bindDebugPanelEvents(context);
  populateMaterialGroups(context);
  populateScenarioCatalog(context);
  populateCharacterOptions(context);
  syncDebugScenario(context, { applyDefaultProfile: true });
}

function createDebugContext(panel, actions) {
  return {
    panel,
    actions,
    status: panel.querySelector(".debug-status"),
    toggle: panel.querySelector(".debug-toggle"),
    body: panel.querySelector(".debug-body"),
    levelInput: panel.querySelector(".debug-level"),
    expInput: panel.querySelector(".debug-exp"),
    materialGroupSelect: panel.querySelector(".debug-material-group"),
    materialGiveButton: panel.querySelector(".debug-material-give"),
    scenarioSelect: panel.querySelector(".debug-scenario-select"),
    characterSelect: panel.querySelector(".debug-character-select"),
    scenarioNote: panel.querySelector(".debug-scenario-note"),
    routeEntryRow: panel.querySelector(".debug-route-entry-row"),
    routeEntrySelect: panel.querySelector(".debug-route-entry"),
    midChoiceRow: panel.querySelector(".debug-mid-choice-row"),
    midChoiceSelect: panel.querySelector(".debug-mid-choice"),
    hpRow: panel.querySelector(".debug-hp-row"),
    hpInput: panel.querySelector(".debug-scenario-hp"),
    buildSection: panel.querySelector(".debug-build-section"),
    buildProfiles: panel.querySelector(".debug-build-profiles"),
    buildList: panel.querySelector(".debug-build-list"),
    buildCount: panel.querySelector(".debug-build-count"),
    buildPaste: panel.querySelector(".debug-build-paste"),
    buildParseButton: panel.querySelector(".debug-build-parse"),
    scenarioStartButton: panel.querySelector(".debug-scenario-start"),
    catalog: [],
    buildSlots: [],
    buildSelections: {}
  };
}

function bindDebugPanelEvents(context) {
  context.toggle.addEventListener("click", () => {
    const expanded = context.body.hidden;
    context.body.hidden = !expanded;
    context.toggle.setAttribute("aria-expanded", String(expanded));
  });

  context.panel.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      runDebugAction(button.dataset.action, context);
    });
  });

  context.materialGiveButton.addEventListener("click", () => {
    runSafe(context, () => context.actions.giveMaterials(context.materialGroupSelect.value));
  });

  context.scenarioSelect.addEventListener("change", () => {
    syncDebugScenario(context, { applyDefaultProfile: true });
    setStatus(context.status, "已切換場景並套用預設混合 Build。", "ok");
  });

  context.routeEntrySelect.addEventListener("change", () => {
    syncDebugBuildSlots(context, { applyDefaultProfile: true });
    setStatus(context.status, "已依 Route 進入時機重建 Blessing 取得位置。", "ok");
  });

  context.midChoiceSelect.addEventListener("change", () => {
    syncDebugBuildSlots(context, { applyDefaultProfile: true });
    setStatus(context.status, "已依中段選擇重建 Blessing 取得位置。", "ok");
  });

  context.buildParseButton.addEventListener("click", () => parseBlessingBuildInput(context));
  context.scenarioStartButton.addEventListener("click", () => startSelectedScenario(context));
}

function populateMaterialGroups(context) {
  const groups = typeof context.actions.getMaterialGroups === "function"
    ? context.actions.getMaterialGroups()
    : [];
  context.materialGroupSelect.replaceChildren();
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    context.materialGroupSelect.append(option);
  });
  context.materialGiveButton.disabled = groups.length === 0;
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
    camp: () => context.actions.returnToCamp(),
    "delete-save": () => confirmDanger("要刪除目前存檔嗎？這個動作無法復原。") && context.actions.deleteSave()
  };

  runSafe(context, actionMap[action]);
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
      setStatus(context.status, `已套用「${profile.label}」快速 Build。`, "ok");
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
  setStatus(context.status, messages.join(" "), hasWarning ? "warn" : "ok");
}

function startSelectedScenario(context) {
  const scenario = getSelectedScenario(context);
  if (!scenario) {
    setStatus(context.status, "沒有可開始的 Debug 場景。", "error");
    return;
  }

  runSafe(context, () => context.actions.startScenario({
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

function runSafe(context, action) {
  if (typeof action !== "function") {
    setStatus(context.status, "找不到指定 Debug 操作。", "error");
    return;
  }

  try {
    const result = action();
    if (result === false) {
      setStatus(context.status, "操作已取消。", "warn");
      return;
    }
    setStatus(context.status, result || "操作完成。", "ok");
  } catch (error) {
    setStatus(context.status, `操作失敗：${error?.message || "未知錯誤"}`, "error");
  }
}

export function parseDebugBlessingList(text, blessings) {
  const blessingByName = new Map((blessings || []).map((blessing) => [blessing.name, blessing]));
  const names = String(text || "")
    .split(/[、,，\r\n]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  const blessingIds = [];
  const unknownNames = [];

  names.forEach((name) => {
    const blessing = blessingByName.get(name);
    if (blessing) {
      blessingIds.push(blessing.id);
    } else {
      unknownNames.push(name);
    }
  });

  return { blessingIds, unknownNames };
}

function confirmDanger(message) {
  return window.confirm(message);
}

function setStatus(element, message, type) {
  element.textContent = message;
  element.dataset.type = type;
}
