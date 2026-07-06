import { getEnemyPendingHpLoss, getHeroPendingHpLoss } from "../core/combat.js";
import { getEnemyDisplayName, getLivingEnemies } from "../core/enemyGroups.js";
import { renderStatList } from "./renderHelpers.js";

const rosterTargetState = new WeakMap();

export function renderCombatView({ els, hero, enemies, targetEnemyId, phase, onTargetSelect }) {
  if (!hero) {
    return;
  }

  renderHeroStatus(els, hero);
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

function renderHeroStatus(els, hero) {
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
  renderHeroStatuses(els.heroStatusList, hero);
}

function renderHeroStatuses(element, hero) {
  const statuses = [];
  const pendingLoss = getHeroPendingHpLoss(hero);
  if (hero.shield > 0) {
    statuses.push({ label: `護盾 ${hero.shield}`, className: "is-shield" });
  }
  if (hero.poison > 0) {
    statuses.push({ label: `中毒 ${hero.poison} · 預計 -${pendingLoss}`, className: "is-negative" });
  }
  if (hero.entangle) {
    statuses.push({ label: "纏繞", className: "is-negative" });
  }
  renderStatusChips(element, statuses, "狀態正常");
}

function renderEnemyRoster({ roster, countLabel, enemies, targetEnemyId, phase, onTargetSelect }) {
  const livingEnemies = getLivingEnemies(enemies);
  countLabel.textContent = livingEnemies.length > 0 ? `${livingEnemies.length} 名敵人` : "暫無遭遇";

  const existingCards = new Map(
    [...roster.querySelectorAll(".enemy-card[data-runtime-id]")]
      .map((card) => [card.dataset.runtimeId, card])
  );
  const livingIds = new Set(livingEnemies.map((enemy) => enemy.runtimeId));
  existingCards.forEach((card, runtimeId) => {
    if (!livingIds.has(runtimeId)) {
      card.remove();
      existingCards.delete(runtimeId);
    }
  });
  roster.querySelector(".enemy-roster-empty")?.remove();

  if (livingEnemies.length === 0) {
    const empty = document.createElement("p");
    empty.className = "enemy-roster-empty";
    empty.textContent = phase === "safe" ? "目前位於安全路段。" : "目前沒有可戰鬥的敵人。";
    roster.append(empty);
    rosterTargetState.set(roster, null);
    return;
  }

  const orderedCards = livingEnemies.map((enemy) => ({
    enemy,
    card: existingCards.get(enemy.runtimeId) || createEnemyCard(enemy.runtimeId)
  }));

  // Keep existing cards attached when order is unchanged. Re-appending a card
  // after updating meter widths cancels the CSS transition and makes HP jump.
  orderedCards.forEach(({ card }, index) => {
    const currentCard = roster.children[index] || null;
    if (currentCard !== card) {
      roster.insertBefore(card, currentCard);
    }
  });

  orderedCards.forEach(({ enemy, card }) => {
    card._onTargetSelect = onTargetSelect;
    updateEnemyCard(card, enemy, livingEnemies.length, enemy.runtimeId === targetEnemyId);
  });

  const previousTargetId = rosterTargetState.get(roster);
  const targetCard = [...roster.querySelectorAll(".enemy-card[data-runtime-id]")]
    .find((card) => card.dataset.runtimeId === targetEnemyId);
  rosterTargetState.set(roster, targetEnemyId);
  if (targetCard) {
    if (previousTargetId !== targetEnemyId) {
      queueTargetVisibility(roster, targetCard);
    } else {
      const scheduledTargetId = targetEnemyId;
      window.requestAnimationFrame(() => {
        if (rosterTargetState.get(roster) === scheduledTargetId) {
          alignCardWithinRoster(roster, targetCard);
        }
      });
    }
  }
}

function createEnemyCard(runtimeId) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "enemy-card";
  card.dataset.runtimeId = runtimeId;
  card.innerHTML = `
    <span class="enemy-card-heading">
      <span class="enemy-name-line">
        <strong data-enemy-name></strong>
        <span class="target-mark">目標</span>
      </span>
      <span class="enemy-kind" data-enemy-kind></span>
    </span>
    <span class="layered-meter enemy-meter" data-enemy-meter role="meter">
      <span class="meter-layer enemy-hp" data-enemy-hp></span>
      <span class="meter-layer pending-loss" data-enemy-pending></span>
      <span class="meter-layer shield" data-enemy-shield></span>
    </span>
    <span class="meter-text" data-enemy-health-text></span>
    <span class="enemy-card-detail">
      <span class="enemy-card-detail-inner">
        <span class="enemy-detail-content">
          <span class="enemy-stats">
            <span><small>攻擊</small><b data-enemy-attack></b></span>
            <span><small>防禦</small><b data-enemy-defense></b></span>
            <span><small>暴擊率</small><b data-enemy-crit></b></span>
          </span>
          <span class="combat-statuses enemy-statuses" data-enemy-statuses></span>
          <span class="enemy-intro" data-enemy-intro></span>
        </span>
      </span>
    </span>
  `;
  card.addEventListener("click", () => card._onTargetSelect?.(card.dataset.runtimeId));
  return card;
}

function updateEnemyCard(card, enemy, enemyCount, isTarget) {
  card.classList.toggle("is-target", isTarget);
  card.classList.toggle("is-single", enemyCount === 1);
  card.disabled = enemy.hp <= 0;
  card.querySelector("[data-enemy-name]").textContent = getEnemyDisplayName(enemy);
  card.querySelector("[data-enemy-kind]").textContent = enemy.kind || "普通";
  card.querySelector("[data-enemy-health-text]").textContent = `${enemy.hp} / ${enemy.maxHp}`;
  card.querySelector("[data-enemy-attack]").textContent = enemy.attack ?? 0;
  card.querySelector("[data-enemy-defense]").textContent = enemy.defense ?? 0;
  card.querySelector("[data-enemy-crit]").textContent = `${Math.round((Number(enemy.critChance) || 0) * 100)}%`;
  const intro = card.querySelector("[data-enemy-intro]");
  intro.textContent = enemy.intro || "";
  intro.hidden = !intro.textContent;

  renderLayeredMeter({
    meter: card.querySelector("[data-enemy-meter]"),
    currentLayer: card.querySelector("[data-enemy-hp]"),
    pendingLayer: card.querySelector("[data-enemy-pending]"),
    shieldLayer: card.querySelector("[data-enemy-shield]"),
    value: enemy.hp,
    max: enemy.maxHp,
    pendingLoss: getEnemyPendingHpLoss(enemy),
    shield: enemy.shield || 0,
    enemy: true
  });

  const statuses = [];
  if (enemy.shield > 0) {
    statuses.push({ label: `護盾 ${enemy.shield}`, className: "is-shield" });
  }
  if (enemy.poison > 0) {
    statuses.push({ label: `中毒 ${enemy.poison} · 預計 -${getEnemyPendingHpLoss(enemy)}`, className: "is-negative" });
  }
  renderStatusChips(card.querySelector("[data-enemy-statuses]"), statuses, "狀態正常");
}

function renderLayeredMeter({ meter, currentLayer, pendingLayer, shieldLayer, value, max, pendingLoss, shield, enemy = false }) {
  const safeMax = Math.max(1, Number(max) || 1);
  const safeValue = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const safePendingLoss = Math.max(0, Math.min(safeValue, Number(pendingLoss) || 0));
  const safeShield = Math.max(0, Number(shield) || 0);
  const hpPercent = percentOf(safeValue, safeMax);
  const pendingStart = percentOf(safeValue - safePendingLoss, safeMax);
  const pendingPercent = percentOf(safePendingLoss, safeMax);
  const shieldPercent = Math.min(100 - hpPercent, percentOf(safeShield, safeMax));

  currentLayer.classList.toggle("enemy-hp", enemy);
  currentLayer.classList.toggle("hp", !enemy);
  currentLayer.style.left = "0%";
  currentLayer.style.width = `${hpPercent}%`;
  pendingLayer.style.left = `${pendingStart}%`;
  pendingLayer.style.width = `${pendingPercent}%`;
  shieldLayer.style.left = `${hpPercent}%`;
  shieldLayer.style.width = `${shieldPercent}%`;
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", String(safeMax));
  meter.setAttribute("aria-valuenow", String(safeValue));
  meter.setAttribute(
    "aria-valuetext",
    `${safeValue} / ${safeMax}${safeShield > 0 ? `，護盾 ${safeShield}` : ""}${safePendingLoss > 0 ? `，預計失去 ${safePendingLoss}` : ""}`
  );
}

function renderStatusSummary(els, hero) {
  els.currentAttackSummary.textContent = getHeroRuntimeAttack(hero);
  els.currentDefenseSummary.textContent = hero.defense ?? 0;
  els.currentCritSummary.textContent = `${Math.round(getHeroRuntimeCritChance(hero) * 100)}%`;
  els.currentBlessingSummary.textContent = Array.isArray(hero.blessings) ? hero.blessings.length : 0;
}

function renderStatusChips(element, statuses, emptyLabel) {
  element.replaceChildren();
  if (statuses.length === 0) {
    const chip = document.createElement("span");
    chip.className = "combat-status is-normal";
    chip.textContent = emptyLabel;
    element.append(chip);
    return;
  }
  statuses.forEach((status) => {
    const chip = document.createElement("span");
    chip.className = `combat-status ${status.className || ""}`.trim();
    chip.textContent = status.label;
    element.append(chip);
  });
}

function queueTargetVisibility(roster, card) {
  const detail = card.querySelector(".enemy-card-detail");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let settled = false;
  let fallbackTimer = null;

  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    if (fallbackTimer !== null) {
      window.clearTimeout(fallbackTimer);
    }
    detail?.removeEventListener("transitionend", onTransitionEnd);
    if (rosterTargetState.get(roster) === card.dataset.runtimeId) {
      alignCardWithinRoster(roster, card);
    }
  };
  const onTransitionEnd = (event) => {
    if (event.target === detail && event.propertyName === "max-height") {
      finish();
    }
  };

  if (reducedMotion || !detail) {
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
    return;
  }
  detail.addEventListener("transitionend", onTransitionEnd);
  fallbackTimer = window.setTimeout(finish, 460);
}

function alignCardWithinRoster(roster, card) {
  if (!roster.isConnected || !card.isConnected) {
    return;
  }
  const rosterRect = roster.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const padding = 4;
  if (cardRect.bottom > rosterRect.bottom - padding) {
    roster.scrollTop += cardRect.bottom - rosterRect.bottom + padding;
  } else if (cardRect.top < rosterRect.top + padding) {
    roster.scrollTop -= rosterRect.top - cardRect.top + padding;
  }
}

function percentOf(value, max) {
  return Math.max(0, Math.min(100, (Number(value) || 0) / Math.max(1, Number(max) || 1) * 100));
}
