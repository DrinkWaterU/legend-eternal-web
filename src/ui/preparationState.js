import { getRegionPreparation } from "../core/preparations.js";

function assertPreparationUiState(uiState) {
  if (!uiState || typeof uiState !== "object") {
    throw new TypeError("整備 UI State 需要可修改的物件。");
  }
}

export function clearPreparationSelectionState(uiState) {
  assertPreparationUiState(uiState);
  uiState.selectedPreparationId = null;
  uiState.enhancedPreparationId = null;
  uiState.preparationEnhancementRevealId = null;
  uiState.preparationDetailId = null;
  uiState.preparationDetailExpanded = false;
  return uiState;
}

export function normalizePreparationUiState({
  uiState,
  region,
  gold,
  inventoryMaterials = null,
  enabled = true
}) {
  assertPreparationUiState(uiState);

  if (!enabled) {
    return clearPreparationSelectionState(uiState);
  }

  const availableGold = Number.isFinite(Number(gold))
    ? Math.max(0, Math.floor(Number(gold)))
    : 0;
  const selectedPreparation = getRegionPreparation(region, uiState.selectedPreparationId);
  if (
    uiState.selectedPreparationId
    && (!selectedPreparation || availableGold < selectedPreparation.cost)
  ) {
    uiState.selectedPreparationId = null;
    uiState.enhancedPreparationId = null;
    uiState.preparationEnhancementRevealId = null;
  }

  const enhancedPreparation = getRegionPreparation(region, uiState.enhancedPreparationId);
  const hasEnhancementMaterials = inventoryMaterials === null
    ? true
    : enhancedPreparation?.enhancement?.materialCosts?.every((cost) => {
      const quantity = Number(inventoryMaterials?.[cost.materialId]?.quantity) || 0;
      return quantity >= cost.quantity;
    }) ?? false;
  if (
    uiState.enhancedPreparationId
    && (
      uiState.enhancedPreparationId !== uiState.selectedPreparationId
      || !enhancedPreparation?.enhancement
      || !hasEnhancementMaterials
    )
  ) {
    uiState.enhancedPreparationId = null;
    uiState.preparationEnhancementRevealId = null;
  }

  if (
    uiState.preparationEnhancementRevealId
    && uiState.preparationEnhancementRevealId !== uiState.enhancedPreparationId
  ) {
    uiState.preparationEnhancementRevealId = null;
  }

  if (
    uiState.preparationDetailId
    && !getRegionPreparation(region, uiState.preparationDetailId)
  ) {
    uiState.preparationDetailId = null;
    uiState.preparationDetailExpanded = false;
  }

  return uiState;
}

export function consumePreparationEnhancementReveal(uiState, preparationId) {
  assertPreparationUiState(uiState);
  if (!preparationId || uiState.preparationEnhancementRevealId !== preparationId) {
    return false;
  }
  uiState.preparationEnhancementRevealId = null;
  return true;
}
