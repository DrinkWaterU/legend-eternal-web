import { buildGuildAdventureRecordModel } from "./guildAdventureRecord.js";
import { renderGuildAdventureRecordView } from "./guildAdventureRecordView.js";

export function createGuildAdventureRecordController({
  els,
  characterDefinitions = {},
  npcDefinition = null,
  getSave
} = {}) {
  if (!els || typeof els !== "object") {
    throw new Error("Guild Adventure Record Controller 需要有效的 els。");
  }
  if (typeof getSave !== "function") {
    throw new Error("Guild Adventure Record Controller 需要 getSave()。");
  }

  function render() {
    renderGuildAdventureRecordView({
      els,
      npc: npcDefinition,
      model: buildGuildAdventureRecordModel({
        save: getSave(),
        characterDefinitions
      })
    });
  }

  return Object.freeze({ render });
}
