import { createWeaponIcon, getWeaponRarityLabel } from "./weaponViewHelpers.js";
import { getCharacterOtherRuns, safeStatisticCount } from "./statisticsMetrics.js";
import { createCharacterEmblem, renderDefinitionList } from "./statisticsViewHelpers.js";

export function renderStatisticsCharacterBrowser({
  els,
  uiState,
  saveData,
  characterDefinitions,
  equippedWeaponsByCharacterId,
  onCharacterSelect
}) {
  const entries = Object.entries(characterDefinitions)
    .filter(([characterId]) => saveData.progression.characters[characterId]?.unlocked === true);
  const resolvedId = entries.some(([characterId]) => characterId === uiState.statisticsCharacterId)
    ? uiState.statisticsCharacterId
    : entries[0]?.[0] || null;
  uiState.statisticsCharacterId = resolvedId;
  els.statisticsCharacterList.replaceChildren();

  entries.forEach(([characterId, character]) => {
    const progress = saveData.progression.characters[characterId];
    const stats = saveData.statistics.characters[characterId] || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = "statistics-character-card";
    const selected = characterId === resolvedId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const summary = document.createElement("span");
    name.textContent = character.name;
    meta.textContent = `${character.role || "角色"}｜Lv. ${Math.max(1, progress.level || 1)}`;
    summary.textContent = `出戰 ${safeStatisticCount(stats.runs)} 次｜通關 ${safeStatisticCount(stats.clears)} 次`;
    copy.append(name, meta, summary);
    button.append(createCharacterEmblem(characterId, character.name, character), copy);
    button.addEventListener("click", () => onCharacterSelect?.(characterId));
    els.statisticsCharacterList.append(button);
  });

  renderCharacterDetail({
    element: els.statisticsCharacterDetail,
    characterId: resolvedId,
    character: characterDefinitions[resolvedId],
    progress: saveData.progression.characters[resolvedId],
    stats: saveData.statistics.characters[resolvedId] || {},
    weapon: equippedWeaponsByCharacterId[resolvedId] || null
  });
}

function renderCharacterDetail({ element, characterId, character, progress, stats, weapon }) {
  element.replaceChildren();
  if (!character || !progress) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有可查看的角色紀錄。";
    element.append(empty);
    return;
  }

  const header = document.createElement("header");
  header.className = "statistics-detail-heading";
  const identity = document.createElement("div");
  identity.append(createCharacterEmblem(characterId, character.name, character));
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  const title = document.createElement("h3");
  const meta = document.createElement("p");
  eyebrow.textContent = "角色冒險紀錄";
  title.textContent = character.name;
  meta.textContent = `${character.role || "角色"}｜目前 Lv. ${Math.max(1, progress.level || 1)}`;
  copy.append(eyebrow, title, meta);
  identity.append(copy);
  header.append(identity);

  const growth = createDetailSection("永久成長", [
    ["目前等級", `Lv. ${Math.max(1, progress.level || 1)}`],
    ["目前經驗", safeStatisticCount(progress.exp)],
    ["已學技能", Array.isArray(progress.learnedSkills) ? progress.learnedSkills.length : 0],
    ["目前武器", weapon?.name || "未裝備"]
  ]);
  const record = createDetailSection("冒險紀錄", [
    ["出戰次數", safeStatisticCount(stats.runs)],
    ["通關次數", safeStatisticCount(stats.clears)],
    ["撤退次數", safeStatisticCount(stats.retreats)],
    ["其他出戰", getCharacterOtherRuns(stats)],
    ["冒險最高等級", safeStatisticCount(stats.highestRunLevel) > 0 ? `Lv. ${safeStatisticCount(stats.highestRunLevel)}` : "尚未記錄"]
  ]);

  if (weapon) {
    const weaponRow = document.createElement("div");
    weaponRow.className = "statistics-equipped-weapon";
    const weaponCopy = document.createElement("div");
    const label = document.createElement("span");
    const name = document.createElement("strong");
    label.textContent = `${getWeaponRarityLabel(weapon)}品級武器`;
    name.textContent = weapon.name;
    weaponCopy.append(label, name);
    weaponRow.append(createWeaponIcon(weapon, { className: "weapon-icon statistics-weapon-icon" }), weaponCopy);
    growth.append(weaponRow);
  }
  element.append(header, growth, record);
}

function createDetailSection(titleText, items) {
  const section = document.createElement("section");
  section.className = "statistics-detail-section";
  const title = document.createElement("h4");
  title.textContent = titleText;
  const list = document.createElement("dl");
  list.className = "statistics-detail-grid";
  renderDefinitionList(list, items, "statistics-detail-stat");
  section.append(title, list);
  return section;
}
