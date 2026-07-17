import { createEventRuntime } from "../adventure/eventRuntime.js";
import { createDebugRuntimeActions } from "../debug/runtimeActions.js";

export function createRuntimeIntegrations({ eventDependencies, debugDependencies }) {
  return Object.freeze({
    eventRuntime: createEventRuntime(eventDependencies),
    debugActions: createDebugRuntimeActions(debugDependencies)
  });
}
