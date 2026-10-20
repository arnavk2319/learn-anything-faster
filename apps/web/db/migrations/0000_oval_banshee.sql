CREATE TYPE "public"."request_kind" AS ENUM('request', 'notify');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('proposed', 'approved', 'dead');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('youtube', 'coursera', 'course', 'book', 'docs', 'blog', 'article');--> statement-breakpoint
CREATE TYPE "public"."role_status" AS ENUM('live', 'coming_soon');--> statement-breakpoint
CREATE TYPE "public"."role_topic_kind" AS ENUM('requires', 'covers');--> statement-breakpoint
CREATE TABLE "resource_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" text NOT NULL,
	"url" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"type" "resource_type" NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"is_free" boolean NOT NULL,
	"status" "resource_status" DEFAULT 'proposed' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"source_note" text,
	CONSTRAINT "resources_topic_url_uniq" UNIQUE("topic_id","url")
);
--> statement-breakpoint
CREATE TABLE "role_topics" (
	"role_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"kind" "role_topic_kind" NOT NULL,
	CONSTRAINT "role_topics_role_id_topic_id_kind_pk" PRIMARY KEY("role_id","topic_id","kind")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "role_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_edges" (
	"topic_id" text NOT NULL,
	"prerequisite_id" text NOT NULL,
	CONSTRAINT "topic_edges_topic_id_prerequisite_id_pk" PRIMARY KEY("topic_id","prerequisite_id"),
	CONSTRAINT "topic_edges_no_self" CHECK ("topic_edges"."topic_id" <> "topic_edges"."prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"area" text NOT NULL,
	"why" text NOT NULL,
	"est_hours" integer NOT NULL,
	CONSTRAINT "topics_est_hours_positive" CHECK ("topics"."est_hours" > 0)
);
--> statement-breakpoint
CREATE TABLE "transition_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_role" text NOT NULL,
	"to_role" text NOT NULL,
	"email" text NOT NULL,
	"kind" "request_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transition_requests_uniq" UNIQUE("from_role","to_role","email","kind"),
	CONSTRAINT "transition_requests_email_norm" CHECK ("transition_requests"."email" = lower(btrim("transition_requests"."email")))
);
--> statement-breakpoint
ALTER TABLE "resource_suggestions" ADD CONSTRAINT "resource_suggestions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_topics" ADD CONSTRAINT "role_topics_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_topics" ADD CONSTRAINT "role_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_edges" ADD CONSTRAINT "topic_edges_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_edges" ADD CONSTRAINT "topic_edges_prerequisite_id_topics_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transition_requests" ADD CONSTRAINT "transition_requests_from_role_roles_id_fk" FOREIGN KEY ("from_role") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transition_requests" ADD CONSTRAINT "transition_requests_to_role_roles_id_fk" FOREIGN KEY ("to_role") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_suggestions_topic_idx" ON "resource_suggestions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "resources_topic_status_idx" ON "resources" USING btree ("topic_id","status");--> statement-breakpoint
CREATE INDEX "role_topics_role_kind_idx" ON "role_topics" USING btree ("role_id","kind");--> statement-breakpoint
CREATE INDEX "topic_edges_prerequisite_idx" ON "topic_edges" USING btree ("prerequisite_id","topic_id");