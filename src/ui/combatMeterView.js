export function renderLayeredMeter({ meter, currentLayer, pendingLayer, shieldLayer, value, max, pendingLoss, shield, enemy = false }) {
  const safeMax = Math.max(1, Number(max) || 1);
  const safeValue = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const safePendingLoss = Math.max(0, Math.min(safeValue, Number(pendingLoss) || 0));
  const safeShield = Math.max(0, Number(shield) || 0);
  const hpPercent = percentOf(safeValue, safeMax);
  const pendingStart = percentOf(safeValue - safePendingLoss, safeMax);
  const pendingPercent = percentOf(safePendingLoss, safeMax);
  const shieldPercent = Math.min(100 - hpPercent, percentOf(safeShield, safeMax));

  currentLayer.classList.toggle("enemy-hp", enemy);
  currentLayer.classList.toggle("hp", !enemy);
  currentLayer.style.left = "0%";
  currentLayer.style.width = `${hpPercent}%`;
  pendingLayer.style.left = `${pendingStart}%`;
  pendingLayer.style.width = `${pendingPercent}%`;
  shieldLayer.style.left = `${hpPercent}%`;
  shieldLayer.style.width = `${shieldPercent}%`;
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", String(safeMax));
  meter.setAttribute("aria-valuenow", String(safeValue));
  meter.setAttribute(
    "aria-valuetext",
    `${safeValue} / ${safeMax}${safeShield > 0 ? `，護盾 ${safeShield}` : ""}${safePendingLoss > 0 ? `，預計失去 ${safePendingLoss}` : ""}`
  );
}

export function renderStatusChips(element, statuses, emptyLabel) {
  element.replaceChildren();
  if (statuses.length === 0) {
    const chip = document.createElement("span");
    chip.className = "combat-status is-normal";
    chip.textContent = emptyLabel;
    element.append(chip);
    return;
  }
  statuses.forEach((status) => {
    const chip = document.createElement("span");
    chip.className = `combat-status ${status.className || ""}`.trim();
    chip.textContent = status.label;
    element.append(chip);
  });
}

function percentOf(value, max) {
  return Math.max(0, Math.min(100, (Number(value) || 0) / Math.max(1, Number(max) || 1) * 100));
}
