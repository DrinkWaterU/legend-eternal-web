import { GAME_VERSION, SAVE_KEY, SAVE_SCHEMA_VERSION } from "../config.js";
import { createDefaultSave } from "./saveDefaults.js";
import { migrateSaveData } from "./saveMigrations.js";

export { createDefaultSave } from "./saveDefaults.js";

export function loadSave() {
  const fallback = createDefaultSave();
  try {
    const rawSave = localStorage.getItem(SAVE_KEY);
    if (!rawSave) {
      saveGame(fallback);
      return fallback;
    }
    return migrateSave(JSON.parse(rawSave), { persist: true });
  } catch {
    return fallback;
  }
}

export function migrateSave(rawSave, options = {}) {
  const save = migrateSaveData(rawSave);
  if (options.persist) {
    saveGame(save);
  }
  return save;
}

export function saveGame(save, options = {}) {
  const { onError } = options;
  const previousSchemaVersion = save.schemaVersion;
  const previousGameVersion = save.gameVersion;
  const previousUpdatedAt = save.profile?.updatedAt;
  try {
    save.schemaVersion = SAVE_SCHEMA_VERSION;
    save.gameVersion = GAME_VERSION;
    save.profile.updatedAt = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    save.schemaVersion = previousSchemaVersion;
    save.gameVersion = previousGameVersion;
    if (save.profile && typeof save.profile === "object") {
      save.profile.updatedAt = previousUpdatedAt;
    }
    onError?.();
    return false;
  }
}

export function deleteStoredSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function isImportableSave(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Boolean(value.schemaVersion || value.statistics || value.progression || value.settings || value.profile);
}
