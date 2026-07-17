import { getHeroPendingHpLoss } from "../core/combat.js";
import { formatQuestObjective, getQuestTarget } from "../core/questRules.js";
import { materialDefinitions } from "../data/materials.js";
import { getQuestRarity } from "../data/questRarities.js";
import { renderStatList } from "./renderHelpers.js";
import { renderLayeredMeter, renderStatusChips } from "./combatMeterView.js";
import { renderEnemyRoster } from "./enemyRosterView.js";

export function renderCombatView({
  els,
  hero,
  enemies,
  targetEnemyId,
  phase,
  preparationStatus = null,
  characterStatusEntries = [],
  onTargetSelect,
  questSnapshot = null
}) {
  if (!hero) return;
  renderHeroStatus(els, hero, characterStatusEntries);
  renderPreparationStatus(els, preparationStatus);
  renderEnemyRoster({
    roster: els.enemyRoster,
    countLabel: els.enemyCountLabel,
    enemies,
    targetEnemyId,
    phase,
    onTargetSelect
  });
  renderStatusSummary(els, hero);
  renderQuestCombatSummary(els, questSnapshot);
}

export function renderQuestCombatSummary(els, snapshot) {
  const button = els.questCombatToggle;
  if (!button) return;
  const quest = snapshot?.activeQuest;
  button.hidden = !quest;
  if (!quest) {
    button.classList.remove("is-complete");
    button.setAttribute("aria-expanded", "false");
    return;
  }

  const target = getQuestTarget(quest);
  const progress = Math.min(target, Number(snapshot.activeProgress) || 0);
  const complete = progress >= target;
  els.questCombatToggle.querySelector("#questCombatSummaryName").textContent = quest.name;
  els.questCombatToggle.querySelector("#questCombatSummaryProgress").textContent = `${progress} / ${target}`;
  button.classList.toggle("is-complete", complete);
  button.setAttribute("aria-label", `查看委託：${quest.name}，進度 ${progress} / ${target}`);
}

export function renderQuestCombatDetails({ els, snapshot }) {
  const quest = snapshot?.activeQuest;
  const title = els.questInfoPanel.querySelector("#questInfoTitle");
  const content = els.questInfoPanel.querySelector("#questInfoContent");
  content.replaceChildren();
  if (!quest) {
    title.textContent = "目前委託";
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有承接中的委託。";
    content.append(empty);
    return;
  }

  const target = getQuestTarget(quest);
  const progress = Math.min(target, Number(snapshot.activeProgress) || 0);
  const complete = progress >= target;
  const percent = Math.min(100, Math.round((progress / Math.max(1, target)) * 100));
  const rarity = getQuestRarity(quest.rarity);
  title.textContent = quest.name;

  const card = document.createElement("article");
  card.className = `quest-info-card${complete ? " is-complete" : ""}`;

  const heading = document.createElement("div");
  heading.className = "quest-info-card-heading";
  const mark = document.createElement("span");
  mark.className = "quest-info-mark";
  mark.textContent = "✦";
  mark.setAttribute("aria-hidden", "true");
  const titleGroup = document.createElement("div");
  titleGroup.className = "quest-info-title-group";
  const rarityLabel = document.createElement("p");
  rarityLabel.className = "eyebrow";
  rarityLabel.textContent = `目前委託・${rarity?.label || quest.rarity}`;
  const name = document.createElement("h3");
  name.textContent = quest.name;
  titleGroup.append(rarityLabel, name);
  const progressValue = document.createElement("strong");
  progressValue.className = `quest-info-progress-value${complete ? " is-complete" : ""}`;
  progressValue.textContent = `${progress} / ${target}`;
  heading.append(mark, titleGroup, progressValue);

  const objective = document.createElement("p");
  objective.className = "quest-info-objective";
  objective.textContent = formatQuestObjective(quest, materialDefinitions);

  const progressTrack = document.createElement("div");
  progressTrack.className = "quest-info-progress-track";
  progressTrack.setAttribute("role", "progressbar");
  progressTrack.setAttribute("aria-label", `委託進度 ${progress} / ${target}`);
  progressTrack.setAttribute("aria-valuemin", "0");
  progressTrack.setAttribute("aria-valuemax", String(target));
  progressTrack.setAttribute("aria-valuenow", String(progress));
  const progressBar = document.createElement("span");
  progressBar.style.width = `${percent}%`;
  progressTrack.append(progressBar);

  const footer = document.createElement("div");
  footer.className = "quest-info-footer";
  const status = document.createElement("span");
  status.textContent = complete ? "目標已達成" : "戰鬥結算後更新進度";
  const action = document.createElement("span");
  action.textContent = complete ? "返回公會回報" : "一次只能承接一項";
  footer.append(status, action);

  card.append(heading, objective, progressTrack, footer);
  content.append(card);
}

export function renderCurrentAbilityView(element, hero) {
  renderStatList(element, [
    ["角色等級", `Lv. ${hero.level || 1}`],
    ["經驗", `${hero.exp || 0} / ${hero.expToNext || "-"}`],
    ["攻擊", getHeroRuntimeAttack(hero)],
    ["防禦", hero.defense],
    ["暴擊", `${Math.round(getHeroRuntimeCritChance(hero) * 100)}%`],
    ["逃跑", `${hero.fleesRemaining ?? 0} 次`],
    ["護盾", hero.shield || 0],
    ["中毒", hero.poison || 0],
    ["技能", Array.isArray(hero.skills) ? hero.skills.length : 0],
    ["祝福", Array.isArray(hero.blessings) ? hero.blessings.length : 0]
  ]);
}

export function getHeroRuntimeAttack(hero) {
  return (Number(hero?.attack) || 0) + (Number(hero?.battleAttackBonus) || 0);
}

export function getHeroRuntimeCritChance(hero) {
  return (Number(hero?.critChance) || 0) + (Number(hero?.battleCritBonus) || 0);
}

function renderHeroStatus(els, hero, characterStatusEntries) {
  els.heroName.textContent = hero.name;
  els.heroLevel.textContent = `角色 Lv. ${hero.level || 1}`;
  renderLayeredMeter({
    meter: els.heroHealthMeter,
    currentLayer: els.heroHealthBar,
    pendingLayer: els.heroPendingHealthBar,
    shieldLayer: els.heroShieldBar,
    value: hero.hp,
    max: hero.maxHp,
    pendingLoss: getHeroPendingHpLoss(hero),
    shield: hero.shield || 0
  });
  els.heroHealthText.textContent = `${hero.hp} / ${hero.maxHp}`;
  const statuses = [];
  if (hero.shield > 0) statuses.push({ label: `護盾 ${hero.shield}`, className: "is-shield" });
  if (hero.poison > 0) {
    statuses.push({ label: `中毒 ${hero.poison} · 預計 -${getHeroPendingHpLoss(hero)}`, className: "is-negative" });
  }
  if (hero.entangle) statuses.push({ label: "纏繞", className: "is-negative" });
  statuses.push(...characterStatusEntries);
  renderStatusChips(els.heroStatusList, statuses, "狀態正常");
}

function renderPreparationStatus(els, preparationStatus) {
  const status = els.combatPreparationStatus;
  if (!preparationStatus) {
    status.hidden = true;
    els.combatPreparationName.textContent = "未整備";
    els.combatPreparationCharges.textContent = "";
    return;
  }
  status.hidden = false;
  status.classList.toggle("is-depleted", preparationStatus.isDepleted === true);
  els.combatPreparationName.textContent = preparationStatus.name || "冒險整備";
  els.combatPreparationCharges.textContent = preparationStatus.label || "";
}

function renderStatusSummary(els, hero) {
  els.currentAttackSummary.textContent = getHeroRuntimeAttack(hero);
  els.currentDefenseSummary.textContent = hero.defense ?? 0;
  els.currentCritSummary.textContent = `${Math.round(getHeroRuntimeCritChance(hero) * 100)}%`;
  els.currentBlessingSummary.textContent = Array.isArray(hero.blessings) ? hero.blessings.length : 0;
}
