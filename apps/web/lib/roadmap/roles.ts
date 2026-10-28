// Role list for the page's role switcher. Server only. Ids and names, never anything private.
import { asc } from "drizzle-orm";
import { roles } from "../../db/schema";
import { sharedDb } from "./db";

export interface RoleOption {
  id: string;
  name: string;
  status: "live" | "coming_soon";
}

/** Empty on a DB failure: the roadmap request itself reports the error state. */
export async function loadRoles(): Promise<RoleOption[]> {
  try {
    const db = await sharedDb();
    return await db
      .select({ id: roles.id, name: roles.name, status: roles.status })
      .from(roles)
      .orderBy(asc(roles.name));
  } catch {
    return [];
  }
}

/** The launch move when both roles are live, else the first two live roles. */
export function defaultPair(list: RoleOption[]): { from: string; to: string } {
  const live = list.filter((r) => r.status === "live").map((r) => r.id);
  if (live.includes("full-stack-engineer") && live.includes("ml-engineer"))
    return { from: "full-stack-engineer", to: "ml-engineer" };
  return { from: live[0] ?? "full-stack-engineer", to: live[1] ?? "ml-engineer" };
}
