const CONDITION_TYPES = new Set(["storyFlag"]);
const CONDITION_OPERATORS = new Set(["equals", "notEquals"]);
const ACTION_TYPES = new Set([
  "gotoNode",
  "endDialogue",
  "setStoryFlag",
  "openFacility",
  "returnToFacilityList"
]);

export function evaluateDialogueCondition(condition, context = {}) {
  if (!condition || condition.type !== "storyFlag") {
    return false;
  }
  const actual = Boolean(context.storyFlags?.[condition.key]);
  const expected = Boolean(condition.value);
  return condition.operator === "notEquals" ? actual !== expected : actual === expected;
}

export function areDialogueConditionsMet(conditions = [], context = {}) {
  return conditions.every((condition) => evaluateDialogueCondition(condition, context));
}

export function resolveDialogueEntryNode(dialogue, context = {}) {
  if (!dialogue) {
    return null;
  }
  const matchingRule = (dialogue.entryRules || []).find((rule) => (
    areDialogueConditionsMet(rule.conditions || [], context)
  ));
  return matchingRule?.nodeId || dialogue.fallbackNodeId || null;
}

export function getVisibleDialogueChoices(node, context = {}) {
  return (node?.choices || []).filter((choice) => (
    areDialogueConditionsMet(choice.conditions || [], context)
  ));
}

export function assertDialogueDefinitions(dialogues, options = {}) {
  const { npcDefinitions = null, storyFlagKeys = [], facilityDefinitions = null } = options;
  const knownStoryFlags = new Set(storyFlagKeys);

  Object.entries(dialogues || {}).forEach(([dialogueId, dialogue]) => {
    if (!dialogue || dialogue.id !== dialogueId) {
      throw new Error(`Dialogue definition id 不一致：${dialogueId}`);
    }
    if (!String(dialogue.npcId || "").trim()) {
      throw new Error(`Dialogue ${dialogueId} 缺少 npcId。`);
    }
    if (npcDefinitions && !npcDefinitions[dialogue.npcId]) {
      throw new Error(`Dialogue ${dialogueId} 引用了未知 NPC：${dialogue.npcId}`);
    }
    const nodes = dialogue.nodes || {};
    if (!nodes[dialogue.fallbackNodeId]) {
      throw new Error(`Dialogue ${dialogueId} fallbackNodeId 無效：${dialogue.fallbackNodeId || "(empty)"}`);
    }

    (dialogue.entryRules || []).forEach((rule, index) => {
      assertNodeReference(nodes, rule.nodeId, `Dialogue ${dialogueId} entryRules[${index}]`);
      assertConditions(rule.conditions, { dialogueId, knownStoryFlags });
    });

    Object.entries(nodes).forEach(([nodeId, node]) => {
      const pages = Array.isArray(node.pages) ? node.pages : [];
      if (pages.length < 1 || pages.some((page) => !String(page?.text || "").trim())) {
        throw new Error(`Dialogue ${dialogueId} node ${nodeId} 必須至少有一頁有效文字。`);
      }
      if (node.nextNodeId) {
        assertNodeReference(nodes, node.nextNodeId, `Dialogue ${dialogueId} node ${nodeId}`);
      }
      (node.choices || []).forEach((choice, choiceIndex) => {
        if (!String(choice.id || "").trim() || !String(choice.label || "").trim()) {
          throw new Error(`Dialogue ${dialogueId} node ${nodeId} choice[${choiceIndex}] 缺少 id 或 label。`);
        }
        assertConditions(choice.conditions, { dialogueId, knownStoryFlags });
        assertAction(choice.action, { dialogueId, nodeId, nodes, knownStoryFlags, facilityDefinitions });
      });
      (node.actionsOnComplete || []).forEach((action) => {
        assertAction(action, { dialogueId, nodeId, nodes, knownStoryFlags, facilityDefinitions });
      });
    });
  });

  return true;
}

function assertNodeReference(nodes, nodeId, source) {
  if (!String(nodeId || "").trim() || !nodes[nodeId]) {
    throw new Error(`${source} 引用了未知 node：${nodeId || "(empty)"}`);
  }
}

function assertConditions(conditions = [], { dialogueId, knownStoryFlags }) {
  (conditions || []).forEach((condition) => {
    if (!CONDITION_TYPES.has(condition?.type)) {
      throw new Error(`Dialogue ${dialogueId} 使用未知 condition type：${condition?.type || "(empty)"}`);
    }
    if (!CONDITION_OPERATORS.has(condition.operator)) {
      throw new Error(`Dialogue ${dialogueId} 使用未知 condition operator：${condition.operator || "(empty)"}`);
    }
    if (!String(condition.key || "").trim()) {
      throw new Error(`Dialogue ${dialogueId} storyFlag condition 缺少 key。`);
    }
    if (knownStoryFlags.size > 0 && !knownStoryFlags.has(condition.key)) {
      throw new Error(`Dialogue ${dialogueId} 引用了未知 storyFlag：${condition.key}`);
    }
  });
}

function assertAction(action, { dialogueId, nodeId, nodes, knownStoryFlags, facilityDefinitions }) {
  if (!ACTION_TYPES.has(action?.type)) {
    throw new Error(`Dialogue ${dialogueId} node ${nodeId} 使用未知 action type：${action?.type || "(empty)"}`);
  }
  if (action.type === "gotoNode") {
    assertNodeReference(nodes, action.nodeId, `Dialogue ${dialogueId} node ${nodeId}`);
  }
  if (action.type === "setStoryFlag") {
    if (!String(action.key || "").trim()) {
      throw new Error(`Dialogue ${dialogueId} node ${nodeId} setStoryFlag 缺少 key。`);
    }
    if (knownStoryFlags.size > 0 && !knownStoryFlags.has(action.key)) {
      throw new Error(`Dialogue ${dialogueId} 引用了未知 storyFlag：${action.key}`);
    }
    if (typeof action.value !== "boolean") {
      throw new Error(`Dialogue ${dialogueId} node ${nodeId} setStoryFlag.value 必須是 boolean。`);
    }
  }
  if (action.type === "openFacility") {
    if (!String(action.facilityId || "").trim()) {
      throw new Error(`Dialogue ${dialogueId} node ${nodeId} openFacility 缺少 facilityId。`);
    }
    if (facilityDefinitions && !facilityDefinitions[action.facilityId]) {
      throw new Error(`Dialogue ${dialogueId} 引用了未知 facility：${action.facilityId}`);
    }
  }
}
