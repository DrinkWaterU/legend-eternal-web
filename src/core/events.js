import { getEventDefinition } from "../data/events/index.js";

export function scheduleRegionEvent(region, randomFn = Math.random, options = {}) {
  const config = region?.events;
  const pool = Array.isArray(config?.pool) ? config.pool.filter(Boolean) : [];
  const triggerBeforeEncounters = Array.isArray(config?.triggerBeforeEncounters)
    ? config.triggerBeforeEncounters
      .map((value) => Math.floor(Number(value)))
      .filter((value) => value > 0)
    : [];
  const scheduleChance = clampChance(options.scheduleChance ?? config?.scheduleChance);

  if (pool.length === 0 || triggerBeforeEncounters.length === 0 || randomFn() >= scheduleChance) {
    return null;
  }

  const candidates = pool
    .map((eventId) => getEventDefinition(eventId))
    .filter(Boolean);
  if (candidates.length === 0) {
    return null;
  }

  const event = weightedPick(candidates, (candidate) => candidate.weight ?? 100, randomFn);
  const fixedTrigger = Number(event.triggerBeforeEncounter);
  const triggerBeforeEncounter = Number.isInteger(fixedTrigger) && fixedTrigger > 0
    ? fixedTrigger
    : triggerBeforeEncounters[
      Math.floor(randomFn() * triggerBeforeEncounters.length)
    ];

  return {
    eventId: event.id,
    triggerBeforeEncounter
  };
}

export function shouldTriggerScheduledEvent(schedule, encounterIndex) {
  if (!schedule?.eventId || !Number.isInteger(schedule.triggerBeforeEncounter)) {
    return false;
  }
  const nextEncounterNumber = Math.max(1, Math.floor(Number(encounterIndex) || 0) + 1);
  return nextEncounterNumber === schedule.triggerBeforeEncounter;
}

export function createEventContext(eventId) {
  if (!getEventDefinition(eventId)) {
    throw new Error(`找不到事件 definition：${eventId}`);
  }
  return {
    eventId,
    choiceId: null,
    battleIndex: 0
  };
}

export function getEventChoice(event, choiceId) {
  return (event?.choices || []).find((choice) => choice.id === choiceId) || null;
}

export function appendRunEventRecord(records, record) {
  if (!Array.isArray(records)) {
    throw new Error("runEventRecords 必須是陣列。");
  }
  const eventId = String(record?.eventId || "").trim();
  const choiceId = String(record?.choiceId || "").trim();
  if (!eventId || !choiceId) {
    throw new Error("事件紀錄缺少 eventId 或 choiceId。");
  }
  const normalized = {
    eventId,
    choiceId,
    resultIds: normalizeResultIds(record.resultIds)
  };
  records.push(normalized);
  return normalized;
}

export function hasRunEventResults(records, requiredResultIds = []) {
  const required = normalizeResultIds(requiredResultIds);
  if (required.length === 0) {
    return true;
  }
  const available = new Set(
    (Array.isArray(records) ? records : [])
      .flatMap((record) => normalizeResultIds(record?.resultIds))
  );
  return required.every((resultId) => available.has(resultId));
}

export function getAvailableFollowUpChoices(result, records) {
  const choices = Array.isArray(result?.followUpChoices) ? result.followUpChoices : [];
  return choices.filter((choice) => hasRunEventResults(records, choice.requiresResults));
}

export function validateEventTarget(target, supportedTypes = ["returnAdventure"]) {
  const type = String(target?.type || "").trim();
  if (!supportedTypes.includes(type)) {
    throw new Error(`尚未支援的事件 target type：${type || "(empty)"}`);
  }
  if (type === "enterRoute" && !String(target?.routeId || "").trim()) {
    throw new Error("enterRoute target 缺少 routeId。");
  }
  if (type === "chooseBlessing") {
    if (!String(target?.poolId || "").trim()) {
      throw new Error("chooseBlessing target 缺少 poolId。");
    }
    if (!(Number(target?.count) > 0)) {
      throw new Error("chooseBlessing target count 必須 > 0。");
    }
  }
  return target;
}

export function normalizeResultIds(resultIds) {
  return [...new Set((Array.isArray(resultIds) ? resultIds : [])
    .map((resultId) => String(resultId || "").trim())
    .filter(Boolean))];
}

export function applyEventEffects({ effects = [], hero, grantBlessing, grantMaterials }) {
  const applied = [];

  for (const effect of Array.isArray(effects) ? effects : []) {
    if (effect?.type === "recoverHp") {
      const hasAmount = effect.amount !== undefined;
      const hasMaxHpRatio = effect.maxHpRatio !== undefined;
      if (hasAmount === hasMaxHpRatio) {
        throw new Error("recoverHp 必須且只能指定 amount 或 maxHpRatio。");
      }
      const amount = hasMaxHpRatio
        ? Math.max(0, Math.round(hero.maxHp * Math.max(0, Number(effect.maxHpRatio) || 0)))
        : Math.max(0, Math.floor(Number(effect.amount) || 0));
      const before = hero.hp;
      hero.hp = Math.min(hero.maxHp, hero.hp + amount);
      applied.push({ type: effect.type, amount: hero.hp - before });
      continue;
    }

    if (effect?.type === "loseHp") {
      const amount = Math.max(0, Math.floor(Number(effect.amount) || 0));
      const before = hero.hp;
      hero.hp = Math.max(0, hero.hp - amount);
      applied.push({ type: effect.type, amount: before - hero.hp });
      if (hero.hp <= 0) {
        break;
      }
      continue;
    }

    if (effect?.type === "grantMaterials") {
      const result = grantMaterials?.(effect) || null;
      applied.push({ type: effect.type, result });
      continue;
    }

    if (effect?.type === "grantBlessing") {
      const result = grantBlessing?.(effect) || null;
      applied.push({ type: effect.type, result });
      continue;
    }

    throw new Error(`尚未支援的事件 effect type：${effect?.type || "(empty)"}`);
  }

  return {
    applied,
    heroDefeated: hero.hp <= 0
  };
}

function clampChance(value) {
  const chance = Number(value);
  if (!Number.isFinite(chance)) {
    return 0;
  }
  return Math.max(0, Math.min(1, chance));
}

function weightedPick(items, getWeight, randomFn) {
  const weights = items.map((item) => Math.max(0, Number(getWeight(item)) || 0));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) {
    return items[Math.floor(randomFn() * items.length)];
  }
  let roll = randomFn() * totalWeight;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      return items[index];
    }
  }
  return items[items.length - 1];
}
