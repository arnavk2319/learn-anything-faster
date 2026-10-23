"use client";
// Reusable by T-011 (topic panel). Anonymous: link plus optional note, no email.
import { useActionState } from "react";
import { suggestResourceAction } from "../../app/actions/forms";
import type { FormResult } from "../../lib/forms/schemas";
import { buttonClass, FormField, inputClass } from "./FormField";

export function SuggestResourceForm({ topicId }: { topicId: string }) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(
    suggestResourceAction,
    null,
  );
  if (state?.ok) {
    return (
      <p role="status" className="text-sm font-medium">
        Suggested. Thanks, we'll review it.
      </p>
    );
  }
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form
      action={action}
      noValidate
      className="flex flex-col gap-3"
      aria-label="Suggest a resource"
    >
      <input type="hidden" name="topicId" value={topicId} />
      <FormField id={`url-${topicId}`} label="Link" error={fe?.url ?? fe?.topicId}>
        <input
          id={`url-${topicId}`}
          name="url"
          type="url"
          placeholder="https://"
          aria-invalid={fe?.url ? true : undefined}
          aria-describedby={fe?.url ? `url-${topicId}-error` : undefined}
          className={inputClass}
        />
      </FormField>
      <FormField id={`note-${topicId}`} label="Note (optional)" error={fe?.note}>
        <textarea
          id={`note-${topicId}`}
          name="note"
          rows={3}
          maxLength={500}
          className={`${inputClass} h-auto py-2`}
        />
      </FormField>
      {state && !state.ok && state.error === "rate_limited" ? (
        <p role="alert" className="text-destructive text-sm">
          Too many suggestions. Try again in a few minutes.
        </p>
      ) : null}
      {state && !state.ok && state.error === "failed" ? (
        <p role="alert" className="text-destructive text-sm">
          Something went wrong. Try again.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending" : "Suggest a resource"}
      </button>
    </form>
  );
}
