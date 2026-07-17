export function parseDebugBlessingList(text, blessings) {
  const blessingByName = new Map((blessings || []).map((blessing) => [blessing.name, blessing]));
  const names = String(text || "")
    .split(/[、,，\r\n]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  const blessingIds = [];
  const unknownNames = [];

  names.forEach((name) => {
    const blessing = blessingByName.get(name);
    if (blessing) {
      blessingIds.push(blessing.id);
    } else {
      unknownNames.push(name);
    }
  });

  return { blessingIds, unknownNames };
}
