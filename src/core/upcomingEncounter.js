// Safe-route preview of the next step, so "continue or retreat" is an informed choice.
// Only reveals what the encounter plan already fixes (encounter type, scheduled event);
// it never reveals which enemies will be rolled.

const TYPE_LABELS = Object.freeze({
  normal: "一般遭遇",
  elite: "精英戰",
  boss: "首領戰"
});

export function describeUpcomingEncounter({ encounterType, encounterNumber, encounterCount, eventPending = false, resumingThreat = false } = {}) {
  if (resumingThreat) return "前方：剛才逃離的敵人還在等你。";
  const label = TYPE_LABELS[encounterType];
  if (!label || !(encounterNumber >= 1)) return "";
  const position = encounterCount >= encounterNumber ? `（第 ${encounterNumber} / ${encounterCount} 場）` : "";
  const lead = eventPending ? `前方似乎有些動靜，之後是${label}${position}。` : `前方：${label}${position}。`;
  if (encounterType === "boss") return `${lead}首領戰無法逃跑，要撤退只能趁現在。`;
  if (encounterType === "elite") return `${lead}對手明顯更強，狀態不好時可以先撤退。`;
  return lead;
}
