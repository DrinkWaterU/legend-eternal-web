import assert from "node:assert/strict";

import { resolveCharacterPlayerAction, initializeCharacterBattleState, modifyCharacterIncomingDirectDamage } from "../src/characters/skills/index.js";
import { applyEnemyPoisonDamage, resolveHeroAction } from "../src/core/combat.js";
import { getCampExperienceSummary } from "../src/features/safeArea/campController.js";
import { migrateSave, createDefaultSave } from "../src/core/storage.js";
import { LV25_EXP_CAP_MIGRATION_SCHEMA_VERSION } from "../src/core/saveMigrations.js";
import {
  buildHeroFromProgression,
  getCharacterExperienceLabel,
  getExpStorageLimit
} from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";
import { createBattleSettlement } from "../src/features/battle/battleSettlement.js";
import { createCharacterProgression } from "../src/features/character/characterProgression.js";
import { buildCharacterSkillModel } from "../src/ui/characterSkillsView.js";

const originalRandom = Math.random;
const logger = { template() {}, fixed() {} };

try {
  assert.equal(LV25_EXP_CAP_MIGRATION_SCHEMA_VERSION, 11);
  assert.equal(getExpStorageLimit(25, characterDefinitions.adventurer), 2309);
  assert.equal(getExpStorageLimit(30, characterDefinitions.adventurer), 3003);

  const expectedStats = {
    adventurer: {
      level25: { maxHp: 200, attack: 16, defense: 9, critChance: 0.22 },
      level30: { maxHp: 226, attack: 17, defense: 10, critChance: 0.22 }
    },
    archer: {
      level25: { maxHp: 192, attack: 18, defense: 6, critChance: 0.17 },
      level30: { maxHp: 210, attack: 19, defense: 7, critChance: 0.20 }
    },
    kaige: {
      level25: { maxHp: 220, attack: 19, defense: 6, critChance: 0.08 },
      level26: { maxHp: 234, attack: 19, defense: 6, critChance: 0.08 },
      level28: { maxHp: 246, attack: 20, defense: 6, critChance: 0.08 },
      level30: { maxHp: 260, attack: 21, defense: 6, critChance: 0.08 }
    }
  };
  for (const [characterId, expected] of Object.entries(expectedStats)) {
    for (const [levelKey, stats] of Object.entries(expected)) {
      const level = Number(levelKey.replace("level", ""));
      const hero = buildHeroFromProgression(characterDefinitions[characterId], {
        level,
        exp: 0,
        learnedSkills: [],
        equipment: { weaponId: null }
      });
      assert.deepEqual(
        pickStats(hero),
        stats,
        `${characterId} ${levelKey} 應符合 v0.2.7.4 正式素質`
      );
    }
  }

  const expectedLv27Skills = [
    ["adventurer", "heavy-strike-mastery", "heavy-strike"],
    ["archer", "poison-arrow-mastery", "poison-arrow"],
    ["kaige", "battle-hunger-mastery", "battle-hunger"]
  ];
  for (const [characterId, skillId, targetSkillId] of expectedLv27Skills) {
    const skill = characterDefinitions[characterId].skills.find((entry) => entry.id === skillId);
    assert.equal(skill?.level, 27);
    assert.equal(skill?.type, "minor");
    assert.equal(skill?.targetSkillId, targetSkillId);
    assert.ok(buildHeroFromProgression(characterDefinitions[characterId], {
      level: 27,
      exp: 0,
      learnedSkills: []
    }).skills.includes(skillId));
  }

  const skillModel = buildCharacterSkillModel(characterDefinitions.adventurer, { level: 30 });
  assert.equal(skillModel.learnedSkills.filter((skill) => skill.id === "heavy-strike").length, 1);
  assert.equal(skillModel.learnedSkills.find((skill) => skill.id === "heavy-strike")?.currentLevel, 27);
  assert.equal(skillModel.learnedSkills.find((skill) => skill.id === "versatile-mastery")?.type, "rare");

  assert.equal(
    getCharacterExperienceLabel({ level: 30, exp: 2309 }, characterDefinitions.adventurer),
    "已達目前上限｜儲備 EXP 2309／3003"
  );
  assert.equal(
    getCharacterExperienceLabel({ level: 30, exp: 3003 }, characterDefinitions.adventurer),
    "已達目前上限｜下一級 EXP 已儲滿"
  );
  assert.deepEqual(
    getCampExperienceSummary({ level: 29, exp: 120 }, characterDefinitions.adventurer),
    { title: "經驗", value: "120／2859" },
    "營地未封頂 EXP 應使用短格式"
  );
  assert.deepEqual(
    getCampExperienceSummary({ level: 30, exp: 0 }, characterDefinitions.adventurer),
    { title: "經驗（已達上限）", value: "儲備 0／3003" },
    "營地封頂 EXP 應保留儲備量"
  );
  assert.deepEqual(
    getCampExperienceSummary({ level: 30, exp: 3003 }, characterDefinitions.adventurer),
    { title: "經驗（已達上限）", value: "儲備 3003／3003" },
    "營地儲滿 EXP 仍應顯示短格式"
  );

  const schema10BoundaryCases = [
    [0, 0],
    [2308, 2308],
    [2309, 2309],
    [2310, 2309]
  ];
  for (const [exp, expectedExp] of schema10BoundaryCases) {
    const migrated = migrateSave({
      schemaVersion: 10,
      progression: { characters: { adventurer: { level: 25, exp } } }
    });
    assert.equal(migrated.schemaVersion, 12);
    assert.equal(migrated.progression.characters.adventurer.exp, expectedExp);
  }

  const schema9Overflow = migrateSave({
    schemaVersion: 9,
    progression: { characters: { adventurer: { level: 25, exp: 12909 } } }
  });
  assert.equal(schema9Overflow.schemaVersion, 12);
  assert.equal(schema9Overflow.progression.characters.adventurer.exp, 2309);

  const schema9State = {
    selectedHeroId: "adventurer",
    hero: buildHeroFromProgression(
      characterDefinitions.adventurer,
      schema9Overflow.progression.characters.adventurer
    ),
    debugBuildRun: false,
    runStats: { expGained: 0, endLevel: 25, levelUps: [], learnedSkills: [] }
  };
  const schema9ProgressionRuntime = createCharacterProgression({
    state: schema9State,
    saveStore: { current: schema9Overflow },
    characterDefinitions,
    weaponDefinitions: {},
    addLog() {},
    saveGameSafe() {}
  });
  const schema9Settlement = schema9ProgressionRuntime.settleCharacterProgression();
  const schema9Progress = schema9Overflow.progression.characters.adventurer;
  assert.equal(schema9Progress.level, 26);
  assert.equal(schema9Progress.exp, 0);
  assert.deepEqual(schema9Settlement.levelUps, [26]);
  assert.ok(!schema9Progress.learnedSkills.includes("heavy-strike-mastery"));
  assert.ok(!schema9Progress.learnedSkills.includes("versatile-mastery"));

  const schema9Lv24 = migrateSave({
    schemaVersion: 9,
    progression: { characters: { adventurer: { level: 24, exp: 12909 } } }
  });
  assert.equal(schema9Lv24.progression.characters.adventurer.level, 24);
  assert.equal(schema9Lv24.progression.characters.adventurer.exp, 12909);

  const schema11Save = migrateSave({
    schemaVersion: 11,
    progression: { characters: { adventurer: { level: 25, exp: 12909 } } }
  });
  assert.equal(
    schema11Save.progression.characters.adventurer.exp,
    12909,
    "固定於 Schema 11 的 Lv.25 EXP migration 不得在後續 Schema 升版時重套"
  );

  const mixedSchema9Save = migrateSave({
    schemaVersion: 9,
    progression: {
      characters: {
        adventurer: { level: 25, exp: 12909 },
        archer: { level: 25, exp: 2000 },
        kaige: { level: 24, exp: 5000 }
      }
    }
  });
  assert.equal(mixedSchema9Save.progression.characters.adventurer.exp, 2309);
  assert.equal(mixedSchema9Save.progression.characters.archer.exp, 2000);
  assert.equal(mixedSchema9Save.progression.characters.kaige.level, 24);
  assert.equal(mixedSchema9Save.progression.characters.kaige.exp, 5000);

  const cappedSave = createDefaultSave();
  cappedSave.progression.characters.adventurer.level = 30;
  cappedSave.progression.characters.adventurer.exp = 3000;
  const progressionState = {
    selectedHeroId: "adventurer",
    hero: { name: "冒險者" },
    debugBuildRun: false,
    runStats: { expGained: 0 }
  };
  const progressionRuntime = createCharacterProgression({
    state: progressionState,
    saveStore: { current: cappedSave },
    characterDefinitions,
    weaponDefinitions: {},
    addLog() {},
    saveGameSafe() {}
  });
  progressionRuntime.gainCharacterExp(100);
  assert.equal(cappedSave.progression.characters.adventurer.exp, 3003, "Lv.30 永久儲備不得超過 3003");
  assert.equal(progressionState.runStats.expGained, 100, "本輪取得 EXP 紀錄仍應保留原始量");

  const baseHeavy = buildHero( "adventurer", 25);
  const masteredHeavy = buildHero("adventurer", 27);
  const baseEnemy = makeEnemy("base-heavy", 1000);
  const masteredEnemy = makeEnemy("mastered-heavy", 1000);
  Math.random = sequenceRandom([0.24, 0.99, 0.99]);
  resolveHeroAction({ hero: baseHeavy, enemy: baseEnemy, log: logger });
  Math.random = sequenceRandom([0.24, 0.99, 0.99]);
  resolveHeroAction({ hero: masteredHeavy, enemy: masteredEnemy, log: logger });
  assert.equal(baseEnemy.hp, 984, "Lv.25 重擊精熟前的 0.24 應未觸發重擊");
  assert.equal(masteredEnemy.hp, 973, "Lv.27 重擊精熟應使用 25%／160% 邏輯");

  const archerLv27 = buildHero("archer", 27);
  archerLv27.critChance = 0;
  initializeCharacterBattleState(archerLv27);
  const poisonTarget = makeEnemy("poison-target", 1000);
  Math.random = () => 0.59;
  resolveCharacterPlayerAction({
    hero: archerLv27,
    enemies: [poisonTarget],
    targetEnemyId: poisonTarget.runtimeId,
    log: logger
  });
  assert.equal(poisonTarget.poison, 6, "Lv.27 淬毒精熟應以 60% 觸發且維持毒傷 6");

  const archerLv30 = buildHero("archer", 30);
  archerLv30.skills = ["poison-arrow", "weak-point-penetration"];
  archerLv30.critChance = 1;
  archerLv30.attack = 1;
  initializeCharacterBattleState(archerLv30);
  const poisonedTarget = makeEnemy("weak-point-target", 100, 0, { poison: 6 });
  Math.random = () => 0;
  resolveCharacterPlayerAction({
    hero: archerLv30,
    enemies: [poisonedTarget],
    targetEnemyId: poisonedTarget.runtimeId,
    log: logger
  });
  assert.equal(poisonedTarget.hp, 92, "弱點貫穿應在原始射擊後追加目前中毒值");
  assert.equal(archerLv30.skillState.archer.playerAttackCount, 1, "弱點貫穿不得增加玩家攻擊計數");

  const unpoisonedTarget = makeEnemy("unpoisoned-target", 100, 0);
  initializeCharacterBattleState(archerLv30);
  Math.random = () => 0;
  resolveCharacterPlayerAction({
    hero: archerLv30,
    enemies: [unpoisonedTarget],
    targetEnemyId: unpoisonedTarget.runtimeId,
    log: logger
  });
  assert.equal(unpoisonedTarget.hp, 98, "原本未中毒的目標不得由同一箭觸發弱點貫穿");

  const protectedTarget = makeEnemy("protected-target", 100, 0, {
    family: "fishman",
    combatRole: "output",
    poison: 6
  });
  const frontline = makeEnemy("frontline", 100, 0, {
    family: "fishman",
    combatRole: "frontline"
  });
  assert.equal(
    applyEnemyPoisonDamage({ enemy: protectedTarget, enemies: [protectedTarget, frontline] }),
    4,
    "弱點貫穿追加毒傷應沿用正式敵方保護減免"
  );

  const kaigeLow = buildReadyKaige(30, 65);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: kaigeLow,
    enemies: [makeEnemy("kaige-low-target", 1000)],
    targetEnemyId: "kaige-low-target",
    log: logger
  });
  assert.equal(kaigeLow.hp, 91, "血戰無前命中時仍應完成終結技吸血");
  assert.equal(kaigeLow.skillState.kaige.fury, 3, "血戰無前命中後應重新補滿戰意");

  const kaigeBelow = buildReadyKaige(30, 64);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: kaigeBelow,
    enemies: [makeEnemy("kaige-below-target", 1000)],
    targetEnemyId: "kaige-below-target",
    log: logger
  });
  assert.equal(kaigeBelow.hp, 90, "低於 25% 時應正常完成終結技吸血");
  assert.equal(kaigeBelow.skillState.kaige.fury, 3, "低於 25% 的命中終結技應重新補滿戰意");

  const kaigeAbove = buildReadyKaige(30, 66);
  resolveCharacterPlayerAction({
    hero: kaigeAbove,
    enemies: [makeEnemy("kaige-above-target", 1000)],
    targetEnemyId: "kaige-above-target",
    log: logger
  });
  assert.equal(kaigeAbove.hp, 92, "高於 25% 時應恢復一般終結技回復");
  assert.equal(kaigeAbove.skillState.kaige.fury, 1, "高於 25% 時應沿用戰無止境消耗 2 層");

  const kaigeDodged = buildReadyKaige(30, 65);
  const dodgedTarget = makeEnemy("kaige-dodged-target", 1000);
  dodgedTarget.dodgeChance = 1;
  Math.random = () => 0;
  resolveCharacterPlayerAction({
    hero: kaigeDodged,
    enemies: [dodgedTarget],
    targetEnemyId: dodgedTarget.runtimeId,
    log: logger
  });
  assert.equal(kaigeDodged.hp, 65, "主要目標閃避時不得吸血");
  assert.equal(dodgedTarget.hp, 1000, "主要目標閃避時不得造成主要傷害");
  assert.equal(kaigeDodged.skillState.kaige.fury, 1, "血戰無前閃避時不得重新補滿戰意");

  const sweepSkipped = makeEnemy("sweep-skipped", 1000);
  const dodgeSecondary = makeEnemy("dodge-secondary", 1000);
  const kaigeDodgeWithGroup = buildReadyKaige(30, 65);
  sweepSkipped.dodgeChance = 1;
  Math.random = () => 0;
  resolveCharacterPlayerAction({
    hero: kaigeDodgeWithGroup,
    enemies: [sweepSkipped, dodgeSecondary],
    targetEnemyId: sweepSkipped.runtimeId,
    log: logger
  });
  assert.equal(dodgeSecondary.hp, 1000, "主要目標閃避時不得觸發旋斧橫掃");

  const basicRecovery = buildReadyKaige(10, 20);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: basicRecovery,
    enemies: [makeEnemy("basic-recovery-target", 1000)],
    targetEnemyId: "basic-recovery-target",
    log: logger
  });
  assert.equal(basicRecovery.hp, 32, "單體終結技傷害不足時應保留 8% 基礎回復");

  const upgradedBaseRecovery = buildReadyKaige(20, 20);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: upgradedBaseRecovery,
    enemies: [makeEnemy("upgraded-base-recovery-target", 1000)],
    targetEnemyId: "upgraded-base-recovery-target",
    log: logger
  });
  assert.equal(upgradedBaseRecovery.hp, 40, "不息鬥志的單體終結技傷害不足時應保留 10% 基礎回復");

  const lv29SingleRecovery = buildReadyKaige(29, 10);
  lv29SingleRecovery.attack = 100;
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: lv29SingleRecovery,
    enemies: [makeEnemy("lv29-single-recovery", 1000)],
    targetEnemyId: "lv29-single-recovery",
    log: logger
  });
  assert.equal(lv29SingleRecovery.hp, 35, "Lv.29 單體高傷終結技仍只恢復最大生命 10%");
  assert.equal(lv29SingleRecovery.skillState.kaige.fury, 1, "Lv.29 不具備血戰無前時不得補滿戰意");

  const lv29MultiRecovery = buildReadyKaige(29, 10);
  lv29MultiRecovery.attack = 100;
  const lv29MultiPrimary = makeEnemy("lv29-multi-primary", 1000);
  const lv29MultiSecondary = makeEnemy("lv29-multi-secondary", 1000);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: lv29MultiRecovery,
    enemies: [lv29MultiPrimary, lv29MultiSecondary],
    targetEnemyId: lv29MultiPrimary.runtimeId,
    log: logger
  });
  assert.equal(lv29MultiRecovery.hp, 35, "Lv.29 多敵橫掃總傷害再高仍只恢復最大生命 10%");
  assert.ok(lv29MultiPrimary.hp < 1000 && lv29MultiSecondary.hp < 1000, "Lv.29 多敵終結技仍應命中主要目標與橫掃目標");

  const multiTargetRecovery = buildReadyKaige(30, 10);
  const multiPrimary = makeEnemy("multi-primary", 1000);
  const multiSecondary = makeEnemy("multi-secondary", 1000);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: multiTargetRecovery,
    enemies: [multiPrimary, multiSecondary],
    targetEnemyId: multiPrimary.runtimeId,
    log: logger
  });
  assert.equal(multiTargetRecovery.hp, 42, "主要傷害與旋斧橫掃應共同提高實際傷害吸血");
  assert.ok(multiPrimary.hp < 1000 && multiSecondary.hp < 1000, "多敵終結技應由正式 Runtime 同時命中主要目標與橫掃目標");

  const multiRequestedHealCap = buildReadyKaige(30, 10);
  multiRequestedHealCap.attack = 100;
  const multiCapPrimary = makeEnemy("multi-cap-primary", 1000);
  const multiCapSecondary = makeEnemy("multi-cap-secondary", 1000);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: multiRequestedHealCap,
    enemies: [multiCapPrimary, multiCapSecondary],
    targetEnemyId: multiCapPrimary.runtimeId,
    log: logger
  });
  assert.equal(multiRequestedHealCap.hp, 62, "Lv.30 多敵主要目標與橫掃吸血合計仍受最大生命 20% 請求上限限制");

  const requestedHealCap = buildReadyKaige(30, 10);
  requestedHealCap.attack = 100;
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: requestedHealCap,
    enemies: [makeEnemy("requested-heal-cap", 1000)],
    targetEnemyId: "requested-heal-cap",
    log: logger
  });
  assert.equal(requestedHealCap.hp, 62, "終結技請求回復不得超過最大生命 20%");

  const cappedFinisherRecovery = buildReadyKaige(30, 175);
  cappedFinisherRecovery.attack = 100;
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: cappedFinisherRecovery,
    enemies: [makeEnemy("post-heal-cap", 1000)],
    targetEnemyId: "post-heal-cap",
    log: logger
  });
  assert.equal(cappedFinisherRecovery.hp, 182, "終結技吸血後生命不得超過最大生命 70%");

  const saltReducedRecovery = buildReadyKaige(30, 65);
  saltReducedRecovery.saltErosion = { remainingTurns: 1 };
  saltReducedRecovery.saltHealingReduction = 0.5;
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: saltReducedRecovery,
    enemies: [makeEnemy("salt-reduced-target", 1000)],
    targetEnemyId: "salt-reduced-target",
    log: logger
  });
  assert.equal(saltReducedRecovery.hp, 78, "鹽蝕應透過既有治療倍率降低終結技吸血");

  const protectedFinisher = buildReadyKaige(30, 10);
  protectedFinisher.attack = 45;
  protectedFinisher.skills = protectedFinisher.skills.filter((skillId) => skillId !== "spinning-axe-sweep");
  const protectedPrimary = makeEnemy("protected-finisher", 1000, 0, { family: "fishman", combatRole: "output" });
  const protectingFrontline = makeEnemy("protecting-frontline", 1000, 0, { family: "fishman", combatRole: "frontline" });
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: protectedFinisher,
    enemies: [protectedPrimary, protectingFrontline],
    targetEnemyId: protectedPrimary.runtimeId,
    log: logger
  });
  assert.equal(protectedFinisher.hp, 41, "受保護目標的吸血只可按正式減傷後實際失血計算");

  const overkillFinisher = buildReadyKaige(30, 10);
  overkillFinisher.attack = 100;
  overkillFinisher.skills = overkillFinisher.skills.filter((skillId) => skillId !== "spinning-axe-sweep");
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: overkillFinisher,
    enemies: [makeEnemy("overkill-finisher", 5)],
    targetEnemyId: "overkill-finisher",
    log: logger
  });
  assert.equal(overkillFinisher.hp, 36, "殘血目標的溢出傷害不得轉成額外吸血");

  const killRecoveryAfterLifesteal = buildReadyKaige(30, 160);
  killRecoveryAfterLifesteal.skills = killRecoveryAfterLifesteal.skills.filter((skillId) => skillId !== "spinning-axe-sweep");
  const defeatedByFinisher = makeEnemy("defeated-by-finisher", 5);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: killRecoveryAfterLifesteal,
    enemies: [defeatedByFinisher],
    targetEnemyId: defeatedByFinisher.runtimeId,
    log: logger
  });
  assert.equal(killRecoveryAfterLifesteal.hp, 182, "終結技吸血應先受 70% 上限限制");
  const settlementState = {
    hero: killRecoveryAfterLifesteal,
    enemies: [defeatedByFinisher],
    battleSource: "normal",
    debugBuildRun: true,
    runStats: {},
    defeatedEnemies: 0,
    defeatedBoss: false,
    targetEnemyId: defeatedByFinisher.runtimeId
  };
  createBattleSettlement({
    state: settlementState,
    saveStore: { current: { inventory: {} } },
    counterEscapeHealRatio: 0,
    addLog() {},
    addFixedLog() {},
    gainCharacterExp() {},
    settleCharacterProgression() {},
    recordEnemyDefeated() {},
    hasPhoenixBlessing: () => false,
    saveGameSafe() {},
    applyVictorySkills() {},
    consumeBattleLimitedEffects() {},
    render() {},
    showBlessings() {}
  }).settleDefeatedEnemies();
  assert.equal(killRecoveryAfterLifesteal.hp, 208, "嗜戰本能擊殺回復必須在終結技吸血後獨立結算，且可超過 70% 上限");

  const kaigeSkills = Object.fromEntries(
    characterDefinitions.kaige.skills.map((skill) => [skill.id, skill])
  );
  assert.equal(
    kaigeSkills["blood-soaked-fight"].description,
    "戰意終結技成功命中後恢復最大生命 8%；回復後生命不高於最大生命 70%。"
  );
  assert.equal(
    kaigeSkills["unyielding-fighting-spirit"].description,
    "將浴血奮戰的回復提高至最大生命 10%；回復後生命上限維持最大生命 70%。"
  );
  assert.equal(
    kaigeSkills["blood-without-retreat"].description,
    "戰意終結技成功命中後，以主要目標與旋斧橫掃實際總生命損失的 50% 提高回復，單次請求最多為最大生命 20%；出手前生命不高於 25% 時，結算後重新補滿 3 層戰意。"
  );
  assert.equal(kaigeSkills["blood-soaked-fight"].level, 10);
  assert.equal(kaigeSkills["unyielding-fighting-spirit"].level, 20);
  assert.equal(kaigeSkills["blood-without-retreat"].level, 30);

  const normalStrike = buildHero("kaige", 30);
  normalStrike.hp = 65;
  initializeCharacterBattleState(normalStrike);
  Math.random = () => 0.99;
  resolveCharacterPlayerAction({
    hero: normalStrike,
    enemies: [makeEnemy("normal-strike-target", 1000)],
    targetEnemyId: "normal-strike-target",
    log: logger
  });
  assert.equal(normalStrike.hp, 65, "非終結技不得觸發吸血或血戰無前");
  assert.equal(normalStrike.skillState.kaige.fury, 2, "非終結技不得補滿戰意");

  const satchelLogs = [];
  const satchelHero = {
    name: "冒險者",
    skills: ["versatile-satchel", "versatile-mastery"],
    blessingFlows: [],
    blessingFlowMomentum: { attack: 2, defense: 1 },
    battleAttackBonus: 0,
    battleCritBonus: 0,
    shield: 0,
    victoryHealBonusRatio: 0,
    statusFamiliarityLimitBonus: 0
  };
  const satchelRuntime = createBattleSkills({
    state: { hero: satchelHero },
    hasHeroSkill: (skillId) => satchelHero.skills.includes(skillId),
    addLog: (type, templateId, values) => satchelLogs.push({ type, templateId, values }),
    addFixedLog() {},
    lastBagFlowWeightMultiplier: 0.6
  });
  Math.random = () => 0;
  satchelRuntime.applyBattleStartSkills();
  assert.equal(satchelHero.battleAttackBonus, 1);
  assert.equal(satchelHero.shield, 6);
  assert.equal(satchelHero.lastBagFlow, "attack");
  assert.equal(satchelHero.blessingFlowMomentum.attack, 2);
  assert.equal(satchelHero.blessingFlowMomentum.defense, 1);
  assert.equal(satchelLogs.length, 2, "融會貫通每場最多應套用兩項行囊效果");

  const fallbackSatchelHero = {
    ...satchelHero,
    skills: ["versatile-satchel", "versatile-mastery"],
    blessingFlowMomentum: { attack: 2 },
    battleAttackBonus: 0,
    shield: 0,
    lastBagFlow: null
  };
  const fallbackRuntime = createBattleSkills({
    state: { hero: fallbackSatchelHero },
    hasHeroSkill: (skillId) => fallbackSatchelHero.skills.includes(skillId),
    addLog() {},
    addFixedLog() {},
    lastBagFlowWeightMultiplier: 0.6
  });
  Math.random = () => 0;
  fallbackRuntime.applyBattleStartSkills();
  assert.equal(fallbackSatchelHero.battleAttackBonus, 2, "無合格第二 Flow 時應重複第一項效果");

  const emptySatchelHero = {
    ...fallbackSatchelHero,
    blessingFlowMomentum: {},
    battleAttackBonus: 0,
    lastBagFlow: null
  };
  const emptyRuntime = createBattleSkills({
    state: { hero: emptySatchelHero },
    hasHeroSkill: (skillId) => emptySatchelHero.skills.includes(skillId),
    addLog() {},
    addFixedLog() {},
    lastBagFlowWeightMultiplier: 0.6
  });
  emptyRuntime.applyBattleStartSkills();
  assert.equal(emptySatchelHero.battleAttackBonus, 2, "完全沒有 Flow 時應取得攻擊 +1 兩次");

  console.log("v0.2.7.4 Lv.30 growth, skill, capped EXP, Runtime boundary and Save Schema tests passed.");
} finally {
  Math.random = originalRandom;
}

function buildHero(characterId, level) {
  return buildHeroFromProgression(characterDefinitions[characterId], {
    level,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: null }
  });
}

function pickStats(hero) {
  return {
    maxHp: hero.maxHp,
    attack: hero.attack,
    defense: hero.defense,
    critChance: hero.critChance
  };
}

function makeEnemy(runtimeId, hp, defense = 0, overrides = {}) {
  return {
    id: runtimeId,
    runtimeId,
    name: runtimeId,
    maxHp: hp,
    hp,
    defense,
    family: "test",
    combatRole: "output",
    poison: 0,
    dodgeChance: 0,
    ...overrides
  };
}

function buildReadyKaige(level, hp) {
  const hero = buildHero("kaige", level);
  hero.hp = hp;
  initializeCharacterBattleState(hero);
  for (let index = 0; index < 3 && hero.skillState.kaige.fury < 3; index += 1) {
    modifyCharacterIncomingDirectDamage({ hero, damage: 1 });
  }
  assert.equal(hero.skillState.kaige.fury, 3, "測試前置應以正式受擊 Runtime 補滿戰意");
  return hero;
}

function sequenceRandom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0.99;
}
