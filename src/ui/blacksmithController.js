import { craftWeapon } from "../core/commerce.js";
import {
  closeBlacksmithCraftPanel,
  renderBlacksmithCraftPanel,
  renderBlacksmithView,
  updateBlacksmithCategoryControls
} from "./blacksmithView.js";

export function createBlacksmithController({
  els,
  weaponDefinitions = {},
  weaponCategoryDefinitions = {},
  materialDefinitions = {},
  getInventory,
  getSafeArea = () => null,
  saveInventory = () => true
} = {}) {
  if (!els || typeof els !== "object") {
    throw new Error("Blacksmith Controller 需要有效的 els。");
  }
  if (typeof getInventory !== "function") {
    throw new Error("Blacksmith Controller 需要 getInventory()。");
  }
  if (typeof getSafeArea !== "function") {
    throw new Error("Blacksmith Controller 的 getSafeArea 必須是函式。");
  }
  if (typeof saveInventory !== "function") {
    throw new Error("Blacksmith Controller 的 saveInventory 必須是函式。");
  }

  const firstWeaponId = Object.keys(weaponDefinitions)[0] || null;
  const state = {
    selectedWeaponId: firstWeaponId,
    pendingWeaponId: null,
    filter: "all",
    category: "all",
    query: "",
    notice: "",
    noticeType: "status"
  };

  function reset() {
    if (!weaponDefinitions[state.selectedWeaponId]) {
      state.selectedWeaponId = firstWeaponId;
    }
    state.pendingWeaponId = null;
    state.filter = "all";
    state.category = "all";
    state.query = "";
    state.notice = "";
    state.noticeType = "status";
    if (els.blacksmithSearchInput) {
      els.blacksmithSearchInput.value = "";
    }
    closeBlacksmithCraftPanel(els);
  }

  function render() {
    els.blacksmithAreaLabel.textContent = getSafeArea()?.placesTitle || "城鎮去處";
    renderBlacksmithView({
      els,
      inventory: getInventory(),
      weaponDefinitions,
      weaponCategoryDefinitions,
      materialDefinitions,
      selectedWeaponId: state.selectedWeaponId,
      filter: state.filter,
      category: state.category,
      query: state.query,
      notice: state.notice,
      noticeType: state.noticeType,
      onWeaponSelect: selectWeapon,
      onCraftRequest: requestCraft,
      onCategorySelect: setCategory
    });
  }

  function setFilter(filter) {
    if (!["all", "available", "owned"].includes(filter)) return;
    state.filter = filter;
    render();
  }

  function setCategory(category) {
    if (category !== "all" && !weaponCategoryDefinitions[category]) return;
    state.category = category;
    render();
  }

  function setQuery(query) {
    state.query = String(query || "");
    render();
  }

  function scrollCategoryList(direction) {
    const scroller = els.blacksmithCategoryScroller;
    if (!scroller) return;
    const distance = Math.max(120, scroller.clientWidth * 0.7);
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const currentScroll = Number(scroller.scrollLeft) || 0;
    const targetScroll = Math.min(maxScroll, Math.max(0, currentScroll + direction * distance));
    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ left: targetScroll, behavior: "smooth" });
      if (Math.abs((Number(scroller.scrollLeft) || 0) - targetScroll) <= 1) return;
    }
    scroller.scrollLeft = targetScroll;
  }

  forEachElement(els.blacksmithFilterTabs, (button) => {
    button.addEventListener("click", () => setFilter(button.dataset.blacksmithFilter));
  });
  els.blacksmithSearchInput?.addEventListener("input", () => setQuery(els.blacksmithSearchInput.value));
  els.blacksmithCategoryPrev?.addEventListener("click", () => scrollCategoryList(-1));
  els.blacksmithCategoryNext?.addEventListener("click", () => scrollCategoryList(1));
  els.blacksmithCategoryScroller?.addEventListener("scroll", () => updateBlacksmithCategoryControls(els), { passive: true });
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => updateBlacksmithCategoryControls(els));
  }

  function selectWeapon(weaponId) {
    if (!weaponDefinitions[weaponId]) {
      return;
    }
    state.selectedWeaponId = weaponId;
    render();
  }

  function requestCraft(weaponId) {
    const weapon = weaponDefinitions[weaponId];
    if (!weapon) {
      return;
    }
    state.pendingWeaponId = weapon.id;
    renderBlacksmithCraftPanel({
      els,
      weapon,
      inventory: getInventory(),
      materialDefinitions,
      onConfirm: confirmCraft
    });
  }

  function confirmCraft() {
    const weapon = weaponDefinitions[state.pendingWeaponId];
    if (!weapon) {
      closeCraftDialog();
      return;
    }

    const inventory = getInventory();
    const snapshot = {
      gold: inventory.gold,
      materials: structuredClone(inventory.materials || {}),
      weapons: structuredClone(inventory.weapons || {})
    };

    try {
      craftWeapon({
        inventory,
        weapon,
        materialDefinitions
      });
      if (!saveInventory()) {
        inventory.gold = snapshot.gold;
        inventory.materials = snapshot.materials;
        inventory.weapons = snapshot.weapons;
        throw new Error("瀏覽器無法保存製作結果，資源已回復。");
      }
      state.notice = `已製作：${weapon.name}`;
      state.noticeType = "status";
      closeCraftDialog();
      render();
    } catch (error) {
      state.notice = error instanceof Error ? error.message : "武器製作失敗。";
      state.noticeType = "error";
      closeCraftDialog();
      render();
    }
  }

  function closeCraftDialog() {
    state.pendingWeaponId = null;
    closeBlacksmithCraftPanel(els);
  }

  return Object.freeze({
    reset,
    render,
    setFilter,
    setCategory,
    setQuery,
    closeCraftDialog
  });
}

function forEachElement(elements, callback) {
  if (!elements) return;
  Array.from(elements).forEach(callback);
}
