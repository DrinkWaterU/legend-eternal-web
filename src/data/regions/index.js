import { DEFAULT_REGION_ID } from "../../config.js";
import { beachRegion } from "./beach.js";
import { forestRegion } from "./forest.js";
import { plainsRegion } from "./plains.js";

export const regionDefinitions = {
  [DEFAULT_REGION_ID]: plainsRegion,
  [forestRegion.id]: forestRegion,
  [beachRegion.id]: beachRegion
};
