import adventurerData from "./adventurer.json" with { type: "json" };

export const adventurerDefinition = Object.freeze({
  id: "adventurer",
  ...adventurerData
});

export const adventurerTemplate = adventurerDefinition.template;
