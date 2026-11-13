// Learn content model (ADR-0015 sections 1 and 2). One Zod schema per entity. Pure: no React, no DB.
import { z } from "zod";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase slug (a-z, 0-9, hyphens)");
const Md = z.string().min(1, "must not be empty"); // Markdown string

export const LevelSchema = z.enum(["basic", "intermediate", "advanced"]);
export const StatusSchema = z.enum(["proposed", "approved"]);

export const SrcSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("guide"),
    guide: z.string().min(1),
    heading: z.string().min(1),
    quote: z.string().min(8, "quote must be at least 8 characters"),
  }),
  // Not stated in the source: counted, capped and reviewed.
  z.strictObject({
    kind: z.literal("gap"),
    note: z.string().min(10, "gap note must be at least 10 characters"),
  }),
]);

// ---- Sim (section 2) ----
export const NODE_KINDS = [
  "client",
  "app",
  "lb",
  "cache",
  "cdn",
  "db",
  "queue",
  "worker",
  "decision",
  "store",
  "external",
] as const;
export const TOKEN_COLORS = ["request", "response", "replicate", "error"] as const;

const SimStateSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("lru"),
    capacity: z.number().int().min(1),
    init: z.array(z.string()),
  }),
  z.strictObject({ type: z.literal("queue"), init: z.array(z.string()) }),
  z.strictObject({ type: z.literal("kv"), init: z.record(z.string(), z.string()) }),
  z.strictObject({ type: z.literal("counter"), init: z.number() }),
  z.strictObject({ type: z.literal("ring"), init: z.array(z.string()) }),
]);
const SimNodeSchema = z.strictObject({
  id: slug,
  kind: z.enum(NODE_KINDS),
  label: z.string().min(1),
  state: SimStateSchema.optional(),
  inspect: z.string().min(1, "every node needs inspect text"),
});
const SimEdgeSchema = z.strictObject({
  id: slug,
  from: slug,
  to: slug,
  label: z.string().optional(),
});
const TokenSchema = z.strictObject({
  label: z.string().min(1),
  color: z.enum(TOKEN_COLORS).optional(),
});
const at = z.number().int().min(0);
const SimEventSchema = z.union([
  z.strictObject({ at, send: z.strictObject({ edge: slug, token: TokenSchema }) }),
  z.strictObject({ at, decide: z.strictObject({ node: slug, result: z.enum(["yes", "no"]) }) }),
  z.strictObject({
    at,
    state: z.strictObject({
      node: slug,
      op: z.string().min(1),
      key: z.string().optional(),
      value: z.string().optional(),
    }),
  }),
  z.strictObject({
    at,
    highlight: z.strictObject({ node: slug.optional(), edge: slug.optional() }),
  }),
  z.strictObject({ at, caption: z.string().min(1) }),
  z.strictObject({ at, spawn: z.strictObject({ node: slug, token: TokenSchema }) }),
  z.strictObject({ at, remove: z.strictObject({ token: z.string().min(1) }) }),
]);
export const SimSchema = z.strictObject({
  id: slug,
  template: z.string().min(1).optional(),
  durationMs: z.number().int().min(1),
  loop: z.boolean(),
  nodes: z.array(SimNodeSchema).min(1),
  edges: z.array(SimEdgeSchema),
  scenarios: z
    .array(
      z.strictObject({
        id: slug,
        title: z.string().min(1),
        events: z.array(SimEventSchema).min(1),
      }),
    )
    .min(1),
  src: SrcSchema,
});

const SimRefSchema = z.union([
  SimSchema,
  z.strictObject({ ref: slug }),
  z.strictObject({
    exception: z.strictObject({
      reason: z.string().min(10, "exception reason must be at least 10 characters"),
    }),
  }),
]);

// ---- Blocks ----
const Side = z.strictObject({ title: z.string().min(1), body: Md });
const base = { id: slug, src: SrcSchema };
export const BlockSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...base, type: z.literal("text"), body: Md }),
  z.strictObject({
    ...base,
    type: z.literal("table"),
    columns: z.array(z.string().min(1)).min(2, "a table needs at least 2 columns"),
    rows: z.array(z.array(Md)).min(1, "a table needs at least 1 row"),
  }),
  z.strictObject({ ...base, type: z.literal("compare"), left: Side, right: Side }),
  z.strictObject({
    ...base,
    type: z.literal("callout"),
    tone: z.enum(["pitfall", "tip", "note"]),
    body: Md,
  }),
  z.strictObject({
    ...base,
    type: z.literal("code"),
    language: z.string().min(1),
    caption: z.string(),
    code: z.string().min(1),
  }),
  z.strictObject({ ...base, type: z.literal("sim"), ref: slug }),
  z.strictObject({
    ...base,
    type: z.literal("quiz"),
    questionIds: z
      .array(slug)
      .min(1, "a quiz block needs 1 or 2 question ids")
      .max(2, "a quiz block holds at most 2 question ids"),
  }),
  z.strictObject({
    id: slug,
    type: z.literal("faq"),
    items: z.array(z.strictObject({ q: Md, a: Md, src: SrcSchema })).min(1),
  }),
]);

// ---- Entities ----
export const TrackSchema = z.strictObject({
  id: slug,
  title: z.string().min(1),
  summary: z.string().max(200, "summary must be at most 200 characters"),
  category: slug,
  status: z.enum(["live", "coming-soon"]),
  order: z.number().int(),
});

export const ConceptSchema = z.strictObject({
  id: slug,
  trackId: slug,
  title: z.string().min(1),
  summary: z.string().max(200, "summary must be at most 200 characters"),
  stage: LevelSchema,
  order: z.number().int(),
  topicIds: z.array(slug).default([]),
  prerequisites: z.array(slug).default([]),
  status: StatusSchema,
  supersedes: slug.optional(),
  sim: SimRefSchema,
  levels: z
    .partialRecord(LevelSchema, z.array(BlockSchema))
    .refine((l) => Object.keys(l).length >= 1, "a concept needs at least one level"),
});

export const ProblemSchema = z.strictObject({
  id: slug,
  trackId: slug,
  title: z.string().min(1),
  summary: z.string().max(200, "summary must be at most 200 characters"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  priority: z.boolean(),
  conceptIds: z.array(slug),
  topicIds: z.array(slug).default([]),
  status: StatusSchema,
  supersedes: slug.optional(),
  sim: SimRefSchema,
  blocks: z.array(BlockSchema).min(1),
});

export const QuestionSchema = z
  .strictObject({
    id: slug,
    conceptId: slug.optional(),
    problemId: slug.optional(),
    relatedConceptIds: z.array(slug).default([]),
    status: StatusSchema,
    level: LevelSchema,
    retired: z.boolean().default(false),
    supersedes: slug.optional(),
    type: z.enum(["mcq", "multi", "predict-output", "ordering", "short-explain"]),
    prompt: Md,
    options: z.array(z.strictObject({ id: slug, text: Md })).optional(),
    answer: z.union([z.array(slug), z.string()]),
    rubric: z.array(Md).optional(),
    explanation: Md,
    difficulty: z.number().int().min(1).max(5),
    tags: z.array(slug),
    src: SrcSchema,
  })
  .refine((q) => (q.conceptId === undefined) !== (q.problemId === undefined), {
    message: "a question needs exactly one owner (conceptId or problemId)",
  });

export const QuestionSetSchema = z.strictObject({
  id: slug,
  trackId: slug,
  title: z.string().min(1),
  summary: z.string().max(200, "summary must be at most 200 characters"),
  kind: z.enum(["concept", "mixed"]),
  conceptIds: z.array(slug).min(1, "a set needs at least one concept id"),
  order: z.number().int(),
  questionIds: z.array(slug).optional(),
  select: z
    .strictObject({
      level: LevelSchema.optional(),
      tags: z.array(slug).optional(),
      limit: z.number().optional(),
    })
    .optional(),
});

export type Src = z.infer<typeof SrcSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Concept = z.infer<typeof ConceptSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionSet = z.infer<typeof QuestionSetSchema>;
export type Sim = z.infer<typeof SimSchema>;
