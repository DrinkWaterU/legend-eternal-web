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
  const previousTokens = new Map(
    Array.from(element.querySelectorAll?.("[data-status-id]") || [])
      .map((node) => [node.dataset.statusId, node.dataset.changeToken])
  );
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
    if (status.kind === "fury") {
      renderFuryStatus(chip, status, previousTokens.get(status.id));
    } else {
      chip.textContent = status.label;
    }
    element.append(chip);
  });
}

function renderFuryStatus(chip, status, previousToken) {
  const current = Math.max(0, Math.floor(Number(status.current) || 0));
  const max = Math.max(1, Math.floor(Number(status.max) || 3));
  const token = String(status.changeToken ?? 0);
  chip.dataset.statusId = status.id || "fury";
  chip.dataset.changeToken = token;
  chip.setAttribute("role", "status");
  chip.setAttribute("aria-label", status.label);

  const label = document.createElement("span");
  label.className = "fury-label";
  label.textContent = current >= max ? "戰意已滿" : `戰意 ${current}／${max}`;
  const segments = document.createElement("span");
  segments.className = "fury-segments";
  segments.setAttribute("aria-hidden", "true");
  for (let index = 0; index < max; index += 1) {
    const segment = document.createElement("i");
    segment.className = index < current ? "is-filled" : "";
    segments.append(segment);
  }
  const hint = document.createElement("small");
  hint.textContent = current >= max ? String(status.fullHint || "") : "";
  chip.append(label, segments, hint);

  if (previousToken !== undefined && previousToken !== token && status.changeKind) {
    chip.classList.add(`fury-change-${status.changeKind}`);
  }
}

function percentOf(value, max) {
  return Math.max(0, Math.min(100, (Number(value) || 0) / Math.max(1, Number(max) || 1) * 100));
}
