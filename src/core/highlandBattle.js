import { getWeaponDefinition } from "../data/weapons.js";
import { getLivingEnemies } from "./enemyGroups.js";

export const HIGHLAND_COLUMNS = ["左岩台", "中風道", "右岩台"];
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
  const tutorial = state.encounterIndex < 2 && state.battleSource === "main";
  return getLivingEnemies(state.enemies).map(e => {
    const role = e.windRole || "hunter";
    if (!tutorial && (role === "chime" || role === "warden") && turn % (role === "warden" ? 4 : 3) === 0) {
      const direction = -(Math.sign(windFor(state)) || 1) * 2;
      return { id: e.runtimeId, kind: "gust", direction, text: `蓄風：不攻擊，下回合改為${windLabel(direction)}（敵我共用）` };
    }
    if (!tutorial && role === "carrier" && e.stoneStock > 0 && turn % 4 === 0) {
      const column = [0, 2].find(col => state.highlandBattle.rocks[col] === 0);
      if (column !== undefined) return { id: e.runtimeId, kind: "build", column, text: `搬岩：移至${HIGHLAND_COLUMNS[column]}架設1耐久岩，本場僅一塊` };
    }
    if (!tutorial && ["signal", "captain"].includes(role) && e.windRallies < 2 && turn % 3 === 1 && getLivingEnemies(state.enemies).length > 1)
      return { id: e.runtimeId, kind: "rally", text: `結繩支援：其他隊友攻防+2，本場剩${2 - e.windRallies}次` };
    if (!tutorial && ["storm", "warden"].includes(role) && turn % 4 === 1)
      return { id: e.runtimeId, kind: "flurry", text: "鎖人物：兩段連斬，各65%攻擊，距離≤2" };
    if (!tutorial && ["guard", "captain"].includes(role) && turn % 3 === 0)
      return { id: e.runtimeId, kind: "anchor", text: "錨定護衛：本回合不攻擊，保護風後同欄隊友" };
    if (!tutorial && ((role === "ram" && turn % 3 === 1) || (role === "veteran" && turn % 2 === 0) || (role === "boss" && turn % 3 !== 1) || (role === "warden" && turn % 4 === 2)))
      return { id: e.runtimeId, kind: "charge", column: state.hero.battleColumn,
        text: `跨欄衝刺至${HIGHLAND_COLUMNS[state.hero.battleColumn]}：移至落點、毀岩、傷及同欄敵人` };
    if (!tutorial && ["hunter", "hawk", "storm", "signal"].includes(role) && turn % 3 === 2) {
      const column = (state.hero.battleColumn + 1) % 3;
      return { id: e.runtimeId, kind: "move", column, text: `側繞換位至${HIGHLAND_COLUMNS[column]}：本回合不攻擊` };
    }
    const range = ["signal", "hawk", "storm", "chime", "warden"].includes(role) ? 2 : 1;
    return { id: e.runtimeId, kind: "track", range, text: `鎖人物追蹤｜距離≤${range}，不及則靠近一步` };
  });
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

export function highlandActions(state) {
  if (!state.highlandBattle) return [];
  const list = [];
  if (state.hero.highlandNoRockLunge && !state.highlandBattle.rocks.some(Boolean)) list.push({ type: "lunge", label: "突進攻擊（先移至目標欄）" });
  for (let column = 0; column < 3; column++) {
    if (column !== state.hero.battleColumn) {
      list.push({ type: "move", column, label: `移至${HIGHLAND_COLUMNS[column]}` });
      if (state.hero.highlandRideAttack) list.push({ type: "ride", column, label: `借風移至${HIGHLAND_COLUMNS[column]}（不抵風）` });
      if (state.hero.highlandSlipToken && !state.highlandBattle.slipUsed) list.push({ type: "slip", column, label: `轉瞬移至${HIGHLAND_COLUMNS[column]}（本場一次，不耗回合）` });
    }
    if (state.highlandBattle.rocks[column] > 0 && Math.abs(column - state.hero.battleColumn) <= 1)
      { list.push({ type: "break", column, label: `拆除${HIGHLAND_COLUMNS[column]}岩石` });
        if (state.hero.highlandDemolish && !state.highlandBattle.demolishUsed)
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
  if (!afterAction && ["break", "demolish"].includes(action.type)) rocks[action.column] = 0;
  if (!afterAction && action.type === "tool-rock") rocks[action.column] = Math.min(3, rocks[action.column] + (state.runPreparation?.isEnhanced ? 2 : 1));
  return [h, ...getLivingEnemies(state.enemies)].map(unit => {
    const isHero = unit === h;
    const targetColumn = action.type === "lunge" ? state.enemies.find(e => e.runtimeId === state.targetEnemyId)?.battleColumn : undefined;
    const column = !afterAction && isHero && action.type === "lunge" ? targetColumn : !afterAction && isHero && ["move", "ride", "demolish", "slip", "tool-step"].includes(action.type) ? action.column : unit.battleColumn;
    const free = !afterAction && ["slip", "tool-step"].includes(action.type);
    const sheltered = wind > 0 ? column === 0 && rocks[0] > 0 : wind < 0 && column === 2 && rocks[2] > 0;
    const anchored = !isHero && intents.some(i => i.id === unit.runtimeId && i.kind === "anchor");
    const resist = isHero && ["guard", "move"].includes(action.type) ? 1 + (action.type === "guard" && h.highlandFirmStance ? 1 : 0) : 0;
    const weight = ["boss", "warden"].includes(unit.windRole) ? 1 : 0;
    const braced = isHero && (action.type === "tool-brace" || b.braceUntil >= state.turn + 1);
    const shift = free || sheltered || anchored || braced ? 0 : Math.sign(wind) * Math.max(0, Math.abs(wind) - resist - weight);
    return { unit, column, destination: clamp(column + shift), sheltered: !!sheltered && !!wind, stagger: !!shift && (column + shift < 0 || column + shift > 2) };
  });
}

export function actOnHighland(state, action, log) {
  const h = state.hero, b = state.highlandBattle;
  if (action.type.startsWith("tool-")) {
    state.runPreparation.remainingCharges--; state.runPreparation.triggerCount = (state.runPreparation.triggerCount || 0) + 1;
    if (action.type === "tool-brace") { b.braceUntil = state.turn + 1; log.fixed("status", "繩索固定：本回合與下回合不被風推移，沒有守勢減傷。"); }
    if (action.type === "tool-rock") { b.rocks[action.column] = Math.min(3, b.rocks[action.column] + (state.runPreparation.isEnhanced ? 2 : 1)); log.fixed("status", `你加固${HIGHLAND_COLUMNS[action.column]}岩石，耐久為${b.rocks[action.column]}；本回合敵人仍會行動。`); }
    if (action.type === "tool-step") { h.battleColumn = action.column; log.fixed("status", `你用踏釘移至${HIGHLAND_COLUMNS[action.column]}，不耗回合，也不重置敵意。`); }
  } else if (["move", "ride"].includes(action.type)) {
    h.battleColumn = action.column;
    if (h.highlandMoveShield && (b.moveShieldUses || 0) < 2) { h.shield += Math.min(12, h.highlandMoveShield); b.moveShieldUses = (b.moveShieldUses || 0) + 1; }
    if (action.type === "ride") grantHighlandOpportunity(h, "ride", h.highlandRideAttack);
    log.fixed("status", action.type === "ride" ? `你借風移至${HIGHLAND_COLUMNS[action.column]}，不抵風、不減傷，取得下一擊機會。` : `你移至${HIGHLAND_COLUMNS[action.column]}，本回合抵風一格，沒有守勢減傷。`);
  } else if (["break", "demolish"].includes(action.type)) {
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
  const projected = projectHighlandWind({ ...state, turn: state.turn - 1 }, { type: ["guard", "move"].includes(action.type) ? action.type : "attack" }, intents, w, true);
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
      if (h.highlandWindHeal && !b.windHealUsed) { h.hp = Math.min(h.maxHp, h.hp + h.highlandWindHeal); b.windHealUsed = true; }
    }
    if (unit.battleColumn !== col) log.fixed("status", `${unit.name}隨風移至${HIGHLAND_COLUMNS[unit.battleColumn]}。`);
  }
  for (const col of consumed) {
    b.rocks[col]--;
    log.fixed("status", `${HIGHLAND_COLUMNS[col]}岩石擋住整欄風壓，耐久剩 ${b.rocks[col]}。`);
    if (!b.rocks[col]) {
      b.terrainBreaks++;
      if (h.battleColumn === col && h.highlandRockShield) h.shield += Math.min(16, h.highlandRockShield);
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
  if (intent.kind === "flurry") return false;
  if (intent.kind === "move") { enemy.battleColumn = intent.column; log.fixed("status", `${enemy.name}移至${HIGHLAND_COLUMNS[intent.column]}。`); return true; }
  if (intent.kind === "track") {
    if (Math.abs(enemy.battleColumn - state.hero.battleColumn) <= intent.range) return false;
    enemy.battleColumn += Math.sign(state.hero.battleColumn - enemy.battleColumn);
    log.fixed("status", `${enemy.name}未能接近攻擊，改為向你靠攏。`);
    return true;
  }
  const col = intent.column, b = state.highlandBattle;
  enemy.battleColumn = col;
  if (b.rocks[col]) { b.rocks[col] = 0; b.terrainBreaks++; }
  const repositioned = ["move", "ride", "demolish", "lunge"].includes(action.type) || b.freeRepositionTurn === state.turn - 1
    || (action.type === "break" && action.column === b.actionOriginColumn);
  const playerInduced = repositioned && state.hero.battleColumn !== col;
  const collided = getLivingEnemies(state.enemies).filter(e => e !== enemy && e.battleColumn === col);
  if (playerInduced && collided.length) b.inducedCollisions = (b.inducedCollisions || 0) + 1;
  for (const e of collided) {
    const damage = Math.max(1, Math.round(enemy.attack * 1.2 - e.defense));
    e.hp = Math.max(0, e.hp - damage);
    if (e.hp <= 0) e.defeatOwner = playerInduced ? "hero" : "environment";
    log.fixed("enemy-damage", `${enemy.name}衝撞波及${e.name}，造成 ${damage} 點傷害。`);
  }
  if (state.hero.battleColumn !== col) { log.fixed("status", `${enemy.name}衝過你先前的落點，沒有命中你。`); return true; }
  return false;
}

function grantHighlandOpportunity(hero, source, amount) {
  if (!amount) return;
  hero.highlandOpportunities ||= {};
  hero.highlandOpportunities[source] = Math.min(16, amount);
}
