import { renderBlacksmithDetail } from "./blacksmithView.js";

export function renderBlacksmithWeaponSelection({
  els,
  weapon,
  inventory,
  weaponCategoryDefinitions,
  materialDefinitions,
  onCraftRequest
}) {
  Array.from(els.blacksmithWeaponList?.children || []).forEach((button) => {
    const isSelected = button.dataset.weaponId === weapon?.id;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  renderBlacksmithDetail({
    els,
    weapon,
    inventory,
    weaponCategoryDefinitions,
    materialDefinitions,
    onCraftRequest
  });
}
