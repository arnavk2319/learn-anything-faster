// Contract stub (T-004, ADR-0007). Table definitions and inferred types only.
// No queries, no connection code. Topic/role ids are immutable slugs: no ON UPDATE CASCADE anywhere.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const roleStatus = pgEnum("role_status", ["live", "coming_soon"]);
export const roleTopicKind = pgEnum("role_topic_kind", ["requires", "covers"]);
export const resourceType = pgEnum("resource_type", [
  "youtube",
  "coursera",
  "course",
  "book",
  "docs",
  "blog",
  "article",
]);
export const resourceStatus = pgEnum("resource_status", ["proposed", "approved", "dead"]);
export const requestKind = pgEnum("request_kind", ["request", "notify"]);

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: roleStatus("status").notNull(),
});

export const topics = pgTable(
  "topics",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    area: text("area").notNull(),
    why: text("why").notNull(),
    estHours: integer("est_hours").notNull(),
  },
  (t) => [check("topics_est_hours_positive", sql`${t.estHours} > 0`)],
);

export const topicEdges = pgTable(
  "topic_edges",
  {
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    prerequisiteId: text("prerequisite_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.topicId, t.prerequisiteId] }),
    check("topic_edges_no_self", sql`${t.topicId} <> ${t.prerequisiteId}`),
    index("topic_edges_prerequisite_idx").on(t.prerequisiteId, t.topicId),
  ],
);

export const roleTopics = pgTable(
  "role_topics",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    kind: roleTopicKind("kind").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.topicId, t.kind] }),
    index("role_topics_role_kind_idx").on(t.roleId, t.kind),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    type: resourceType("type").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    isFree: boolean("is_free").notNull(),
    status: resourceStatus("status").notNull().default("proposed"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    sourceNote: text("source_note"),
  },
  (t) => [
    index("resources_topic_status_idx").on(t.topicId, t.status),
    unique("resources_topic_url_uniq").on(t.topicId, t.url),
  ],
);

// Only table with PII (email). Never selected by any API.
export const transitionRequests = pgTable(
  "transition_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromRole: text("from_role")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    toRole: text("to_role")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    email: text("email").notNull(), // stored lowercased + trimmed (check below)
    kind: requestKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("transition_requests_uniq").on(t.fromRole, t.toRole, t.email, t.kind),
    check("transition_requests_email_norm", sql`${t.email} = lower(btrim(${t.email}))`),
  ],
);

export const resourceSuggestions = pgTable(
  "resource_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    url: text("url").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resource_suggestions_topic_idx").on(t.topicId),
    unique("resource_suggestions_topic_url_uniq").on(t.topicId, t.url),
  ],
);

/** Fixed-window counters for the shared form rate limiter (ADR-0014). `key` is a hex sha256, never a raw IP. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    index("rate_limits_window_idx").on(t.windowStart),
    check("rate_limits_count_positive", sql`${t.count} >= 1`),
  ],
);

/**
 * Anonymous Learn feedback (ADR-0017): one row per browser per target. `client_hash` is the sha256 of a random
 * browser UUID, never an IP, email or user agent. `target_kind` has no CHECK: Zod is the gate. `note` is free text
 * (PII risk): never selected by any API, nulled after 180 days.
 */
export const learnFeedback = pgTable(
  "learn_feedback",
  {
    trackId: text("track_id").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    clientHash: text("client_hash").notNull(),
    rating: smallint("rating").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "learn_feedback_pk",
      columns: [t.trackId, t.targetKind, t.targetId, t.clientHash],
    }),
    index("learn_feedback_note_idx")
      .on(t.updatedAt)
      .where(sql`${t.note} IS NOT NULL`),
    check("learn_feedback_rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
    check("learn_feedback_note_len", sql`${t.note} IS NULL OR char_length(${t.note}) <= 280`),
    check("learn_feedback_client_hash_hex", sql`${t.clientHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type TopicEdge = typeof topicEdges.$inferSelect;
export type NewTopicEdge = typeof topicEdges.$inferInsert;
export type RoleTopic = typeof roleTopics.$inferSelect;
export type NewRoleTopic = typeof roleTopics.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type TransitionRequest = typeof transitionRequests.$inferSelect;
export type NewTransitionRequest = typeof transitionRequests.$inferInsert;
export type LearnFeedback = typeof learnFeedback.$inferSelect;
export type ResourceSuggestion = typeof resourceSuggestions.$inferSelect;
export type NewResourceSuggestion = typeof resourceSuggestions.$inferInsert;
export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
