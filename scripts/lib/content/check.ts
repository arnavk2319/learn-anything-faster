// Cross-file content checks: duplicates, references, cycles, coverage, immutable published ids.
import { findCycle } from "../../../packages/graph/src/index.ts";
import type { Content } from "./load.ts";

export interface PublishedIds {
  topics?: string[];
  roles?: string[];
}

function duplicates(label: string, items: { file: string; id: string }[]): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const { file, id } of items) {
    const first = seen.get(id);
    if (first) out.push(`${file}: duplicate ${label} id "${id}" (first in ${first})`);
    else seen.set(id, file);
  }
  return out;
}

export function checkContent(c: Content, published: PublishedIds = {}): string[] {
  const errors: string[] = [];
  const roleIds = new Set(c.roles.map((r) => r.item.id));
  const topicIds = new Set(c.topics.map((t) => t.item.id));

  errors.push(
    ...duplicates(
      "role",
      c.roles.map((r) => ({ file: r.file, id: r.item.id })),
    ),
    ...duplicates(
      "topic",
      c.topics.map((t) => ({ file: t.file, id: t.item.id })),
    ),
    ...duplicates(
      "resource",
      c.resources.map((r) => ({ file: r.file, id: r.item.id })),
    ),
    ...duplicates(
      "role-topics role",
      c.roleTopics.map((r) => ({ file: r.file, id: r.item.role })),
    ),
  );

  // Unknown references.
  for (const t of c.topics)
    for (const p of t.item.learn_first)
      if (!topicIds.has(p))
        errors.push(`${t.file}: unknown reference: ${t.item.id} learn_first "${p}"`);
  for (const { file, item } of c.roleTopics) {
    if (!roleIds.has(item.role)) errors.push(`${file}: unknown reference: role "${item.role}"`);
    for (const k of ["requires", "covers"] as const)
      for (const tid of item[k])
        if (!topicIds.has(tid))
          errors.push(`${file}: unknown reference: ${item.role} ${k} "${tid}"`);
  }
  for (const f of c.resourceFiles) {
    if (!topicIds.has(f.topic)) errors.push(`${f.file}: unknown reference: topic "${f.topic}"`);
    if (f.fileTopic !== f.topic)
      errors.push(`${f.file}: file name must match its topic id "${f.topic}"`);
  }

  // Prerequisite cycle (reuses packages/graph).
  const edges = c.topics.flatMap((t) =>
    t.item.learn_first
      .filter((p) => topicIds.has(p))
      .map((p) => ({ topicId: t.item.id, prerequisiteId: p })),
  );
  const cycle = findCycle(edges);
  if (cycle) errors.push(`topics: prerequisite cycle: ${[...cycle, cycle[0]].join(" -> ")}`);

  // Live role: every required topic, plus its prerequisites, needs an approved resource.
  if (!cycle) {
    const live = new Set(c.roles.filter((r) => r.item.status === "live").map((r) => r.item.id));
    const prereq = new Map(c.topics.map((t) => [t.item.id, t.item.learn_first]));
    const needed = new Set<string>();
    const stack = c.roleTopics.filter((r) => live.has(r.item.role)).flatMap((r) => r.item.requires);
    while (stack.length) {
      const id = stack.pop()!;
      if (needed.has(id) || !topicIds.has(id)) continue;
      needed.add(id);
      stack.push(...(prereq.get(id) ?? []));
    }
    const approved = new Set(
      c.resources.filter((r) => r.item.status === "approved").map((r) => r.topic),
    );
    for (const id of [...needed].sort())
      if (!approved.has(id))
        errors.push(`topic "${id}": in a live role but has no approved resource`);
  }

  // Ids that exist in production must never change or disappear.
  for (const id of published.topics ?? [])
    if (!topicIds.has(id))
      errors.push(`topic id "${id}" exists in production but is missing (ids never change)`);
  for (const id of published.roles ?? [])
    if (!roleIds.has(id))
      errors.push(`role id "${id}" exists in production but is missing (ids never change)`);

  return errors;
}
