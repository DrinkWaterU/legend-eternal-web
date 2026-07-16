import { getHeroPendingHpLoss } from "../core/combat.js";
import { renderStatList } from "./renderHelpers.js";
import { renderLayeredMeter, renderStatusChips } from "./combatMeterView.js";
import { renderEnemyRoster } from "./enemyRosterView.js";

export function renderCombatView({ els, hero, enemies, targetEnemyId, phase, preparationStatus = null, characterStatusEntries = [], onTargetSelect }) {
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
