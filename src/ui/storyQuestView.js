import { STORY_QUEST_STATUSES, getStoryQuestObjective } from "../core/storyQuestRules.js";

const TYPE_LABELS = Object.freeze({
  main: "主線任務",
  side: "支線任務"
});

export function renderStoryQuestView({ els, safeAreaName, entries }) {
  els.storyQuestAreaLabel.textContent = safeAreaName || "安全區";
  const activeEntries = entries.filter(({ record }) => (
    record.status !== STORY_QUEST_STATUSES.COMPLETED
  ));
  const completedEntries = entries.filter(({ record }) => (
    record.status === STORY_QUEST_STATUSES.COMPLETED
  ));
  renderQuestSection(els.storyQuestActiveList, els.storyQuestActiveEmpty, activeEntries);
  renderQuestSection(els.storyQuestCompletedList, els.storyQuestCompletedEmpty, completedEntries);
}

function renderQuestSection(list, empty, entries) {
  list.replaceChildren();
  empty.hidden = entries.length > 0;
  entries.forEach(({ definition, record }) => {
    list.append(createQuestCard(definition, record));
  });
}

function createQuestCard(definition, record) {
  const completed = record.status === STORY_QUEST_STATUSES.COMPLETED;
  const card = document.createElement("article");
  card.className = `story-quest-card${completed ? " is-completed" : ""}`;

  const heading = document.createElement("header");
  const titleGroup = document.createElement("div");
  const type = document.createElement("p");
  const title = document.createElement("h3");
  const status = document.createElement("span");
  type.className = "eyebrow";
  type.textContent = TYPE_LABELS[definition.type] || "劇情任務";
  title.textContent = definition.name;
  status.className = "story-quest-status";
  status.textContent = completed
    ? "已完成"
    : record.status === STORY_QUEST_STATUSES.AVAILABLE
      ? "可開始"
      : "進行中";
  titleGroup.append(type, title);
  heading.append(titleGroup, status);

  const summary = document.createElement("p");
  summary.className = "body-text story-quest-summary";
  summary.textContent = definition.summary;
  const objective = document.createElement("p");
  objective.className = "story-quest-objective";
  objective.textContent = getStoryQuestObjective(definition, record);
  card.append(heading, summary, objective);
  return card;
}
