// Roadmap API contract (T-007). Single source of truth: T-009/T-010/T-011 import these types.
// No positions anywhere: layout is the client's job (ELK in a Web Worker).
import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid id");

/** Query params of GET /api/roadmap. */
export const roadmapQuerySchema = z.object({ from: slug, to: slug });
export type RoadmapQuery = z.infer<typeof roadmapQuerySchema>;

export const roadmapResourceSchema = z.object({
  id: z.string(),
  type: z.enum(["youtube", "coursera", "course", "book", "docs", "blog", "article"]),
  title: z.string(),
  url: z.string(),
  isFree: z.boolean(),
});

export const roadmapNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  area: z.string(),
  why: z.string(),
  estHours: z.number().int().positive(),
  /** Approved resources only, ordered by id. */
  resources: z.array(roadmapResourceSchema),
});

export const roadmapEdgeSchema = z.object({
  /** `topicId` requires `prerequisiteId` first. Both ids are in `nodes`. */
  topicId: z.string(),
  prerequisiteId: z.string(),
});

export const coveredTopicSchema = z.object({ id: z.string(), name: z.string(), area: z.string() });

export const roadmapResponseSchema = z.object({
  from: z.object({ id: z.string(), name: z.string() }),
  to: z.object({ id: z.string(), name: z.string() }),
  /** Topologically ordered: every prerequisite appears before its dependents. */
  nodes: z.array(roadmapNodeSchema),
  edges: z.array(roadmapEdgeSchema),
  /** Topics the target needs that the current role already covers (skipped, not in `nodes`). */
  covered: z.array(coveredTopicSchema),
});
export type RoadmapResource = z.infer<typeof roadmapResourceSchema>;
export type RoadmapNode = z.infer<typeof roadmapNodeSchema>;
export type RoadmapEdge = z.infer<typeof roadmapEdgeSchema>;
export type CoveredTopic = z.infer<typeof coveredTopicSchema>;
export type RoadmapResponse = z.infer<typeof roadmapResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.enum(["invalid_params", "not_found", "unavailable"]),
  /** Field -> message, only for invalid_params. */
  fields: z.record(z.string(), z.string()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  db: z.enum(["ok", "error"]),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
