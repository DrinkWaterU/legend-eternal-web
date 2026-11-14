import { weaponDefinitions } from "../data/weapons.js";
import { createWeaponIcon } from "./weaponViewHelpers.js";

const REGIONS = Object.freeze([
  ["forest", "森林"],
  ["beach", "海岸"],
  ["highlands", "斷風高地"]
]);
const HAMMER_REGION = Object.freeze(["highlands", "斷風高地"]);

export function createSwordTrainingCard({ training, owned, location, onUnlock }) {
  if (!training) return null;
  const section = createTrainingSection({
    title: "守隘劍專精",
    weaponId: "windbreak-sword",
    location,
    owned,
    training,
    regions: REGIONS
  });
  const description = createText("p", "解鎖「冒險反攻」：普通守勢減傷20%，比「穩守反攻」少減傷，換來更強的反攻。反攻只在下一回合攻擊命中時發動；否則失效。", "weapon-training-description");
  const steps = createStepList([
    "普通守勢減輕直接傷害",
    "下一次攻擊命中",
    "追加反攻傷害"
  ]);
  const objective = createObjective(owned
    ? "裝備斷風守隘劍，在森林、海岸、高地各完成一次連招：先用普通守勢減輕直接傷害，再攻擊並打出反攻傷害。"
    : "先打造，再裝備斷風守隘劍。");
  const progress = createRegionList(training, REGIONS);
  const status = createStatus(getSwordStatus({ training, owned, location }), getTrainingStatusState({ training, owned }));
  const rules = createRuleDetails("查看完整效果與條件", [
    "穩守反攻：普通守勢減傷35%。成功減傷後，下一次攻擊命中追加攻擊力70%＋4傷害。",
    "冒險反攻：普通守勢減傷20%。成功減傷後，下一回合攻擊命中追加攻擊力110%＋4傷害。若下一回合沒有攻擊，或攻擊未命中，反攻就會失效。",
    "反攻傷害受目標防禦與護衛影響，不會暴擊、觸發追擊或吸血。若攻擊先擊倒目標，就不會追加反攻傷害。",
    "專精只記錄實際造成傷害的反攻。高地的「扎穩守勢」不計入。倒下或撤退不會清除已完成的地區進度。"
  ]);
  appendTrainingContent(section, { location, training, description, steps, objective, progress, status, rules });
  if (location === "blacksmith" && owned && !training.unlocked) {
    section.append(createUnlockButton(training.ready ? "解鎖冒險反攻" : "完成三地連招", training.ready, onUnlock));
  }
  return section;
}

export function createHammerTrainingCard({ training, owned, location, onUnlock }) {
  if (!training) return null;
  const section = createTrainingSection({
    title: "岩鎚裂陣專精",
    weaponId: "cairn-warhammer",
    location,
    owned,
    training,
    regions: [HAMMER_REGION]
  });
  const description = createText("p", "解鎖「震岩裂陣」。攻擊命中後，震擊其他敵人。", "weapon-training-description");
  const steps = createStepList([
    "攻擊命中3次，累積3層衝擊",
    "用3層衝擊的破勢命中敵人",
    "破綻消失前，再攻擊同一敵人並命中"
  ]);
  const objective = createObjective(owned
    ? "裝備鎮隘岩鎚，在斷風高地開場至少有2名敵人的戰鬥中完成連招。"
    : "先打造，再裝備鎮隘岩鎚。");
  const progress = createRegionList(training, [HAMMER_REGION]);
  const status = createStatus(getHammerStatus({ training, owned, location }), getTrainingStatusState({ training, owned }));
  const rules = createRuleDetails("查看完整效果與條件", [
    "每次攻擊命中累積1層衝擊，最多3層。",
    "震岩裂陣需要3層衝擊，且場上至少有2名存活敵人。選擇目標後，攻擊必須命中並造成傷害。",
    "攻擊未命中時，仍會消耗3層衝擊，但不會發出震波。",
    "攻擊造成傷害後，其他存活敵人各受一次攻擊力100%的傷害。此傷害先扣防禦。若前衛仍存活並保護目標，傷害再降低30%。",
    "範圍傷害不會暴擊、吸血或觸發其他攻擊效果。擊殺仍會觸發擊殺回血與其他擊殺效果。",
    "震岩裂陣不追加單體破勢傷害，也不施加破綻。",
    "專精只記錄高地開場至少有2名敵人、且完整完成連招的戰鬥。倒下或撤退不會清除已完成的進度。"
  ]);
  appendTrainingContent(section, { location, training, description, steps, objective, progress, status, rules });
  if (location === "blacksmith" && owned && !training.unlocked) {
    section.append(createUnlockButton(training.ready ? "解鎖震岩裂陣" : "完成高地連招", training.ready, onUnlock));
  }
  return section;
}

function createTrainingSection({ title, weaponId, location, owned, training, regions }) {
  const section = document.createElement("section");
  const hostClass = location === "guild" ? "guild" : "blacksmith";
  const weaponClass = weaponId === "windbreak-sword" ? "sword" : "hammer";
  section.className = `weapon-training-card weapon-training-card--${weaponClass} weapon-training-card--${hostClass} ${hostClass === "guild" ? "guild-quest-active-section" : "blacksmith-detail-section"}`;
  section.setAttribute("aria-label", title);

  const heading = document.createElement("header");
  heading.className = "weapon-training-header";
  heading.append(createWeaponIcon(weaponDefinitions[weaponId], {
    className: "weapon-icon weapon-training-icon",
    alt: ""
  }));
  const titleGroup = document.createElement("div");
  titleGroup.className = "weapon-training-title-group";
  const kicker = createText("span", "武器專精", "weapon-training-kicker");
  const name = createText(location === "guild" ? "h3" : "h4", title, "weapon-training-title");
  titleGroup.append(kicker, name);
  const badge = createText("span", getTrainingBadge({ training, owned }), "weapon-training-badge");
  badge.dataset.state = training.unlocked ? "complete" : owned && training.ready ? "ready" : owned ? "active" : "locked";
  heading.append(titleGroup, badge);

  const progress = createProgressMeter(training, regions);
  section.append(heading, progress);
  return section;
}

function createProgressMeter(training, regions) {
  const completed = regions.filter(([id]) => training.regions?.[id]).length;
  const meter = document.createElement("div");
  meter.className = "weapon-training-meter";
  meter.setAttribute("role", "progressbar");
  meter.setAttribute("aria-label", "專精地區進度");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", String(regions.length));
  meter.setAttribute("aria-valuenow", String(completed));
  meter.setAttribute("aria-valuetext", `完成 ${completed} / ${regions.length} 個地區`);

  const label = createText("span", "專精進度", "weapon-training-meter-label");
  const count = createText("strong", `${completed} / ${regions.length}`, "weapon-training-meter-count");
  const track = document.createElement("span");
  track.className = "weapon-training-meter-track";
  track.setAttribute("aria-hidden", "true");
  const fill = document.createElement("span");
  fill.className = "weapon-training-meter-fill";
  fill.style.width = `${Math.round((completed / regions.length) * 100)}%`;
  track.append(fill);
  meter.append(label, count, track);
  return meter;
}

function createStepList(steps) {
  const panel = document.createElement("div");
  panel.className = "weapon-training-steps-panel";
  const heading = createText("h5", "完成專精連招", "weapon-training-steps-title");
  const list = document.createElement("ol");
  list.className = "weapon-training-steps";
  for (const [index, text] of steps.entries()) {
    const item = document.createElement("li");
    const marker = createText("span", String(index + 1), "weapon-training-step-marker");
    marker.setAttribute("aria-hidden", "true");
    const label = createText("span", text, "weapon-training-step-label");
    item.append(marker, label);
    list.append(item);
  }
  panel.append(heading, list);
  return panel;
}

function appendTrainingContent(section, { location, training, description, steps, objective, progress, status, rules }) {
  if (location !== "guild") {
    section.append(description, steps, objective, progress, status, rules);
    return;
  }

  if (training.unlocked) {
    section.append(status);
  } else {
    section.append(description, progress, status);
  }

  const disclosure = document.createElement("details");
  disclosure.className = "weapon-training-disclosure";
  const summary = createText("summary", training.unlocked
    ? "查看專精連招與效果"
    : "查看專精連招與完成條件");
  disclosure.append(summary);
  if (training.unlocked) disclosure.append(description, progress);
  disclosure.append(steps, objective, rules);
  section.append(disclosure);
}

function getSwordStatus({ training, owned, location }) {
  if (training.unlocked) return "已解鎖。到角色裝備頁選擇打法。";
  if (!owned) return location === "guild" ? "下一步：打造並裝備斷風守隘劍。" : "先打造並裝備斷風守隘劍，才能完成專精。";
  if (training.ready) return location === "blacksmith" ? "專精條件已完成。按下方按鈕解鎖。" : "各地區連招已完成。到鐵匠鋪解鎖。";
  const nextRegion = REGIONS.find(([id]) => training.regions?.[id] !== true)?.[1] || "下一個地區";
  return location === "guild"
    ? `下一步：裝備守隘劍，在${nextRegion}完成一次守勢反攻。`
    : "完成三地連招後，到鐵匠鋪解鎖。";
}

function getHammerStatus({ training, owned, location }) {
  if (training.unlocked) return "已解鎖。裝備鎮隘岩鎚，在任何地區的群戰中都可使用。";
  if (!owned) return location === "guild" ? "下一步：打造並裝備鎮隘岩鎚。" : "先打造並裝備鎮隘岩鎚，才能完成專精。";
  if (training.ready) return location === "blacksmith" ? "專精條件已完成。按下方按鈕解鎖。" : "高地連招已完成。到鐵匠鋪解鎖。";
  return location === "guild"
    ? "下一步：裝備鎮隘岩鎚，在斷風高地開場至少有2名敵人的戰鬥中完成連招。"
    : "完成高地連招後，到鐵匠鋪解鎖。";
}

function getTrainingStatusState({ training, owned }) {
  if (training.unlocked) return "complete";
  if (!owned) return "locked";
  return training.ready ? "ready" : "active";
}

function createObjective(text) {
  const objective = document.createElement("p");
  objective.className = "weapon-training-objective";
  const label = createText("span", "完成條件", "weapon-training-objective-label");
  const copy = createText("span", text, "weapon-training-objective-copy");
  objective.append(label, copy);
  return objective;
}

function createRegionList(training, regions) {
  const list = document.createElement("ul");
  list.className = "weapon-training-regions";
  list.setAttribute("aria-label", "各地區專精進度");
  for (const [id, label] of regions) {
    const complete = training.regions?.[id] === true;
    const item = document.createElement("li");
    item.dataset.complete = String(complete);
    const icon = createText("span", complete ? "√" : "○", "weapon-training-region-icon");
    icon.setAttribute("aria-hidden", "true");
    const status = createText("span", `${label}：${complete ? "已完成" : "尚未完成"}`, "weapon-training-region-label");
    item.append(icon, status);
    list.append(item);
  }
  return list;
}

function createStatus(text, state) {
  const status = document.createElement("div");
  status.className = "weapon-training-status";
  status.dataset.state = state;
  const icon = createText("span", state === "complete" ? "√" : state === "ready" ? "!" : "→", "weapon-training-status-icon");
  icon.setAttribute("aria-hidden", "true");
  const label = createText("span", text, "weapon-training-status-copy");
  status.append(icon, label);
  return status;
}

function getTrainingBadge({ training, owned }) {
  if (training.unlocked) return "已解鎖";
  if (!owned) return "先打造";
  if (training.ready) return "可解鎖";
  return "進行中";
}

function createRuleDetails(label, rules) {
  const details = document.createElement("details");
  details.className = "weapon-training-rules";
  const summary = document.createElement("summary");
  const list = document.createElement("ul");
  summary.textContent = label;
  for (const rule of rules) {
    const item = document.createElement("li");
    item.textContent = rule;
    list.append(item);
  }
  details.append(summary, list);
  return details;
}

function createUnlockButton(label, enabled, onUnlock) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-button weapon-training-unlock";
  button.disabled = !enabled;
  button.textContent = label;
  button.addEventListener("click", () => onUnlock?.());
  return button;
}

function createText(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}
