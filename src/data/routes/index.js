import { getBlessingPool } from "../blessings/index.js";
import { getEnemyDefinition } from "../enemies/index.js";
import { musicDefinitions } from "../music.js";
import { regionDefinitions } from "../regions/index.js";
import { ROUTE_ENDING_ROLES, ROUTE_ENDING_TONES } from "./endingSemantics.js";
import goblinCampData from "./goblinCamp.json" with { type: "json" };

const routeDataFiles = [goblinCampData];

export const routeDefinitions = buildRouteRegistry(routeDataFiles);

export function getRouteDefinition(routeId) {
  return routeDefinitions[routeId] || null;
}

export function getRouteGroup(route, groupId) {
  return (route?.groups || []).find((group) => group.id === groupId) || null;
}

function buildRouteRegistry(routes) {
  const registry = {};
  routes.forEach((route) => {
    validateRouteDefinition(route, registry);
    registry[route.id] = route;
  });
  return Object.freeze(registry);
}

function validateRouteDefinition(route, registry) {
  const id = String(route?.id || "").trim();
  if (!id) throw new Error("Route definition 缺少 id。");
  if (registry[id]) throw new Error(`Route id 重複：${id}`);
  if (!regionDefinitions[route.regionId]) throw new Error(`Route ${id} 找不到 regionId：${route.regionId}`);
  if (!String(route.clearSourceId || "").trim()) throw new Error(`Route ${id} 缺少 clearSourceId。`);
  if (!getBlessingPool(route.blessingPoolId)) throw new Error(`Route ${id} 找不到 Blessing Pool：${route.blessingPoolId}`);

  const groups = new Map();
  (route.groups || []).forEach((group) => {
    if (!group?.id) throw new Error(`Route ${id} group 缺少 id。`);
    if (groups.has(group.id)) throw new Error(`Route ${id} group id 重複：${group.id}`);
    if (!Array.isArray(group.members) || group.members.length === 0) throw new Error(`Route ${id} group ${group.id} 沒有 members。`);
    group.members.forEach((member) => {
      if (!getEnemyDefinition(member.enemyId)) throw new Error(`Route ${id} group ${group.id} 找不到 enemyId：${member.enemyId}`);
      if (!(Number(member.statScale) > 0)) throw new Error(`Route ${id} group ${group.id} statScale 必須 > 0。`);
      if (!Number.isFinite(Number(member.rewardScale)) || Number(member.rewardScale) < 0) {
        throw new Error(`Route ${id} group ${group.id} 必須明寫非負 rewardScale。`);
      }
    });
    groups.set(group.id, group);
  });

  if (!Array.isArray(route.encounterPlan) || route.encounterPlan.length === 0) throw new Error(`Route ${id} encounterPlan 不可為空。`);
  route.encounterPlan.forEach((entry) => {
    if (!groups.has(entry?.groupId)) throw new Error(`Route ${id} encounterPlan 找不到 groupId：${entry?.groupId}`);
  });

  validateRouteEvents(route);
  validateRouteEnding(route, "ending");
  validateRouteEnding(route, "repeatEnding");

  const finalEncounter = route.encounterPlan.at(-1);
  const finalGroup = groups.get(finalEncounter.groupId);
  if (finalEncounter?.type !== "boss" || !finalGroup.members.some((member) => getEnemyDefinition(member.enemyId)?.kind === "首領")) {
    throw new Error(`Route ${id} 最終 encounter 必須是含首領的 boss group。`);
  }

  const trackId = String(route.audio?.bgmId || "").trim();
  if (!trackId) throw new Error(`Route ${id} 缺少 BGM id。`);
  if (!musicDefinitions[trackId]) throw new Error(`Route ${id} 找不到 BGM definition：${trackId}`);

  const counterEnemyIds = Array.isArray(route.counterEnemyIds) ? route.counterEnemyIds : [];
  if (counterEnemyIds.length === 0) throw new Error(`Route ${id} counterEnemyIds 不可為空。`);
  counterEnemyIds.forEach((enemyId) => {
    if (!getEnemyDefinition(enemyId)) throw new Error(`Route ${id} counterEnemyIds 找不到 enemyId：${enemyId}`);
  });

  (route.visual?.backgroundStages || []).forEach((stage) => {
    const from = Number(stage.fromEncounter);
    const to = Number(stage.toEncounter);
    if (!(from >= 1 && to >= from && to <= route.encounterPlan.length)) {
      throw new Error(`Route ${id} background stage 範圍無效：${stage.id || "(empty)"}`);
    }
  });
}
function validateRouteEnding(route, endingKey) {
  const ending = route?.[endingKey];
  if (!ending) {
    return;
  }

  const routeId = route.id;
  if (!String(ending.title || "").trim()) {
    throw new Error(`Route ${routeId} ${endingKey} 缺少 title。`);
  }
  if (!Array.isArray(ending.pages) || ending.pages.length === 0) {
    throw new Error(`Route ${routeId} ${endingKey}.pages 不可為空。`);
  }

  ending.pages.forEach((page, pageIndex) => {
    if (!ROUTE_ENDING_TONES.includes(page?.tone)) {
      throw new Error(`Route ${routeId} ${endingKey} 第 ${pageIndex + 1} 頁 tone 無效：${page?.tone || "(empty)"}`);
    }
    if (!Array.isArray(page.lines) || page.lines.length === 0) {
      throw new Error(`Route ${routeId} ${endingKey} 第 ${pageIndex + 1} 頁 lines 不可為空。`);
    }
    page.lines.forEach((line, lineIndex) => {
      if (!ROUTE_ENDING_ROLES.includes(line?.role)) {
        throw new Error(`Route ${routeId} ${endingKey} 第 ${pageIndex + 1} 頁第 ${lineIndex + 1} 行 role 無效：${line?.role || "(empty)"}`);
      }
      if (!String(line?.text || "").trim()) {
        throw new Error(`Route ${routeId} ${endingKey} 第 ${pageIndex + 1} 頁第 ${lineIndex + 1} 行缺少 text。`);
      }
    });
  });
}

function validateRouteEvents(route) {
  const routeId = route.id;
  const definitions = new Map();
  (route.eventDefinitions || []).forEach((event) => {
    const eventId = String(event?.id || "").trim();
    if (!eventId) throw new Error(`Route ${routeId} event definition 缺少 id。`);
    if (definitions.has(eventId)) throw new Error(`Route ${routeId} event id 重複：${eventId}`);
    if (!Array.isArray(event.choices) || event.choices.length === 0) {
      throw new Error(`Route ${routeId} event ${eventId} 沒有 choices。`);
    }
    const choiceIds = new Set();
    event.choices.forEach((choice) => {
      const choiceId = String(choice?.id || "").trim();
      if (!choiceId) throw new Error(`Route ${routeId} event ${eventId} choice 缺少 id。`);
      if (choiceIds.has(choiceId)) throw new Error(`Route ${routeId} event ${eventId} choice id 重複：${choiceId}`);
      choiceIds.add(choiceId);
      validateRouteEventTarget(routeId, eventId, choice.result?.defaultTarget);
      (choice.result?.followUpChoices || []).forEach((followUp) => {
        validateRouteEventTarget(routeId, eventId, followUp?.target);
      });
    });
    definitions.set(eventId, event);
  });

  const config = route.events;
  if (!config) {
    return;
  }
  const scheduleChance = Number(config.scheduleChance);
  if (!(scheduleChance >= 0 && scheduleChance <= 1)) {
    throw new Error(`Route ${routeId} events.scheduleChance 必須介於 0 到 1。`);
  }
  if (!Array.isArray(config.triggerBeforeEncounters) || config.triggerBeforeEncounters.length === 0) {
    throw new Error(`Route ${routeId} events.triggerBeforeEncounters 不可為空。`);
  }
  config.triggerBeforeEncounters.forEach((encounterNumber) => {
    if (!Number.isInteger(encounterNumber) || encounterNumber < 1 || encounterNumber > route.encounterPlan.length) {
      throw new Error(`Route ${routeId} 事件觸發場次超出範圍：${encounterNumber}`);
    }
  });
  if (!Array.isArray(config.pool) || config.pool.length === 0) {
    throw new Error(`Route ${routeId} events.pool 不可為空。`);
  }
  config.pool.forEach((eventId) => {
    if (!definitions.has(eventId)) {
      throw new Error(`Route ${routeId} events.pool 找不到 event definition：${eventId}`);
    }
  });
}

function validateRouteEventTarget(routeId, eventId, target) {
  const supportedTypes = new Set(["returnAdventure", "enterRoute", "chooseBlessing"]);
  const type = String(target?.type || "").trim();
  if (!supportedTypes.has(type)) {
    throw new Error(`Route ${routeId} event ${eventId} target type 無效：${type || "(empty)"}`);
  }
  if (type === "enterRoute" && !String(target.routeId || "").trim()) {
    throw new Error(`Route ${routeId} event ${eventId} enterRoute 缺少 routeId。`);
  }
  if (type === "chooseBlessing") {
    if (!getBlessingPool(target.poolId)) {
      throw new Error(`Route ${routeId} event ${eventId} chooseBlessing 找不到 poolId：${target.poolId}`);
    }
    if (!(Number(target.count) > 0)) {
      throw new Error(`Route ${routeId} event ${eventId} chooseBlessing count 必須 > 0。`);
    }
  }
}

