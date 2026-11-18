// Anonymous feedback schemas (ADR-0017). One Zod schema per entity: the request and the stored row.
import { createHash } from "node:crypto";
import { z } from "zod";

const slug = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** The one list of target kinds; the UI imports it too. `track` is reserved for the later star roll-up. */
export const FEEDBACK_TARGET_KINDS = [
  "concept",
  "problem",
  "question",
  "sim",
  "block",
  "track",
] as const;
export type FeedbackTargetKind = (typeof FEEDBACK_TARGET_KINDS)[number];

export const NOTE_MAX = 280;

export const feedbackRequestSchema = z.strictObject({
  clientId: z.uuid(),
  trackId: slug,
  targetKind: z.enum(FEEDBACK_TARGET_KINDS),
  targetId: z.string().min(1).max(200),
  // 5 = helpful, 1 = not helpful (v1 UI); null retracts. 2-4 are reserved for the track star roll-up.
  rating: z.union([z.literal(1), z.literal(5)]).nullable(),
  note: z.string().trim().max(NOTE_MAX).optional(),
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export const feedbackRowSchema = z.strictObject({
  trackId: slug,
  targetKind: z.enum(FEEDBACK_TARGET_KINDS),
  targetId: z.string().min(1).max(200),
  clientHash: z.string().regex(/^[0-9a-f]{64}$/),
  rating: z.number().int().min(1).max(5),
  note: z.string().max(NOTE_MAX).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type FeedbackRow = z.infer<typeof feedbackRowSchema>;

/** Hex sha256 of the anonymous client id: the only form in which it is stored. */
export const hashClientId = (clientId: string): string =>
  createHash("sha256").update(clientId).digest("hex");

/**
 * Note to store: control characters stripped, trimmed, empty becomes null, and dropped unless the rating is 1.
 */
export function normalizeNote(note: string | undefined, rating: number | null): string | null {
  if (rating !== 1 || note === undefined) return null;
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const clean = note.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  return clean === "" ? null : clean;
}
