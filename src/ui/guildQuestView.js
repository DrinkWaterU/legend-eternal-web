import { formatQuestObjective, getQuestTarget, isQuestComplete } from "../core/questRules.js";
import { getQuestRarity } from "../data/questRarities.js";

export function renderGuildQuestView({
  els,
  snapshot,
  questDefinitions,
  materialDefinitions,
  onAccept,
  onReport,
  onAbandon
}) {
  els.guildQuestContent.replaceChildren();
  els.guildQuestGold.textContent = String(snapshot.inventoryGold || 0);
  els.guildQuestNotice.textContent = snapshot.notice || "";
  els.guildQuestNotice.dataset.type = snapshot.noticeType || "status";

  const root = document.createElement("div");
  root.className = "guild-quest-layout";
  root.append(
    createHistory(snapshot.statistics),
    createActiveQuest({ snapshot, materialDefinitions, onReport, onAbandon }),
    createBoard({ snapshot, questDefinitions, materialDefinitions, onAccept })
  );
  els.guildQuestContent.append(root);
}

function createHistory(statistics) {
  const section = document.createElement("section");
  section.className = "guild-quest-history";
  section.setAttribute("aria-label", "公會委託履歷");
  section.append(createHeading("公會履歷", "委託紀錄", `${statistics.completedTotal} 件`));
  const metrics = document.createElement("dl");
  metrics.className = "guild-quest-history-metrics";
  [
    ["普通", statistics.completedByRarity.common],
    ["進階", statistics.completedByRarity.advanced],
    ["稀有", statistics.completedByRarity.rare],
    ["累積賞金", `${statistics.rewardGoldTotal} G`]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = String(value);
    item.append(dt, dd);
    metrics.append(item);
  });
  section.append(metrics);
  return section;
}

function createActiveQuest({ snapshot, materialDefinitions, onReport, onAbandon }) {
  const section = document.createElement("section");
  section.className = "guild-quest-active-section";
  section.append(createHeading("目前承接", "進行中的委託"));
  if (!snapshot.activeQuest) {
    const empty = document.createElement("p");
    empty.className = "empty-state guild-quest-empty";
    empty.textContent = "目前沒有承接中的委託。";
    section.append(empty);
    return section;
  }

  const quest = snapshot.activeQuest;
  const target = getQuestTarget(quest);
  const complete = isQuestComplete({
    quest,
    active: snapshot.active,
    inventory: snapshot.inventory
  });
  const card = document.createElement("article");
  card.className = `guild-quest-active-card rarity-${quest.rarity}`;
  card.append(
    createQuestTitle(quest),
    createQuestDetails(quest, materialDefinitions),
    createProgress(snapshot.activeProgress, target, complete)
  );

  const actions = document.createElement("div");
  actions.className = "guild-quest-active-actions";
  const report = document.createElement("button");
  report.type = "button";
  report.className = "primary-button";
  report.disabled = !complete;
  report.textContent = complete ? "回報委託" : quest.objective.type === "deliverMaterials" ? "素材不足" : "尚未達標";
  report.addEventListener("click", () => onReport(quest.id));
  const abandon = document.createElement("button");
  abandon.type = "button";
  abandon.className = "secondary-button";
  abandon.textContent = "放棄委託";
  abandon.addEventListener("click", () => onAbandon(quest.id));
  actions.append(report, abandon);
  card.append(actions);
  section.append(card);
  return section;
}

function createBoard({ snapshot, questDefinitions, materialDefinitions, onAccept }) {
  const section = document.createElement("section");
  section.className = "guild-quest-board-section";
  section.append(createHeading("公會委託榜", "可承接委託", "4 項"));
  const board = document.createElement("div");
  board.className = "guild-quest-board";
  snapshot.boardQuestIds.forEach((questId) => {
    const quest = questDefinitions[questId];
    if (!quest) return;
    const isActive = snapshot.active?.questId === quest.id;
    const card = document.createElement("article");
    card.className = `guild-quest-card rarity-${quest.rarity}${isActive ? " is-active" : ""}`;
    card.append(
      createQuestTitle(quest),
      createQuestDetails(quest, materialDefinitions),
      createReward(quest),
      createCompletionCount(snapshot.completions[quest.id]?.count || 0)
    );
    const button = document.createElement("button");
    button.type = "button";
    button.className = isActive ? "secondary-button" : "primary-button";
    button.disabled = Boolean(snapshot.active);
    button.textContent = isActive ? "進行中" : snapshot.active ? "已有進行中的委託" : "承接委託";
    button.addEventListener("click", () => onAccept(quest.id));
    card.append(button);
    board.append(card);
  });
  section.append(board);
  return section;
}

function createQuestTitle(quest) {
  const heading = document.createElement("header");
  heading.className = "guild-quest-card-heading";
  const copy = document.createElement("div");
  const rarity = document.createElement("span");
  rarity.className = `guild-quest-rarity rarity-${quest.rarity}`;
  rarity.textContent = getQuestRarity(quest.rarity)?.label || quest.rarity;
  const title = document.createElement("h4");
  title.textContent = quest.name;
  copy.append(rarity, title);
  heading.append(copy);
  return heading;
}

function createQuestDetails(quest, materialDefinitions) {
  const details = document.createElement("div");
  details.className = "guild-quest-card-details";
  const description = document.createElement("p");
  description.textContent = quest.description;
  const objective = document.createElement("strong");
  objective.textContent = formatQuestObjective(quest, materialDefinitions);
  details.append(description, objective);
  return details;
}

function createReward(quest) {
  const reward = document.createElement("p");
  reward.className = "guild-quest-reward";
  const label = document.createElement("span");
  const value = document.createElement("strong");
  label.textContent = "委託賞金";
  value.textContent = `${quest.rewards.gold} G`;
  reward.append(label, value);
  return reward;
}

function createProgress(progress, target, complete) {
  const wrapper = document.createElement("div");
  wrapper.className = `guild-quest-progress${complete ? " is-complete" : ""}`;
  const label = document.createElement("div");
  const text = document.createElement("span");
  const value = document.createElement("strong");
  text.textContent = complete ? "可回報" : "目前進度";
  value.textContent = `${progress} / ${target}`;
  label.append(text, value);
  const track = document.createElement("div");
  const bar = document.createElement("i");
  bar.style.width = `${Math.min(100, Math.round(progress / Math.max(1, target) * 100))}%`;
  track.append(bar);
  wrapper.append(label, track);
  return wrapper;
}

function createCompletionCount(count) {
  const text = document.createElement("small");
  text.className = "guild-quest-completion-count";
  text.textContent = count > 0 ? `已完成 ${count} 次` : "尚未完成過";
  return text;
}

function createHeading(eyebrowText, titleText, badgeText = "") {
  const heading = document.createElement("div");
  heading.className = "browser-panel-heading guild-quest-section-heading";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = eyebrowText;
  const title = document.createElement("h3");
  title.textContent = titleText;
  copy.append(eyebrow, title);
  heading.append(copy);
  if (badgeText) {
    const badge = document.createElement("strong");
    badge.className = "result-count-badge";
    badge.textContent = badgeText;
    heading.append(badge);
  }
  return heading;
}
