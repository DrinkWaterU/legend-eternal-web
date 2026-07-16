import {
  createMaterialSalePlan,
  MATERIAL_SALE_POLICIES,
  sellMaterials
} from "../core/commerce.js";
import { normalizeInventory } from "../core/rewards.js";
import {
  closeGuildBulkConfirmPanel,
  createGuildBulkDraft,
  renderGuildBulkConfirmPanel,
  renderGuildBulkSaleView
} from "./guildBulkSaleView.js";

const TIER_NODE_IDS = Object.freeze({
  "below-minimum": "bulk-sale-tier-below-minimum",
  small: "bulk-sale-tier-small",
  large: "bulk-sale-tier-large",
  bulk: "bulk-sale-tier-bulk"
});

export function createGuildBulkSaleController({
  els,
  materialDefinitions = {},
  npcDefinition,
  dialogueDefinition,
  getInventory,
  saveInventory = () => true
} = {}) {
  if (!els || typeof els !== "object") throw new Error("Guild Bulk Sale Controller 需要有效的 els。");
  if (typeof getInventory !== "function") throw new Error("Guild Bulk Sale Controller 需要 getInventory()。");
  if (typeof saveInventory !== "function") throw new Error("Guild Bulk Sale Controller 需要 saveInventory()。");

  const state = {
    quantities: {},
    tiers: {},
    messageNodeId: "bulk-sale-entry",
    messageSerial: 0,
    notice: "",
    noticeType: "status",
    pendingPlan: null,
    animateMessage: true,
    filters: {
      query: "",
      region: "all",
      sort: "order"
    }
  };

  function reset({ clearDraft = true } = {}) {
    if (clearDraft) {
      state.quantities = {};
      state.tiers = {};
    }
    state.messageNodeId = "bulk-sale-entry";
    state.messageSerial += 1;
    state.notice = "";
    state.noticeType = "status";
    state.pendingPlan = null;
    state.animateMessage = true;
    state.filters = { query: "", region: "all", sort: "order" };
    closeGuildBulkConfirmPanel(els);
  }

  function render() {
    const inventory = normalizeInventory(getInventory());
    const draft = createGuildBulkDraft({
      inventory,
      materialDefinitions,
      quantities: state.quantities
    });
    renderGuildBulkSaleView({
      els,
      inventory,
      materialDefinitions,
      npc: npcDefinition,
      quantities: state.quantities,
      draft,
      filters: state.filters,
      message: getMessageText(state.messageNodeId),
      messageKey: `${state.messageNodeId}:${state.messageSerial}`,
      notice: state.notice,
      noticeType: state.noticeType,
      animateMessage: state.animateMessage,
      onQuantityChange: changeQuantity,
      onQuantityInput: setQuantityFromInput,
      onSelect: setQuantity,
      onMax: setMax,
      onRemove: removeQuantity,
      onClearDraft: clearDraft,
      onConfirmRequest: requestConfirm,
      onFilterChange: setFilter
    });
    state.animateMessage = false;
  }


  function setFilter(key, value) {
    if (!Object.hasOwn(state.filters, key)) return;
    state.filters[key] = String(value || (key === "query" ? "" : key === "region" ? "all" : "order"));
    render();
  }

  function changeQuantity(materialId, delta) {
    const held = getHeldQuantity(materialId);
    const current = normalizeQuantity(state.quantities[materialId], held);
    setQuantity(materialId, current + delta);
  }

  function setQuantityFromInput(materialId, rawValue, commit) {
    if (!commit) {
      return;
    }
    const value = Number(rawValue);
    if (!Number.isSafeInteger(value)) {
      setQuantity(materialId, state.quantities[materialId] || 0);
      return;
    }
    setQuantity(materialId, value);
  }

  function setMax(materialId) {
    setQuantity(materialId, getHeldQuantity(materialId));
  }

  function removeQuantity(materialId) {
    setQuantity(materialId, 0);
  }

  function clearDraft() {
    state.quantities = {};
    state.tiers = {};
    state.pendingPlan = null;
    state.notice = "已清除本次交付選擇。";
    state.noticeType = "status";
    closeGuildBulkConfirmPanel(els, { restoreFocus: false });
    render();
  }

  function setQuantity(materialId, value) {
    const held = getHeldQuantity(materialId);
    const next = Math.min(held, Math.max(0, Number.isSafeInteger(value) ? value : 0));
    const previousTier = state.tiers[materialId] || null;
    if (next === 0) {
      delete state.quantities[materialId];
      delete state.tiers[materialId];
    } else {
      state.quantities[materialId] = next;
      const draft = createGuildBulkDraft({
        inventory: getInventory(),
        materialDefinitions,
        quantities: { [materialId]: next }
      });
      const nextTier = draft.items[0]?.tierId || null;
      state.tiers[materialId] = nextTier;
      if (nextTier && nextTier !== previousTier) {
        showMessage(TIER_NODE_IDS[nextTier]);
      }
    }
    state.notice = "";
    state.noticeType = "status";
    render();
  }

  function requestConfirm() {
    try {
      state.pendingPlan = buildCurrentPlan();
      renderGuildBulkConfirmPanel({
        els,
        plan: state.pendingPlan,
        onConfirm: confirmSale
      });
    } catch (error) {
      state.notice = error instanceof Error ? error.message : "目前無法確認交付。";
      state.noticeType = "error";
      render();
    }
  }

  function confirmSale() {
    let plan;
    try {
      plan = buildCurrentPlan();
    } catch (error) {
      state.notice = error instanceof Error ? error.message : "交付資料已變更，請重新確認。";
      state.noticeType = "error";
      closeGuildBulkConfirmPanel(els);
      render();
      return;
    }

    const inventory = getInventory();
    const snapshot = {
      gold: inventory.gold,
      materials: structuredClone(inventory.materials || {})
    };
    let mutated = false;
    try {
      const result = sellMaterials({
        inventory,
        materialDefinitions,
        sales: plan.items.map(({ materialId, quantity }) => ({ materialId, quantity })),
        policyId: MATERIAL_SALE_POLICIES.GUILD_BULK
      });
      mutated = true;
      if (!saveInventory()) {
        throw new Error("瀏覽器無法保存交付結果，金幣與素材已回復。請再試一次。");
      }
      state.quantities = {};
      state.tiers = {};
      state.pendingPlan = null;
      state.notice = `已交付 ${result.items.length} 種素材，共 ${result.totalQuantity} 件，取得 ${result.totalGold} 金幣。`;
      state.noticeType = "status";
      showMessage("bulk-sale-success");
      closeGuildBulkConfirmPanel(els);
      render();
    } catch (error) {
      if (mutated) {
        inventory.gold = snapshot.gold;
        inventory.materials = snapshot.materials;
      }
      state.notice = error instanceof Error ? error.message : "物資交付失敗。";
      state.noticeType = "error";
      closeGuildBulkConfirmPanel(els);
      render();
    }
  }

  function buildCurrentPlan() {
    const sales = Object.entries(state.quantities)
      .filter(([, quantity]) => Number.isSafeInteger(quantity) && quantity > 0)
      .map(([materialId, quantity]) => ({ materialId, quantity }));
    return createMaterialSalePlan({
      inventory: getInventory(),
      materialDefinitions,
      sales,
      policyId: MATERIAL_SALE_POLICIES.GUILD_BULK
    });
  }

  function closeConfirm() {
    state.pendingPlan = null;
    closeGuildBulkConfirmPanel(els);
  }

  function getHeldQuantity(materialId) {
    const held = Number(getInventory()?.materials?.[materialId]?.quantity);
    return Number.isSafeInteger(held) && held > 0 ? held : 0;
  }

  function normalizeQuantity(value, max) {
    return Number.isSafeInteger(value) ? Math.min(max, Math.max(0, value)) : 0;
  }

  function showMessage(nodeId) {
    state.messageNodeId = nodeId || "bulk-sale-entry";
    state.messageSerial += 1;
    state.animateMessage = true;
  }

  function getMessageText(nodeId) {
    return dialogueDefinition?.nodes?.[nodeId]?.pages?.[0]?.text || "……";
  }

  function getState() {
    return {
      quantities: { ...state.quantities },
      tiers: { ...state.tiers },
      messageNodeId: state.messageNodeId,
      notice: state.notice,
      noticeType: state.noticeType,
      filters: { ...state.filters }
    };
  }

  return Object.freeze({
    reset,
    render,
    closeConfirm,
    getState,
    setQuantity,
    clearDraft,
    requestConfirm,
    confirmSale
  });
}
