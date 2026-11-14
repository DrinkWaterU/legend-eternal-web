export const HAMMER_TRAINING_WEAPON = "cairn-warhammer";
export const HAMMER_TRAINING_REGIONS = Object.freeze(["highlands"]);

export function getHammerTraining(save) {
  const raw = save?.hammerTraining || {};
  const regions = Object.fromEntries(HAMMER_TRAINING_REGIONS.map(id => [id, raw.regions?.[id] === true]));
  const ready = HAMMER_TRAINING_REGIONS.every(id => regions[id]);
  return { regions, unlocked: raw.unlocked === true && ready, ready };
}

export function recordHammerBreak(save, event = {}) {
  const { regionId, weaponId, battleSource, debugBuildRun, battleStartEnemyCount,
    playerAction, breachTargetId, targetId, breachStrength, primaryHit } = event;
  if (!save || debugBuildRun || battleSource === "duel" || weaponId !== HAMMER_TRAINING_WEAPON
    || !HAMMER_TRAINING_REGIONS.includes(regionId) || !(battleStartEnemyCount >= 2)
    || !["attack", "lunge"].includes(playerAction) || !primaryHit
    || !breachTargetId || targetId !== breachTargetId || breachStrength !== 3) return false;

  const training = getHammerTraining(save);
  if (training.regions[regionId]) return false;
  training.regions[regionId] = true;
  delete training.ready;
  save.hammerTraining = training;
  return true;
}

export function unlockHammerTechnique(save) {
  const training = getHammerTraining(save);
  if (save?.inventory?.weapons?.[HAMMER_TRAINING_WEAPON] !== true) throw new Error("請先打造鎮隘岩鎚。");
  if (!training.ready) throw new Error("請先完成斷風高地的岩鎚連招。");
  training.unlocked = true;
  delete training.ready;
  save.hammerTraining = training;
  return training;
}
