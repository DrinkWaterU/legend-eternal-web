import { getLivingEnemies } from "./enemyGroups.js";

export const HIGHLAND_COLUMNS = ["左岩台", "中風道", "右岩台"];
const location = columns => columns.map(c => HIGHLAND_COLUMNS[c]).join("、");
export const isGroundAttack = i => ["strike", "slam", "sweep", "flurry", "charge"].includes(i?.kind);
export const attackColumns = i => i?.columns || (Number.isInteger(i?.column) ? [i.column] : []);

// Commit attack areas before the player acts. Moving the caster never retargets
// a committed ground attack; killing it cancels its attack in the controller.
export function buildHighlandIntents(state, turn, wind) {
  const heroColumn = state.hero.battleColumn;
  return getLivingEnemies(state.enemies).map(e => {
    const role = e.windRole || "hunter";
    const ground = (kind, columns, ratio = 1, friendly = false) => ({ id: e.runtimeId, kind, columns,
      attackRatio: ratio, friendly, text: `⚔ ${location(columns)}｜${kind === "flurry" ? "連打兩下" : "打這裡，不追人"}${friendly ? "，也會打到同伴" : ""}` });
    if (state.encounterIndex === 0 && state.battleSource === "main" && turn === 0) return ground("strike", [1]);
    if (["chime", "warden"].includes(role) && turn % (role === "warden" ? 4 : 3) === 0) {
      const direction = -(Math.sign(wind) || 1) * 2;
      return { id: e.runtimeId, kind: "gust", direction, text: `呼風：這回合不打，下回合往${direction > 0 ? "右" : "左"}吹兩格` };
    }
    if (role === "carrier" && e.stoneStock > 0 && turn % 4 === 0) {
      const column = [0, 2].find(c => state.highlandBattle.rocks[c] === 0);
      if (column !== undefined) return { id: e.runtimeId, kind: "build", column, text: `搬岩到${HIGHLAND_COLUMNS[column]}，這場只帶了一塊` };
    }
    if (["signal", "captain"].includes(role) && e.windRallies < 2 && turn % 3 === 1 && getLivingEnemies(state.enemies).length > 1)
      return { id: e.runtimeId, kind: "rally", text: `替同伴加攻防各2，還能用${2 - e.windRallies}次` };
    if (["guard", "captain"].includes(role) && turn % 3 === 0)
      return { id: e.runtimeId, kind: "anchor", text: "站穩護衛：不出手，也不被風吹走，保護同位置的隊友" };
    if ((role === "ram" && turn % 3 === 1) || (role === "veteran" && turn % 2 === 0)
      || (role === "boss" && turn % 3 !== 1) || (role === "warden" && turn % 4 === 2))
      return { id: e.runtimeId, kind: "charge", column: heroColumn, friendly: true, attackRatio: 1.5,
        text: `➜ 撞向${HIGHLAND_COLUMNS[heroColumn]}｜不追人，撞碎岩石，也會撞到同伴` };
    if (["storm", "warden"].includes(role) && turn % 4 === 1) return ground("flurry", [heroColumn, (heroColumn + 1) % 3], .65, true);
    if (["hunter", "hawk", "storm", "signal"].includes(role) && turn % 3 === 2) {
      const column = (heroColumn + 1) % 3;
      return { id: e.runtimeId, kind: "move", column, text: `側繞換位至${HIGHLAND_COLUMNS[column]}：本回合不攻擊` };
    }
    if ((role === "hawk" && turn % 3 === 1) || (role === "warden" && turn % 4 === 3))
      return { id: e.runtimeId, kind: "track", range: 2, text: "◎ 盯著你打｜會追人，換位置也躲不掉，可用守勢減傷" };
    if (role === "guard") return ground("strike", [1]);
    if (["veteran", "storm", "hawk"].includes(role)) return ground("sweep", [0, 2], .8, true);
    if (role === "boss") return ground("sweep", [1, turn % 2 ? 0 : 2], .8, true);
    if (["carrier", "captain"].includes(role)) return ground("slam", [turn % 3], 1.1, true);
    if (role === "chime") return ground("slam", [wind >= 0 ? 2 : 0], 1, true);
    if (role === "signal") return ground("strike", [(heroColumn + 1) % 3], .9);
    return ground("strike", [turn % 3 === 0 ? heroColumn : (heroColumn + 1) % 3]);
  });
}

export function projectedHighlandThreats(state, projected, intents) {
  const mine = projected[0];
  return intents.filter(i => {
    const actor = projected.find(p => p.unit.runtimeId === i.id && p.unit.hp > 0);
    if (!actor) return false;
    if (isGroundAttack(i)) return attackColumns(i).includes(mine.destination);
    return i.kind === "track" && Math.abs(actor.destination - mine.destination) <= i.range;
  });
}
