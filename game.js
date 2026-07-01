"use strict";

const templates = {
  encounter: "{enemy} 出現在平原上。",
  heroDamage: "{actor} 攻擊了 {target}，造成 {amount} 點傷害。",
  enemyDamage: "{actor} 攻擊了 {target}，造成 {amount} 點傷害。",
  critical: "{actor} 打出了暴擊。",
  block: "{target} 擋下了一部分攻擊。",
  poisonApply: "{target} 中毒了。",
  poisonTick: "{target} 受到毒素影響，失去 {amount} 點生命。",
  heal: "{target} 恢復了 {amount} 點生命。",
  charge: "{actor} 準備衝撞。",
  shield: "{target} 獲得了 {amount} 點護盾。",
  victory: "{target} 倒下了。戰鬥勝利。",
  defeat: "{target} 倒下了。本輪冒險結束。",
  reward: "你選擇了強化：{reward}。",
  boss: "平原深處傳來沉重的腳步聲。",
  clear: "你擊敗了平原的首領。這次冒險成功了。"
};

const heroTemplate = {
  name: "冒險者",
  maxHp: 100,
  hp: 100,
  attack: 10,
  defense: 2,
  critChance: 0.05,
  shieldStart: 0,
  poisonPower: 0,
  regenEvery: 0,
  regenAmount: 0,
  killHeal: 0,
  slimeBonus: 0,
  damageReduction: 0,
  rewards: []
};

const enemies = [
  {
    id: "boar",
    name: "野豬",
    kind: "普通",
    family: "beast",
    maxHp: 34,
    attack: 8,
    defense: 1,
    critChance: 0.03,
    intro: "野豬壓低身體，前蹄刮過草地。"
  },
  {
    id: "slime",
    name: "史萊姆",
    kind: "普通",
    family: "slime",
    maxHp: 30,
    attack: 6,
    defense: 0,
    critChance: 0,
    intro: "史萊姆在草葉間緩慢蠕動。"
  },
  {
    id: "wolf",
    name: "草原狼",
    kind: "普通",
    family: "beast",
    maxHp: 28,
    attack: 9,
    defense: 0,
    critChance: 0.08,
    dodgeChance: 0.12,
    intro: "草原狼繞著你低聲咆哮。"
  },
  {
    id: "poison-slime",
    name: "毒史萊姆",
    kind: "普通",
    family: "slime",
    maxHp: 32,
    attack: 5,
    defense: 0,
    critChance: 0,
    poisonPower: 3,
    intro: "毒史萊姆冒出細小氣泡。"
  },
  {
    id: "horn-rabbit",
    name: "尖角兔",
    kind: "普通",
    family: "beast",
    maxHp: 22,
    attack: 7,
    defense: 0,
    critChance: 0.1,
    dodgeChance: 0.15,
    intro: "尖角兔從草叢裡竄出。"
  }
];

const elites = [
  {
    id: "giant-boar",
    name: "巨大野豬",
    kind: "精英",
    family: "beast",
    maxHp: 70,
    attack: 12,
    defense: 2,
    critChance: 0.05,
    chargeEvery: 3,
    intro: "巨大野豬用沉重鼻息震動草梗。"
  },
  {
    id: "mutant-slime",
    name: "變異史萊姆",
    kind: "精英",
    family: "slime",
    maxHp: 64,
    attack: 9,
    defense: 1,
    critChance: 0,
    regenEvery: 3,
    regenAmount: 6,
    intro: "變異史萊姆的核心在半透明身體裡閃動。"
  }
];

const boss = {
  id: "boar-king",
  name: "魔化野豬王",
  kind: "首領",
  family: "beast",
  maxHp: 118,
  attack: 14,
  defense: 3,
  critChance: 0.06,
  chargeEvery: 3,
  intro: "魔化野豬王踏碎土丘，闖入你的視線。"
};

const rewards = [
  {
    name: "磨利劍刃",
    description: "攻擊力 +2。",
    apply(hero) {
      hero.attack += 2;
    }
  },
  {
    name: "穩固體魄",
    description: "最大生命 +12，並恢復 12 點生命。",
    apply(hero) {
      hero.maxHp += 12;
      hero.hp = Math.min(hero.maxHp, hero.hp + 12);
    }
  },
  {
    name: "皮革護具",
    description: "防禦 +1。",
    apply(hero) {
      hero.defense += 1;
    }
  },
  {
    name: "精準攻勢",
    description: "暴擊率 +8%。",
    apply(hero) {
      hero.critChance += 0.08;
    }
  },
  {
    name: "冒險護符",
    description: "每場戰鬥開始獲得 8 點護盾。",
    apply(hero) {
      hero.shieldStart += 8;
    }
  },
  {
    name: "簡易繃帶",
    description: "每 3 回合恢復 5 點生命。",
    apply(hero) {
      hero.regenEvery = 3;
      hero.regenAmount += 5;
    }
  },
  {
    name: "酸液瓶",
    description: "攻擊時附加 2 點中毒傷害。",
    apply(hero) {
      hero.poisonPower += 2;
    }
  },
  {
    name: "喘息節奏",
    description: "擊敗敵人後恢復 10 點生命。",
    apply(hero) {
      hero.killHeal += 10;
    }
  },
  {
    name: "黏液研究",
    description: "對史萊姆類敵人的傷害 +15%。",
    apply(hero) {
      hero.slimeBonus += 0.15;
    }
  },
  {
    name: "解毒草",
    description: "受到的中毒傷害降低 50%。",
    apply(hero) {
      hero.damageReduction = Math.max(hero.damageReduction, 0.5);
    }
  }
];

const encounterPlan = ["normal", "normal", "normal", "elite", "normal", "normal", "elite", "boss"];

const state = {
  run: 0,
  selectedRegion: "平原",
  selectedHero: "冒險者",
  encounterIndex: 0,
  turn: 0,
  hero: null,
  enemy: null,
  awaitingReward: false,
  ended: false,
  log: []
};

const els = {
  menuScreen: document.querySelector("#menuScreen"),
  regionScreen: document.querySelector("#regionScreen"),
  characterScreen: document.querySelector("#characterScreen"),
  achievementScreen: document.querySelector("#achievementScreen"),
  gameScreen: document.querySelector("#gameScreen"),
  openRegionButton: document.querySelector("#openRegionButton"),
  openCharacterButton: document.querySelector("#openCharacterButton"),
  openAchievementButton: document.querySelector("#openAchievementButton"),
  selectAdventurerButton: document.querySelector("#selectAdventurerButton"),
  startButton: document.querySelector("#startButton"),
  restartButton: document.querySelector("#restartButton"),
  nextButton: document.querySelector("#nextButton"),
  encounterLabel: document.querySelector("#encounterLabel"),
  resultLabel: document.querySelector("#resultLabel"),
  heroName: document.querySelector("#heroName"),
  heroLevel: document.querySelector("#heroLevel"),
  heroHealthBar: document.querySelector("#heroHealthBar"),
  heroHealthText: document.querySelector("#heroHealthText"),
  enemyName: document.querySelector("#enemyName"),
  enemyKind: document.querySelector("#enemyKind"),
  enemyHealthBar: document.querySelector("#enemyHealthBar"),
  enemyHealthText: document.querySelector("#enemyHealthText"),
  currentStats: document.querySelector("#currentStats"),
  battleLog: document.querySelector("#battleLog"),
  rewardPanel: document.querySelector("#rewardPanel"),
  rewardChoices: document.querySelector("#rewardChoices"),
  endPanel: document.querySelector("#endPanel"),
  endTitle: document.querySelector("#endTitle"),
  endText: document.querySelector("#endText")
};

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === screenId);
  });

  if (screenId === "menuScreen") {
    els.resultLabel.textContent = "冒險準備中";
    els.encounterLabel.textContent = "尚未開始";
  }
  if (screenId === "regionScreen") {
    els.resultLabel.textContent = "選擇地區";
    els.encounterLabel.textContent = state.selectedRegion;
  }
  if (screenId === "characterScreen") {
    els.resultLabel.textContent = "選擇角色";
    els.encounterLabel.textContent = state.selectedHero;
  }
  if (screenId === "achievementScreen") {
    els.resultLabel.textContent = "尚未開放";
    els.encounterLabel.textContent = "成就系統";
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function roll(chance) {
  return Math.random() < chance;
}

function format(templateId, values = {}) {
  return templates[templateId].replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function addLog(type, templateId, values) {
  state.log.push({
    type,
    text: format(templateId, values)
  });
  renderLog();
}

function addFixedLog(type, text) {
  state.log.push({ type, text });
  renderLog();
}

function startRun() {
  state.run += 1;
  state.encounterIndex = 0;
  state.turn = 0;
  state.hero = clone(heroTemplate);
  state.enemy = null;
  state.awaitingReward = false;
  state.ended = false;
  state.log = [];

  showScreen("gameScreen");
  els.rewardPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  els.nextButton.disabled = false;

  startEncounter();
}

function restart() {
  showScreen("menuScreen");
  els.rewardPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  els.resultLabel.textContent = "冒險準備中";
  els.encounterLabel.textContent = "尚未開始";
}

function startEncounter() {
  const type = encounterPlan[state.encounterIndex];
  state.turn = 0;
  state.awaitingReward = false;
  state.log = [];
  state.enemy = buildEnemy(type, state.encounterIndex);
  state.enemy.poison = 0;
  state.hero.poison = 0;
  state.hero.shield = state.hero.shieldStart;

  els.rewardPanel.classList.remove("is-visible");
  els.nextButton.disabled = false;

  if (type === "boss") {
    addLog("system", "boss");
  }
  addLog("system", "encounter", { enemy: state.enemy.name });
  addFixedLog("status", state.enemy.intro);
  if (state.hero.shield > 0) {
    addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
  }
  render();
}

function buildEnemy(type, encounterIndex) {
  const base = type === "boss" ? boss : type === "elite" ? randomItem(elites) : randomItem(enemies);
  const enemy = clone(base);
  const scale = 1 + encounterIndex * 0.08;
  enemy.maxHp = Math.round(enemy.maxHp * scale);
  enemy.hp = enemy.maxHp;
  enemy.attack = Math.round(enemy.attack * scale);
  return enemy;
}

function playTurn() {
  if (state.ended || state.awaitingReward || !state.enemy) {
    return;
  }

  state.turn += 1;
  heroAction();
  if (state.enemy.hp <= 0) {
    winEncounter();
    return;
  }

  enemyAction();
  if (state.hero.hp <= 0) {
    loseRun();
    return;
  }

  applyEndOfTurnEffects();
  if (state.enemy.hp <= 0) {
    winEncounter();
    return;
  }
  if (state.hero.hp <= 0) {
    loseRun();
    return;
  }

  render();
}

function heroAction() {
  const enemy = state.enemy;
  const hero = state.hero;

  if (enemy.dodgeChance && roll(enemy.dodgeChance)) {
    addFixedLog("status", `${enemy.name} 閃開了攻擊。`);
    return;
  }

  let damage = Math.max(1, hero.attack - enemy.defense);
  if (enemy.family === "slime") {
    damage = Math.round(damage * (1 + hero.slimeBonus));
  }
  if (roll(hero.critChance)) {
    damage = Math.round(damage * 1.7);
    addLog("damage", "critical", { actor: hero.name });
  }

  enemy.hp = Math.max(0, enemy.hp - damage);
  addLog("damage", "heroDamage", {
    actor: hero.name,
    target: enemy.name,
    amount: damage
  });

  if (hero.poisonPower > 0 && enemy.hp > 0) {
    enemy.poison = Math.max(enemy.poison || 0, hero.poisonPower);
    addLog("status", "poisonApply", { target: enemy.name });
  }
}

function enemyAction() {
  const enemy = state.enemy;
  const hero = state.hero;
  let damage = Math.max(1, enemy.attack - hero.defense);

  if (enemy.chargeEvery && state.turn % enemy.chargeEvery === 0) {
    addLog("status", "charge", { actor: enemy.name });
    damage = Math.round(damage * 1.8);
  }

  if (roll(enemy.critChance || 0)) {
    damage = Math.round(damage * 1.6);
    addLog("damage", "critical", { actor: enemy.name });
  }

  if (hero.shield > 0) {
    const blocked = Math.min(hero.shield, damage);
    hero.shield -= blocked;
    damage -= blocked;
    addLog("status", "block", { target: hero.name });
  }

  hero.hp = Math.max(0, hero.hp - damage);
  addLog("damage", "enemyDamage", {
    actor: enemy.name,
    target: hero.name,
    amount: damage
  });

  if (enemy.poisonPower && hero.hp > 0) {
    hero.poison = Math.max(hero.poison || 0, enemy.poisonPower);
    addLog("status", "poisonApply", { target: hero.name });
  }
}

function applyEndOfTurnEffects() {
  const hero = state.hero;
  const enemy = state.enemy;

  if (hero.poison > 0) {
    const poisonDamage = Math.max(1, Math.round(hero.poison * (1 - hero.damageReduction)));
    hero.hp = Math.max(0, hero.hp - poisonDamage);
    addLog("damage", "poisonTick", { target: hero.name, amount: poisonDamage });
  }

  if (enemy.poison > 0) {
    enemy.hp = Math.max(0, enemy.hp - enemy.poison);
    addLog("damage", "poisonTick", { target: enemy.name, amount: enemy.poison });
  }

  if (hero.regenEvery > 0 && state.turn % hero.regenEvery === 0 && hero.hp > 0) {
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.regenAmount);
    addLog("heal", "heal", { target: hero.name, amount: hero.regenAmount });
  }

  if (enemy.regenEvery > 0 && state.turn % enemy.regenEvery === 0 && enemy.hp > 0) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenAmount);
    addLog("heal", "heal", { target: enemy.name, amount: enemy.regenAmount });
  }
}

function winEncounter() {
  const enemyName = state.enemy.name;
  addLog("system", "victory", { target: enemyName });

  if (state.hero.killHeal > 0) {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.killHeal);
    addLog("heal", "heal", { target: state.hero.name, amount: state.hero.killHeal });
  }

  state.encounterIndex += 1;
  render();

  if (state.encounterIndex >= encounterPlan.length) {
    addLog("system", "clear");
    finishRun(true);
    return;
  }

  showRewards();
}

function loseRun() {
  addLog("system", "defeat", { target: state.hero.name });
  finishRun(false);
}

function finishRun(cleared) {
  state.ended = true;
  state.awaitingReward = false;
  els.nextButton.disabled = true;
  els.rewardPanel.classList.remove("is-visible");
  els.endPanel.classList.add("is-visible");
  els.endTitle.textContent = cleared ? "冒險成功" : "冒險失敗";
  els.endText.textContent = cleared
    ? `你完成了平原的挑戰。本輪共通過 ${state.encounterIndex} 場遭遇。`
    : `你抵達了第 ${state.encounterIndex + 1} 場遭遇。本輪冒險結束。`;
  els.resultLabel.textContent = cleared ? "平原突破" : "本輪結束";
  render();
}

function showRewards() {
  state.awaitingReward = true;
  els.nextButton.disabled = true;
  els.rewardPanel.classList.add("is-visible");
  els.resultLabel.textContent = "選擇強化";
  els.rewardChoices.innerHTML = "";

  getRewardChoices(3).forEach((reward) => {
    const button = document.createElement("button");
    button.className = "reward-card";
    button.type = "button";
    button.innerHTML = `<strong>${reward.name}</strong><span>${reward.description}</span>`;
    button.addEventListener("click", () => chooseReward(reward));
    els.rewardChoices.append(button);
  });
}

function getRewardChoices(count) {
  const pool = [...rewards];
  const choices = [];
  while (choices.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

function chooseReward(reward) {
  reward.apply(state.hero);
  state.hero.rewards.push(reward.name);
  addLog("system", "reward", { reward: reward.name });
  startEncounter();
}

function render() {
  const hero = state.hero;
  const enemy = state.enemy;

  els.heroName.textContent = hero.name;
  els.heroLevel.textContent = `第 ${state.run} 輪`;
  setMeter(els.heroHealthBar, hero.hp, hero.maxHp);
  els.heroHealthText.textContent = `${hero.hp} / ${hero.maxHp}`;

  els.enemyName.textContent = enemy ? enemy.name : "敵人";
  els.enemyKind.textContent = enemy ? enemy.kind : "普通";
  setMeter(els.enemyHealthBar, enemy ? enemy.hp : 0, enemy ? enemy.maxHp : 1);
  els.enemyHealthText.textContent = enemy ? `${enemy.hp} / ${enemy.maxHp}` : "0 / 0";

  els.encounterLabel.textContent = `第 ${Math.min(state.encounterIndex + 1, encounterPlan.length)} / ${encounterPlan.length} 場`;
  if (!state.ended) {
    els.resultLabel.textContent = state.awaitingReward
      ? "選擇強化"
      : state.turn === 0
        ? "遭遇開始"
        : `第 ${state.turn} 回合`;
  }

  els.currentStats.innerHTML = "";
  [
    ["攻擊", hero.attack],
    ["防禦", hero.defense],
    ["暴擊", `${Math.round(hero.critChance * 100)}%`],
    ["護盾", hero.shield || 0],
    ["中毒", hero.poison || 0],
    ["強化", hero.rewards.length]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    els.currentStats.append(item);
  });
}

function renderLog() {
  els.battleLog.innerHTML = "";
  state.log.slice(-80).forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.type;
    item.textContent = entry.text;
    els.battleLog.append(item);
  });
  els.battleLog.scrollTop = els.battleLog.scrollHeight;
}

function setMeter(element, value, max) {
  const ratio = Math.max(0, Math.min(1, value / max));
  element.style.width = `${Math.round(ratio * 100)}%`;
}

els.openRegionButton.addEventListener("click", () => showScreen("regionScreen"));
els.openCharacterButton.addEventListener("click", () => showScreen("characterScreen"));
els.openAchievementButton.addEventListener("click", () => showScreen("achievementScreen"));
els.selectAdventurerButton.addEventListener("click", () => {
  state.selectedHero = "冒險者";
  showScreen("menuScreen");
});
document.querySelectorAll(".back-button").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.target));
});
els.startButton.addEventListener("click", startRun);
els.restartButton.addEventListener("click", restart);
els.nextButton.addEventListener("click", playTurn);
