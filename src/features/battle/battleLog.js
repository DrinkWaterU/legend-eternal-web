export function createBattleLog({ state, templates, renderLog }) {
  function format(templateId, values = {}) {
    return templates[templateId].replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  }

  function addLog(type, templateId, values) {
    state.log.push({ type, text: format(templateId, values) });
    renderLog();
  }

  function addFixedLog(type, text) {
    state.log.push({ type, text });
    renderLog();
  }

  function createCombatLogger() {
    return {
      template: addLog,
      fixed: addFixedLog
    };
  }

  return Object.freeze({ format, addLog, addFixedLog, createCombatLogger });
}
