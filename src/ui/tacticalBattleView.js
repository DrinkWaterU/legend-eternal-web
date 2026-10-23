import { HIGHLAND_COLUMNS, highlandActions, highlandIntents, windFor, windLabel, canReachHighlandTarget, projectHighlandWind } from "../core/highlandBattle.js";
import { getWeaponActions, getWeaponStatus } from "../core/weaponTechniques.js";
import { getPendingHighlandPaths } from "../data/highlandPaths.js";

export function renderTacticalBattle({ state, els, canFight, choosePath }) {
  const panel = els.highlandBattlePanel, controls = els.tacticalActions;
  const text = getWeaponStatus(state.hero);
  if (els.weaponTechniqueStatus) {
    els.weaponTechniqueStatus.textContent = text;
    els.weaponTechniqueStatus.hidden = !text || !canFight;
  }
  if (controls) {
    const wasOpen = controls.querySelector("details")?.open || false;
    controls.replaceChildren();
    const moves = canFight ? [...highlandActions(state), ...getWeaponActions(state.hero)] : [];
    const details = controls.ownerDocument.createElement("details");
    details.open = wasOpen;
    const summary = controls.ownerDocument.createElement("summary");
    summary.textContent = "戰術行動｜選落點與方式"; details.append(summary);
    const tabs = controls.ownerDocument.createElement("div"); tabs.className = "tactical-destinations"; details.append(tabs);
    const grid = controls.ownerDocument.createElement("div"); grid.className = "tactical-action-grid"; details.append(grid);
    const terrainTypes = ["move", "break", "ride", "slip", "demolish", "tool-step", "tool-rock", "tool-brace"];
    const columns = [...new Set(moves.filter(a => terrainTypes.includes(a.type) && a.column !== undefined).map(a => a.column))].sort();
    let selected = Number(controls.dataset.selectedColumn);
    if (!columns.includes(selected)) selected = columns[0];
    const selectColumn = column => {
      controls.dataset.selectedColumn = String(column);
      for (const tab of tabs.children) tab.setAttribute("aria-pressed", String(Number(tab.dataset.tacticColumn) === column));
      for (const button of grid.children) button.hidden = button.dataset.column !== undefined && Number(button.dataset.column) !== column;
    };
    for (const column of columns) {
      const tab = controls.ownerDocument.createElement("button"); tab.type = "button"; tab.className = "secondary-button";
      tab.textContent = HIGHLAND_COLUMNS[column]; tab.dataset.tacticColumn = String(column);
      tab.addEventListener("click", () => selectColumn(column)); tabs.append(tab);
    }
    if (moves.some(a => ["move", "break", "ride", "slip", "demolish", "tool-step", "tool-rock", "tool-brace"].includes(a.type))) controls.append(details);
    for (const move of moves) {
      const button = controls.ownerDocument.createElement("button");
      button.type = "button"; button.className = "secondary-button";
      button.textContent = move.label; button.dataset.actionType = move.type;
      const labels = {
        move: ["移位", "1回合・抵風1"], ride: ["借風", `1回合・不抵風・機會+${state.hero.highlandRideAttack}`],
        slip: ["轉瞬", "免費・本場1次"], break: ["拆岩", "1回合・毀共用岩"], demolish: ["破岩突入", "1回合・拆岩並移位・本場1次"],
        "tool-step": ["踏釘", `免費・整備剩${state.runPreparation?.remainingCharges}次`],
        "tool-rock": ["加固", `1回合・整備剩${state.runPreparation?.remainingCharges}次`],
        "tool-brace": ["繩索固定", `1回合・兩回合不受風推・剩${state.runPreparation?.remainingCharges}次`]
      };
      if (labels[move.type]) {
        button.textContent = labels[move.type][0];
        const cost = controls.ownerDocument.createElement("small"); cost.textContent = labels[move.type][1]; button.append(cost);
      }
      if (state.highlandBattle) {
        const landing = projectHighlandWind(state, move).find(p => p.unit === state.hero);
        const hint = controls.ownerDocument.createElement("small");
        hint.textContent = `${["slip", "tool-step"].includes(move.type) ? "立即" : "風後"}：${HIGHLAND_COLUMNS[landing.destination]}${landing.stagger ? "・撞邊失衡" : ""}`;
        button.append(hint);
      }
      if (move.column !== undefined) button.dataset.column = String(move.column);
      if (["sweep", "cleave", "breach"].includes(move.type)) {
        const target = state.enemies.find(e => e.runtimeId === state.targetEnemyId);
        button.disabled = !canReachHighlandTarget(state, target) || (move.type === "breach" && (!!target?.weaponBreach || state.turn + 1 <= (target?.breachCooldownUntil ?? -1)));
        if (button.disabled && move.type === "breach") button.textContent = "破勢暫不可用・請換目標或等待";
      }
      if (terrainTypes.includes(move.type)) grid.append(button); else controls.append(button);
    }
    selectColumn(selected);
    controls.hidden = !moves.length;
  }
  if (!panel) return;
  panel.dataset.pathChoice = String(state.phase === "highlandChoice");
  panel.replaceChildren();
  const paths = state.phase === "highlandChoice" ? getPendingHighlandPaths({ ...state, battleSource: "main" }) : [];
  panel.hidden = !paths.length && (!state.highlandBattle || !canFight);
  if (panel.hidden) return;
  const doc = panel.ownerDocument;
  if (paths.length) {
    const heading = doc.createElement("h3"); heading.textContent = "山路分岔｜選擇接下來四場的路線"; panel.append(heading);
    for (const path of paths) {
      const button = doc.createElement("button"); button.type = "button"; button.className = "secondary-button highland-path-choice";
      const title = doc.createElement("strong"); title.textContent = path.name;
      const description = doc.createElement("span"); description.textContent = path.description;
      button.append(title, description); button.addEventListener("click", () => choosePath?.(path.id)); panel.append(button);
    }
    return;
  }
  const wind = doc.createElement("p"); wind.className = "highland-wind";
  wind.textContent = `本回合風向 ${windLabel(windFor(state))}　｜接下來 ${windLabel(windFor(state, 1))} / ${windLabel(windFor(state, 2))}`;
  panel.append(wind);
  const board = doc.createElement("div"); board.className = "highland-board";
  for (let col = 0; col < 3; col++) {
    const lane = doc.createElement("div"); lane.className = "highland-lane";
    lane.classList.toggle("has-hero", state.hero.battleColumn === col);
    const name = doc.createElement("strong"); name.textContent = HIGHLAND_COLUMNS[col];
    const rock = doc.createElement("small"); rock.textContent = col === 1 ? "無遮蔽" : state.highlandBattle.rocks[col] ? `擋${col === 0 ? "→" : "←"}風・耐久${state.highlandBattle.rocks[col]}` : "岩壁已碎";
    lane.append(name, rock);
    for (const unit of [state.hero, ...state.enemies].filter(e => e.hp > 0 && e.battleColumn === col)) {
      const tag = doc.createElement("span"); tag.textContent = `${unit === state.hero ? "◆ " : ""}${unit.name}${unit.windStagger ? "・失衡" : ""}`; lane.append(tag);
    }
    board.append(lane);
  }
  panel.append(board);
  const forecast = doc.createElement("p"); forecast.className = "highland-forecast";
  const projected = projectHighlandWind(state);
  const mine = projected[0];
  const opportunity = Object.values(state.hero.highlandOpportunities || {}).reduce((sum, n) => sum + n, 0);
  forecast.textContent = `直接攻擊後，你會在${HIGHLAND_COLUMNS[mine.destination]}${mine.stagger ? "（撞邊失衡）" : ""}。${opportunity ? `借勢已存${opportunity}。` : ""}${state.hero.highlandShelterPierceReady ? "穿隘就緒。" : ""}`;
  panel.append(forecast);
  const rules = doc.createElement("details"); rules.className = "highland-rules";
  const rulesTitle = doc.createElement("summary"); rulesTitle.textContent = "風與地形說明";
  const rulesText = doc.createElement("p"); rulesText.textContent = "玩家 → 風 → 敵意。移位抵風1、無減傷；守勢抵風1並減傷。岩石只擋風，敵我共用；最後1耐久仍保護整欄。預覽只到風後，敵意接著執行，擊殺會改變結果。";
  rules.append(rulesTitle, rulesText);
  panel.append(rules);
  const intentMap = new Map(highlandIntents(state).map(i => [i.id, i.text]));
  for (const card of els.enemyRoster?.querySelectorAll?.("[data-runtime-id]") || []) {
    const intent = card.querySelector("[data-enemy-intent]");
    if (intent) { intent.textContent = intentMap.get(card.dataset.runtimeId) || ""; intent.hidden = !intent.textContent; }
  }
}
