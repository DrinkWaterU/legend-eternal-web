export const npcDefinitions = Object.freeze({
  "anping-blacksmith": Object.freeze({
    id: "anping-blacksmith",
    name: "羅根",
    title: "安平鎮的鐵匠",
    race: "human",
    gender: "male",
    ageGroup: "older-adult",
    portrait: "assets/images/npcs/anping/logan.jpg",
    dialogueId: "anping-blacksmith-main",
    identity: Object.freeze({
      unknownLabel: "安平鎮的鐵匠",
      acquaintedLabel: "鐵匠",
      metFlag: "metAnpingBlacksmith",
      nameKnownFlag: "knowsAnpingBlacksmithName"
    })
  })
});

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
    ["name", "title", "dialogueId", "portrait"].forEach((field) => {
      if (!String(npc[field] || "").trim()) {
        throw new Error(`NPC ${npcId} 缺少 ${field}。`);
      }
    });
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
