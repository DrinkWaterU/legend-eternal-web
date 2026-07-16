export function createSaveStore({ initialSave, persistSave }) {
  if (!initialSave || typeof initialSave !== "object") {
    throw new TypeError("Save Store 需要有效的初始存檔");
  }
  if (typeof persistSave !== "function") {
    throw new TypeError("Save Store 需要 persistSave 函式");
  }

  let current = initialSave;

  return Object.freeze({
    get current() {
      return current;
    },
    replace(nextSave) {
      if (!nextSave || typeof nextSave !== "object") {
        throw new TypeError("不能以無效資料替換存檔");
      }
      current = nextSave;
      return current;
    },
    persist(options = {}) {
      return persistSave(current, options);
    }
  });
}
