import blessingFlowsData from "./blessingFlows.json" with { type: "json" };

export const blessingFlowDefinitions = blessingFlowsData;

export function getBlessingFlowDefinitions() {
  return Object.values(blessingFlowDefinitions);
}

export function getBlessingFlowDefinition(flowId) {
  return blessingFlowDefinitions[flowId] || null;
}

export function isBlessingFlowId(flowId) {
  return Boolean(getBlessingFlowDefinition(flowId));
}

