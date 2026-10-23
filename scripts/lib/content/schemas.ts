// Content file schemas (T-005). One Zod schema per entity; enums mirror apps/web/db/schema.ts.
import { z } from "zod";

export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase slug");

export const RoleSchema = z.strictObject({
  id: slug,
  name: z.string().min(1),
  status: z.enum(["live", "coming_soon"]),
});
export const RolesFileSchema = z.array(RoleSchema);

export const TopicSchema = z.strictObject({
  id: slug,
  name: z.string().min(1),
  why: z.string().min(1),
  est_hours: z.number().int().positive(),
  learn_first: z.array(slug).default([]), // prerequisites; seeds topic_edges
});
export const TopicsFileSchema = z.strictObject({
  area: slug,
  topics: z.array(TopicSchema),
});

export const RoleTopicsEntrySchema = z.strictObject({
  role: slug,
  requires: z.array(slug).default([]),
  covers: z.array(slug).default([]),
});
export const RoleTopicsFileSchema = z.array(RoleTopicsEntrySchema);

export const ResourceSchema = z.strictObject({
  id: slug,
  type: z.enum(["youtube", "coursera", "course", "book", "docs", "blog", "article"]),
  title: z.string().min(1),
  url: z.url({ protocol: /^https?$/ }),
  is_free: z.boolean(),
  status: z.enum(["proposed", "approved", "dead"]),
  source_note: z.string().optional(),
  last_checked_at: z.iso.datetime().optional(),
});
export const ResourcesFileSchema = z.strictObject({
  topic: slug,
  resources: z.array(ResourceSchema),
});

export type RoleEntry = z.infer<typeof RoleSchema>;
export type TopicEntry = z.infer<typeof TopicSchema>;
export type RoleTopicsEntry = z.infer<typeof RoleTopicsEntrySchema>;
export type ResourceEntry = z.infer<typeof ResourceSchema>;
