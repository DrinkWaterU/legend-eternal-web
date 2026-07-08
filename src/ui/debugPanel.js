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
      <label>
        等級
        <input class="debug-level" type="number" min="1" max="30" value="1" />
      </label>
      <label>
        EXP
        <input class="debug-exp" type="number" min="0" value="0" />
      </label>
      <div class="debug-grid">
        <button type="button" data-action="set-level">設定等級</button>
        <button type="button" data-action="set-exp">設定 EXP</button>
        <button type="button" data-action="heal">補滿 HP</button>
        <button type="button" data-action="unlock-phoenix">解鎖加護</button>
        <button type="button" data-action="remove-phoenix">移除加護</button>
        <button type="button" data-action="give-materials">給平原素材</button>
        <button type="button" data-action="give-forest-materials">給森林素材</button>
        <button type="button" data-action="clear-inventory">清空資源</button>
        <button type="button" data-action="boss">首領戰</button>
        <button type="button" data-action="forest-boss-random">森林首領</button>
        <button type="button" data-action="forest-boss-wood">古木守衛</button>
        <button type="button" data-action="forest-boss-stag">翠影鹿王</button>
        <button type="button" data-action="forest-campfire">森林事件</button>
        <button type="button" data-action="multi-enemy">多敵人測試</button>
        <button type="button" data-action="goblin-route">哥布林 Route</button>
        <button type="button" data-action="goblin-mid-event">營地補給事件</button>
        <button type="button" data-action="goblin-after-mid">營地第 5 場</button>
        <button type="button" data-action="goblin-boss">血骨薩滿</button>
        <button type="button" data-action="story">劇情殺</button>
        <button type="button" data-action="camp">回營地</button>
        <button type="button" data-action="delete-save">刪存檔</button>
      </div>
      <section class="debug-build-section" aria-labelledby="debugBuildTitle">
        <div class="debug-build-heading">
          <strong id="debugBuildTitle">自訂 Blessing Build</strong>
          <small class="debug-build-count">0 / 0</small>
        </div>
        <label>
          地區
          <select class="debug-build-region"></select>
        </label>
        <div class="debug-build-add-row">
          <label>
            Blessing
            <select class="debug-build-blessing"></select>
          </label>
          <button class="debug-build-add" type="button">加入</button>
        </div>
        <div class="debug-build-list" role="list"></div>
        <button class="debug-build-clear" type="button">清空 Build</button>
        <label>
          貼上祝福列表
          <textarea class="debug-build-paste" rows="4" placeholder="孢子調息、樹皮加固、苔石護步"></textarea>
        </label>
        <button class="debug-build-parse" type="button">解析 Blessing 列表</button>
        <label>
          進場生命（%）
          <input class="debug-build-hp" type="number" min="1" max="100" value="100" />
        </label>
        <div class="debug-build-bosses" aria-label="指定首領"></div>
        <small class="debug-build-note"></small>
      </section>
      <p class="debug-status" role="status">待命中。</p>
    </div>
  `;

  document.body.append(panel);

  const toggle = panel.querySelector(".debug-toggle");
  const body = panel.querySelector(".debug-body");
  const levelInput = panel.querySelector(".debug-level");
  const expInput = panel.querySelector(".debug-exp");
  const status = panel.querySelector(".debug-status");
  const buildContext = createBlessingBuildContext(panel, actions, status);

  toggle.addEventListener("click", () => {
    const expanded = body.hidden;
    body.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
  });

  panel.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      runDebugAction(action, { actions, levelInput, expInput, status });
    });
  });

  bindBlessingBuildEvents(buildContext);
  syncBlessingBuildRegion(buildContext, { clearBuild: true });
}

function runDebugAction(action, context) {
  const { actions, levelInput, expInput, status } = context;
  const actionMap = {
    "set-level": () => actions.setLevel(Number(levelInput.value)),
    "set-exp": () => actions.setExp(Number(expInput.value)),
    heal: () => actions.healHero(),
    "unlock-phoenix": () => actions.unlockPhoenix(),
    "remove-phoenix": () => confirmDanger("要移除鳳凰加護並重置平原劇情旗標嗎？") && actions.removePhoenix(),
    "give-materials": () => actions.givePlainsMaterials(),
    "give-forest-materials": () => actions.giveForestMaterials(),
    "clear-inventory": () => confirmDanger("要清空金幣與素材嗎？") && actions.clearInventory(),
    boss: () => actions.startPlainsBoss(),
    "forest-boss-random": () => actions.startForestBoss(),
    "forest-boss-wood": () => actions.startForestBoss("ancient-wood-warden"),
    "forest-boss-stag": () => actions.startForestBoss("verdant-stag-king"),
    "forest-campfire": () => actions.startForestCampfire(),
    "multi-enemy": () => actions.startMultiEnemyGoblin(),
    "goblin-route": () => actions.startGoblinCampRoute(),
    "goblin-mid-event": () => actions.startGoblinCampMidEvent(),
    "goblin-after-mid": () => actions.startGoblinCampAfterMidEvent(),
    "goblin-boss": () => actions.startGoblinCampBoss(),
    story: () => actions.triggerPlainsStory(),
    camp: () => actions.returnToCamp(),
    "delete-save": () => confirmDanger("要刪除目前存檔嗎？這個動作無法復原。") && actions.deleteSave()
  };

  try {
    const result = actionMap[action]?.();
    if (result === false) {
      setStatus(status, "操作已取消。", "warn");
      return;
    }
    setStatus(status, result || "操作完成。", "ok");
  } catch (error) {
    setStatus(status, `操作失敗：${error?.message || "未知錯誤"}`, "error");
  }
}

function createBlessingBuildContext(panel, actions, status) {
  const catalog = typeof actions.getBlessingBuildCatalog === "function"
    ? actions.getBlessingBuildCatalog()
    : [];
  const regionSelect = panel.querySelector(".debug-build-region");

  catalog.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.id;
    option.textContent = region.name;
    regionSelect.append(option);
  });

  return {
    actions,
    status,
    catalog,
    build: [],
    regionSelect,
    blessingSelect: panel.querySelector(".debug-build-blessing"),
    addButton: panel.querySelector(".debug-build-add"),
    list: panel.querySelector(".debug-build-list"),
    clearButton: panel.querySelector(".debug-build-clear"),
    pasteInput: panel.querySelector(".debug-build-paste"),
    parseButton: panel.querySelector(".debug-build-parse"),
    hpInput: panel.querySelector(".debug-build-hp"),
    bosses: panel.querySelector(".debug-build-bosses"),
    count: panel.querySelector(".debug-build-count"),
    note: panel.querySelector(".debug-build-note")
  };
}

function bindBlessingBuildEvents(context) {
  context.regionSelect.addEventListener("change", () => {
    syncBlessingBuildRegion(context, { clearBuild: true });
    setStatus(context.status, "已切換自訂 Build 地區並清空目前列表。", "ok");
  });

  context.addButton.addEventListener("click", () => {
    const region = getSelectedBuildRegion(context);
    const blessing = region?.blessings.find((item) => item.id === context.blessingSelect.value);
    if (!region || !blessing) {
      setStatus(context.status, "沒有可加入的 Blessing。", "warn");
      return;
    }
    if (context.build.length >= region.standardBlessingSlots) {
      setStatus(context.status, `標準首領測試最多 ${region.standardBlessingSlots} 個 Blessing。`, "warn");
      return;
    }
    context.build.push(blessing.id);
    renderBlessingBuild(context);
    setStatus(context.status, `已加入「${blessing.name}」。`, "ok");
  });

  context.clearButton.addEventListener("click", () => {
    context.build = [];
    renderBlessingBuild(context);
    setStatus(context.status, "已清空自訂 Build。", "ok");
  });

  context.parseButton.addEventListener("click", () => {
    const region = getSelectedBuildRegion(context);
    if (!region) {
      setStatus(context.status, "目前沒有可解析的地區資料。", "error");
      return;
    }
    const result = parseDebugBlessingList(context.pasteInput.value, region.blessings);
    context.build = result.blessingIds.slice(0, region.standardBlessingSlots);
    renderBlessingBuild(context);

    const messages = [`已解析 ${context.build.length} 個 Blessing。`];
    if (result.blessingIds.length > region.standardBlessingSlots) {
      messages.push(`超過標準 ${region.standardBlessingSlots} 格的部分未加入。`);
    }
    if (result.unknownNames.length > 0) {
      messages.push(`無法解析：${result.unknownNames.join("、")}。`);
    }
    setStatus(context.status, messages.join(" "), result.unknownNames.length > 0 ? "warn" : "ok");
  });
}

function syncBlessingBuildRegion(context, options = {}) {
  const { clearBuild = false } = options;
  if (clearBuild) {
    context.build = [];
  }

  const region = getSelectedBuildRegion(context);
  context.blessingSelect.replaceChildren();
  context.bosses.replaceChildren();

  if (!region) {
    context.addButton.disabled = true;
    context.parseButton.disabled = true;
    context.note.textContent = "沒有可用的 Blessing Build 測試地區。";
    renderBlessingBuild(context);
    return;
  }

  region.blessings.forEach((blessing) => {
    const option = document.createElement("option");
    option.value = blessing.id;
    option.textContent = blessing.name;
    context.blessingSelect.append(option);
  });

  region.bosses.forEach((boss) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = boss.name;
    button.addEventListener("click", () => startBlessingBuildBoss(context, region, boss));
    context.bosses.append(button);
  });

  context.addButton.disabled = region.blessings.length === 0;
  context.parseButton.disabled = region.blessings.length === 0;
  context.note.textContent = `標準首領前共有 ${region.standardBlessingSlots} 次 Blessing 取得位置；少於此數時視為前段取得，後續位置留空。`;
  renderBlessingBuild(context);
}

function renderBlessingBuild(context) {
  const region = getSelectedBuildRegion(context);
  const blessingsById = new Map((region?.blessings || []).map((blessing) => [blessing.id, blessing]));
  context.list.replaceChildren();

  if (context.build.length === 0) {
    const empty = document.createElement("p");
    empty.className = "debug-build-empty";
    empty.textContent = "尚未加入 Blessing。";
    context.list.append(empty);
  }

  context.build.forEach((blessingId, index) => {
    const blessing = blessingsById.get(blessingId);
    const item = document.createElement("div");
    item.className = "debug-build-item";
    item.setAttribute("role", "listitem");

    const name = document.createElement("span");
    name.textContent = `${String(index + 1).padStart(2, "0")}. ${blessing?.name || blessingId}`;

    const controls = document.createElement("span");
    controls.className = "debug-build-item-controls";
    controls.append(
      createBuildControlButton("↑", "上移", index === 0, () => moveBuildItem(context, index, -1)),
      createBuildControlButton("↓", "下移", index === context.build.length - 1, () => moveBuildItem(context, index, 1)),
      createBuildControlButton("刪", "刪除", false, () => removeBuildItem(context, index))
    );

    item.append(name, controls);
    context.list.append(item);
  });

  context.count.textContent = `${context.build.length} / ${region?.standardBlessingSlots || 0}`;
}

function createBuildControlButton(text, label, disabled, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function moveBuildItem(context, index, offset) {
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= context.build.length) {
    return;
  }
  [context.build[index], context.build[nextIndex]] = [context.build[nextIndex], context.build[index]];
  renderBlessingBuild(context);
}

function removeBuildItem(context, index) {
  context.build.splice(index, 1);
  renderBlessingBuild(context);
}

function startBlessingBuildBoss(context, region, boss) {
  try {
    const result = context.actions.startBossWithBlessingBuild({
      regionId: region.id,
      bossId: boss.id,
      blessingIds: [...context.build],
      hpPercent: Number(context.hpInput.value)
    });
    setStatus(context.status, result || `已使用自訂 Build 進入「${boss.name}」。`, "ok");
  } catch (error) {
    setStatus(context.status, `操作失敗：${error?.message || "未知錯誤"}`, "error");
  }
}

function getSelectedBuildRegion(context) {
  return context.catalog.find((region) => region.id === context.regionSelect.value) || context.catalog[0] || null;
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
