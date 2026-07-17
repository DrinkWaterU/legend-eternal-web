(() => {
  "use strict";

  const SCHEMA_VERSION = 1;
  const TOOL_VERSION = "v0.1.6";
  const KNOWN_GAME_REGIONS = [
    { id: "plains", name: "平原", path: "../src/data/regions/plains.json" },
    { id: "forest", name: "森林", path: "../src/data/regions/forest.json" }
  ];
  const DEFAULT_GAME_VERSION = "v0.2.6.4.1-alpha";
  const BLESSING_FLOW_REGISTRY_PATH = "../src/data/blessingFlows.json";

  const state = {
    package: createEmptyPackage(),
    dropsDraft: [],
    effectsDraft: [],
    blessingFlowDefinitions: [],
    blessingFlowRegistryReady: false,
    activeTab: "monster"
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", async () => {
    bindElements();
    populateKnownGameRegions();
    bindEvents();
    syncRegionFieldsFromState();
    await loadBlessingFlowRegistry();
    renderAll();
  });

  function createEmptyPackage() {
    return {
      schemaVersion: SCHEMA_VERSION,
      toolVersion: TOOL_VERSION,
      gameVersion: DEFAULT_GAME_VERSION,
      region: {
        id: "plains",
        name: "平原",
        note: ""
      },
      regionMeta: createDefaultRegionMeta(),
      monsters: [],
      blessings: []
    };
  }


  async function loadBlessingFlowRegistry() {
    try {
      const response = await fetch(BLESSING_FLOW_REGISTRY_PATH, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`讀取失敗：HTTP ${response.status}`);
      }
      const registry = await response.json();
      state.blessingFlowDefinitions = normalizeBlessingFlowRegistry(registry);
      state.blessingFlowRegistryReady = true;
      populateBlessingPrimaryFlowOptions();
    } catch (error) {
      state.blessingFlowDefinitions = [];
      state.blessingFlowRegistryReady = false;
      populateBlessingPrimaryFlowOptions();
      showToast(`載入 Blessing Flow registry 失敗：${error.message}`, true);
    }
  }

  function normalizeBlessingFlowRegistry(registry) {
    if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
      throw new Error("Flow registry 根節點必須是物件。");
    }

    const definitions = Object.entries(registry).map(([flowId, definition]) => {
      const id = String(definition?.id || "").trim();
      const label = String(definition?.label || "").trim();
      const satchelEffectId = String(definition?.satchelEffectId || "").trim();
      if (!id || id !== flowId || !label || !satchelEffectId) {
        throw new Error(`Flow「${flowId}」定義不完整或 id 不一致。`);
      }
      return { id, label, satchelEffectId };
    });

    if (definitions.length === 0) {
      throw new Error("Flow registry 不可為空。");
    }
    return definitions;
  }

  function populateBlessingPrimaryFlowOptions() {
    els.blessingPrimaryFlow.innerHTML = "";
    if (!state.blessingFlowRegistryReady) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Flow registry 載入失敗";
      els.blessingPrimaryFlow.appendChild(option);
      els.blessingPrimaryFlow.disabled = true;
      return;
    }

    state.blessingFlowDefinitions.forEach((flow) => {
      const option = document.createElement("option");
      option.value = flow.id;
      option.textContent = `${flow.label} / ${flow.id}`;
      els.blessingPrimaryFlow.appendChild(option);
    });
    els.blessingPrimaryFlow.disabled = false;
  }

  function isRegisteredBlessingFlow(flowId) {
    return state.blessingFlowDefinitions.some((flow) => flow.id === flowId);
  }

  function validateBlessingPrimaryFlows() {
    if (!state.blessingFlowRegistryReady) {
      return fail("Blessing Flow registry 尚未成功載入，無法匯出正式遊戲 JSON。", "blessingPrimaryFlow");
    }
    const invalidBlessing = state.package.blessings.find((blessing) => !isRegisteredBlessingFlow(blessing.primaryFlow));
    if (invalidBlessing) {
      return fail(`Buff「${invalidBlessing.title}」缺少有效的主要流派。`, "blessingPrimaryFlow");
    }
    return { ok: true };
  }



  function createDefaultRegionMeta() {
    return {
      description: "",
      difficulty: "",
      encounterPlan: ["normal", "normal", "normal", "elite", "normal", "normal", "elite", "boss"],
      extraFields: {}
    };
  }

  function bindElements() {
    const ids = [
      "regionId", "regionName", "regionNote", "knownGameRegion", "loadKnownRegionButton", "gameRegionFileInput", "syncRegionButton", "copyPackageButton", "downloadPackageButton", "copyGameRegionButton", "downloadGameRegionButton",
      "monsterTab", "blessingTab", "monsterForm", "blessingForm", "monsterEditIndex", "blessingEditIndex",
      "monsterId", "monsterName", "monsterType", "monsterFamily", "monsterDescription",
      "monsterMaxHp", "monsterAttack", "monsterDefense", "monsterCritRate", "monsterEvasion",
      "monsterPoisonPower", "monsterRegenEvery", "monsterRegenAmount", "monsterChargeEvery", "monsterChargeMultiplier", "monsterDamageReduction",
      "monsterExp", "monsterGoldMin", "monsterGoldMax", "dropItemId", "dropName", "dropChance", "dropMin", "dropMax",
      "addDropButton", "dropList", "copyMonsterDraftButton", "resetMonsterButton",
      "blessingId", "blessingTitle", "blessingRarity", "blessingPrimaryFlow", "blessingEventTitle", "blessingStory", "blessingFlavor", "blessingEffectText",
      "effectType", "effectTarget", "effectValue", "addEffectButton", "effectList", "copyBlessingDraftButton", "resetBlessingButton",
      "monsterList", "blessingList", "monsterCount", "blessingCount", "jsonOutput", "gameJsonOutput", "jsonImport", "copyPreviewButton", "copyGamePreviewButton", "loadPreviewButton", "clearPackageButton", "toast"
    ];

    ids.forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.syncRegionButton.addEventListener("click", syncRegionToState);
    els.loadKnownRegionButton.addEventListener("click", loadKnownGameRegion);
    els.gameRegionFileInput.addEventListener("change", importGameRegionFile);
    els.copyPackageButton.addEventListener("click", () => copyText(toPrettyJson(state.package), "已複製整包 JSON。"));
    els.downloadPackageButton.addEventListener("click", downloadPackageJson);
    els.copyGameRegionButton.addEventListener("click", copyGameRegionJson);
    els.downloadGameRegionButton.addEventListener("click", downloadGameRegionJson);

    els.monsterTab.addEventListener("click", () => setActiveTab("monster"));
    els.blessingTab.addEventListener("click", () => setActiveTab("blessing"));

    els.monsterForm.addEventListener("submit", handleMonsterSubmit);
    els.blessingForm.addEventListener("submit", handleBlessingSubmit);

    els.addDropButton.addEventListener("click", addDropDraft);
    els.addEffectButton.addEventListener("click", addEffectDraft);
    els.copyMonsterDraftButton.addEventListener("click", copyMonsterDraft);
    els.copyBlessingDraftButton.addEventListener("click", copyBlessingDraft);
    els.resetMonsterButton.addEventListener("click", resetMonsterForm);
    els.resetBlessingButton.addEventListener("click", resetBlessingForm);

    els.copyPreviewButton.addEventListener("click", () => copyText(els.jsonOutput.value, "已複製工具預覽 JSON。"));
    els.copyGamePreviewButton.addEventListener("click", copyGameRegionJson);
    els.loadPreviewButton.addEventListener("click", importPackageFromText);
    els.clearPackageButton.addEventListener("click", clearPackage);

    [els.regionId, els.regionName, els.regionNote].forEach((input) => {
      input.addEventListener("change", syncRegionToState);
    });
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    const isMonster = tab === "monster";
    els.monsterForm.classList.toggle("hidden", !isMonster);
    els.blessingForm.classList.toggle("hidden", isMonster);
    els.monsterTab.classList.toggle("active", isMonster);
    els.blessingTab.classList.toggle("active", !isMonster);
    els.monsterTab.setAttribute("aria-selected", String(isMonster));
    els.blessingTab.setAttribute("aria-selected", String(!isMonster));
  }

  function syncRegionFieldsFromState() {
    els.regionId.value = state.package.region.id;
    els.regionName.value = state.package.region.name;
    els.regionNote.value = state.package.region.note || "";
  }

  function syncRegionToState() {
    const id = normalizeId(els.regionId.value);
    const name = els.regionName.value.trim();

    if (!id) {
      showToast("地區 ID 不能空白。", true);
      els.regionId.focus();
      return;
    }

    if (!name) {
      showToast("地區名稱不能空白。", true);
      els.regionName.focus();
      return;
    }

    state.package.region = {
      id,
      name,
      note: els.regionNote.value.trim()
    };
    if (!state.package.regionMeta) {
      state.package.regionMeta = createDefaultRegionMeta();
    }
    els.regionId.value = id;
    renderPreview();
    showToast("已套用地區設定。");
  }

  function handleMonsterSubmit(event) {
    event.preventDefault();

    const result = buildMonsterFromForm();
    if (!result.ok) {
      showToast(result.message, true);
      focusById(result.focusId);
      return;
    }

    const editIndex = parseIndex(els.monsterEditIndex.value);
    if (editIndex === null) {
      state.package.monsters.push(result.data);
      showToast(`已新增怪物：${result.data.name}`);
    } else {
      state.package.monsters[editIndex] = result.data;
      showToast(`已更新怪物：${result.data.name}`);
    }

    resetMonsterForm();
    renderAll();
  }

  function buildMonsterFromForm() {
    const id = normalizeId(els.monsterId.value);
    const name = els.monsterName.value.trim();
    const goldMin = readNumber("monsterGoldMin");
    const goldMax = readNumber("monsterGoldMax");

    if (!id) return fail("怪物 ID 不能空白。", "monsterId");
    if (!name) return fail("怪物名稱不能空白。", "monsterName");
    if (goldMax < goldMin) return fail("金幣最大值不能小於最小值。", "monsterGoldMax");

    const monster = {
      contentType: "monster",
      id,
      name,
      type: els.monsterType.value,
      family: els.monsterFamily.value,
      description: els.monsterDescription.value.trim(),
      stats: {
        maxHp: readNumber("monsterMaxHp"),
        attack: readNumber("monsterAttack"),
        defense: readNumber("monsterDefense"),
        critRate: readNumber("monsterCritRate"),
        evasion: readNumber("monsterEvasion")
      },
      traits: {
        poisonPower: readNumber("monsterPoisonPower"),
        regenEvery: readNumber("monsterRegenEvery"),
        regenAmount: readNumber("monsterRegenAmount"),
        chargeEvery: readNumber("monsterChargeEvery"),
        chargeMultiplier: readNumber("monsterChargeMultiplier"),
        damageReduction: readNumber("monsterDamageReduction")
      },
      rewards: {
        exp: readNumber("monsterExp"),
        gold: {
          min: goldMin,
          max: goldMax
        },
        drops: clone(state.dropsDraft),
        materials: state.dropsDraft.map(toRewardMaterial)
      }
    };

    const statValidation = validateRateFields([
      [monster.stats.critRate, "怪物暴擊率建議介於 0 到 1。", "monsterCritRate"],
      [monster.stats.evasion, "怪物閃避率建議介於 0 到 1。", "monsterEvasion"],
      [monster.traits.damageReduction, "傷害減免建議介於 0 到 1。", "monsterDamageReduction"]
    ]);
    if (!statValidation.ok) return statValidation;

    return { ok: true, data: monster };
  }

  function addDropDraft() {
    const itemId = normalizeId(els.dropItemId.value);
    const name = els.dropName.value.trim();
    const chance = readNumber("dropChance");
    const min = readNumber("dropMin");
    const max = readNumber("dropMax");

    if (!itemId) return showToast("掉落素材 ID 不能空白。", true);
    if (!name) return showToast("掉落素材名稱不能空白。", true);
    if (chance < 0 || chance > 1) return showToast("掉落率需介於 0 到 1。", true);
    if (min <= 0 || max <= 0) return showToast("掉落數量需大於 0。", true);
    if (max < min) return showToast("掉落最大數量不能小於最小數量。", true);

    state.dropsDraft.push({ itemId, name, chance, min, max });
    ["dropItemId", "dropName", "dropChance", "dropMin", "dropMax"].forEach((id) => {
      els[id].value = "";
    });
    renderDropList();
    showToast(`已加入掉落：${name}`);
  }

  function handleBlessingSubmit(event) {
    event.preventDefault();

    const result = buildBlessingFromForm();
    if (!result.ok) {
      showToast(result.message, true);
      focusById(result.focusId);
      return;
    }

    const editIndex = parseIndex(els.blessingEditIndex.value);
    if (editIndex === null) {
      state.package.blessings.push(result.data);
      showToast(`已新增 Buff：${result.data.title}`);
    } else {
      state.package.blessings[editIndex] = result.data;
      showToast(`已更新 Buff：${result.data.title}`);
    }

    resetBlessingForm();
    renderAll();
  }

  function buildBlessingFromForm() {
    const id = normalizeId(els.blessingId.value);
    const title = els.blessingTitle.value.trim();
    const primaryFlow = els.blessingPrimaryFlow.value;

    if (!id) return fail("Buff ID 不能空白。", "blessingId");
    if (!title) return fail("Buff 標題不能空白。", "blessingTitle");
    if (!state.blessingFlowRegistryReady) return fail("Blessing Flow registry 尚未成功載入。", "blessingPrimaryFlow");
    if (!isRegisteredBlessingFlow(primaryFlow)) return fail("請選擇有效的主要流派。", "blessingPrimaryFlow");
    if (state.effectsDraft.length === 0) return fail("至少需要新增一個效果。", "effectValue");

    return {
      ok: true,
      data: {
        contentType: "blessing",
        id,
        title,
        rarity: els.blessingRarity.value,
        primaryFlow,
        eventTitle: els.blessingEventTitle.value.trim(),
        story: els.blessingStory.value.trim(),
        flavor: els.blessingFlavor.value.trim(),
        effectText: els.blessingEffectText.value.trim(),
        effects: clone(state.effectsDraft)
      }
    };
  }

  function addEffectDraft() {
    const type = els.effectType.value;
    const target = els.effectTarget.value;
    const value = readNumber("effectValue");

    if (els.effectValue.value.trim() === "") {
      return showToast("效果數值不能空白。", true);
    }

    const effect = type === "recoverHp"
      ? { type, value }
      : { type, target, value };

    state.effectsDraft.push(effect);
    els.effectValue.value = "";
    renderEffectList();
    showToast("已加入效果。");
  }

  function renderAll() {
    renderDropList();
    renderEffectList();
    renderContentLists();
    renderPreview();
  }

  function renderDropList() {
    els.dropList.innerHTML = "";
    state.dropsDraft.forEach((drop, index) => {
      const li = document.createElement("li");
      li.textContent = `${drop.name} (${drop.itemId}) ${formatPercent(drop.chance)} × ${drop.min}-${drop.max}`;
      li.appendChild(makeSmallDeleteButton(() => {
        state.dropsDraft.splice(index, 1);
        renderDropList();
      }));
      els.dropList.appendChild(li);
    });
  }

  function renderEffectList() {
    els.effectList.innerHTML = "";
    state.effectsDraft.forEach((effect, index) => {
      const li = document.createElement("li");
      li.textContent = formatEffectDraft(effect);
      li.appendChild(makeSmallDeleteButton(() => {
        state.effectsDraft.splice(index, 1);
        renderEffectList();
      }));
      els.effectList.appendChild(li);
    });
  }

  function formatEffectDraft(effect) {
    if (effect.type === "recoverHp") {
      return `${effect.type}: ${effect.value}`;
    }
    if (effect.type === "addTimedRegen") {
      return `${effect.type}: ${effect.durationEncounters} battles / ${effect.everyTurns} turns / ${formatPercent(effect.maxHpRatio)}`;
    }
    return `${effect.type} ${effect.target}: ${effect.value}`;
  }

  function renderContentLists() {
    els.monsterCount.textContent = String(state.package.monsters.length);
    els.blessingCount.textContent = String(state.package.blessings.length);
    renderList(els.monsterList, state.package.monsters, "monster");
    renderList(els.blessingList, state.package.blessings, "blessing");
  }

  function renderList(listEl, items, type) {
    listEl.innerHTML = "";

    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = type === "monster" ? "目前沒有怪物。" : "目前沒有 Buff。";
      empty.className = "empty-item";
      listEl.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement("li");
      const title = type === "monster" ? item.name : item.title;
      const badge = type === "monster" ? item.type : item.rarity;

      li.innerHTML = `
        <div class="content-item-head">
          <div>
            <span class="content-item-title"></span>
            <span class="content-item-id"></span>
          </div>
          <span class="badge"></span>
        </div>
        <div class="item-actions"></div>
      `;

      li.querySelector(".content-item-title").textContent = title;
      li.querySelector(".content-item-id").textContent = item.id;
      li.querySelector(".badge").textContent = badge;

      const actions = li.querySelector(".item-actions");
      actions.appendChild(makeActionButton("複製", () => copyText(toPrettyJson(item), `已複製：${title}`)));
      actions.appendChild(makeActionButton("載入編輯", () => type === "monster" ? loadMonster(index) : loadBlessing(index)));
      actions.appendChild(makeActionButton("刪除", () => deleteItem(type, index), true));

      listEl.appendChild(li);
    });
  }

  function renderPreview() {
    els.jsonOutput.value = toPrettyJson(state.package);
    els.gameJsonOutput.value = toPrettyJson(buildGameRegionJson());
  }

  function loadMonster(index) {
    const monster = state.package.monsters[index];
    if (!monster) return;

    setActiveTab("monster");
    els.monsterEditIndex.value = String(index);
    els.monsterId.value = monster.id || "";
    els.monsterName.value = monster.name || "";
    els.monsterType.value = monster.type || "normal";
    els.monsterFamily.value = monster.family || "other";
    els.monsterDescription.value = monster.description || "";

    const stats = monster.stats || {};
    const traits = monster.traits || {};
    const rewards = monster.rewards || {};
    const gold = Array.isArray(rewards.gold)
      ? { min: rewards.gold[0], max: rewards.gold[1] }
      : rewards.gold || {};

    setValue("monsterMaxHp", stats.maxHp, 1);
    setValue("monsterAttack", stats.attack, 0);
    setValue("monsterDefense", stats.defense, 0);
    setValue("monsterCritRate", stats.critRate, 0);
    setValue("monsterEvasion", stats.evasion, 0);
    setValue("monsterPoisonPower", traits.poisonPower, 0);
    setValue("monsterRegenEvery", traits.regenEvery, 0);
    setValue("monsterRegenAmount", traits.regenAmount, 0);
    setValue("monsterChargeEvery", traits.chargeEvery, 0);
    setValue("monsterChargeMultiplier", traits.chargeMultiplier, 1);
    setValue("monsterDamageReduction", traits.damageReduction, 0);
    setValue("monsterExp", rewards.exp, 0);
    setValue("monsterGoldMin", gold.min, 0);
    setValue("monsterGoldMax", gold.max, 0);

    state.dropsDraft = Array.isArray(rewards.drops)
      ? clone(rewards.drops)
      : Array.isArray(rewards.materials)
        ? rewards.materials.map(normalizeDrop)
        : [];
    renderDropList();
    els.monsterForm.querySelector("button[type='submit']").textContent = "更新目前怪物";
    showToast(`已載入怪物：${monster.name}`);
  }

  function loadBlessing(index) {
    const blessing = state.package.blessings[index];
    if (!blessing) return;

    setActiveTab("blessing");
    els.blessingEditIndex.value = String(index);
    els.blessingId.value = blessing.id || "";
    els.blessingTitle.value = blessing.title || "";
    els.blessingRarity.value = blessing.rarity || "common";
    els.blessingPrimaryFlow.value = blessing.primaryFlow || "";
    els.blessingEventTitle.value = blessing.eventTitle || "";
    els.blessingStory.value = blessing.story || "";
    els.blessingFlavor.value = blessing.flavor || "";
    els.blessingEffectText.value = blessing.effectText || "";
    state.effectsDraft = Array.isArray(blessing.effects) ? clone(blessing.effects) : [];
    renderEffectList();
    els.blessingForm.querySelector("button[type='submit']").textContent = "更新目前 Buff";
    showToast(`已載入 Buff：${blessing.title}`);
  }

  function deleteItem(type, index) {
    const list = type === "monster" ? state.package.monsters : state.package.blessings;
    const item = list[index];
    if (!item) return;

    const label = type === "monster" ? item.name : item.title;
    const confirmed = window.confirm(`確定刪除「${label}」嗎？`);
    if (!confirmed) return;

    list.splice(index, 1);
    renderAll();
    showToast(`已刪除：${label}`);
  }

  function copyMonsterDraft() {
    const result = buildMonsterFromForm();
    if (!result.ok) {
      showToast(result.message, true);
      focusById(result.focusId);
      return;
    }
    copyText(toPrettyJson(result.data), "已複製目前怪物 JSON。");
  }

  function copyBlessingDraft() {
    const result = buildBlessingFromForm();
    if (!result.ok) {
      showToast(result.message, true);
      focusById(result.focusId);
      return;
    }
    copyText(toPrettyJson(result.data), "已複製目前 Buff JSON。");
  }

  function resetMonsterForm() {
    els.monsterForm.reset();
    els.monsterEditIndex.value = "";
    state.dropsDraft = [];
    setValue("monsterMaxHp", 35);
    setValue("monsterAttack", 8);
    setValue("monsterDefense", 1);
    setValue("monsterCritRate", 0.03);
    setValue("monsterEvasion", 0);
    setValue("monsterPoisonPower", 0);
    setValue("monsterRegenEvery", 0);
    setValue("monsterRegenAmount", 0);
    setValue("monsterChargeEvery", 0);
    setValue("monsterChargeMultiplier", 1);
    setValue("monsterDamageReduction", 0);
    setValue("monsterExp", 0);
    setValue("monsterGoldMin", 0);
    setValue("monsterGoldMax", 0);
    els.monsterForm.querySelector("button[type='submit']").textContent = "新增到目前地區";
    renderDropList();
  }

  function resetBlessingForm() {
    els.blessingForm.reset();
    els.blessingEditIndex.value = "";
    state.effectsDraft = [];
    els.blessingForm.querySelector("button[type='submit']").textContent = "新增到目前地區";
    renderEffectList();
  }

  function clearPackage() {
    const confirmed = window.confirm("確定清空目前內容包嗎？這不會影響主遊戲存檔，但會清掉工具頁目前記憶體中的怪物與 Buff。" );
    if (!confirmed) return;

    const currentRegion = clone(state.package.region);
    const currentRegionMeta = clone(state.package.regionMeta || createDefaultRegionMeta());
    state.package = createEmptyPackage();
    state.package.region = currentRegion;
    state.package.regionMeta = currentRegionMeta;
    state.dropsDraft = [];
    state.effectsDraft = [];
    resetMonsterForm();
    resetBlessingForm();
    renderAll();
    showToast("已清空目前內容包。");
  }

  function populateKnownGameRegions() {
    if (!els.knownGameRegion) return;

    els.knownGameRegion.innerHTML = "";
    KNOWN_GAME_REGIONS.forEach((region) => {
      const option = document.createElement("option");
      option.value = region.id;
      option.textContent = `${region.name} / ${region.id}`;
      els.knownGameRegion.appendChild(option);
    });
  }

  async function loadKnownGameRegion() {
    const regionId = els.knownGameRegion.value;
    const region = KNOWN_GAME_REGIONS.find((item) => item.id === regionId);
    if (!region) {
      showToast("找不到已知地區設定。", true);
      return;
    }

    try {
      const response = await fetch(region.path, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`讀取失敗：HTTP ${response.status}`);
      }
      const data = await response.json();
      replacePackageWithGameRegion(data, `已載入遊戲地區：${region.name}`);
    } catch (error) {
      showToast(`載入遊戲地區失敗：${error.message}`, true);
    }
  }

  function importGameRegionFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const data = JSON.parse(String(reader.result || ""));
        replacePackageWithGameRegion(data, `已匯入地區檔案：${file.name}`);
      } catch (error) {
        showToast(`地區檔案匯入失敗：${error.message}`, true);
      } finally {
        els.gameRegionFileInput.value = "";
      }
    });
    reader.addEventListener("error", () => {
      showToast("讀取地區檔案失敗。", true);
      els.gameRegionFileInput.value = "";
    });
    reader.readAsText(file);
  }

  function replacePackageWithGameRegion(regionData, successMessage) {
    const normalized = normalizeGameRegionData(regionData);
    const hasCurrentItems = state.package.monsters.length > 0 || state.package.blessings.length > 0;
    if (hasCurrentItems) {
      const confirmed = window.confirm("匯入遊戲地區資料會覆蓋工具目前內容包。要繼續嗎？");
      if (!confirmed) return;
    }

    state.package = normalized;
    state.dropsDraft = [];
    state.effectsDraft = [];
    resetMonsterForm();
    resetBlessingForm();
    syncRegionFieldsFromState();
    renderAll();
    showToast(successMessage);
  }

  function normalizeGameRegionData(regionData) {
    if (!regionData || typeof regionData !== "object") {
      throw new Error("地區資料根節點必須是物件。");
    }

    const regionId = normalizeId(regionData.id || "region");
    const regionName = String(regionData.name || "未命名地區").trim();
    if (!regionId) throw new Error("地區 id 不能空白。");
    if (!regionName) throw new Error("地區 name 不能空白。");

    const monsters = [
      ...toArray(regionData.enemies).map((monster) => normalizeGameMonster(monster, "normal")),
      ...toArray(regionData.elites).map((monster) => normalizeGameMonster(monster, "elite")),
      ...toArray(regionData.bosses || (regionData.boss ? [regionData.boss] : [])).map((monster) => normalizeGameMonster(monster, "boss"))
    ];

    return {
      schemaVersion: SCHEMA_VERSION,
      toolVersion: TOOL_VERSION,
      gameVersion: DEFAULT_GAME_VERSION,
      sourceFormat: "game-region-json",
      region: {
        id: regionId,
        name: regionName,
        note: buildRegionNote(regionData)
      },
      regionMeta: extractRegionMeta(regionData),
      monsters,
      blessings: toArray(regionData.blessings).map(normalizeGameBlessing)
    };
  }



  function extractRegionMeta(regionData) {
    const extraFields = {};
    Object.entries(regionData || {}).forEach(([key, value]) => {
      if (["id", "name", "description", "difficulty", "encounterPlan", "enemies", "elites", "boss", "bosses", "blessings"].includes(key)) {
        return;
      }
      extraFields[key] = clone(value);
    });

    return {
      description: String(regionData.description || ""),
      difficulty: String(regionData.difficulty || ""),
      encounterPlan: Array.isArray(regionData.encounterPlan) ? clone(regionData.encounterPlan) : createDefaultRegionMeta().encounterPlan,
      extraFields
    };
  }

  function normalizeGameMonster(monster, fallbackType) {
    const type = monster.type || kindToType(monster.kind) || fallbackType || "normal";
    const critRate = monster.critRate ?? monster.critChance ?? 0;
    const evasion = monster.evasion ?? monster.dodgeChance ?? 0;

    return normalizeMonster({
      contentType: "monster",
      id: monster.id,
      name: monster.name,
      type,
      family: monster.family || "other",
      description: monster.description || monster.intro || "",
      meta: {
        kind: monster.kind || typeToKind(type),
        intro: monster.intro || monster.description || "",
        extraFields: collectExtraMonsterFields(monster)
      },
      stats: {
        maxHp: monster.maxHp,
        attack: monster.attack,
        defense: monster.defense,
        critRate,
        evasion
      },
      traits: {
        poisonPower: monster.poisonPower,
        regenEvery: monster.regenEvery,
        regenAmount: monster.regenAmount,
        chargeEvery: monster.chargeEvery,
        chargeMultiplier: monster.chargeMultiplier || 1.6,
        damageReduction: monster.damageReduction
      },
      rewards: monster.rewards || {
        exp: monster.expReward || monster.exp || 0,
        gold: monster.goldReward || { min: 0, max: 0 },
        drops: monster.drops || []
      }
    });
  }



  function collectExtraMonsterFields(monster) {
    const extraFields = {};
    Object.entries(monster || {}).forEach(([key, value]) => {
      if (["id", "name", "kind", "family", "description", "intro", "maxHp", "attack", "defense", "critRate", "critChance", "evasion", "dodgeChance", "poisonPower", "regenEvery", "regenAmount", "chargeEvery", "chargeMultiplier", "damageReduction", "rewards", "expReward", "exp", "goldReward", "drops", "type"].includes(key)) {
        return;
      }
      extraFields[key] = clone(value);
    });
    return extraFields;
  }

  function typeToKind(type) {
    const map = { normal: "普通", elite: "精英", boss: "首領" };
    return map[type] || "普通";
  }

  function normalizeGameBlessing(blessing) {
    return normalizeBlessing({
      contentType: "blessing",
      id: blessing.id,
      title: blessing.title || blessing.name,
      rarity: blessing.rarity || "common",
      primaryFlow: blessing.primaryFlow || "",
      eventTitle: blessing.eventTitle,
      story: blessing.story || blessing.eventText || blessing.description,
      flavor: blessing.flavor || blessing.flavorText,
      effectText: blessing.effectText,
      meta: {
        category: blessing.category || "misc",
        name: blessing.name || blessing.title || "",
        extraFields: collectExtraBlessingFields(blessing)
      },
      effects: toArray(blessing.effects).map(normalizeGameEffect)
    });
  }

  function normalizeGameEffect(effect) {
    if (effect.type === "recoverHp") {
      return { type: "recoverHp", value: numberOr(effect.value ?? effect.amount, 0) };
    }

    if (effect.type === "addTimedRegen") {
      return {
        type: "addTimedRegen",
        durationEncounters: numberOr(effect.durationEncounters, 0),
        everyTurns: numberOr(effect.everyTurns, 0),
        maxHpRatio: numberOr(effect.maxHpRatio, 0)
      };
    }

    if (effect.type === "addFamilyDamageBonus") {
      return {
        type: "addFamilyDamageBonus",
        target: effect.family || effect.target || "slime",
        value: numberOr(effect.value ?? effect.amount, 0)
      };
    }

    return {
      type: effect.type || "add",
      target: effect.target || effect.stat || "attack",
      value: numberOr(effect.value ?? effect.amount, 0)
    };
  }



  function collectExtraBlessingFields(blessing) {
    const extraFields = {};
    Object.entries(blessing || {}).forEach(([key, value]) => {
      if (["id", "category", "name", "title", "rarity", "primaryFlow", "eventTitle", "story", "eventText", "description", "flavor", "flavorText", "effectText", "effects"].includes(key)) {
        return;
      }
      extraFields[key] = clone(value);
    });
    return extraFields;
  }

  function kindToType(kind) {
    const map = {
      "普通": "normal",
      "精英": "elite",
      "首領": "boss",
      "Boss": "boss"
    };
    return map[kind] || null;
  }

  function buildRegionNote(regionData) {
    const parts = [];
    if (regionData.description) parts.push(String(regionData.description));
    if (regionData.difficulty) parts.push(`難度：${regionData.difficulty}`);
    return parts.join("\n");
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function importPackageFromText() {
    const text = els.jsonImport.value.trim();
    if (!text) {
      showToast("請先貼上要匯入的整包 JSON。", true);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const normalized = normalizeImportedPackage(parsed);
      state.package = normalized;
      state.dropsDraft = [];
      state.effectsDraft = [];
      resetMonsterForm();
      resetBlessingForm();
      syncRegionFieldsFromState();
      renderAll();
      showToast("已匯入內容包。");
    } catch (error) {
      showToast(`匯入失敗：${error.message}`, true);
    }
  }

  function normalizeImportedPackage(data) {
    if (!data || typeof data !== "object") {
      throw new Error("JSON 根節點必須是物件。");
    }

    if (Number(data.schemaVersion || 1) > SCHEMA_VERSION) {
      throw new Error(`此工具最高支援 schemaVersion ${SCHEMA_VERSION}。`);
    }

    const region = data.region || {};
    const regionId = normalizeId(region.id || data.regionId || "plains");
    const regionName = String(region.name || data.regionName || "平原").trim();

    if (!regionId) throw new Error("region.id 不能空白。");
    if (!regionName) throw new Error("region.name 不能空白。");

    return {
      schemaVersion: SCHEMA_VERSION,
      toolVersion: TOOL_VERSION,
      gameVersion: String(data.gameVersion || DEFAULT_GAME_VERSION),
      region: {
        id: regionId,
        name: regionName,
        note: String(region.note || "")
      },
      regionMeta: normalizeRegionMeta(data.regionMeta),
      monsters: Array.isArray(data.monsters) ? data.monsters.map(normalizeMonster) : [],
      blessings: Array.isArray(data.blessings) ? data.blessings.map(normalizeBlessing) : []
    };
  }



  function normalizeRegionMeta(regionMeta) {
    const defaults = createDefaultRegionMeta();
    const meta = regionMeta && typeof regionMeta === "object" ? regionMeta : {};
    return {
      description: String(meta.description || defaults.description),
      difficulty: String(meta.difficulty || defaults.difficulty),
      encounterPlan: Array.isArray(meta.encounterPlan) && meta.encounterPlan.length > 0 ? clone(meta.encounterPlan) : clone(defaults.encounterPlan),
      extraFields: meta.extraFields && typeof meta.extraFields === "object" ? clone(meta.extraFields) : {}
    };
  }

  function normalizeMonster(monster) {
    const stats = monster.stats || monster;
    const traits = monster.traits || monster;
    const rewards = monster.rewards || {};
    const gold = rewards.gold || {};

    return {
      contentType: "monster",
      id: normalizeId(monster.id || "monster"),
      name: String(monster.name || "未命名怪物"),
      type: monster.type || "normal",
      family: monster.family || "other",
      description: String(monster.description || ""),
      meta: normalizeMonsterMeta(monster.meta),
      stats: {
        maxHp: numberOr(stats.maxHp, 1),
        attack: numberOr(stats.attack, 0),
        defense: numberOr(stats.defense, 0),
        critRate: numberOr(stats.critRate, 0),
        evasion: numberOr(stats.evasion, 0)
      },
      traits: {
        poisonPower: numberOr(traits.poisonPower, 0),
        regenEvery: numberOr(traits.regenEvery, 0),
        regenAmount: numberOr(traits.regenAmount, 0),
        chargeEvery: numberOr(traits.chargeEvery, 0),
        chargeMultiplier: numberOr(traits.chargeMultiplier, 1),
        damageReduction: numberOr(traits.damageReduction, 0)
      },
      rewards: {
        exp: numberOr(rewards.exp, 0),
        gold: {
          min: numberOr(gold.min, 0),
          max: numberOr(gold.max, 0)
        },
        drops: Array.isArray(rewards.drops)
          ? rewards.drops.map(normalizeDrop)
          : Array.isArray(rewards.materials)
            ? rewards.materials.map(normalizeDrop)
            : [],
        materials: Array.isArray(rewards.materials)
          ? rewards.materials.map(toRewardMaterial)
          : Array.isArray(rewards.drops)
            ? rewards.drops.map(toRewardMaterial)
            : []
      }
    };
  }



  function normalizeMonsterMeta(meta) {
    const metaObj = meta && typeof meta === "object" ? meta : {};
    return {
      kind: String(metaObj.kind || ""),
      intro: String(metaObj.intro || ""),
      extraFields: metaObj.extraFields && typeof metaObj.extraFields === "object" ? clone(metaObj.extraFields) : {}
    };
  }

  function normalizeDrop(drop) {
    return {
      itemId: normalizeId(drop.itemId || drop.id || "item"),
      name: String(drop.name || "未命名素材"),
      chance: numberOr(drop.chance, 0),
      min: numberOr(drop.min, 1),
      max: numberOr(drop.max, 1)
    };
  }

  function toRewardMaterial(drop) {
    const normalizedDrop = normalizeDrop(drop);
    return {
      id: normalizedDrop.itemId,
      name: normalizedDrop.name,
      chance: normalizedDrop.chance,
      min: normalizedDrop.min,
      max: normalizedDrop.max
    };
  }

  function normalizeBlessing(blessing) {
    return {
      contentType: "blessing",
      id: normalizeId(blessing.id || "blessing"),
      title: String(blessing.title || blessing.name || "未命名 Buff"),
      rarity: blessing.rarity || "common",
      primaryFlow: String(blessing.primaryFlow || ""),
      eventTitle: String(blessing.eventTitle || ""),
      story: String(blessing.story || blessing.description || ""),
      flavor: String(blessing.flavor || ""),
      effectText: String(blessing.effectText || ""),
      meta: normalizeBlessingMeta(blessing.meta),
      effects: Array.isArray(blessing.effects) ? blessing.effects.map(normalizeEffect) : []
    };
  }

  function normalizeEffect(effect) {
    if (effect.type === "recoverHp") {
      return { type: "recoverHp", value: numberOr(effect.value ?? effect.amount, 0) };
    }

    if (effect.type === "addTimedRegen") {
      return {
        type: "addTimedRegen",
        durationEncounters: numberOr(effect.durationEncounters, 0),
        everyTurns: numberOr(effect.everyTurns, 0),
        maxHpRatio: numberOr(effect.maxHpRatio, 0)
      };
    }

    if (effect.type === "addFamilyDamageBonus") {
      return {
        type: "addFamilyDamageBonus",
        target: effect.family || effect.target || "slime",
        value: numberOr(effect.value ?? effect.amount, 0)
      };
    }

    return {
      type: effect.type || "add",
      target: effect.target || effect.stat || "attack",
      value: numberOr(effect.value ?? effect.amount, 0)
    };
  }



  function normalizeBlessingMeta(meta) {
    const metaObj = meta && typeof meta === "object" ? meta : {};
    return {
      category: String(metaObj.category || "misc"),
      name: String(metaObj.name || ""),
      extraFields: metaObj.extraFields && typeof metaObj.extraFields === "object" ? clone(metaObj.extraFields) : {}
    };
  }

  function buildGameRegionJson() {
    const meta = normalizeRegionMeta(state.package.regionMeta);
    const gameRegion = {
      id: state.package.region.id || "plains",
      name: state.package.region.name || "平原",
      description: meta.description || state.package.region.note || "",
      difficulty: meta.difficulty || "",
      encounterPlan: clone(meta.encounterPlan),
      enemies: state.package.monsters.filter((item) => item.type === "normal").map((item) => convertMonsterToGameFormat(item, "normal")),
      elites: state.package.monsters.filter((item) => item.type === "elite").map((item) => convertMonsterToGameFormat(item, "elite")),
      blessings: state.package.blessings.map(convertBlessingToGameFormat)
    };

    const bossMonsters = state.package.monsters.filter((item) => item.type === "boss");
    if (bossMonsters.length > 1) {
      gameRegion.bosses = bossMonsters.map((item) => convertMonsterToGameFormat(item, "boss"));
    } else if (bossMonsters.length === 1) {
      gameRegion.boss = convertMonsterToGameFormat(bossMonsters[0], "boss");
    }

    Object.assign(gameRegion, clone(meta.extraFields || {}));
    return gameRegion;
  }

  function convertMonsterToGameFormat(monster, fallbackType) {
    const meta = normalizeMonsterMeta(monster.meta);
    const gameMonster = {
      id: normalizeId(monster.id || "monster"),
      name: String(monster.name || "未命名怪物"),
      kind: meta.kind || typeToKind(monster.type || fallbackType),
      family: monster.family || "other",
      maxHp: numberOr(monster.stats && monster.stats.maxHp, 1),
      attack: numberOr(monster.stats && monster.stats.attack, 0),
      defense: numberOr(monster.stats && monster.stats.defense, 0),
      critChance: numberOr(monster.stats && monster.stats.critRate, 0),
      intro: meta.intro || monster.description || ""
    };

    const evasion = numberOr(monster.stats && monster.stats.evasion, 0);
    if (evasion > 0) gameMonster.dodgeChance = evasion;

    const poisonPower = numberOr(monster.traits && monster.traits.poisonPower, 0);
    if (poisonPower > 0) gameMonster.poisonPower = poisonPower;

    const regenEvery = numberOr(monster.traits && monster.traits.regenEvery, 0);
    if (regenEvery > 0) gameMonster.regenEvery = regenEvery;

    const regenAmount = numberOr(monster.traits && monster.traits.regenAmount, 0);
    if (regenAmount > 0) gameMonster.regenAmount = regenAmount;

    const chargeEvery = numberOr(monster.traits && monster.traits.chargeEvery, 0);
    if (chargeEvery > 0) gameMonster.chargeEvery = chargeEvery;

    const chargeMultiplier = numberOr(monster.traits && monster.traits.chargeMultiplier, 1);
    if (chargeEvery > 0 && chargeMultiplier !== 1) gameMonster.chargeMultiplier = chargeMultiplier;

    const damageReduction = numberOr(monster.traits && monster.traits.damageReduction, 0);
    if (damageReduction > 0) gameMonster.damageReduction = damageReduction;

    const rewards = monster.rewards || {};
    const exp = numberOr(rewards.exp, 0);
    if (exp > 0) gameMonster.expReward = exp;

    const gold = rewards.gold || {};
    const rewardMaterials = Array.isArray(rewards.materials)
      ? rewards.materials.map(toRewardMaterial)
      : Array.isArray(rewards.drops)
        ? rewards.drops.map(toRewardMaterial)
        : [];
    if (numberOr(gold.min, 0) > 0 || numberOr(gold.max, 0) > 0 || rewardMaterials.length > 0) {
      gameMonster.rewards = {
        gold: {
          min: numberOr(gold.min, 0),
          max: numberOr(gold.max, 0)
        },
        materials: rewardMaterials
      };
    }

    Object.assign(gameMonster, clone(meta.extraFields || {}));
    return gameMonster;
  }

  function convertBlessingToGameFormat(blessing) {
    const meta = normalizeBlessingMeta(blessing.meta);
    const gameBlessing = {
      id: normalizeId(blessing.id || "blessing"),
      category: meta.category || "misc",
      rarity: blessing.rarity || "common",
      primaryFlow: String(blessing.primaryFlow || ""),
      name: meta.name || blessing.title || "未命名 Buff",
      eventTitle: String(blessing.eventTitle || ""),
      eventText: String(blessing.story || ""),
      flavorText: String(blessing.flavor || ""),
      effectText: String(blessing.effectText || ""),
      effects: Array.isArray(blessing.effects) ? blessing.effects.map(convertEffectToGameFormat) : []
    };

    Object.assign(gameBlessing, clone(meta.extraFields || {}));
    return gameBlessing;
  }

  function convertEffectToGameFormat(effect) {
    if (effect.type === "recoverHp") {
      return { type: "recoverHp", amount: numberOr(effect.value, 0) };
    }
    if (effect.type === "addTimedRegen") {
      return {
        type: "addTimedRegen",
        durationEncounters: numberOr(effect.durationEncounters, 0),
        everyTurns: numberOr(effect.everyTurns, 0),
        maxHpRatio: numberOr(effect.maxHpRatio, 0)
      };
    }
    if (effect.type === "set" || effect.type === "max") {
      return {
        type: effect.type,
        stat: effect.target || "attack",
        value: numberOr(effect.value, 0)
      };
    }
    if (effect.type === "addFamilyDamageBonus") {
      return {
        type: "addFamilyDamageBonus",
        family: effect.target || "slime",
        amount: numberOr(effect.value, 0)
      };
    }
    return {
      type: effect.type || "add",
      stat: effect.target || "attack",
      amount: numberOr(effect.value, 0)
    };
  }

  function copyGameRegionJson() {
    const validation = validateBlessingPrimaryFlows();
    if (!validation.ok) {
      showToast(validation.message, true);
      focusById(validation.focusId);
      return;
    }
    copyText(toPrettyJson(buildGameRegionJson()), "已複製遊戲地區 JSON。");
  }

  function downloadGameRegionJson() {
    const validation = validateBlessingPrimaryFlows();
    if (!validation.ok) {
      showToast(validation.message, true);
      focusById(validation.focusId);
      return;
    }
    const regionId = state.package.region.id || "region";
    const filename = `${regionId}.json`;
    const blob = new Blob([toPrettyJson(buildGameRegionJson())], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`已下載可覆蓋用地區檔：${filename}`);
  }

  function downloadPackageJson() {
    const regionId = state.package.region.id || "region";
    const filename = `legend-eternal-${regionId}-content.json`;
    const blob = new Blob([toPrettyJson(state.package)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`已下載 ${filename}`);
  }

  async function copyText(text, successMessage) {
    if (!text) {
      showToast("沒有可複製的內容。", true);
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      showToast(successMessage);
    } catch (error) {
      fallbackCopy(text);
      showToast(successMessage);
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function makeSmallDeleteButton(onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "×";
    button.setAttribute("aria-label", "移除");
    button.addEventListener("click", onClick);
    return button;
  }

  function makeActionButton(label, onClick, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (danger) button.classList.add("danger-button");
    button.addEventListener("click", onClick);
    return button;
  }

  function validateRateFields(fields) {
    for (const [value, message, focusId] of fields) {
      if (value < 0 || value > 1) {
        return fail(message, focusId);
      }
    }
    return { ok: true };
  }

  function fail(message, focusId) {
    return { ok: false, message, focusId };
  }

  function readNumber(id) {
    const raw = els[id].value;
    return numberOr(raw, 0);
  }

  function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseIndex(value) {
    if (value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  function setValue(id, value, fallback = 0) {
    els[id].value = String(value ?? fallback);
  }

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_\-]/g, "");
  }

  function formatPercent(value) {
    return `${Math.round(numberOr(value, 0) * 100)}%`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toPrettyJson(value) {
    return JSON.stringify(value, null, 2);
  }

  function focusById(id) {
    if (id && els[id]) els[id].focus();
  }

  let toastTimer = null;
  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.style.borderColor = isError ? "rgba(217, 112, 112, 0.72)" : "rgba(241, 197, 106, 0.52)";
    els.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, 2600);
  }
})();
