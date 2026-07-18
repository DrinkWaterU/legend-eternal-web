import beachBlessingData from "../blessings/beach.json" with { type: "json" };
import beachData from "./beach.json" with { type: "json" };
import { createRegionDefinition } from "./regionDefinition.js";

export const beachRegion = createRegionDefinition({
  ...beachData,
  blessings: beachBlessingData.blessings
});
