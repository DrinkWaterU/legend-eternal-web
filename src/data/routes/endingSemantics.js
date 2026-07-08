export const ROUTE_ENDING_TONES = Object.freeze(["embers", "cold", "archer", "warm"]);
export const ROUTE_ENDING_ROLES = Object.freeze(["narration", "scene", "archer", "player", "ending"]);

const ROUTE_ENDING_TONE_SET = new Set(ROUTE_ENDING_TONES);
const ROUTE_ENDING_ROLE_SET = new Set(ROUTE_ENDING_ROLES);

export function normalizeRouteEndingTone(tone) {
  return ROUTE_ENDING_TONE_SET.has(tone) ? tone : "cold";
}

export function normalizeRouteEndingRole(role) {
  return ROUTE_ENDING_ROLE_SET.has(role) ? role : "narration";
}
