// Foreshadowing for the phoenix blessing. Before the plains boss story, a death still
// resets growth, but each one leaves a faint ember; the story later pays those embers off.

export function getPrePhoenixDeathEmberLine(totalDefeats) {
  const count = Math.max(0, Math.floor(Number(totalDefeats) || 0));
  if (count <= 0) return "";
  if (count === 1) return "倒下的前一刻，你好像在灰燼裡看見一點微光。它很快就熄了，只留下一點餘溫。";
  if (count === 2) return "那點微光又出現了，比上次更近一些。";
  return "灰燼裡的微光一次比一次清楚，像是在等待什麼。";
}

// Inserted into the phoenix awakening story, before the closing line.
export function getPhoenixPayoffLine(totalDefeats) {
  const count = Math.max(0, Math.floor(Number(totalDefeats) || 0));
  if (count <= 0) {
    return "你從未在旅途中倒下。第一次面對死亡，<span class=\"story-mark-phoenix\" data-fx=\"flare\">那點微光</span>卻像早就在等你。";
  }
  return `你認得這點光。你曾倒下 ${count} 次，它每次都在灰燼裡閃過，又熄滅。這一次，<span class="story-mark-phoenix" data-fx="flare">它沒有熄滅</span>。`;
}

export function insertPhoenixPayoffLine(lines, totalDefeats) {
  const source = Array.isArray(lines) ? lines : [];
  if (source.length === 0) return source;
  const payoff = getPhoenixPayoffLine(totalDefeats);
  return [...source.slice(0, -1), payoff, source.at(-1)];
}
