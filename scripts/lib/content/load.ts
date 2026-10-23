// Reads content/ from disk and parses every file with its Zod schema. Never throws on bad content.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { z } from "zod";
import {
  ResourcesFileSchema,
  RolesFileSchema,
  RoleTopicsFileSchema,
  TopicsFileSchema,
  type ResourceEntry,
  type RoleEntry,
  type RoleTopicsEntry,
  type TopicEntry,
} from "./schemas.ts";

export interface Content {
  roles: { file: string; item: RoleEntry }[];
  topics: { file: string; area: string; item: TopicEntry }[];
  roleTopics: { file: string; item: RoleTopicsEntry }[];
  resources: { file: string; topic: string; item: ResourceEntry }[];
  /** Resource file names (without .yaml) vs the topic they declare. */
  resourceFiles: { file: string; fileTopic: string; topic: string }[];
}

export interface Loaded {
  content: Content;
  errors: string[];
}

function yamlFiles(dir: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".yaml"))
        .sort()
    : [];
}

export function loadContent(dir: string): Loaded {
  const content: Content = {
    roles: [],
    topics: [],
    roleTopics: [],
    resources: [],
    resourceFiles: [],
  };
  const errors: string[] = [];

  function read<T extends z.ZodType>(rel: string, schema: T): z.infer<T> | undefined {
    let raw: unknown;
    try {
      raw = parse(readFileSync(join(dir, rel), "utf8"));
    } catch (e) {
      errors.push(`${rel}: unreadable or invalid YAML (${(e as Error).message.split("\n")[0]})`);
      return undefined;
    }
    const r = schema.safeParse(raw);
    if (r.success) return r.data;
    for (const i of r.error.issues)
      errors.push(`${rel}: schema: ${i.path.join(".") || "(root)"}: ${i.message}`);
    return undefined;
  }

  if (existsSync(join(dir, "roles.yaml"))) {
    for (const item of read("roles.yaml", RolesFileSchema) ?? [])
      content.roles.push({ file: "roles.yaml", item });
  }
  for (const f of yamlFiles(join(dir, "topics"))) {
    const rel = `topics/${f}`;
    const data = read(rel, TopicsFileSchema);
    for (const item of data?.topics ?? [])
      content.topics.push({ file: rel, area: data!.area, item });
  }
  if (existsSync(join(dir, "role-topics.yaml"))) {
    for (const item of read("role-topics.yaml", RoleTopicsFileSchema) ?? [])
      content.roleTopics.push({ file: "role-topics.yaml", item });
  }
  for (const f of yamlFiles(join(dir, "resources"))) {
    const rel = `resources/${f}`;
    const data = read(rel, ResourcesFileSchema);
    if (!data) continue;
    content.resourceFiles.push({
      file: rel,
      fileTopic: f.replace(/\.yaml$/, ""),
      topic: data.topic,
    });
    for (const item of data.resources)
      content.resources.push({ file: rel, topic: data.topic, item });
  }
  return { content, errors };
}
