import { clone } from "../utils.js";
import { initializePreparationRuntime } from "./preparationEffects.js";
import { assertRegionPreparations } from "./preparationValidation.js";

export { assertRegionPreparations } from "./preparationValidation.js";
export {
  beginPreparationBattle,
  consumePreparationParalysisPenaltyPrevention,
  consumePreparationEntangleRetry,
  recordPreparationEntangleRetryResult,
  resolvePostEncounterPreparation,
  resolvePreparationIncomingDirectDamage,
  resolvePreparationPoisonDamage,
  resolvePreparationSaltErosionInitialTurns,
  runPreparationOpeningAction
} from "./preparationEffects.js";
export { getPreparationCombatStatus, getPreparationSummary } from "./preparationStatus.js";

export function getRegionPreparation(region, preparationId) {
  if (!preparationId) {
    return null;
  }
  const preparations = Array.isArray(region?.preparations) ? region.preparations : [];
  return preparations.find((preparation) => preparation?.id === preparationId) || null;
}

export function createRunPreparation(region, preparationId, options = {}) {
  if (!preparationId) {
    return null;
  }
  assertRegionPreparations(region);
  const definition = getRegionPreparation(region, preparationId);
  if (!definition) {
    throw new Error(`整備 ${preparationId} 不屬於地區 ${region?.id || "(unknown)"}。`);
  }

  const enhanced = options?.enhanced === true;
  if (enhanced && !definition.enhancement) {
    throw new Error(`整備 ${preparationId} 沒有素材強化。`);
  }
  const baseName = definition.name;
  const effectDefinition = enhanced ? definition.enhancement.effect : definition.effect;
  const description = enhanced ? definition.enhancement.description : definition.description;
  const preparation = {
    id: definition.id,
    baseName,
    name: enhanced ? `${baseName}・強化` : baseName,
    description: description || "",
    regionId: region.id,
    cost: definition.cost,
    effect: clone(effectDefinition),
    triggerCount: 0,
    isEnhanced: enhanced
  };

  initializePreparationRuntime(preparation);
  return preparation;
}
