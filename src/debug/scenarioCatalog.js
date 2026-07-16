export const GOBLIN_ROUTE_ID = "goblin-camp";
export const GOBLIN_ROUTE_ENTRY_OPTIONS = Object.freeze([6, 7, 8]);
export const GOBLIN_MID_CHOICES = Object.freeze([
  Object.freeze({ id: "heal", label: "恢復 35% HP" }),
  Object.freeze({ id: "blessing", label: "搜刮額外 Blessing" })
]);
export const DEBUG_BUILD_PROFILES = Object.freeze([
  Object.freeze({ id: "mixed", label: "混合" }),
  Object.freeze({ id: "attack", label: "Attack" }),
  Object.freeze({ id: "crit", label: "Crit" }),
  Object.freeze({ id: "debuff", label: "Debuff" }),
  Object.freeze({ id: "healing", label: "Healing" }),
  Object.freeze({ id: "defense", label: "Defense" }),
  Object.freeze({ id: "empty", label: "空白" })
]);
export const MIXED_FLOW_ORDER = Object.freeze(["attack", "crit", "debuff", "healing", "defense"]);

export const DEBUG_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "plains-boss", category: "平原", name: "平原首領",
    description: "使用平原正式首領場次與平原 Blessing 取得時序。",
    kind: "regionBoss", regionId: "plains", supportsBuild: true
  }),
  Object.freeze({
    id: "plains-story", category: "平原", name: "平原星神劇情",
    description: "只測試星神劇情 presentation；完成後不解鎖鳳凰或修改正式存檔。",
    kind: "plainsStory", regionId: "plains", supportsBuild: false
  }),
  Object.freeze({
    id: "forest-campfire", category: "森林", name: "林間營火",
    description: "準備事件觸發前的森林安全狀態，按「繼續前進」進入林間營火。",
    kind: "forestCampfire", regionId: "forest", supportsBuild: true
  }),
  Object.freeze({
    id: "forest-boss-wood", category: "森林", name: "古木守衛",
    description: "使用森林正式首領場次與森林 Blessing 取得時序。",
    kind: "regionBoss", regionId: "forest", bossId: "ancient-wood-warden", supportsBuild: true
  }),
  Object.freeze({
    id: "forest-boss-stag", category: "森林", name: "翠影鹿王",
    description: "使用森林正式首領場次與森林 Blessing 取得時序。",
    kind: "regionBoss", regionId: "forest", bossId: "verdant-stag-king", supportsBuild: true
  }),
  Object.freeze({
    id: "core-multi-enemy", category: "核心測試", name: "多敵人基礎",
    description: "哥布林戰士 ×2；第二名套用 statScale 0.75 / rewardScale 0.5。",
    kind: "multiEnemy", regionId: "forest", supportsBuild: false
  }),
  Object.freeze({
    id: "goblin-route-start", category: "哥布林營地", name: "Route 第 1 場",
    description: "依 Route 進入時機建立森林前置 Build、林間營火獎勵，直接開始營地第 1 場。",
    kind: "goblinRouteEncounter", regionId: "forest", routeId: GOBLIN_ROUTE_ID,
    routeEncounterIndex: 0, supportsBuild: true, supportsRouteEntry: true
  }),
  Object.freeze({
    id: "goblin-mid-event", category: "哥布林營地", name: "第 4 場後補給",
    description: "視為已完成 Route 第 4 場並取得 Blessing；下一次繼續前進觸發「掠奪來的補給」。",
    kind: "goblinMidEvent", regionId: "forest", routeId: GOBLIN_ROUTE_ID,
    routeEncounterIndex: 4, supportsBuild: true, supportsRouteEntry: true
  }),
  Object.freeze({
    id: "goblin-after-mid", category: "哥布林營地", name: "Route 第 5 場",
    description: "略過補給 presentation，依指定中段選擇建立 Build 後直接開始第 5 場。",
    kind: "goblinRouteEncounter", regionId: "forest", routeId: GOBLIN_ROUTE_ID,
    routeEncounterIndex: 4, supportsBuild: true, supportsRouteEntry: true, supportsMidChoice: true
  }),
  Object.freeze({
    id: "goblin-boss", category: "哥布林營地", name: "血骨薩滿",
    description: "依正式森林前置、林間營火、Route Blessing 與中段選擇建立 Build，直接開始第 9 場 Boss group。",
    kind: "goblinRouteEncounter", regionId: "forest", routeId: GOBLIN_ROUTE_ID,
    routeEncounterIndex: 8, supportsBuild: true, supportsRouteEntry: true, supportsMidChoice: true
  }),
  Object.freeze({
    id: "goblin-ending", category: "哥布林營地", name: "弓箭手 Ending",
    description: "只測試四頁 Route Ending；不救援角色、不記通關、不解鎖成就。",
    kind: "goblinEnding", regionId: "forest", routeId: GOBLIN_ROUTE_ID, supportsBuild: false
  })
]);
