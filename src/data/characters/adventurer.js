import adventurerData from "./adventurer.json" with { type: "json" };

export const adventurerDefinition = {
  name: adventurerData.name,
  description: adventurerData.description,
  stats: adventurerData.stats,
  template: adventurerData.template
};

export const adventurerTemplate = adventurerDefinition.template;
