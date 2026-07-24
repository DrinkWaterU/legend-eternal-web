import { applyCharacterPortraitFocus, getCharacterPortraitPath } from "./characterPortrait.js";

let guildRecordSectionCounter = 0;

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
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "安平鎮分會紀錄";
  const title = document.createElement("h3");
  title.textContent = "冒險者資歷摘要";
  heading.append(eyebrow, title);

  sheet.append(
    heading,
    createIdentityCard(model.selectedCharacter),
    createMetrics(model.summary),
    createExperienceSection(model.experiences),
    createQuestHistorySection(model.questHistory),
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
    path: getCharacterPortraitPath(character, character.id),
    focus: character.portraitFocus,
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
  const list = document.createElement("div");
  list.className = "guild-record-milestone-list";
  if (experiences.length === 0) {
    list.append(createEmpty("目前還沒有可列入公會資歷的主要經歷。"));
  } else {
    experiences.forEach((experience) => {
      const row = document.createElement("article");
      row.className = "guild-record-milestone guild-record-reveal-item";
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
  return createCollapsibleSection("公會確認", "主要經歷", `${experiences.length} 項`, list);
}

function createQuestHistorySection(history) {
  const content = document.createElement("div");
  content.className = "guild-record-quest-history";
  const metrics = document.createElement("dl");
  metrics.className = "guild-record-quest-metrics guild-record-reveal-item";
  [
    ["普通委託", history.completedByRarity.common],
    ["進階委託", history.completedByRarity.advanced],
    ["稀有委託", history.completedByRarity.rare],
    ["累積賞金", `${history.rewardGoldTotal} G`]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = String(value);
    item.append(dt, dd);
    metrics.append(item);
  });
  const totals = document.createElement("div");
  totals.className = "guild-record-quest-totals";
  totals.append(
    createQuestTotal("委託完成總數", "完成回報並結案後才列入", history.completedTotal),
    createQuestTotal("放棄委託", "進度歸零且不刷新原看板", history.abandonedTotal)
  );
  [...totals.children].forEach?.((item) => item.classList.add("guild-record-reveal-item"));
  content.append(metrics, totals);
  return createCollapsibleSection("公會正式紀錄", "委託履歷", `${history.completedTotal} 件`, content);
}

function createQuestTotal(labelText, descriptionText, valueText) {
  const row = document.createElement("article");
  row.className = "guild-record-quest-total";
  const copy = document.createElement("div");
  const label = document.createElement("strong");
  const description = document.createElement("small");
  label.textContent = labelText;
  description.textContent = descriptionText;
  copy.append(label, description);
  const value = document.createElement("b");
  value.textContent = String(valueText);
  row.append(copy, value);
  return row;
}

function createCharactersSection(characters) {
  const list = document.createElement("div");
  list.className = "guild-record-character-list";
  if (characters.length === 0) {
    list.append(createEmpty("目前沒有已解鎖角色。"));
  } else {
    characters.forEach((character) => {
      const card = document.createElement("article");
      card.className = "guild-record-character-card guild-record-reveal-item";
      const emblem = createEmblem({
        className: "guild-record-character-emblem",
        path: getCharacterPortraitPath(character, character.id),
        focus: character.portraitFocus,
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
  return createCollapsibleSection("已登記身分", "可用角色", `${characters.length} 名`, list);
}

function createCollapsibleSection(eyebrowText, titleText, badgeText, content) {
  const section = document.createElement("section");
  section.className = "guild-record-section guild-record-collapsible";
  const contentId = `guildRecordSection-${++guildRecordSectionCounter}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "guild-record-collapse-toggle";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", contentId);
  const copy = document.createElement("span");
  copy.className = "guild-record-collapse-copy";
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = eyebrowText;
  const title = document.createElement("strong");
  title.textContent = titleText;
  copy.append(eyebrow, title);
  const badge = document.createElement("span");
  badge.className = "result-count-badge";
  badge.textContent = badgeText;
  const arrow = document.createElement("span");
  arrow.className = "guild-record-collapse-arrow";
  arrow.textContent = "⌄";
  button.append(copy, badge, arrow);

  const wrapper = document.createElement("div");
  wrapper.id = contentId;
  wrapper.className = "guild-record-collapse-content";
  wrapper.hidden = true;
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.append(content);
  button.addEventListener("click", () => toggleCollapsibleSection({ section, button, wrapper }));
  section.append(button, wrapper);
  return section;
}

function toggleCollapsibleSection({ section, button, wrapper }) {
  if (section.classList.contains("is-animating")) return;
  const open = button.getAttribute("aria-expanded") === "true";
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.classList.add("is-animating");
  button.disabled = true;
  if (open) {
    section.classList.remove("is-revealed");
    wrapper.style.height = `${wrapper.scrollHeight || 0}px`;
    requestFrame(() => { wrapper.style.height = "0px"; });
    finishAfter(wrapper, reducedMotion ? 0 : 280, () => {
      wrapper.hidden = true;
      wrapper.setAttribute("aria-hidden", "true");
      section.classList.remove("is-open", "is-animating");
      button.setAttribute("aria-expanded", "false");
      button.disabled = false;
      wrapper.style.height = "";
    });
    return;
  }
  wrapper.hidden = false;
  wrapper.setAttribute("aria-hidden", "false");
  wrapper.style.height = "0px";
  section.classList.add("is-open");
  requestFrame(() => { wrapper.style.height = `${wrapper.scrollHeight || 0}px`; });
  finishAfter(wrapper, reducedMotion ? 0 : 300, () => {
    wrapper.style.height = "auto";
    section.classList.add("is-revealed");
    section.classList.remove("is-animating");
    button.setAttribute("aria-expanded", "true");
    button.disabled = false;
  });
}

function finishAfter(element, duration, callback) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    callback();
  };
  element.addEventListener?.("transitionend", finish, { once: true });
  setTimeout(finish, duration + 40);
}

function requestFrame(callback) {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
  else callback();
}

function createCelineNote(text) {
  const note = document.createElement("blockquote");
  note.className = "guild-record-celine-note";
  note.textContent = `「${String(text || "").replace(/^「|」$/gu, "")}」`;
  return note;
}

function createEmblem({ className, path, focus, name }) {
  const emblem = document.createElement("span");
  emblem.className = className;
  if (!path) {
    emblem.textContent = name.charAt(0) || "？";
    return emblem;
  }
  const image = document.createElement("img");
  image.src = path;
  image.alt = `${name}徽記`;
  applyCharacterPortraitFocus(image, { portraitFocus: focus });
  image.addEventListener("error", () => {
    image.hidden = true;
    emblem.textContent = name.charAt(0) || "？";
  });
  emblem.append(image);
  return emblem;
}

function createEmpty(text) {
  const empty = document.createElement("p");
  empty.className = "empty-state guild-record-reveal-item";
  empty.textContent = text;
  return empty;
}
