import anpingBlacksmithData from "./npcs/anping-blacksmith.json" with { type: "json" };
import anpingGuildReceptionistData from "./npcs/anping-guild-receptionist.json" with { type: "json" };
import kaigeData from "./npcs/kaige.json" with { type: "json" };

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function createNpcDefinition(data) {
  return deepFreeze(structuredClone(data));
}

const definitions = [
  createNpcDefinition(anpingBlacksmithData),
  createNpcDefinition(anpingGuildReceptionistData),
  createNpcDefinition(kaigeData)
];

export const npcDefinitions = Object.freeze(Object.fromEntries(
  definitions.map((npc) => [npc.id, npc])
));

export function getNpcDefinition(npcId) {
  return npcDefinitions[npcId] || null;
}

export function resolveNpcDisplayName(npc, context = {}) {
  if (!npc) {
    return "未知人物";
  }
  const storyFlags = context.storyFlags || {};
  if (storyFlags[npc.identity?.nameKnownFlag] === true) {
    return npc.name;
  }
  if (storyFlags[npc.identity?.metFlag] === true) {
    return npc.identity?.acquaintedLabel || npc.title;
  }
  return npc.identity?.unknownLabel || npc.title;
}

export function assertNpcDefinitions(npcs = npcDefinitions, options = {}) {
  const { storyFlagKeys = [], dialogueDefinitions = null } = options;
  const knownStoryFlags = new Set(storyFlagKeys);

  Object.entries(npcs).forEach(([npcId, npc]) => {
    if (!npc || npc.id !== npcId) {
      throw new Error(`NPC definition id 不一致：${npcId}`);
    }
    ["name", "title", "dialogueId"].forEach((field) => {
      if (!String(npc[field] || "").trim()) {
        throw new Error(`NPC ${npcId} 缺少 ${field}。`);
      }
    });
    if (npc.portrait !== null && !String(npc.portrait || "").trim()) {
      throw new Error(`NPC ${npcId} portrait 必須是有效路徑或 null。`);
    }
    ["unknownLabel", "acquaintedLabel", "metFlag", "nameKnownFlag"].forEach((field) => {
      if (!String(npc.identity?.[field] || "").trim()) {
        throw new Error(`NPC ${npcId} 缺少 identity.${field}。`);
      }
    });
    [npc.identity.metFlag, npc.identity.nameKnownFlag].forEach((flag) => {
      if (knownStoryFlags.size > 0 && !knownStoryFlags.has(flag)) {
        throw new Error(`NPC ${npcId} 引用了未知 storyFlag：${flag}`);
      }
    });
    if (dialogueDefinitions && !dialogueDefinitions[npc.dialogueId]) {
      throw new Error(`NPC ${npcId} 引用了未知 dialogue：${npc.dialogueId}`);
    }
  });

  return true;
}
