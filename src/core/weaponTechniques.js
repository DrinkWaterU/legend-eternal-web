import { getWeaponDefinition } from "../data/weapons.js";
import { getHeroEffectiveAttack } from "./heroCombat.js";
import { applyEnemyDamageProtection } from "./enemyProtection.js";

export function getWeaponTechnique(hero) {
  const effect = getWeaponDefinition(hero?.equipment?.weaponId)?.specialEffect;
  return effect?.type === "weaponTechnique" ? effect.technique : null;
}

export function isSwiftRiposte(hero) {
  return getWeaponTechnique(hero) === "riposte" && hero?.equipment?.trainingMode === "swift";
}

export function resetWeaponTechnique(hero) {
  hero.weaponRuntime = { charge: 0, weight: 0, impact: 0, riposte: false, riposteFromStandardGuard: false, targetId: null, chain: 0 };
}

export function getWeaponActions(hero) {
  const kind = getWeaponTechnique(hero), r = hero?.weaponRuntime;
  if (!r) return [];
  if (kind === "charge" && !r.charge) return [{ type: "charge", label: "蓄射（放棄本回合攻擊）" }];
  if (kind === "breach" && r.impact > 0) return [
    { type: "breach", label: `破勢（消耗衝擊 ${r.impact}）` },
    ...(r.impact === 3 && hero.equipment?.hammerTechniqueUnlocked === true && hero.activeEnemyCount >= 2
      ? [{ type: "breach-wave", label: "震岩裂陣（耗盡3層）" }]
      : [])
  ];
  if (kind === "weight" && r.weight >= 2) return [
    { type: "sweep", label: `橫掃（全耗重量 ${r.weight}）` },
    ...(r.weight === 4 ? [{ type: "cleave", label: "重劈（全耗重量 4）" }] : [])
  ];
  return [];
}

export function getWeaponStatus(hero) {
  const r = hero?.weaponRuntime, kind = getWeaponTechnique(hero);
  if (!r || !kind) return "";
  return kind === "charge" ? r.charge ? `蓄射就緒｜剩 ${r.charge} 回合` : "可蓄射：攻擊命中後穿透"
    : kind === "weight" ? `重量 ${r.weight}/4｜2層可掃，4層可重劈`
    : kind === "breach" ? r.impact === 3 && hero.equipment?.hammerTechniqueUnlocked === true && hero.activeEnemyCount >= 2
      ? "衝擊 3/3｜破勢強化目標；裂陣震擊其他存活敵人"
      : `衝擊 ${r.impact}/3｜可主動破勢`
    : kind === "riposte" ? r.riposte ? isSwiftRiposte(hero) ? "冒險反攻就緒｜本回合攻擊時追加傷害" : "反攻就緒｜下一次攻擊追加傷害" : isSwiftRiposte(hero) ? "普通守勢減輕直接傷害後，下一回合可反攻" : "成功守勢可取得一次反攻"
    : `連斬 ${r.chain}/3｜換活目標突襲會放棄連斬`;
}

// Weapon resources are updated once per committed action, never per follow-up.
// Secondary packets have no attack callbacks and cannot start another action.
export function runWeaponAttack({ state, action, target, log, runAttack }) {
  const h = state.hero, kind = getWeaponTechnique(h);
  if (!h.weaponRuntime) resetWeaponTechnique(h);
  const r = h.weaponRuntime, alive = state.enemies.filter(e => e.hp > 0);
  const power = getHeroEffectiveAttack(h), charge = r.charge, weight = r.weight, impact = r.impact;
  const counter = r.riposte;
  const riposteFromStandardGuard = r.riposteFromStandardGuard === true;
  const terrainBonus = (target.windStagger ? 8 + Math.min(12, Number(h.highlandBorderAttack) || 0) : 0) + Object.values(h.highlandOpportunities || {}).reduce((sum, n) => sum + n, 0);
  target.windStagger = false; h.highlandOpportunities = {};
  h.highlandShelterPierceActive = !!h.highlandShelterPierceReady;
  h.highlandShelterPierceReady = false;
  const previousAlive = alive.some(e => e.runtimeId === r.targetId);
  const switched = previousAlive && r.targetId !== target.runtimeId;
  if (charge) r.charge = 0;
  if (action === "sweep" || action === "cleave") r.weight = 0;
  if (action === "breach" || action === "breach-wave") r.impact = 0;
  if (counter) {
    r.riposte = false;
    r.riposteFromStandardGuard = false;
  }
  let primary = null;
  const oldHooks = h.battleHooks;
  h.battleHooks = { ...oldHooks, onDirectAttackResolved(result) {
    oldHooks?.onDirectAttackResolved?.(result);
    if (result.source !== "characterFollowUp" && result.source !== "followUp" && !primary) primary = result;
  } };
  try { runAttack(); } finally { delete h.highlandShelterPierceActive; if (oldHooks) h.battleHooks = oldHooks; else delete h.battleHooks; }
  if (kind === "weight" && ["attack", "lunge"].includes(action)) r.weight = Math.min(4, r.weight + 1);
  if (!primary || primary.enemy.runtimeId !== target.runtimeId) return { primaryHit: false, targetId: target.runtimeId };
  const packet = (enemy, amount, label, fixed = false) => {
    if (enemy.hp <= 0) return 0;
    const raw = Math.max(1, Math.round(amount - (fixed ? 0 : Number(enemy.defense) || 0)));
    const damage = applyEnemyDamageProtection({ enemy, enemies: state.enemies, damage: raw }).damage;
    const actual = Math.min(enemy.hp, damage); enemy.hp -= actual;
    log.fixed("hero-damage", `${label}命中${enemy.displayName || enemy.name}，造成 ${actual} 點傷害。`);
    return actual;
  };
  if (terrainBonus) packet(target, terrainBonus, "借勢破綻", true);
  const riposteDamage = kind === "riposte" && counter && !primary.dodged && Number(primary.damage) > 0
    ? packet(target, power * (isSwiftRiposte(h) ? 1.1 : .7) + 4, isSwiftRiposte(h) ? "冒險反攻" : "架勢反攻")
    : 0;
  if (kind === "charge" && charge) {
    if (alive.length === 1) packet(target, power * 1.1, "蓄射追加・集中餘力");
    else {
      packet(target, power * .8, "蓄射追加");
      alive.filter(e => e.runtimeId !== target.runtimeId).forEach(e => packet(e, power * .5, "穿風箭"));
    }
  }
  if (kind === "weight" && action === "sweep") alive.forEach(e => packet(e, power * weight * .35, "斧勢橫掃"));
  if (kind === "weight" && action === "cleave") packet(target, power * 1.5, "斧勢重劈");
  if (kind === "breach") {
    if (["attack", "lunge"].includes(action) && !primary.dodged && Number(primary.damage) > 0) {
      r.impact = Math.min(3, r.impact + 1);
    }
    if (action === "breach" && !target.weaponBreach && state.turn > (target.breachCooldownUntil || -1)) {
      packet(target, power * impact * .2, "震岩破勢");
      if (target.hp > 0) target.weaponBreach = { charges: impact === 3 ? 2 : 1, until: state.turn + (impact === 3 ? 3 : 2), strength: impact };
    }
    if (action === "breach-wave" && !primary.dodged && Number(primary.damage) > 0) {
      let hitCount = 0;
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || enemy.runtimeId === target.runtimeId) continue;
        packet(enemy, power * 1.0, "震岩裂陣");
        hitCount++;
      }
      if (!hitCount) log.fixed("status", "沒有其他存活敵人，裂陣沒有造成範圍傷害。");
    }
  }
  if (kind === "feint") {
    r.chain = switched || r.targetId !== target.runtimeId ? 1 : r.chain + 1;
    if (switched) packet(target, power * .45, "換手突襲");
    else if (r.chain >= 3) { packet(target, power * .9, "三連收割"); r.chain = 0; }
    r.targetId = target.runtimeId;
  }
  if (target.weaponBreach && action !== "breach") {
    target.weaponBreach.charges--;
    if (target.weaponBreach.charges <= 0) { target.weaponBreach = null; target.breachCooldownUntil = state.turn + 1; }
  }
  return {
    primaryHit: !primary.dodged && Number(primary.damage) > 0,
    targetId: primary.enemy.runtimeId,
    source: primary.source,
    riposteDamage,
    riposteFromStandardGuard: counter && riposteFromStandardGuard
  };
}

export function finishWeaponTurn(state, playerAction = state.lastPlayerAction) {
  const h = state.hero;
  if (h.weaponRuntime?.charge > 0) h.weaponRuntime.charge--;
  if (getWeaponTechnique(h) === "riposte") {
    if (isSwiftRiposte(h)) {
      if (playerAction === "guard" && h.guardState?.preventedDamage > 0) {
        h.weaponRuntime.riposte = true;
        h.weaponRuntime.riposteFromStandardGuard = true;
        h.weaponRuntime.riposteUntil = state.turn + 1;
      } else if (h.weaponRuntime.riposte && state.turn >= h.weaponRuntime.riposteUntil) {
        h.weaponRuntime.riposte = false;
        h.weaponRuntime.riposteFromStandardGuard = false;
      }
    } else if (h.guardState?.preventedDamage > 0) {
      h.weaponRuntime.riposte = true;
      h.weaponRuntime.riposteFromStandardGuard = playerAction === "guard";
    }
  }
  for (const e of state.enemies) if (e.weaponBreach && e.weaponBreach.until <= state.turn) {
    e.weaponBreach = null; e.breachCooldownUntil = state.turn + 1;
  }
}
