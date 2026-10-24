import { previewHighlandTurn } from "../core/highlandPreview.js";
import { isGroundAttack } from "../core/highlandTelegraphs.js";
import { renderHighlandBoard, updateHighlandPreview, highlandConsequenceText } from "./highlandBoardView.js";
import { HIGHLAND_COLUMNS, highlandActions, highlandIntents, canReachHighlandTarget, projectHighlandWind, windFor, windLabel } from "../core/highlandBattle.js";
import { getWeaponActions, getWeaponStatus } from "../core/weaponTechniques.js";
import { getPendingHighlandPaths } from "../data/highlandPaths.js";

export function renderTacticalBattle({ state, els, canFight, choosePath }) {
  const panel = els.highlandBattlePanel, controls = els.tacticalActions;
  const text = getWeaponStatus(state.hero);
  for (const [button, type] of [[els.nextButton, "attack"], [els.guardButton, "guard"]]) if (button) {
    button.onmouseenter = button.onfocus = () => updateHighlandPreview(state, panel, { type });
  }
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
    summary.textContent = "戰術招式｜先選招，再確認"; details.append(summary);
    const help = controls.ownerDocument.createElement("p"); help.className = "tactical-help";
    help.textContent = "下方地點是招式作用的位置，不一定是你最後站的位置。"; details.append(help);
    const tabs = controls.ownerDocument.createElement("div"); tabs.className = "tactical-destinations"; details.append(tabs);
    const grid = controls.ownerDocument.createElement("div"); grid.className = "tactical-action-grid"; details.append(grid);
    const selection = controls.ownerDocument.createElement("div"); selection.className = "tactical-selection"; selection.hidden = true;
    const result = controls.ownerDocument.createElement("p"); result.setAttribute("aria-live", "polite");
    const confirm = controls.ownerDocument.createElement("button"); confirm.type = "button"; confirm.className = "primary-button"; confirm.dataset.actionConfirm = "true";
    selection.append(result, confirm);
    const terrainTypes = ["move", "break", "ride", "slip", "demolish", "tool-step", "tool-rock", "tool-brace", "shove", "gust-break"];
    const columns = [...new Set(moves.filter(a => terrainTypes.includes(a.type) && a.column !== undefined).map(a => a.column))].sort();
    let selected = Number(controls.dataset.selectedColumn);
    if (!columns.includes(selected)) selected = columns[0];
    const selectColumn = column => {
      selection.hidden = true;
      for (const choice of controls.querySelectorAll('[data-preview-only]')) choice.setAttribute("aria-pressed", "false");
      controls.dataset.selectedColumn = String(column);
      for (const tab of tabs.children) tab.setAttribute("aria-pressed", String(Number(tab.dataset.tacticColumn) === column));
      for (const button of grid.children) button.hidden = button.dataset.column !== undefined && Number(button.dataset.column) !== column;
    };
    for (const column of columns) {
      const tab = controls.ownerDocument.createElement("button"); tab.type = "button"; tab.className = "secondary-button";
      tab.textContent = HIGHLAND_COLUMNS[column]; tab.dataset.tacticColumn = String(column);
      tab.addEventListener("click", () => { selectColumn(column); updateHighlandPreview(state, panel, { type: "attack" }); }); tabs.append(tab);
    }
    if (moves.some(a => ["move", "break", "ride", "slip", "demolish", "tool-step", "tool-rock", "tool-brace", "shove", "gust-break"].includes(a.type))) controls.append(details);
    for (const move of moves) {
      const button = controls.ownerDocument.createElement("button");
      button.type = "button"; button.className = "secondary-button";
      button.textContent = move.label; button.dataset.actionType = move.type;
      if (!state.highlandBattle) button.onmouseenter = button.onfocus = () => updateHighlandPreview(state, panel, move);
      const labels = {
        shove: ["推敵", "花1回合・把選中的敵人推到這裡"],
        "gust-break": ["破岩放風", "花1回合・拆岩並讓風變成2格"],
        hold: ["扎穩守勢", "花1回合・不被風吹・減傷20%"],
        move: ["移位", "花1回合・少被風吹1格"], ride: ["借風", `花1回合・照常被風吹・下次多打${state.hero.highlandRideAttack}`],
        slip: ["轉瞬", "不花回合・每場1次"], break: ["拆岩", "花1回合・敵我都失去擋風岩"], demolish: ["破岩突入", "花1回合・拆岩並移動・每場1次"],
        "tool-step": ["踏釘", `不花回合・整備剩${state.runPreparation?.remainingCharges}次`],
        "tool-rock": ["加固", `1回合・整備剩${state.runPreparation?.remainingCharges}次`],
        "tool-brace": ["繩索固定", `1回合・兩回合不受風推・剩${state.runPreparation?.remainingCharges}次`]
      };
      if (labels[move.type]) {
        button.textContent = labels[move.type][0] + (move.column === undefined ? "" : `・${HIGHLAND_COLUMNS[move.column]}`);
        const cost = controls.ownerDocument.createElement("small"); cost.textContent = labels[move.type][1]; button.append(cost);
      }
      if (state.highlandBattle) {
        const landing = projectHighlandWind(state, move).find(p => p.unit === state.hero);
        const hint = controls.ownerDocument.createElement("small");
        hint.textContent = `${["slip", "tool-step"].includes(move.type) ? "立即" : "風後"}：${HIGHLAND_COLUMNS[landing.destination]}${landing.stagger ? "・撞邊失衡" : ""}`;
        if (!["slip", "tool-step"].includes(move.type)) {
          const count = previewHighlandTurn(state, move).threats.length;
          const attacking = highlandIntents(state).some(i => isGroundAttack(i) || i.kind === "track");
          hint.textContent += !attacking ? "・敵人本回合不攻擊" : count ? "・仍會挨打" : "・避開預告";
        }
        button.append(hint);
        button.dataset.previewOnly = "true";
        button.addEventListener("click", () => {
          updateHighlandPreview(state, panel, move);
          for (const choice of controls.querySelectorAll('[data-preview-only]')) choice.setAttribute("aria-pressed", String(choice === button));
          const preview = previewHighlandTurn(state, move), mine = preview.wind[0];
          const free = ["slip", "tool-step"].includes(move.type), from = state.hero.battleColumn;
          const first = ["move", "ride", "demolish", "slip", "tool-step"].includes(move.type) ? move.column : move.type === "lunge" ? state.enemies.find(e=>e.runtimeId===state.targetEnemyId)?.battleColumn : from;
          const actor = move.type === "shove" ? `先推${state.enemies.find(e=>e.runtimeId===state.targetEnemyId)?.name}到${HIGHLAND_COLUMNS[move.column]}` : `你先在${HIGHLAND_COLUMNS[first]}`;
          const wind = move.type === "gust-break" ? Math.sign(windFor(state))*2 : windFor(state);
          const windStep = !wind ? "這回合無風" : mine.sheltered ? "共用岩石替你擋風（耐久−1）" : ["hold", "tool-brace"].includes(move.type) || state.highlandBattle.braceUntil >= state.turn+1 ? "你固定住，不被風吹" : move.type === "move" ? "你抵住1格風" : `風${windLabel(wind)}`;
          const attacking = highlandIntents(state).some(i => isGroundAttack(i) || i.kind === "track");
          result.textContent = `${state.hero.entangle ? "你正被纏住，這招可能使不出來。" : ""}${actor} → ${free ? "不吹風、敵人不行動" : `${windStep}，最後你在${HIGHLAND_COLUMNS[mine.destination]}；${!attacking ? "敵人本回合不攻擊" : preview.threats.length ? "仍會挨打" : "避開目前預告"}`}。${highlandConsequenceText(state,move,preview)}`;
          confirm.textContent = `確認${labels[move.type]?.[0] || move.label}`;
          confirm.dataset.actionType = move.type;
          if (move.column === undefined) delete confirm.dataset.column; else confirm.dataset.column = String(move.column);
          selection.hidden = false;
          selection.scrollIntoView({ block: "nearest", behavior: "instant" });
        });
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
    if (state.highlandBattle) {
      const unlocked = [state.hero.highlandShove && "推敵", state.hero.highlandShatterGust && "破岩放風", state.hero.highlandDemolish && "破岩突入", state.hero.highlandRideAttack && "借風", state.hero.highlandSlipToken && "免費換位", state.hero.highlandHold && "扎穩"].filter(Boolean);
      if (unlocked.length) { const note = controls.ownerDocument.createElement("p"); note.className = "tactical-unlocks"; note.textContent = `祝福招式：${unlocked.join("、")}。展開上方選招，可先看後果。`; controls.append(note); }
      controls.append(selection);
    }
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
  renderHighlandBoard(state, panel, controls?.querySelector("details") || panel);
  const intentMap = new Map(highlandIntents(state).map(i => [i.id, i.text]));
  for (const card of els.enemyRoster?.querySelectorAll?.("[data-runtime-id]") || []) {
    const intent = card.querySelector("[data-enemy-intent]");
    if (intent) { intent.textContent = intentMap.get(card.dataset.runtimeId) || ""; intent.hidden = !intent.textContent; }
  }
}
