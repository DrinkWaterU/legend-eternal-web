const SKILL_TYPE_LABELS = Object.freeze({
  minor: "一般技能",
  milestone: "里程碑技能",
  rare: "稀有技能"
});

const UPGRADE_LABELS = Object.freeze(["基礎", "強化 I", "強化 II", "強化 III"]);

export function renderCharacterSkills({
  listElement,
  detailElement,
  nextSkillElement,
  countElement,
  emptyElement,
  stageFilterElement,
  character,
  progress,
  selectedSkillId = null,
  searchQuery = "",
  typeFilter = "all",
  stageFilter = "all",
  onSkillSelect
}) {
  const model = buildCharacterSkillModel(character, progress);
  const visibleSkills = filterCharacterSkills(model.learnedSkills, {
    searchQuery,
    typeFilter,
    stageFilter
  });
  const resolvedSelectedSkillId = visibleSkills.some((skill) => skill.id === selectedSkillId)
    ? selectedSkillId
    : visibleSkills[0]?.id || null;

  listElement.replaceChildren();
  visibleSkills.forEach((skill) => {
    listElement.append(createSkillIndexButton(skill, resolvedSelectedSkillId, onSkillSelect));
  });

  countElement.textContent = visibleSkills.length === model.learnedSkills.length
    ? `${model.learnedSkills.length} 項`
    : `${visibleSkills.length} / ${model.learnedSkills.length} 項`;
  emptyElement.hidden = visibleSkills.length > 0;
  renderStageFilterState(stageFilterElement, stageFilter);
  renderSkillDetail(detailElement, visibleSkills.find((skill) => skill.id === resolvedSelectedSkillId) || null);
  renderNextSkill(nextSkillElement, model.nextSkill);

  return {
    selectedSkillId: resolvedSelectedSkillId,
    visibleCount: visibleSkills.length,
    totalCount: model.learnedSkills.length
  };
}

export function buildCharacterSkillModel(character = {}, progress = {}) {
  const currentLevel = Math.min(
    Math.max(1, Math.floor(progress?.level || 1)),
    Math.max(1, Math.floor(character?.levelCurve?.maxLevel || progress?.level || 1))
  );
  const ordered = (Array.isArray(character.skills) ? character.skills : [])
    .map((skill, index) => ({ ...skill, _sourceIndex: index }))
    .sort((left, right) => (left.level - right.level) || (left._sourceIndex - right._sourceIndex));
  const byId = new Map(ordered.map((skill) => [skill.id, skill]));
  const grouped = new Map();

  ordered.forEach((skill) => {
    const rootId = findRootSkillId(skill, byId);
    if (!grouped.has(rootId)) {
      grouped.set(rootId, []);
    }
    grouped.get(rootId).push(skill);
  });

  const learnedSkills = ordered
    .filter((skill) => !skill.targetSkillId)
    .map((baseSkill) => {
      const chain = (grouped.get(baseSkill.id) || [baseSkill])
        .sort((left, right) => (left.level - right.level) || (left._sourceIndex - right._sourceIndex));
      const learnedStages = chain.filter((stage) => stage.level <= currentLevel);
      if (learnedStages.length === 0) {
        return null;
      }
      const activeStage = learnedStages.at(-1);
      return {
        id: baseSkill.id,
        baseName: baseSkill.name,
        name: activeStage.name,
        type: baseSkill.type || "minor",
        baseLevel: baseSkill.level,
        currentLevel: activeStage.level,
        upgradeTier: Math.max(0, learnedStages.length - 1),
        stages: learnedStages.map((stage, tier) => ({
          tier,
          id: stage.id,
          name: stage.name,
          level: stage.level,
          description: stage.description || "尚未記錄技能說明。"
        }))
      };
    })
    .filter(Boolean);

  const nextRaw = ordered.find((skill) => skill.level > currentLevel) || null;
  let nextSkill = null;
  if (nextRaw) {
    const rootId = findRootSkillId(nextRaw, byId);
    const chain = (grouped.get(rootId) || [nextRaw])
      .sort((left, right) => (left.level - right.level) || (left._sourceIndex - right._sourceIndex));
    nextSkill = {
      ...nextRaw,
      rootId,
      upgradeTier: Math.max(0, chain.findIndex((stage) => stage.id === nextRaw.id))
    };
  }

  return { currentLevel, learnedSkills, nextSkill };
}

export function filterCharacterSkills(skills = [], options = {}) {
  const query = String(options.searchQuery || "").trim().toLocaleLowerCase("zh-Hant");
  const typeFilter = options.typeFilter || "all";
  const stageFilter = options.stageFilter || "all";
  return skills.filter((skill) => {
    const searchable = `${skill.name} ${skill.baseName} ${skill.stages.map((stage) => stage.description).join(" ")}`
      .toLocaleLowerCase("zh-Hant");
    const matchesQuery = !query || searchable.includes(query);
    const matchesType = typeFilter === "all" || skill.type === typeFilter;
    const matchesStage = stageFilter === "all"
      || (stageFilter === "base" && skill.upgradeTier === 0)
      || (stageFilter === "upgraded" && skill.upgradeTier > 0);
    return matchesQuery && matchesType && matchesStage;
  });
}

export function formatSkillType(type) {
  const id = normalizeClassName(type || "unknown");
  return { id, label: SKILL_TYPE_LABELS[type] || "技能" };
}

export function getSkillUpgradeLabel(tier) {
  if (tier < UPGRADE_LABELS.length) {
    return UPGRADE_LABELS[tier];
  }
  return `強化 ${romanNumeral(tier)}`;
}

function createSkillIndexButton(skill, selectedSkillId, onSkillSelect) {
  const type = formatSkillType(skill.type);
  const tier = Math.min(3, skill.upgradeTier);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `skill-entry skill-type-${type.id} upgrade-tier-${tier}`;
  button.classList.toggle("is-selected", skill.id === selectedSkillId);
  button.setAttribute("aria-pressed", String(skill.id === selectedSkillId));
  button.setAttribute("role", "listitem");

  const marker = document.createElement("span");
  marker.className = "skill-entry-marker";
  marker.textContent = skill.upgradeTier > 0 ? romanNumeral(skill.upgradeTier) : "●";
  marker.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  copy.className = "skill-entry-copy";
  const name = document.createElement("strong");
  name.textContent = skill.name;
  const meta = document.createElement("small");
  meta.textContent = `Lv. ${skill.currentLevel}｜${type.label}`;
  copy.append(name, meta);

  const stage = document.createElement("span");
  stage.className = "skill-entry-stage";
  stage.textContent = getSkillUpgradeLabel(skill.upgradeTier);
  button.append(marker, copy, stage);
  button.addEventListener("click", () => onSkillSelect?.(skill.id));
  return button;
}

function renderSkillDetail(element, skill) {
  element.replaceChildren();
  if (!skill) {
    element.className = "character-skill-detail is-empty";
    const empty = document.createElement("p");
    empty.textContent = "請調整搜尋或篩選條件，選擇一項技能查看完整效果。";
    element.append(empty);
    return;
  }

  const type = formatSkillType(skill.type);
  const tier = Math.min(3, skill.upgradeTier);
  element.className = `character-skill-detail skill-type-${type.id} upgrade-tier-${tier}`;

  const heading = document.createElement("header");
  heading.className = "skill-detail-heading";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.textContent = `${type.label}｜${getSkillUpgradeLabel(skill.upgradeTier)}`;
  const title = document.createElement("h4");
  title.textContent = skill.name;
  const meta = document.createElement("small");
  meta.textContent = skill.baseName === skill.name
    ? `Lv. ${skill.currentLevel} 習得`
    : `${skill.baseName} → ${skill.name}`;
  copy.append(eyebrow, title, meta);
  const badge = document.createElement("strong");
  badge.textContent = getSkillUpgradeLabel(skill.upgradeTier);
  heading.append(copy, badge);

  const stages = document.createElement("div");
  stages.className = "skill-stage-history";
  skill.stages.forEach((stage) => {
    const card = document.createElement("section");
    card.className = `skill-stage-card upgrade-tier-${Math.min(3, stage.tier)}`;
    const stageHeading = document.createElement("div");
    const stageName = document.createElement("strong");
    stageName.textContent = stage.name;
    const stageMeta = document.createElement("span");
    stageMeta.textContent = `${getSkillUpgradeLabel(stage.tier)}｜Lv. ${stage.level}`;
    stageHeading.append(stageName, stageMeta);
    const description = document.createElement("p");
    description.textContent = stage.description;
    card.append(stageHeading, description);
    stages.append(card);
  });

  element.append(heading, stages);
}

function renderNextSkill(element, skill) {
  element.replaceChildren();
  const label = document.createElement("span");
  label.textContent = "下一技能";
  const content = document.createElement("div");
  const name = document.createElement("strong");
  const meta = document.createElement("small");
  if (!skill) {
    name.textContent = "已達目前技能上限";
    meta.textContent = "目前沒有下一項可習得技能。";
    element.classList.add("is-complete");
  } else {
    const type = formatSkillType(skill.type);
    name.textContent = skill.name;
    meta.textContent = `Lv. ${skill.level}｜${type.label}｜${getSkillUpgradeLabel(skill.upgradeTier)}`;
    element.classList.remove("is-complete");
  }
  content.append(name, meta);
  element.append(label, content);
}

function renderStageFilterState(element, activeFilter) {
  element.querySelectorAll("[data-stage-filter]").forEach((button) => {
    const active = button.dataset.stageFilter === activeFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function findRootSkillId(skill, byId) {
  let current = skill;
  const visited = new Set();
  while (current?.targetSkillId && !visited.has(current.id)) {
    visited.add(current.id);
    const target = byId.get(current.targetSkillId);
    if (!target) {
      break;
    }
    current = target;
  }
  return current?.id || skill.id;
}

function romanNumeral(value) {
  const numerals = ["", "I", "II", "III", "IV", "V"];
  return numerals[value] || String(value);
}

function normalizeClassName(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "unknown";
}
