import { getWeaponDefinition } from "../data/weapons.js";
import { getLivingEnemies } from "./enemyGroups.js";

import { HIGHLAND_COLUMNS, buildHighlandIntents, isGroundAttack, attackColumns } from "./highlandTelegraphs.js";
export { HIGHLAND_COLUMNS } from "./highlandTelegraphs.js";
const patterns = [[1, 0, -1, 1, 0, -1], [-1, 0, 2, -2, 1, 0], [2, 0, -1, -2, 0, 1]];
const clamp = n => Math.max(0, Math.min(2, n));
export const windLabel = n => n ? `${n > 0 ? "→" : "←"} ${Math.abs(n)}格` : "無風";

export function startHighlandBattle(state) {
  state.highlandBattle = null;
  delete state.hero.battleColumn;
  if (state.selectedRegionId !== "highlands" || state.battleSource === "duel") return;
  const index = state.routeEncounterIndex || 0;
  const block = Math.min(2, Math.floor(index / 4));
  const path = state.highlandChoices?.[block * 4] || "shelter";
  state.highlandBattle = { rocks: index < 2 ? [1, 0, 0] : [2, 0, 2],
    pattern: path === "gale" ? (block === 0 ? patterns[1] : block === 1 ? [2, -1, -2, 0, 2, -1] : [-2, 1, 2, -1, 0, 2]) : patterns[block],
    path, terrainBreaks: 0, heroBreaks: 0, lastWind: null };
  // Freeze one visible opening variant at battle entry; resuming never rerolls it.
  const phase = index < 2 ? 0 : (Number(state.runRandomState) >>> 0) % state.highlandBattle.pattern.length;
  const pattern = state.highlandBattle.pattern;
  state.highlandBattle.pattern = [...pattern.slice(phase), ...pattern.slice(0, phase)];
  const terrain = state.hero.nextHighlandTerrain;
  if (terrain === "exposed") state.highlandBattle.rocks = [0, 0, 0];
  if (terrain === "reinforced") state.highlandBattle.rocks = [3, 0, 3];
  if (terrain === "draft") state.highlandBattle.pattern = [2, -2, 0, -1, 2, 0];
  state.hero.nextHighlandTerrain = null;
  state.hero.battleColumn = index < 2 ? 1 : 2;
  state.enemies.forEach((e, i) => {
    e.battleColumn = e.windRole === "guard" ? 0 : e.windRole === "signal" ? 2 : i % 3;
    e.formationId = null;
    delete e.chargeEvery; delete e.specialAttack;
    e.windStagger = false;
    e.stoneStock = e.windRole === "carrier" ? 1 : 0;
    e.windRallies = 0;
  });
  state.hero.windStagger = false;
  state.hero.highlandOpportunities = {};
  state.hero.highlandShelterPierceReady = false;
  lockHighlandIntents(state);
  updateHighlandProtection(state);
}

export function windFor(state, offset = 0) {
  const b = state.highlandBattle;
  if (!b) return 0;
  return b.windOverrides?.[state.turn + offset] ?? b.pattern[(state.turn + offset) % b.pattern.length];
}

export function highlandIntents(state, turn = state.turn, fresh = false) {
  if (!state.highlandBattle) return [];
  if (!fresh && state.highlandBattle.intentTurn === turn && Array.isArray(state.highlandBattle.intents))
    return state.highlandBattle.intents.filter(i => state.enemies.some(e => e.hp > 0 && e.runtimeId === i.id));
  return buildHighlandIntents(state, turn, windFor(state, turn - state.turn));
}

export function lockHighlandIntents(state) {
  if (!state.highlandBattle) return;
  state.highlandBattle.intents = highlandIntents(state, state.turn, true);
  state.highlandBattle.intentTurn = state.turn;
}

export function updateHighlandProtection(state, intents = highlandIntents(state)) {
  if (!state.highlandBattle) return;
  for (const e of state.enemies) e.formationId = null;
  for (const guard of getLivingEnemies(state.enemies).filter(e => intents.some(i => i.id === e.runtimeId && i.kind === "anchor"))) {
    for (const e of getLivingEnemies(state.enemies).filter(e => e.battleColumn === guard.battleColumn))
      e.formationId = `highland:${guard.runtimeId}`;
  }
}

export function canReachHighlandTarget(state, target, action = "attack") {
  if (!state.highlandBattle) return true;
  if (action === "lunge" && state.hero.highlandNoRockLunge && !state.highlandBattle.rocks.some(Boolean)) return !!target;
  const bow = getWeaponDefinition(state.hero.equipment?.weaponId)?.categoryId === "bow";
  return !!target && Math.abs(target.battleColumn - state.hero.battleColumn) <= (bow ? 2 : 1);
}

function shoveHitsChargingRock(state, action, intents) {
  return action.type === "shove" && state.highlandBattle.rocks[action.column] > 0
    && intents.some(i => i.id === state.targetEnemyId && i.kind === "charge");
}

export function highlandActions(state) {
  if (!state.highlandBattle) return [];
  const list = [];
  if (state.hero.highlandHold) list.push({ type: "hold", label: "扎穩守勢（不被風吹，減傷20%）" });
  const target = state.enemies.find(e => e.runtimeId === state.targetEnemyId && e.hp > 0);
  if (state.hero.highlandShove && target && Math.abs(target.battleColumn - state.hero.battleColumn) <= 1) {
    for (const column of [target.battleColumn - 1, target.battleColumn + 1].filter(c => c >= 0 && c <= 2))
      list.push({ type: "shove", column, label: `推敵到${HIGHLAND_COLUMNS[column]}` });
  }
  if (state.hero.highlandNoRockLunge && !state.highlandBattle.rocks.some(Boolean)) list.push({ type: "lunge", label: "突進攻擊（先移至目標欄）" });
  for (let column = 0; column < 3; column++) {
    if (column !== state.hero.battleColumn) {
      list.push({ type: "move", column, label: `移至${HIGHLAND_COLUMNS[column]}` });
      if (state.hero.highlandRideAttack) list.push({ type: "ride", column, label: `借風移至${HIGHLAND_COLUMNS[column]}（不抵風）` });
      if (state.hero.highlandSlipToken && !state.highlandBattle.slipUsed) list.push({ type: "slip", column, label: `轉瞬移至${HIGHLAND_COLUMNS[column]}（本場一次，不耗回合）` });
    }
    if (state.highlandBattle.rocks[column] > 0 && Math.abs(column - state.hero.battleColumn) <= 1)
      { list.push({ type: "break", column, label: `拆除${HIGHLAND_COLUMNS[column]}岩石` });
        if (state.hero.highlandShatterGust && Math.abs(windFor(state)) === 1) list.push({ type: "gust-break", column, label: "破岩放風（本回合風力變兩格）" });
        if (state.hero.highlandDemolish && !state.highlandBattle.demolishUsed && column !== state.hero.battleColumn)
          list.push({ type: "demolish", column, label: `破岩突入${HIGHLAND_COLUMNS[column]}（本場一次）` });
      }
  }
  const prep = state.runPreparation;
  if (prep?.effect?.type === "highlandTool" && prep.remainingCharges > 0) {
    if (prep.effect.tool === "brace") list.push({ type: "tool-brace", label: `繩索固定（剩${prep.remainingCharges}次）` });
    for (let column = 0; column < 3; column++) {
      if (prep.effect.tool === "step" && column !== state.hero.battleColumn) list.push({ type: "tool-step", column, label: `踏釘移至${HIGHLAND_COLUMNS[column]}（不耗回合，剩${prep.remainingCharges}次）` });
      if (prep.effect.tool === "rock" && state.highlandBattle.rocks[column] > 0 && state.highlandBattle.rocks[column] < 3 && Math.abs(column - state.hero.battleColumn) <= 1)
        list.push({ type: "tool-rock", column, label: `加固${HIGHLAND_COLUMNS[column]}（剩${prep.remainingCharges}次）` });
    }
  }
  return list;
}

// Projection stops before enemy actions. It shares the exact displacement rule
// with resolution and never consumes rocks, charges, healing or random numbers.
export function projectHighlandWind(state, action = { type: "attack" }, intents = highlandIntents(state), wind = windFor(state), afterAction = false) {
  if (!state.highlandBattle) return [];
  const h = state.hero, b = state.highlandBattle, rocks = [...b.rocks];
  if (!afterAction && ["break", "demolish", "gust-break"].includes(action.type)) rocks[action.column] = 0;
  if (!afterAction && shoveHitsChargingRock(state, action, intents)) rocks[action.column] = 0;
  if (!afterAction && action.type === "gust-break") wind = Math.sign(wind) * 2;
  if (!afterAction && action.type === "tool-rock") rocks[action.column] = Math.min(3, rocks[action.column] + (state.runPreparation?.isEnhanced ? 2 : 1));
  return [h, ...getLivingEnemies(state.enemies)].map(unit => {
    const isHero = unit === h;
    const targetColumn = action.type === "lunge" ? state.enemies.find(e => e.runtimeId === state.targetEnemyId)?.battleColumn : undefined;
    const column = !afterAction && action.type === "shove" && unit.runtimeId === state.targetEnemyId ? action.column
      : !afterAction && isHero && action.type === "lunge" ? targetColumn : !afterAction && isHero && ["move", "ride", "demolish", "slip", "tool-step"].includes(action.type) ? action.column : unit.battleColumn;
    const free = !afterAction && ["slip", "tool-step"].includes(action.type);
    const sheltered = wind > 0 ? column === 0 && rocks[0] > 0 : wind < 0 && column === 2 && rocks[2] > 0;
    const anchored = !isHero && intents.some(i => i.id === unit.runtimeId && i.kind === "anchor");
    const resist = isHero && ["guard", "move"].includes(action.type) ? 1 : 0;
    const weight = ["boss", "warden"].includes(unit.windRole) ? 1 : 0;
    const braced = isHero && (["tool-brace", "hold"].includes(action.type) || b.braceUntil >= state.turn + 1);
    const shift = free || sheltered || anchored || braced ? 0 : Math.sign(wind) * Math.max(0, Math.abs(wind) - resist - weight);
    return { unit, column, destination: clamp(column + shift), sheltered: !!sheltered && !!wind, stagger: !!shift && (column + shift < 0 || column + shift > 2) };
  });
}

export function actOnHighland(state, action, log) {
  const h = state.hero, b = state.highlandBattle;
  if (action.type === "shove") {
    const target = state.enemies.find(e => e.runtimeId === state.targetEnemyId && e.hp > 0);
    target.battleColumn = action.column; b.forcedEnemyTurn = state.turn; b.forcedEnemyId = target.runtimeId;
    if (shoveHitsChargingRock(state, action, b.intents || [])) {
      b.rocks[action.column] = 0; b.terrainBreaks++;
      b.interruptedEnemyId = target.runtimeId; b.interruptedEnemyTurn = state.turn;
      log.fixed("status", `${target.name}撞碎了整塊擋風岩，這次衝撞被打斷了；岩石也沒了。`);
    }
    log.fixed("status", `你把${target.name}推到${HIGHLAND_COLUMNS[action.column]}，接著還會被風吹動。`);
  } else if (action.type.startsWith("tool-")) {
    state.runPreparation.remainingCharges--; state.runPreparation.triggerCount = (state.runPreparation.triggerCount || 0) + 1;
    if (action.type === "tool-brace") { b.braceUntil = state.turn + 1; log.fixed("status", "繩索固定：本回合與下回合不被風推移，沒有守勢減傷。"); }
    if (action.type === "tool-rock") { b.rocks[action.column] = Math.min(3, b.rocks[action.column] + (state.runPreparation.isEnhanced ? 2 : 1)); log.fixed("status", `你加固${HIGHLAND_COLUMNS[action.column]}岩石，耐久為${b.rocks[action.column]}；本回合敵人仍會行動。`); }
    if (action.type === "tool-step") { h.battleColumn = action.column; log.fixed("status", `你用踏釘移至${HIGHLAND_COLUMNS[action.column]}，不耗回合，也不重置敵意。`); }
  } else if (["move", "ride"].includes(action.type)) {
    h.battleColumn = action.column;
    if (h.highlandMoveShield && (b.moveShieldUses || 0) < 2) { h.shield += Math.min(12, h.highlandMoveShield); b.moveShieldUses = (b.moveShieldUses || 0) + 1; }
    if (action.type === "ride") grantHighlandOpportunity(h, "ride", h.highlandRideAttack);
    log.fixed("status", action.type === "ride" ? `你借風移至${HIGHLAND_COLUMNS[action.column]}，不抵風、不減傷，取得下一擊機會。` : `你移至${HIGHLAND_COLUMNS[action.column]}，本回合抵風一格，沒有守勢減傷。`);
  } else if (["break", "demolish", "gust-break"].includes(action.type)) {
    if (action.type === "gust-break") b.windOverrides = { ...(b.windOverrides || {}), [state.turn - 1]: Math.sign(windFor(state, -1)) * 2 };
    b.rocks[action.column] = 0; b.terrainBreaks++; b.heroBreaks++;
    if (h.highlandBreakAttack) grantHighlandOpportunity(h, "break", h.highlandBreakAttack);
    if (action.type === "demolish") { h.battleColumn = action.column; b.demolishUsed = true; }
    log.fixed("status", `你拆掉${HIGHLAND_COLUMNS[action.column]}整塊岩石，敵我都失去此處遮蔽。`);
  }
}

// All shelter checks use the same pre-pulse columns and rocks. Entering another
// column mid-pulse never grants shelter; a shared rock loses durability once.
export function resolveHighlandWind(state, action, intents, log) {
  const b = state.highlandBattle;
  if (!b) return;
  const w = windFor(state, -1);
  b.lastWind = w;
  const consumed = new Set(), h = state.hero;
  const projected = projectHighlandWind({ ...state, turn: state.turn - 1 }, { type: ["guard", "move", "hold"].includes(action.type) ? action.type : "attack" }, intents, w, true);
  b.changedWindEnemyIds = projected.filter(p => p.unit !== h && b.baselineWind && b.baselineWind[p.unit.runtimeId] !== p.destination).map(p => p.unit.runtimeId);
  for (const { unit, column: col, sheltered, destination, stagger } of projected) {
    if (sheltered && w) {
      consumed.add(col);
      if (unit === h) {
        if (h.highlandShelterPierce) h.highlandShelterPierceReady = true;
        if (h.highlandShelterHeal && (b.shelterHealUses || 0) < 2) { h.hp = Math.min(h.maxHp, h.hp + Math.min(16, h.highlandShelterHeal)); b.shelterHealUses = (b.shelterHealUses || 0) + 1; }
      }
    }
    if (stagger) unit.windStagger = true;
    unit.battleColumn = destination;
    if (unit === h && unit.battleColumn !== col) {
      grantHighlandOpportunity(h, "wind", h.highlandWindAttack);
    }
    if (unit.battleColumn !== col) log.fixed("status", `${unit.name}隨風移至${HIGHLAND_COLUMNS[unit.battleColumn]}。`);
  }
  for (const col of consumed) {
    b.rocks[col]--;
    log.fixed("status", `${HIGHLAND_COLUMNS[col]}岩石擋住整欄風壓，耐久剩 ${b.rocks[col]}。`);
    if (!b.rocks[col]) {
      b.terrainBreaks++;
    }
  }
  if (action.type === "guard" && w && h.highlandGuardShield && !b.guardShieldUsed) {
    h.shield += Math.min(12, h.highlandGuardShield); b.guardShieldUsed = true;
  }
  updateHighlandProtection(state, intents);
}

// Returns whether this intent replaces the ordinary enemy action. Environment
// collateral never invokes character incoming-hit callbacks or finisher healing.
export function resolveHighlandEnemyIntent(state, enemy, intent, action, log) {
  if (!state.highlandBattle || !intent) return false;
  if (state.highlandBattle.interruptedEnemyTurn === state.turn && state.highlandBattle.interruptedEnemyId === enemy.runtimeId) return true;
  if (intent.kind === "anchor") return true;
  if (intent.kind === "gust") {
    state.highlandBattle.windOverrides = { ...(state.highlandBattle.windOverrides || {}), [state.turn]: intent.direction };
    log.fixed("status", `${enemy.name}改變風道，下回合${windLabel(intent.direction)}，敵我都會被推動。`); return true;
  }
  if (intent.kind === "build") {
    enemy.battleColumn = intent.column; enemy.stoneStock = 0;
    state.highlandBattle.rocks[intent.column] = Math.max(1, state.highlandBattle.rocks[intent.column]);
    log.fixed("status", `${enemy.name}用完攜帶的岩石，架好一塊1耐久的共用擋風岩。`); return true;
  }
  if (intent.kind === "rally") {
    enemy.windRallies++;
    for (const ally of getLivingEnemies(state.enemies).filter(e => e !== enemy)) {
      ally.attack += 2; ally.defense += 2;
      ally.supportAttackBonus = (ally.supportAttackBonus || 0) + 2;
      ally.supportDefenseBonus = (ally.supportDefenseBonus || 0) + 2;
    }
    log.fixed("status", `${enemy.name}替隊友加固石甲，攻防各提高2；本場最多兩次。`); return true;
  }
  if (intent.kind === "move") { enemy.battleColumn = intent.column; log.fixed("status", `${enemy.name}移至${HIGHLAND_COLUMNS[intent.column]}。`); return true; }
  if (intent.kind === "track") {
    if (Math.abs(enemy.battleColumn - state.hero.battleColumn) <= intent.range) return false;
    enemy.battleColumn += Math.sign(state.hero.battleColumn - enemy.battleColumn);
    log.fixed("status", `${enemy.name}未能接近攻擊，改為向你靠攏。`);
    return true;
  }
  if (!isGroundAttack(intent)) return true;
  const b = state.highlandBattle, columns = attackColumns(intent);
  if (intent.kind === "charge") {
    enemy.battleColumn = intent.column;
    if (b.rocks[intent.column]) { b.rocks[intent.column] = 0; b.terrainBreaks++; }
  }
  const moved = ["move", "ride", "demolish", "lunge", "gust-break"].includes(action.type) || b.freeRepositionTurn === state.turn - 1;
  const collided = getLivingEnemies(state.enemies).filter(e => e !== enemy && columns.includes(e.battleColumn));
  let induced = false;
  if (intent.friendly) for (const e of collided) {
    const forced = b.forcedEnemyTurn === state.turn && b.forcedEnemyId === e.runtimeId;
    const changedWind = ["break", "gust-break"].includes(action.type) && b.changedWindEnemyIds?.includes(e.runtimeId);
    const origin = b.freeRepositionTurn === state.turn - 1 ? b.freeRepositionOrigin : b.actionOriginColumn;
    const baitedCharge = intent.kind === "charge" && columns.includes(origin)
      && (moved || ["break", "gust-break"].includes(action.type)) && !columns.includes(state.hero.battleColumn);
    const playerInduced = forced || changedWind || baitedCharge;
    induced ||= playerInduced;
    const hits = intent.kind === "flurry" ? 2 : 1;
    const ratio = intent.kind === "charge" ? 1.2 : intent.attackRatio || 1;
    const damage = hits * Math.max(1, Math.round(enemy.attack * ratio - e.defense));
    e.hp = Math.max(0, e.hp - damage);
    if (e.hp <= 0) e.defeatOwner = playerInduced ? "hero" : "environment";
    log.fixed("enemy-damage", `${enemy.name}的攻擊波及${e.name}，造成 ${damage} 點傷害。`);
  }
  if (induced) b.inducedCollisions = (b.inducedCollisions || 0) + 1;
  if (!columns.includes(state.hero.battleColumn)) {
    b.avoidedAttacks = (b.avoidedAttacks || 0) + 1;
    log.fixed("status", `${enemy.name}打向${columns.map(c => HIGHLAND_COLUMNS[c]).join("、")}，你已不在那裡，這一下打空了。`);
    return true;
  }
  return false;
}

function grantHighlandOpportunity(hero, source, amount) {
  if (!amount) return;
  hero.highlandOpportunities ||= {};
  hero.highlandOpportunities[source] = Math.min(16, amount);
}
