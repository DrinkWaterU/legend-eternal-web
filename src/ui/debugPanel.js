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
        <button type="button" data-action="clear-inventory">清空資源</button>
        <button type="button" data-action="boss">首領戰</button>
        <button type="button" data-action="story">劇情殺</button>
        <button type="button" data-action="camp">回營地</button>
        <button type="button" data-action="delete-save">刪存檔</button>
      </div>
      <p class="debug-status" role="status">待命中。</p>
    </div>
  `;

  document.body.append(panel);

  const toggle = panel.querySelector(".debug-toggle");
  const body = panel.querySelector(".debug-body");
  const levelInput = panel.querySelector(".debug-level");
  const expInput = panel.querySelector(".debug-exp");
  const status = panel.querySelector(".debug-status");

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
    "clear-inventory": () => confirmDanger("要清空金幣與素材嗎？") && actions.clearInventory(),
    boss: () => actions.startPlainsBoss(),
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

function confirmDanger(message) {
  return window.confirm(message);
}

function setStatus(element, message, type) {
  element.textContent = message;
  element.dataset.type = type;
}
