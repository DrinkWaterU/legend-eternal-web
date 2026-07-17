import { parseDebugBlessingList } from "./debugBlessingParser.js";
import {
  populateDebugSafeAreaOptions,
  populateDebugQuestOptions,
  runDebugPanelAction,
  runDebugPanelActionSafely,
  syncDebugQuestNote,
  syncDebugSafeAreaNote
} from "./debugPanelActions.js";
import { createDebugPanelElement } from "./debugPanelMarkup.js";
import { initializeDebugScenarioPanel } from "./debugScenarioPanel.js";

export { parseDebugBlessingList } from "./debugBlessingParser.js";

export function initDebugPanel({ enabled, actions }) {
  if (!enabled || !actions) {
    return;
  }

  const panel = createDebugPanelElement();
  document.body.append(panel);
  const context = createDebugContext(panel, actions);
  bindDebugPanelEvents(context);
  populateMaterialGroups(context);
  populateDebugSafeAreaOptions(context);
  populateDebugQuestOptions(context);
  initializeDebugScenarioPanel(context);
}

function createDebugContext(panel, actions) {
  return {
    panel,
    actions,
    status: panel.querySelector(".debug-status"),
    toggle: panel.querySelector(".debug-toggle"),
    body: panel.querySelector(".debug-body"),
    levelInput: panel.querySelector(".debug-level"),
    expInput: panel.querySelector(".debug-exp"),
    materialGroupSelect: panel.querySelector(".debug-material-group"),
    materialGiveButton: panel.querySelector(".debug-material-give"),
    safeAreaSelect: panel.querySelector(".debug-safe-area-select"),
    safeAreaNote: panel.querySelector(".debug-safe-area-note"),
    questSelect: panel.querySelector(".debug-quest-select"),
    questNote: panel.querySelector(".debug-quest-note"),
    scenarioSelect: panel.querySelector(".debug-scenario-select"),
    characterSelect: panel.querySelector(".debug-character-select"),
    scenarioNote: panel.querySelector(".debug-scenario-note"),
    routeEntryRow: panel.querySelector(".debug-route-entry-row"),
    routeEntrySelect: panel.querySelector(".debug-route-entry"),
    midChoiceRow: panel.querySelector(".debug-mid-choice-row"),
    midChoiceSelect: panel.querySelector(".debug-mid-choice"),
    hpRow: panel.querySelector(".debug-hp-row"),
    hpInput: panel.querySelector(".debug-scenario-hp"),
    buildSection: panel.querySelector(".debug-build-section"),
    buildProfiles: panel.querySelector(".debug-build-profiles"),
    buildList: panel.querySelector(".debug-build-list"),
    buildCount: panel.querySelector(".debug-build-count"),
    buildPaste: panel.querySelector(".debug-build-paste"),
    buildParseButton: panel.querySelector(".debug-build-parse"),
    scenarioStartButton: panel.querySelector(".debug-scenario-start"),
    catalog: [],
    buildSlots: [],
    buildSelections: {}
  };
}

function bindDebugPanelEvents(context) {
  context.toggle.addEventListener("click", () => {
    const expanded = context.body.hidden;
    context.body.hidden = !expanded;
    context.toggle.setAttribute("aria-expanded", String(expanded));
  });
  context.panel.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => runDebugPanelAction(button.dataset.action, context));
  });
  context.materialGiveButton.addEventListener("click", () => {
    runDebugPanelActionSafely(context, () => context.actions.giveMaterials(context.materialGroupSelect.value));
  });
  context.safeAreaSelect.addEventListener("change", () => syncDebugSafeAreaNote(context));
  context.questSelect.addEventListener("change", () => syncDebugQuestNote(context));
}

function populateMaterialGroups(context) {
  const groups = typeof context.actions.getMaterialGroups === "function"
    ? context.actions.getMaterialGroups()
    : [];
  context.materialGroupSelect.replaceChildren();
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    context.materialGroupSelect.append(option);
  });
  context.materialGiveButton.disabled = groups.length === 0;
}
