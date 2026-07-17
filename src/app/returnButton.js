export function createReturnButtonController({ getCurrentSafeArea }) {
  function setReturnButton(button, target) {
    if (!button) return;
    button.dataset.target = target;
    button.textContent = target === "campScreen"
      ? `回${getCurrentSafeArea()?.name || "安全區"}`
      : "回主選單";
  }

  return Object.freeze({ setReturnButton });
}
