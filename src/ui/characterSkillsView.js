const SKILL_TYPE_LABELS = {
  minor: "普通技能",
  milestone: "強技能",
  rare: "稀有技能"
};

export function renderCharacterSkills({ learnedListElement, nextSkillElement, character, progress, onSkillClick }) {
  const skills = getOrderedSkills(character);
  const currentLevel = Math.max(1, Math.floor(progress?.level || 1));
  const learnedSkills = skills.filter((skill) => currentLevel >= skill.level);
  const nextSkill = skills.find((skill) => skill.level > currentLevel);

  renderLearnedSkills(learnedListElement, learnedSkills, currentLevel, onSkillClick);
  renderNextSkill(nextSkillElement, nextSkill, currentLevel, onSkillClick);
}

export function formatSkillType(type) {
  const id = normalizeClassName(type || "unknown");
  return {
    id,
    label: SKILL_TYPE_LABELS[type] || "技能"
  };
}

function renderLearnedSkills(element, skills, currentLevel, onSkillClick) {
  if (!element) return;
  element.innerHTML = "";

  if (skills.length === 0) {
    const empty = document.createElement("span");
    empty.className = "skill-chip is-empty";
    empty.textContent = "尚未學會技能";
    element.append(empty);
    return;
  }

  skills.forEach((skill) => {
    element.append(createSkillButton(skill, currentLevel, onSkillClick));
  });
}

function renderNextSkill(element, skill, currentLevel, onSkillClick) {
  if (!element) return;
  element.innerHTML = "";

  if (!skill) {
    const empty = document.createElement("div");
    empty.className = "next-skill-card is-empty";
    empty.textContent = "已達目前技能上限";
    element.append(empty);
    return;
  }

  const type = formatSkillType(skill.type);
  const button = document.createElement("button");
  button.className = `next-skill-card skill-type-${type.id}`;
  button.type = "button";
  button.append(createSkillHeader(skill, type));

  const description = document.createElement("span");
  description.textContent = skill.description || "尚未記錄技能說明。";
  button.append(description);

  button.addEventListener("click", () => onSkillClick?.(skill, createSkillContext(skill, currentLevel)));
  element.append(button);
}

function createSkillButton(skill, currentLevel, onSkillClick) {
  const type = formatSkillType(skill.type);
  const button = document.createElement("button");
  button.className = `skill-chip skill-type-${type.id}`;
  button.type = "button";
  button.textContent = skill.name;
  button.addEventListener("click", () => onSkillClick?.(skill, createSkillContext(skill, currentLevel)));
  return button;
}

function createSkillHeader(skill, type) {
  const header = document.createElement("span");

  const title = document.createElement("strong");
  title.textContent = skill.name;
  header.append(title);

  const meta = document.createElement("small");
  meta.textContent = `Lv. ${skill.level} ${type.label}`;
  header.append(meta);

  return header;
}

function createSkillContext(skill, currentLevel) {
  const type = formatSkillType(skill.type);
  const levelsRemaining = Math.max(0, skill.level - currentLevel);
  return {
    learned: levelsRemaining === 0,
    levelsRemaining,
    type
  };
}

function getOrderedSkills(character) {
  return (character.skills || [])
    .map((skill, index) => ({ skill, index }))
    .sort((a, b) => (a.skill.level - b.skill.level) || (a.index - b.index))
    .map((entry) => entry.skill);
}

function normalizeClassName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-") || "unknown";
}
