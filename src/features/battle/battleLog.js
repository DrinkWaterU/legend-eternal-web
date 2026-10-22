export function createBattleLog({ state, templates, renderLog }) {
  let batchDepth = 0;
  let dirty = false;

  function append(entry) {
    state.log.push(entry);
    if (state.log.length > 1000) state.log.splice(0, state.log.length - 1000);
    dirty = true;
    if (batchDepth === 0) flush();
  }

  function flush() {
    if (!dirty) return;
    dirty = false;
    renderLog();
  }

  function withLogBatch(action) {
    batchDepth += 1;
    try {
      return action();
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0) flush();
    }
  }

  function format(templateId, values = {}) {
    return templates[templateId].replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  }

  function addLog(type, templateId, values) {
    append({ type, text: format(templateId, values) });
  }

  function addFixedLog(type, text) {
    append({ type, text });
  }

  function createCombatLogger() {
    return {
      template: addLog,
      fixed: addFixedLog
    };
  }

  return Object.freeze({ format, addLog, addFixedLog, createCombatLogger, withLogBatch });
}
