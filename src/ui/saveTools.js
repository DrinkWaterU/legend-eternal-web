const LEGACY_SAVE_CODE_PREFIX = "LE_SAVE_1:";
const COMPRESSED_SAVE_CODE_PREFIX = "LE_SAVE_2:";
const SAVE_CODE_FORMAT = 2;

export async function createSaveTransferCode(save, gameVersion) {
  const payload = createPayload(save, gameVersion, SAVE_CODE_FORMAT);
  const compressed = await compressText(JSON.stringify(payload));
  return `${COMPRESSED_SAVE_CODE_PREFIX}${encodeBase64Url(compressed)}`;
}

export function createLegacySaveTransferCode(save, gameVersion) {
  const payload = createPayload(save, gameVersion, 1);
  return `${LEGACY_SAVE_CODE_PREFIX}${encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)))}`;
}

export async function parseSaveTransferCode(code) {
  const normalized = String(code || "").trim();
  let payload;

  try {
    if (normalized.startsWith(COMPRESSED_SAVE_CODE_PREFIX)) {
      const encoded = requireEncodedContent(normalized, COMPRESSED_SAVE_CODE_PREFIX);
      payload = JSON.parse(await decompressText(decodeBase64Url(encoded)));
    } else if (normalized.startsWith(LEGACY_SAVE_CODE_PREFIX)) {
      const encoded = requireEncodedContent(normalized, LEGACY_SAVE_CODE_PREFIX);
      payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded)));
    } else {
      throw new Error("Unsupported save code prefix");
    }
  } catch {
    throw new Error("存檔碼無法解析。");
  }

  if (!payload || ![1, SAVE_CODE_FORMAT].includes(payload.format) || !payload.save) {
    throw new Error("存檔碼缺少必要資料。");
  }

  return payload;
}

export function downloadSaveTransferFile(code, gameVersion, options = {}) {
  const documentRef = options.documentRef || document;
  const urlApi = options.urlApi || URL;
  const BlobCtor = options.BlobCtor || Blob;
  const normalized = String(code || "").trim();
  if (!normalized.startsWith(COMPRESSED_SAVE_CODE_PREFIX)) {
    throw new Error("請先產生新版壓縮存檔碼。");
  }

  const blob = new BlobCtor([normalized], { type: "application/x-legend-eternal-save;charset=utf-8" });
  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = objectUrl;
  anchor.download = createSaveTransferFileName(gameVersion);
  anchor.hidden = true;
  documentRef.body.append(anchor);
  anchor.click();
  anchor.remove();
  urlApi.revokeObjectURL(objectUrl);
  return anchor.download;
}

export function createSaveTransferFileName(gameVersion, date = new Date()) {
  const version = String(gameVersion || "unknown").replace(/[^0-9A-Za-z._-]/g, "-");
  const day = date.toISOString().slice(0, 10);
  return `傳說永恆_${version}_${day}.lesave`;
}

export async function readSaveTransferFile(file) {
  if (!file || typeof file.text !== "function") {
    throw new Error("無法讀取存檔檔案。");
  }
  const code = String(await file.text()).trim();
  if (!code) {
    throw new Error("存檔檔案內容空白。");
  }
  return code;
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Clipboard API unavailable");
}

function createPayload(save, gameVersion, format) {
  return {
    format,
    gameVersion,
    exportedAt: new Date().toISOString(),
    save
  };
}

function requireEncodedContent(code, prefix) {
  const encoded = code.slice(prefix.length);
  if (!encoded) {
    throw new Error("存檔碼內容空白。");
  }
  return encoded;
}

function encodeBase64Url(bytes) {
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
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function compressText(text) {
  if (typeof CompressionStream !== "function") {
    throw new Error("目前瀏覽器不支援壓縮存檔碼。");
  }
  const source = new Blob([new TextEncoder().encode(text)]);
  const stream = source.stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressText(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("目前瀏覽器不支援解壓縮存檔碼。");
  }
  const source = new Blob([bytes]);
  const stream = source.stream().pipeThrough(new DecompressionStream("gzip"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
