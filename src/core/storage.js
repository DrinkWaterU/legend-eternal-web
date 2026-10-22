import { GAME_VERSION, SAVE_KEY, SAVE_SCHEMA_VERSION } from "../config.js";
import { createDefaultSave } from "./saveDefaults.js";
import { migrateSaveData } from "./saveMigrations.js";

export { createDefaultSave } from "./saveDefaults.js";

let protectedLoad = false;
let canWrite = () => true;
export function setStorageWriteGuard(guard) { canWrite = guard; }
export const SAVE_RECOVERY_KEY = `${SAVE_KEY}:recovery`;

export function loadSave({ onError } = {}) {
  const fallback = createDefaultSave();
  let readableSave = fallback;
  protectedLoad = false;
  try {
    const rawSave = localStorage.getItem(SAVE_KEY);
    if (!rawSave) {
      saveGame(fallback, { onError });
      return fallback;
    }
    const raw = JSON.parse(rawSave);
    if (!isImportableSave(raw)) throw new Error("存檔內容無法辨識。");
    const save = migrateSave(raw);
    readableSave = save;
    if (Number(raw.schemaVersion) !== SAVE_SCHEMA_VERSION) {
      localStorage.setItem(SAVE_RECOVERY_KEY, rawSave);
    }
    if (!saveGame(save)) throw new Error("瀏覽器無法保存轉換後的進度。");
    return save;
  } catch (error) {
    // A fallback must never silently overwrite unreadable or newer progress.
    protectedLoad = true;
    onError?.(error);
    return readableSave;
  }
}

export function migrateSave(rawSave, options = {}) {
  const save = migrateSaveData(rawSave);
  if (options.persist) {
    if (!saveGame(save, options)) throw new Error("瀏覽器無法保存存檔，原有進度未被替換。");
  }
  return save;
}

export function saveGame(save, options = {}) {
  const { onError, replaceProtected = false } = options;
  const previousSchemaVersion = save.schemaVersion;
  const previousGameVersion = save.gameVersion;
  const previousUpdatedAt = save.profile?.updatedAt;
  try {
    if (!canWrite()) throw new Error("此分頁沒有存檔寫入權，請重新載入最新進度。");
    if (protectedLoad && !replaceProtected) throw new Error("原始存檔已受保護，請先匯入備份或明確刪除存檔。");
    if (replaceProtected) {
      const original = localStorage.getItem(SAVE_KEY);
      if (original) localStorage.setItem(SAVE_RECOVERY_KEY, original);
    }
    save.schemaVersion = SAVE_SCHEMA_VERSION;
    save.gameVersion = GAME_VERSION;
    save.profile.updatedAt = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    protectedLoad = false;
    return true;
  } catch (error) {
    save.schemaVersion = previousSchemaVersion;
    save.gameVersion = previousGameVersion;
    if (save.profile && typeof save.profile === "object") {
      save.profile.updatedAt = previousUpdatedAt;
    }
    onError?.(error);
    return false;
  }
}

export function deleteStoredSave() {
  if (!canWrite()) throw new Error("此分頁沒有存檔寫入權。");
  localStorage.removeItem(SAVE_RECOVERY_KEY);
  localStorage.removeItem(SAVE_KEY);
  protectedLoad = false;
}

export function isImportableSave(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Boolean(value.schemaVersion || value.statistics || value.progression || value.settings || value.profile);
}
