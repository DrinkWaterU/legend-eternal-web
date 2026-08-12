export function getCombatElements(document) {
  return {
    nextButton: document.querySelector("#nextButton"),
    guardButton: document.querySelector("#guardButton"),
    fleeButton: document.querySelector("#fleeButton"),
    continueButton: document.querySelector("#continueButton"),
    restButton: document.querySelector("#restButton"),
    retreatButton: document.querySelector("#retreatButton"),
    returnToEndSummaryButton: document.querySelector("#returnToEndSummaryButton"),
    combatHomeButton: document.querySelector("#combatHomeButton"),
    viewBlessingsButton: document.querySelector("#viewBlessingsButton"),
    battleLogTitle: document.querySelector("#battleLogTitle"),
    encounterLabel: document.querySelector("#encounterLabel"),
    resultLabel: document.querySelector("#resultLabel"),
    combatActionHint: document.querySelector("#combatActionHint")
  };
}
