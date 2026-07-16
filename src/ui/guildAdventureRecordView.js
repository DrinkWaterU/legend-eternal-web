export function renderGuildAdventureRecordView({ els, model, npc = null }) {
  els.guildRecordContent.replaceChildren();

  const layout = document.createElement("div");
  layout.className = "guild-record-layout";
  layout.append(createReceptionCard(npc), createRecordSheet(model));
  els.guildRecordContent.append(layout);
}

function createReceptionCard(npc) {
  const card = document.createElement("aside");
  card.className = "guild-record-reception-card";
  card.setAttribute("aria-label", "接待員瑟琳");

  const portrait = document.createElement("figure");
  portrait.className = "guild-record-portrait-card";
  const image = document.createElement("img");
  const displayName = String(npc?.name || "瑟琳");
  image.src = String(npc?.portrait || "./assets/images/npcs/anping/celine.png");
  image.alt = `${displayName}的立繪`;
  const fallback = document.createElement("span");
  fallback.className = "guild-record-portrait-fallback";
  fallback.textContent = displayName;
  fallback.hidden = true;
  image.addEventListener("error", () => {
    image.hidden = true;
    fallback.hidden = false;
  });
  portrait.append(image, fallback);

  const copy = document.createElement("div");
  copy.className = "guild-record-reception-copy";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = String(npc?.title || "冒險者公會資深接待員");
  const name = document.createElement("h3");
  name.textContent = displayName;
  const quote = document.createElement("p");
  quote.textContent = "「數字不能代表你的全部，但它們確實記錄了你平安走過的路。」";
  copy.append(eyebrow, name, quote);
  card.append(portrait, copy);
  return card;
}

function createRecordSheet(model) {
  const sheet = document.createElement("section");
  sheet.className = "guild-record-sheet";
  sheet.setAttribute("aria-label", "公會冒險資歷紀錄");

  const heading = document.createElement("header");
  heading.className = "guild-record-sheet-heading";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "安平鎮分會紀錄";
  const title = document.createElement("h3");
  title.textContent = "冒險者資歷摘要";
  const description = document.createElement("p");
  description.textContent = "本頁只整理公會能從既有紀錄確認的內容，不會覆蓋原本的統計資料。";
  copy.append(eyebrow, title, description);
  heading.append(copy);

  sheet.append(
    heading,
    createIdentityCard(model.selectedCharacter),
    createMetrics(model.summary),
    createExperienceSection(model.experiences),
    createCharactersSection(model.unlockedCharacters),
    createCelineNote(model.celineComment)
  );
  return sheet;
}

function createIdentityCard(character) {
  const card = document.createElement("section");
  card.className = "guild-record-identity-card";
  if (!character) {
    card.append(createEmpty("目前沒有可顯示的角色資料。"));
    return card;
  }

  const emblem = createEmblem({
    className: "guild-record-current-emblem",
    path: character.emblemPath,
    name: character.name
  });

  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "目前登記身分";
  const title = document.createElement("h4");
  title.textContent = `${character.name} Lv.${character.level}`;
  const meta = document.createElement("p");
  meta.textContent = `${character.role}｜已掌握 ${character.learnedSkillCount} 項技能`;
  copy.append(eyebrow, title, meta);

  const status = document.createElement("strong");
  status.className = "guild-record-status";
  status.textContent = character.atMaxLevel ? "已達現階段上限" : `等級上限 ${character.maxLevel}`;
  card.append(emblem, copy, status);
  return card;
}

function createMetrics(summary) {
  const metrics = document.createElement("dl");
  metrics.className = "guild-record-metrics";
  [
    ["冒險次數", summary.totalRuns],
    ["總通關", summary.totalClears],
    ["擊敗敵人", summary.totalEnemiesDefeated],
    ["擊敗首領", summary.bossesDefeated]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = String(value);
    item.append(dt, dd);
    metrics.append(item);
  });
  return metrics;
}

function createExperienceSection(experiences) {
  const section = createSection("公會確認", "主要經歷", `${experiences.length} 項`);
  const list = document.createElement("div");
  list.className = "guild-record-milestone-list";
  if (experiences.length === 0) {
    list.append(createEmpty("目前還沒有可列入公會資歷的主要經歷。"));
  } else {
    experiences.forEach((experience) => {
      const row = document.createElement("article");
      row.className = "guild-record-milestone";
      const marker = document.createElement("span");
      marker.className = "guild-record-milestone-marker";
      marker.textContent = "✓";
      const copy = document.createElement("div");
      const label = document.createElement("strong");
      const status = document.createElement("small");
      label.textContent = experience.label;
      status.textContent = experience.status;
      copy.append(label, status);
      row.append(marker, copy);
      list.append(row);
    });
  }
  section.append(list);
  return section;
}

function createCharactersSection(characters) {
  const section = createSection("已登記身分", "可使用角色");
  const list = document.createElement("div");
  list.className = "guild-record-character-list";
  if (characters.length === 0) {
    list.append(createEmpty("目前沒有已解鎖角色。"));
  } else {
    characters.forEach((character) => {
      const card = document.createElement("article");
      card.className = "guild-record-character-card";
      const emblem = createEmblem({
        className: "guild-record-character-emblem",
        path: `./assets/images/characters/${character.id}/emblem.png`,
        name: character.name
      });
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      const meta = document.createElement("small");
      name.textContent = character.name;
      meta.textContent = `${character.role}｜Lv. ${character.level}`;
      copy.append(name, meta);
      card.append(emblem, copy);
      list.append(card);
    });
  }
  section.append(list);
  return section;
}

function createCelineNote(text) {
  const note = document.createElement("blockquote");
  note.className = "guild-record-celine-note";
  note.textContent = `「${String(text || "").replace(/^「|」$/gu, "")}」`;
  return note;
}

function createSection(eyebrowText, titleText, badgeText = "") {
  const section = document.createElement("section");
  section.className = "guild-record-section";
  const heading = document.createElement("div");
  heading.className = "browser-panel-heading";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = eyebrowText;
  const title = document.createElement("h4");
  title.textContent = titleText;
  copy.append(eyebrow, title);
  heading.append(copy);
  if (badgeText) {
    const badge = document.createElement("strong");
    badge.className = "result-count-badge";
    badge.textContent = badgeText;
    heading.append(badge);
  }
  section.append(heading);
  return section;
}

function createEmblem({ className, path, name }) {
  const emblem = document.createElement("span");
  emblem.className = className;
  const image = document.createElement("img");
  image.src = path;
  image.alt = `${name}徽記`;
  image.addEventListener("error", () => {
    image.hidden = true;
    emblem.textContent = name.charAt(0) || "？";
  });
  emblem.append(image);
  return emblem;
}

function createEmpty(text) {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}
