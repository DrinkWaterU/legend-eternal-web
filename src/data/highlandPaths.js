export const highlandPathChoices = {
  0: [
    { id: "shelter", name: "沿舊守望道", description: "較平緩的風；先遇角羊。保留岩台摸清位置，這段素材收益照常。", groupId: "ram", rewardScale: 1 },
    { id: "gale", name: "走逆風獵道", description: "起步就有反向與兩格強風，先遇獵犬群；本段金幣倍率+20%、非保底素材掉率提高（最高100%）。", groupId: "pack", rewardScale: 1.2 }
  ],
  4: [
    { id: "shelter", name: "從背風哨站上山", description: "先遇岩衛與哨衛，利用拆岩把後排帶進射程；本段收益照常。", groupId: "formation", rewardScale: 1 },
    { id: "gale", name: "穿越碎岩風口", description: "先遇搬石獸與鳴石，強風反轉；本段金幣倍率+20%、非保底素材掉率提高（最高100%），之後仍要面對角王。", groupId: "crosswind", rewardScale: 1.2 }
  ],
  8: [
    { id: "shelter", name: "沿殘存岩台前進", description: "先遇守望隊長；風有間歇，能準備最後首領。本段收益照常。", groupId: "captain", rewardScale: 1 },
    { id: "gale", name: "直取暴風隘口", description: "先遇暴風脊羽鷹；兩格風與反向窗口交錯，本段金幣倍率+20%、非保底素材掉率提高（最高100%）。", groupId: "storm", rewardScale: 1.2 }
  ]
};

export function getPendingHighlandPaths(state) {
  if (state.selectedRegionId !== "highlands" || state.battleSource === "event" || state.battleSource === "counterEscape") return [];
  const index = state.routeEncounterIndex || 0;
  return state.highlandChoices?.[index] ? [] : highlandPathChoices[index] || [];
}

export function getChosenHighlandPath(state) {
  if (state.selectedRegionId !== "highlands") return null;
  const index = Math.min(8, Math.floor((state.routeEncounterIndex || 0) / 4) * 4);
  return highlandPathChoices[index]?.find(p => p.id === state.highlandChoices?.[index]) || null;
}
