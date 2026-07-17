export function isDebugModeEnabled(windowRef = window) {
  return new URLSearchParams(windowRef.location.search).get("debug") === "1";
}
