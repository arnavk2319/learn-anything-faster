// Pure TS graph logic (delta, closure, topo sort, cycle check). No React, no DB imports.
export type { Edge, TopicId } from "./types";
export { CycleError, findCycle } from "./cycle";
export { topoSort } from "./toposort";
export { computeDelta, transitivePrerequisites } from "./delta";
export type { Delta, DeltaInput } from "./delta";
