export const GOBLIN_ROUTE_ID = "goblin-camp";
export const COAST_CAVE_ROUTE_ID = "coast-cave";
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
    id: "beach-boss", category: "海灘", name: "潮汐巨蟹",
    description: "使用海灘正式首領場次與海灘 Blessing 取得時序。",
    kind: "regionBoss", regionId: "beach", supportsBuild: true
  }),
  Object.freeze({
    id: "beach-salt-dressing", category: "海灘", name: "鹽蝕・淡水藥布",
    description: "鹽霧水母固定施加鹽蝕，並自動裝備淡水藥布。",
    kind: "regionEnemy", regionId: "beach", encounterIndex: 9,
    enemyId: "salt-jellyfish", preparationId: "freshwater-dressing",
    enemyOverrides: Object.freeze({ saltErosionChance: 1, paralysisChance: 0 }),
    supportsBuild: true
  }),
  Object.freeze({
    id: "beach-paralysis-gloves", category: "海灘", name: "麻痺・絕緣皮套",
    description: "鹽霧水母固定施加麻痺，並自動裝備絕緣皮套。",
    kind: "regionEnemy", regionId: "beach", encounterIndex: 9,
    enemyId: "salt-jellyfish", preparationId: "insulated-gloves",
    enemyOverrides: Object.freeze({ saltErosionChance: 0, paralysisChance: 1 }),
    supportsBuild: true
  }),
  Object.freeze({
    id: "beach-multi-tether", category: "海灘", name: "敵群・礁釘繫索",
    description: "建立礁甲蟹與鹽霧水母雙敵人，並自動裝備礁釘繫索。",
    kind: "regionEnemyGroup", regionId: "beach", encounterIndex: 9,
    preparationId: "reef-anchor-tether",
    enemyEntries: Object.freeze([
      Object.freeze({ enemyId: "reef-crab", statScale: 0.9, attackScale: 1.55, rewardScale: 0.55 }),
      Object.freeze({ enemyId: "salt-jellyfish", statScale: 0.9, attackScale: 1.55, rewardScale: 0.55 })
    ]),
    enemyOverrides: Object.freeze({ saltErosionChance: 0, paralysisChance: 0 }),
    supportsBuild: true
  }),
  Object.freeze({
    id: "beach-camp-transition", category: "海灘", name: "Boss 後扎營・強化礁釘繫索",
    description: "建立海灘 16 場完整 Blessing，固定攜帶強化礁釘繫索，直接開啟正式扎營選擇與洞穴交接。",
    kind: "coastCampTransition", regionId: "beach", supportsBuild: true, defaultHpPercent: 50
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
  }),
  Object.freeze({
    id: "coast-cave-entry", category: "海岸洞穴", name: "洞穴第 1 場・入口伏擊",
    description: "完整建立海灘 16 場 Blessing、扎營保留 8 張與 50% HP，再直接進入洞穴第 1 場。",
    kind: "coastCaveEncounter", regionId: "beach", routeId: COAST_CAVE_ROUTE_ID,
    routeEncounterIndex: 0, supportsBuild: true, defaultHpPercent: 50
  }),
  Object.freeze({
    id: "coast-cave-event-rockspring", category: "海岸洞穴", name: "事件・岩縫清泉",
    description: "完整海灘與扎營前置後，下一次繼續前進固定觸發「岩縫清泉」。可用低 HP 驗證恢復與安全離開。",
    kind: "coastCaveEvent", regionId: "beach", routeId: COAST_CAVE_ROUTE_ID,
    routeEncounterIndex: 4, eventId: "cave-rockspring", supportsBuild: true, defaultHpPercent: 50
  }),
  Object.freeze({
    id: "coast-cave-event-carvings", category: "海岸洞穴", name: "事件・潮痕石陣",
    description: "完整海灘與扎營前置後，下一次繼續前進固定觸發「潮痕石陣」。低 HP 選讀取可驗證事件致死短路。",
    kind: "coastCaveEvent", regionId: "beach", routeId: COAST_CAVE_ROUTE_ID,
    routeEncounterIndex: 8, eventId: "cave-tide-carvings", supportsBuild: true, defaultHpPercent: 50
  }),
  Object.freeze({
    id: "coast-cave-elite-front", category: "海岸洞穴", name: "洞穴第 9 場・深潮精英",
    description: "完整海灘、扎營與洞穴前 8 場 Blessing 時序後，直接進入第一場精英。",
    kind: "coastCaveEncounter", regionId: "beach", routeId: COAST_CAVE_ROUTE_ID,
    routeEncounterIndex: 8, supportsBuild: true, defaultHpPercent: 50
  }),
  Object.freeze({
    id: "coast-cave-event-altar", category: "海岸洞穴", name: "事件・深潮石壇",
    description: "完整海灘與扎營前置後，下一次繼續前進固定觸發「深潮石壇」。可驗證稀有 Blessing、素材與事件致死。",
    kind: "coastCaveEvent", regionId: "beach", routeId: COAST_CAVE_ROUTE_ID,
    routeEncounterIndex: 12, eventId: "cave-deep-tide-altar", supportsBuild: true, defaultHpPercent: 50
  }),
  Object.freeze({
    id: "coast-cave-elite-deep", category: "海岸洞穴", name: "洞穴第 13 場・深窟精銳",
    description: "完整海灘、扎營與洞穴前 12 場 Blessing 時序後，直接進入第二場精英。",
    kind: "coastCaveEncounter", regionId: "beach", routeId: COAST_CAVE_ROUTE_ID,
    routeEncounterIndex: 12, supportsBuild: true, defaultHpPercent: 50
  }),
  Object.freeze({
    id: "coast-cave-tail", category: "海岸洞穴", name: "洞穴第 15 場・尾段獵隊",
    description: "完整海灘、扎營與洞穴前 14 場 Blessing 時序後，直接進入尾段壓力場。",
    kind: "coastCaveEncounter", regionId: "beach", routeId: COAST_CAVE_ROUTE_ID,
    routeEncounterIndex: 14, supportsBuild: true, defaultHpPercent: 50
  }),
  Object.freeze({
    id: "coast-cave-boss", category: "海岸洞穴", name: "洞穴第 16 場・深潮首領",
    description: "完整 32 場海岸流程的 Boss 壓力測試：海灘 16 場、扎營 8 張／50% HP、洞穴前 15 場。",
    kind: "coastCaveEncounter", regionId: "beach", routeId: COAST_CAVE_ROUTE_ID,
    routeEncounterIndex: 15, supportsBuild: true, defaultHpPercent: 50
  })
]);
