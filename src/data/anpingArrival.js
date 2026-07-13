export const ANPING_ARRIVAL_TIMING = Object.freeze({
  lineDelayMs: 650,
  finishExtraDelayMs: 700,
  locationDelayMs: 700,
  locationHideDelayMs: 2300,
  inputUnlockDelayMs: 420
});

export const anpingArrivalPages = Object.freeze([
  Object.freeze({
    key: "forest",
    eyebrow: "旅途的延續",
    title: "森林的盡頭",
    lines: Object.freeze([
      "戰鬥的聲音逐漸遠去，林間重新恢復了寂靜。",
      "你沿著森林深處尚未走過的道路繼續前進。腳下的泥土漸漸變得乾燥，遮蔽天空的枝葉也愈來愈稀疏。",
      "一陣陌生的風吹過林間。風裡帶著潮濕，以及淡淡的鹹味。"
    ])
  }),
  Object.freeze({
    key: "sea",
    eyebrow: "視野開闊",
    title: "第一次看見海",
    lines: Object.freeze([
      "當最後一片樹影從眼前退去，原本狹窄的道路忽然迎向一片遼闊的蔚藍。",
      "海浪在遠方反覆拍打岸邊，幾艘船隻化作天際線上的小小剪影。",
      "你曾經熟悉的營地、平原與森林，此刻都留在了身後。"
    ])
  }),
  Object.freeze({
    key: "town",
    eyebrow: "海岸上的人煙",
    title: "安平鎮現身",
    lines: Object.freeze([
      "沿著海岸前行不久，遠方的薄霧中開始出現屋舍、石牆與港口的輪廓。",
      "重建後的街道順著坡地延伸，港內停泊著幾艘小船。鎮中較高大的建築前，能看見冒險者往來的身影。",
      "這裡，就是森林道路盡頭的海岸城鎮。"
    ])
  }),
  Object.freeze({
    key: "history",
    eyebrow: "新的旅途起點",
    title: "重建之鎮",
    lines: Object.freeze([
      "安平鎮曾是黑王勢力控制下的殖民地。",
      "在雷利等人消滅盤據此地的黑暗勢力後，人們於舊有的石牆與廢墟之上重新建起屋舍、道路與港口。",
      "如今，這座規模不大的海岸城鎮，擁有專門接納與培育新手冒險者的公會資源。",
      "無數人的旅途曾從這裡開始。而現在，你也終於真正踏入了傳說大陸。"
    ])
  })
]);
