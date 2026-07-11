import { sellMaterial, sellMaterials } from "../core/commerce.js";
import { normalizeInventory } from "../core/rewards.js";
import { getSellableMaterials } from "./materialList.js";
import {
  closeMerchantSalePanel,
  createMerchantBatchPreview,
  getValidMerchantSaleQuantity,
  renderMerchantBatchSalePanel,
  renderMerchantSalePanel,
  renderMerchantView
} from "./merchantView.js";

function createMerchantState() {
  return {
    sortMode: "sellPrice",
    sortDirection: "desc",
    batchMode: false,
    batchMaterialIds: new Set(),
    saleDialogMode: null,
    saleMaterialId: null,
    saleQuantity: 1,
    saleQuantityInput: "1",
    notice: "",
    noticeType: "status"
  };
}

export function createMerchantController({
  els,
  materialDefinitions = {},
  getInventory,
  getSafeArea = () => null,
  saveInventory = () => {}
} = {}) {
  if (!els || typeof els !== "object") {
    throw new Error("Merchant Controller 需要有效的 els。");
  }
  if (typeof getInventory !== "function") {
    throw new Error("Merchant Controller 需要 getInventory()。");
  }
  if (typeof getSafeArea !== "function") {
    throw new Error("Merchant Controller 的 getSafeArea 必須是函式。");
  }
  if (typeof saveInventory !== "function") {
    throw new Error("Merchant Controller 的 saveInventory 必須是函式。");
  }

  const state = createMerchantState();

  function getCurrentInventory() {
    return normalizeInventory(getInventory());
  }

  function getCurrentSellableMaterials() {
    return getSellableMaterials(getInventory(), materialDefinitions);
  }

  function reset({ clearNotice = true } = {}) {
    state.batchMode = false;
    state.batchMaterialIds = new Set();
    resetSaleDialogState();
    if (clearNotice) {
      state.notice = "";
      state.noticeType = "status";
    }
    closeMerchantSalePanel(els);
  }

  function render() {
    const inventory = getCurrentInventory();
    const safeArea = getSafeArea();
    const batchPreview = normalizeBatchSelection();
    const placesTitle = safeArea?.placesTitle || "安全區去處";

    els.merchantAreaLabel.textContent = placesTitle;
    els.merchantBackButton.textContent = `返回${placesTitle}`;
    renderMerchantView({
      els,
      inventory,
      materialDefinitions,
      sortMode: state.sortMode,
      sortDirection: state.sortDirection,
      batchMode: state.batchMode,
      selectedMaterialIds: state.batchMaterialIds,
      batchPreview,
      notice: state.notice,
      noticeType: state.noticeType,
      onSortChange: (sortMode) => {
        state.sortMode = sortMode;
        render();
      },
      onDirectionChange: (sortDirection) => {
        state.sortDirection = sortDirection;
        render();
      },
      onMaterialClick: openSalePanel,
      onBatchModeToggle: toggleBatchMode,
      onBatchSelectionToggle: toggleBatchMaterial,
      onBatchConfirm: openBatchSaleDialog,
      onBatchCancel: cancelBatchMode
    });
  }

  function normalizeBatchSelection() {
    if (!state.batchMode) {
      state.batchMaterialIds = new Set();
      return createMerchantBatchPreview();
    }
    const preview = createMerchantBatchPreview(getCurrentSellableMaterials(), state.batchMaterialIds);
    state.batchMaterialIds = new Set(preview.items.map((item) => item.materialId));
    return preview;
  }

  function toggleBatchMode() {
    if (state.batchMode) {
      cancelBatchMode();
      return;
    }
    closeSaleDialog();
    state.batchMode = true;
    state.batchMaterialIds = new Set();
    state.notice = "";
    state.noticeType = "status";
    render();
  }

  function cancelBatchMode() {
    closeSaleDialog();
    state.batchMode = false;
    state.batchMaterialIds = new Set();
    render();
  }

  function toggleBatchMaterial(materialId) {
    if (!state.batchMode) {
      return;
    }
    const sellable = getCurrentSellableMaterials().some((item) => item.id === materialId);
    if (!sellable) {
      return;
    }

    const selectedIds = new Set(state.batchMaterialIds);
    if (selectedIds.has(materialId)) {
      selectedIds.delete(materialId);
    } else {
      selectedIds.add(materialId);
    }
    state.batchMaterialIds = selectedIds;
    render();
  }

  function getSaleItem() {
    return getCurrentSellableMaterials()
      .find((item) => item.id === state.saleMaterialId) || null;
  }

  function openSalePanel(item) {
    if (state.batchMode || !item?.id) {
      return;
    }
    state.saleDialogMode = "single";
    state.saleMaterialId = item.id;
    state.saleQuantity = 1;
    state.saleQuantityInput = "1";
    renderSaleDialog();
  }

  function renderSaleDialog() {
    if (state.saleDialogMode === "batch") {
      const preview = normalizeBatchSelection();
      if (preview.items.length === 0) {
        closeSaleDialog();
        render();
        return;
      }
      renderMerchantBatchSalePanel({
        els,
        preview,
        onConfirm: confirmBatchSale
      });
      return;
    }

    const item = getSaleItem();
    if (!item) {
      closeSaleDialog();
      return;
    }
    state.saleQuantity = Math.min(item.quantity, Math.max(1, state.saleQuantity));
    renderMerchantSalePanel({
      els,
      item,
      quantity: state.saleQuantity,
      quantityInput: state.saleQuantityInput,
      onDecreaseFive: () => changeSaleQuantity(-5),
      onDecrease: () => changeSaleQuantity(-1),
      onIncrease: () => changeSaleQuantity(1),
      onIncreaseFive: () => changeSaleQuantity(5),
      onMax: () => setSaleQuantity(item.quantity),
      onQuantityInput: (value, validQuantity) => {
        state.saleQuantityInput = value;
        if (validQuantity !== null) {
          state.saleQuantity = validQuantity;
        }
      },
      onQuantityCommit: setSaleQuantity,
      onConfirm: confirmSale
    });
  }

  function changeSaleQuantity(change) {
    setSaleQuantity(state.saleQuantity + change);
  }

  function setSaleQuantity(quantity) {
    const item = getSaleItem();
    if (!item) {
      closeSaleDialog();
      return;
    }
    const parsedQuantity = Number(quantity);
    const fallbackQuantity = getValidMerchantSaleQuantity(state.saleQuantity, item.quantity) || 1;
    const normalizedQuantity = Number.isSafeInteger(parsedQuantity)
      ? Math.min(item.quantity, Math.max(1, parsedQuantity))
      : fallbackQuantity;
    state.saleQuantity = normalizedQuantity;
    state.saleQuantityInput = String(normalizedQuantity);
    renderSaleDialog();
  }

  function confirmSale() {
    const item = getSaleItem();
    const quantity = getValidMerchantSaleQuantity(state.saleQuantityInput, item?.quantity || 0);
    if (!item || quantity === null) {
      setSaleQuantity(state.saleQuantityInput);
      return;
    }

    try {
      const result = sellMaterial({
        inventory: getInventory(),
        materialDefinitions,
        materialId: state.saleMaterialId,
        quantity
      });
      saveInventory();
      state.notice = `已出售${result.name} x${result.quantity}，取得 ${result.totalGold} 金幣。`;
      state.noticeType = "status";
      closeSaleDialog();
      render();
    } catch (error) {
      state.notice = error instanceof Error ? error.message : "交易失敗。";
      state.noticeType = "error";
      closeSaleDialog();
      render();
    }
  }

  function openBatchSaleDialog() {
    if (!state.batchMode) {
      return;
    }
    const preview = normalizeBatchSelection();
    if (preview.items.length === 0) {
      return;
    }
    state.saleDialogMode = "batch";
    renderSaleDialog();
  }

  function confirmBatchSale() {
    if (!state.batchMode || state.saleDialogMode !== "batch") {
      return;
    }
    const preview = normalizeBatchSelection();
    if (preview.items.length === 0) {
      closeSaleDialog();
      render();
      return;
    }

    try {
      const result = sellMaterials({
        inventory: getInventory(),
        materialDefinitions,
        sales: preview.items.map((item) => ({
          materialId: item.materialId,
          quantity: item.quantity
        }))
      });
      saveInventory();
      state.notice = `已出售 ${result.items.length} 種素材，共 ${result.totalQuantity} 件，取得 ${result.totalGold} 金幣。`;
      state.noticeType = "status";
      closeSaleDialog();
      state.batchMode = false;
      state.batchMaterialIds = new Set();
      render();
    } catch (error) {
      state.notice = error instanceof Error ? error.message : "批次交易失敗。";
      state.noticeType = "error";
      closeSaleDialog();
      normalizeBatchSelection();
      render();
    }
  }

  function resetSaleDialogState() {
    state.saleDialogMode = null;
    state.saleMaterialId = null;
    state.saleQuantity = 1;
    state.saleQuantityInput = "1";
  }

  function closeSaleDialog() {
    resetSaleDialogState();
    closeMerchantSalePanel(els);
  }

  return Object.freeze({
    reset,
    render,
    closeSaleDialog
  });
}
