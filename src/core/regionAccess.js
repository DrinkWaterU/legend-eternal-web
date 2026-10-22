// Availability is derived from completed permanent progress, never from an
// unfinished run snapshot or a merely selected region.
export function getRegionAccess(region, save) {
  const requirement = region?.unlockRequirement;
  if (!requirement) return { unlocked: true, reason: "" };
  const cleared = Number(save?.statistics?.regions?.[requirement.regionId]?.clears) || 0;
  return cleared >= requirement.clears
    ? { unlocked: true, reason: "" }
    : { unlocked: false, reason: "完整通關海岸後開放；僅完成海灘段落還不算。" };
}
