import forestData from "./forest.json" with { type: "json" };
import { createRegionDefinition } from "./regionDefinition.js";

export const forestRegion = createRegionDefinition(forestData);
