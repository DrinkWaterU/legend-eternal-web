import { previewHighlandTurn } from "../core/highlandPreview.js";
import { HIGHLAND_COLUMNS, highlandIntents, windFor, windLabel, canReachHighlandTarget } from "../core/highlandBattle.js";
import { attackColumns, isGroundAttack } from "../core/highlandTelegraphs.js";

const shortColumns = ["左邊", "中間", "右邊"];
const svg = {
  hero: '<circle cx="12" cy="5" r="3"/><path d="M7 21v-7H4l4-6h8l4 6h-3v7z"/>',
  enemy: '<path d="M4 4l5 3h6l5-3-2 13-6 5-6-5z"/><path d="M8 11h2m4 0h2" stroke="currentColor" stroke-width="2"/>',
  sword: '<path d="M18 2l4 0 0 4-12 12-4-4zM3 13l8 8M2 22l5-5" stroke="currentColor" stroke-width="2" fill="none"/>',
  rock: '<path d="M3 20L2 10l6-7 10 2 4 9-4 6z"/>',
  landing: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><path d="M8 12h8m-4-4v8" stroke="currentColor" stroke-width="2"/>'
};
function icon(doc, kind) {
  const el = doc.createElement("span"); el.className = `tactical-icon icon-${kind}`;
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${svg[kind]}</svg>`;
  return el;
}
function line(doc, tag, className, text) {
  const el = doc.createElement(tag); el.className = className; el.textContent = text; return el;
}

export function renderHighlandBoard(state, panel, rulesContainer = panel) {
  const doc = panel.ownerDocument, intents = highlandIntents(state);
  const wind = line(doc, "p", "highland-wind", `這回合 ${windLabel(windFor(state))}　｜下回合 ${windLabel(windFor(state, 1))}`);
  panel.append(wind);
  const board = doc.createElement("div"); board.className = "highland-board";
  for (let col = 0; col < 3; col++) {
    const lane = doc.createElement("div"); lane.className = "highland-lane"; lane.dataset.column = String(col);
    lane.classList.toggle("has-hero", state.hero.battleColumn === col);
    lane.append(line(doc, "strong", "", HIGHLAND_COLUMNS[col]));
    const attacks = intents.filter(i => isGroundAttack(i) && attackColumns(i).includes(col));
    if (attacks.length) {
      lane.classList.add("is-danger");
      const threat = line(doc, "span", "highland-danger", "敵人打這裡"); threat.prepend(icon(doc, "sword")); lane.append(threat);
      lane.append(line(doc, "small", "highland-attack-source", `來源：${attacks.map(i => state.enemies.find(e => e.runtimeId === i.id)?.displayName || state.enemies.find(e => e.runtimeId === i.id)?.name).join("、")}`));
    } else lane.append(line(doc, "span", "highland-no-ground", "未被瞄準"));
    const durability = state.highlandBattle.rocks[col];
    if (durability) {
      const rock = line(doc, "small", "", `擋${col === 0 ? "→" : "←"}風 ${"▰".repeat(durability)}`); rock.prepend(icon(doc, "rock")); lane.append(rock);
    }
    for (const unit of [state.hero, ...state.enemies].filter(e => e.hp > 0 && e.battleColumn === col)) {
      const tag = line(doc, "span", "highland-unit", `${unit === state.hero ? "你" : unit.displayName || unit.name}${unit.windStagger ? "・失衡" : ""}`);
      tag.prepend(icon(doc, unit === state.hero ? "hero" : "enemy")); lane.append(tag);
    }
    board.append(lane);
  }
  panel.append(board);
  const tracking = intents.filter(i => i.kind === "track");
  if (tracking.length) panel.append(line(doc, "p", "highland-tracking", `◎ 追著你打：${tracking.map(i => state.enemies.find(e => e.runtimeId === i.id)?.name).join("、")}。換位置也可能被打中。`));
  const previewButtons = doc.createElement("div"); previewButtons.className = "highland-preview-tabs";
  for (const [type, label] of [["attack", "看攻擊後"], ["guard", "看守勢後"]]) {
    const button = line(doc, "button", "secondary-button", label); button.type = "button"; button.dataset.previewAction = type;
    button.addEventListener("click", () => updateHighlandPreview(state, panel, { type })); previewButtons.append(button);
  }
  const reading = doc.createElement("div"); reading.className = "highland-reading";
  const copy = doc.createElement("div"); copy.className = "highland-reading-copy";
  copy.append(previewButtons, line(doc, "p", "highland-preview-label", ""), line(doc, "p", "highland-forecast", ""), line(doc, "p", "highland-consequence", ""));
  reading.append(copy);
  const lesson = doc.createElement("details"); lesson.className = "highland-lesson";
  lesson.open = state.encounterIndex === 0 && state.turn === 0;
  lesson.append(line(doc, "summary", "", "看圖教學：先行動，再吹風"));
  const picture = doc.createElement("div"); picture.className = "highland-lesson-picture"; lesson.append(picture);
  reading.append(lesson); panel.append(reading);
  const damageRules = doc.createElement("details"); damageRules.className = "highland-rules";
  damageRules.append(line(doc, "summary", "", "祝福的固定加傷怎麼算？"), line(doc, "p", "", "這筆傷害不扣敵人的防禦，也不會暴擊或引發追擊；護衛仍能減少它。不同來源可以合計，每種只存一次，下一次攻擊出手就會用掉。"));
  rulesContainer.append(damageRules);
  panel.append(line(doc, "small", "highland-rules", "實心人＝現在　虛線圈＝風後　劍＝敵人攻擊位置。先打倒敵人，就能取消牠的攻擊。"));
  updateHighlandPreview(state, panel, { type: "attack" });
}

export function updateHighlandPreview(state, panel, action) {
  if (!state.highlandBattle || !panel?.querySelector(".highland-board")) return;
  const selection = panel.parentElement?.querySelector(".tactical-selection"), confirm = selection?.querySelector("[data-action-confirm]");
  if (confirm && (confirm.dataset.actionType !== action.type || confirm.dataset.column !== (action.column === undefined ? undefined : String(action.column)))) {
    selection.hidden = true;
    for (const choice of panel.parentElement.querySelectorAll('[data-preview-only]')) choice.setAttribute("aria-pressed", "false");
  }
  const doc = panel.ownerDocument, intents = highlandIntents(state), preview = previewHighlandTurn(state, action), projected = preview.wind;
  const mine = projected[0], free = ["slip", "tool-step"].includes(action.type);
  const threats = preview.threats;
  const names = { attack: "攻擊", guard: "守勢", hold: "沉身守隘", shove: "順勢推搡", "gust-break": "破岩引風", move: "移位", break: "拆岩", slip: "換位", ride: "借風移動", lunge: "突進", demolish: "拆岩突入", "tool-step": "踏釘", "tool-rock": "加固", "tool-brace": "繩索固定" };
  const label = panel.querySelector(".highland-preview-label");
  label.textContent = `目前預覽：${names[action.type] || "武器招式"}`;
  label.hidden = ["attack", "guard"].includes(action.type);
  for (const button of panel.querySelectorAll("[data-preview-action]")) button.setAttribute("aria-pressed", String(button.dataset.previewAction === action.type));
  for (const marker of panel.querySelectorAll(".highland-landing, .highland-enemy-landing")) marker.remove();
  const lane = panel.querySelector(`.highland-lane[data-column="${mine.destination}"]`);
  const landing = line(doc, "span", "highland-landing", free ? "你立刻到這裡" : "風後你在這裡"); landing.prepend(icon(doc, "landing")); lane?.append(landing);
  for (const p of preview.final.slice(1).filter(p => p.destination !== p.unit.battleColumn && p.hp !== 0)) {
    const ghost = line(doc, "small", "highland-enemy-landing", `行動後：${p.unit.displayName || p.unit.name}`);
    ghost.prepend(icon(doc, "enemy")); panel.querySelector(`.highland-lane[data-column="${p.destination}"]`)?.append(ghost);
  }
  let hint;
  const target = state.enemies.find(e => e.runtimeId === state.targetEnemyId);
  if (free) hint = "先換位置，不花回合。風和敵人都還沒行動。";
  else if (state.hero.entangle) hint = "你正被纏住，若沒掙脫，這招就使不出來；先別把預覽當成能躲開。";
  else if (!intents.some(i => isGroundAttack(i) || i.kind === "track")) hint = "這回合敵人不攻擊，可以趁機出手或調整位置。";
  else if (threats.some(i => i.kind === "track")) hint = "牠還盯著你追，這樣換位置仍會被打到。可以看看守勢。";
  else if (threats.length && mine.sheltered) hint = "岩石擋住了風，也讓你留在攻擊裡。看看換位或拆岩，能不能讓開。";
  else if (threats.length) hint = `到${shortColumns[mine.destination]}仍會吃到${threats.length}道攻擊。換個位置看看，或先守住。`;
  else if (!mine.stagger && intents.some(i => isGroundAttack(i) && attackColumns(i).includes(state.hero.battleColumn)) && mine.destination !== state.hero.battleColumn && canReachHighlandTarget(state, target) && action.type === "attack")
    hint = `先別急著躲，牠打的是${shortColumns[state.hero.battleColumn]}。趁現在還手，風剛好會帶你往${mine.destination === 0 ? "左" : "右"}避開！`;
  else hint = `這樣會到${shortColumns[mine.destination]}，能避開目前預告的攻擊。${mine.stagger ? "但撞到邊界會失衡，下次挨打更痛。" : ""}`;
  panel.querySelector(".highland-forecast").textContent = hint;
  const consequences = highlandConsequenceText(state, action, preview);
  const consequence = panel.querySelector(".highland-consequence"); consequence.textContent = consequences; consequence.hidden = !consequences;
  const picture = panel.querySelector(".highland-lesson-picture"); picture?.replaceChildren();
  for (const [title, position] of [["現在", state.hero.battleColumn], [free ? "換位後" : "行動、吹風後", mine.destination]]) {
    const step = doc.createElement("div"); step.className = "highland-lesson-step"; step.append(line(doc, "small", "", title));
    const row = doc.createElement("div"); row.className = "highland-mini-board";
    for (let c = 0; c < 3; c++) {
      const cell = doc.createElement("span"); const danger = intents.some(i => isGroundAttack(i) && attackColumns(i).includes(c));
      cell.classList.toggle("is-danger", danger); cell.setAttribute("aria-label", `${shortColumns[c]}${danger ? "會被攻擊" : ""}${position === c ? "，你在這裡" : ""}`);
      if (danger) cell.append(icon(doc, "sword")); if (position === c) cell.append(icon(doc, "hero")); row.append(cell);
    }
    step.append(row); picture?.append(step);
  }
}

export function highlandConsequenceText(state, action, preview = previewHighlandTurn(state, action)) {
  const name = id => { const e = state.enemies.find(e => e.runtimeId === id); return e?.displayName || e?.name || "敵人"; };
  if (preview.interrupted) return `把${name(preview.interrupted)}推撞岩石：打斷這次衝撞，整塊擋風岩也會碎。`;
  if (preview.collateral.length) return `若照常出招：${preview.collateral.map(c => `${name(c.actorId)}會打到${name(c.targetId)}（${c.damage}傷害${c.defeated ? "，可擊倒" : ""}）`).join("；")}。`;
  if (action.type === "shove" && highlandIntents(state).some(i => i.id === state.targetEnemyId && i.kind === "charge")) return "沒有岩石可撞，推不斷衝撞；牠仍會衝回原本瞄準的位置。";
  if (["break", "gust-break", "demolish"].includes(action.type)) {
    const changed = preview.wind.filter(p => p.destination !== p.unit.battleColumn).map(p => p.unit === state.hero ? "你" : p.unit.displayName || p.unit.name);
    return `拆岩後${changed.length ? `${changed.join("、")}會被風吹動` : "沒有人被風吹動"}。岩石只擋風，不擋刀；敵我共用。`;
  }
  return "";
}
