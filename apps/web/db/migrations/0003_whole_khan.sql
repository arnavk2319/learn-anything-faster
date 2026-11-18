CREATE TABLE "learn_feedback" (
	"track_id" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"client_hash" text NOT NULL,
	"rating" smallint NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learn_feedback_pk" PRIMARY KEY("track_id","target_kind","target_id","client_hash"),
	CONSTRAINT "learn_feedback_rating_range" CHECK ("learn_feedback"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "learn_feedback_note_len" CHECK ("learn_feedback"."note" IS NULL OR char_length("learn_feedback"."note") <= 280),
	CONSTRAINT "learn_feedback_client_hash_hex" CHECK ("learn_feedback"."client_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE INDEX "learn_feedback_note_idx" ON "learn_feedback" USING btree ("updated_at") WHERE "learn_feedback"."note" IS NOT NULL;