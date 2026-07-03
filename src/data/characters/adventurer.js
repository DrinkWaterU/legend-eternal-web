import adventurerData from "./adventurer.json" with { type: "json" };

export const adventurerDefinition = {
  name: adventurerData.name,
  description: adventurerData.description,
  stats: adventurerData.stats,
  template: adventurerData.template,
  levelCurve: adventurerData.levelCurve,
  levelGrowth: adventurerData.levelGrowth,
  skills: adventurerData.skills
};

export const adventurerTemplate = adventurerDefinition.template;
