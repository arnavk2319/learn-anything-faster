// One Zod schema per entity (spec F7). Shared by the server actions and the client forms.
import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid id");

/** Stored trimmed + lowercased (the DB CHECK demands it). */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Enter an email address" }));

export const transitionRequestSchema = z
  .object({
    fromRole: slug,
    toRole: slug,
    email,
    kind: z.enum(["request", "notify"]),
  })
  .refine((v) => v.fromRole !== v.toRole, { path: ["toRole"], error: "Pick two different roles" });
export type TransitionRequestInput = z.infer<typeof transitionRequestSchema>;

export const resourceSuggestionSchema = z.object({
  topicId: slug,
  url: z
    .string()
    .trim()
    .max(2000)
    .pipe(z.url({ protocol: /^https?$/, error: "Enter a link that starts with http or https" })),
  note: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});
export type ResourceSuggestionInput = z.infer<typeof resourceSuggestionSchema>;

export type FormResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid" | "rate_limited" | "failed";
      fieldErrors?: Record<string, string>;
    };
