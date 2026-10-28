// One lazily created db per server instance (getDb builds a new pool on every call).
import { getDb } from "../../db/index";
import type { HealthDb } from "./http";
import type { RoadmapDb } from "./service";

let cached: ReturnType<typeof getDb> | undefined;

// The neon and node-postgres drizzle clients share the query-builder surface used here.
export const sharedDb = async () => (await (cached ??= getDb())) as unknown as RoadmapDb & HealthDb;
