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
  (t) => [index("resource_suggestions_topic_idx").on(t.topicId)],
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
export type ResourceSuggestion = typeof resourceSuggestions.$inferSelect;
export type NewResourceSuggestion = typeof resourceSuggestions.$inferInsert;
