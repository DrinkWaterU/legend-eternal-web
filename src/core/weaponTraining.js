export const SWORD_TRAINING_WEAPON = "windbreak-sword";
export const SWORD_TRAINING_REGIONS = ["forest", "beach", "highlands"];

export function getSwordTraining(save) {
  const raw = save?.weaponTraining || {};
  const regions = Object.fromEntries(SWORD_TRAINING_REGIONS.map(id => [id, raw.regions?.[id] === true]));
  const unlocked = raw.unlocked === true && SWORD_TRAINING_REGIONS.every(id => regions[id]);
  return { regions, unlocked, mode: unlocked && raw.mode === "swift" ? "swift" : "steady", ready: SWORD_TRAINING_REGIONS.every(id => regions[id]) };
}

export function recordSwordTraining(save, { regionId, weaponId, battleSource, debugBuildRun, playerAction, riposteDamage, riposteFromStandardGuard }) {
  if (!save || debugBuildRun || battleSource === "duel" || weaponId !== SWORD_TRAINING_WEAPON
    || !["attack", "lunge"].includes(playerAction) || !(riposteDamage > 0) || riposteFromStandardGuard !== true
    || !SWORD_TRAINING_REGIONS.includes(regionId)) return false;
  const training = getSwordTraining(save);
  if (training.regions[regionId]) return false;
  training.regions[regionId] = true;
  delete training.ready;
  save.weaponTraining = training;
  return true;
}

export function unlockSwordTraining(save) {
  const training = getSwordTraining(save);
  if (save?.inventory?.weapons?.[SWORD_TRAINING_WEAPON] !== true) throw new Error("請先打造斷風守隘劍。");
  if (!training.ready) throw new Error("請先完成三個地區的守勢連招。");
  training.unlocked = true;
  delete training.ready;
  save.weaponTraining = training;
  return training;
}

export function selectSwordTrainingMode(save, mode) {
  const training = getSwordTraining(save);
  if (save?.inventory?.weapons?.[SWORD_TRAINING_WEAPON] !== true) throw new Error("請先打造斷風守隘劍。");
  if (!["steady", "swift"].includes(mode)) throw new Error("沒有這種打法。");
  if (mode === "swift" && !training.unlocked) throw new Error("請先解鎖冒險反攻。");
  training.mode = mode;
  delete training.ready;
  save.weaponTraining = training;
  return training;
}
