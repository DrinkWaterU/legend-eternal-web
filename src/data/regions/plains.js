import plainsData from "./plains.json" with { type: "json" };
import { createRegionDefinition } from "./regionDefinition.js";

export const plainsRegion = createRegionDefinition(plainsData);
