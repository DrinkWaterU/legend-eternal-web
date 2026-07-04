const SAVE_CODE_PREFIX = "LE_SAVE_1:";
const SAVE_CODE_FORMAT = 1;

export function createSaveTransferCode(save, gameVersion) {
  const payload = {
    format: SAVE_CODE_FORMAT,
    gameVersion,
    exportedAt: new Date().toISOString(),
    save
  };
  return `${SAVE_CODE_PREFIX}${encodeBase64Url(JSON.stringify(payload))}`;
}

export function parseSaveTransferCode(code) {
  const normalized = String(code || "").trim();
  if (!normalized.startsWith(SAVE_CODE_PREFIX)) {
    throw new Error("存檔碼格式不正確。");
  }

  const encoded = normalized.slice(SAVE_CODE_PREFIX.length);
  if (!encoded) {
    throw new Error("存檔碼內容空白。");
  }

  let payload;
  try {
    payload = JSON.parse(decodeBase64Url(encoded));
  } catch {
    throw new Error("存檔碼無法解析。");
  }

  if (!payload || payload.format !== SAVE_CODE_FORMAT || !payload.save) {
    throw new Error("存檔碼缺少必要資料。");
  }

  return payload;
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Clipboard API unavailable");
}

function encodeBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(encoded) {
  const padded = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
