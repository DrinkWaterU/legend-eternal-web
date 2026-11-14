import data from "./highlands.json" with { type: "json" };
import blessingData from "../blessings/highlands.json" with { type: "json" };
import { createRegionDefinition } from "./regionDefinition.js";

export const highlandsRegion = createRegionDefinition({ ...data, blessings: blessingData.blessings });
