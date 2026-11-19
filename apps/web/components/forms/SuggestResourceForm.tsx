"use client";
// Reusable by T-011 (topic panel). Anonymous: link plus optional note, no email.
import { useActionState, useState } from "react";
import { suggestResourceAction } from "../../app/actions/forms";
import type { FormResult } from "../../lib/forms/schemas";
import { BLOCKED_COPY, TurnstileWidget } from "./TurnstileWidget";
import { Button } from "@/components/ui/button";
import { FormField, inputClass } from "./FormField";

export function SuggestResourceForm({ topicId }: { topicId: string }) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(
    suggestResourceAction,
    null,
  );
  // Controlled so a failed submit keeps what the user typed after React resets the form.
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  if (state?.ok) {
    return (
      <p role="status" className="text-[length:var(--text-ui)] font-medium">
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
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          placeholder="https://"
          aria-invalid={fe?.url || fe?.topicId ? true : undefined}
          aria-describedby={fe?.url || fe?.topicId ? `url-${topicId}-error` : undefined}
          className={inputClass}
        />
      </FormField>
      <FormField id={`note-${topicId}`} label="Note (optional)" error={fe?.note}>
        <textarea
          id={`note-${topicId}`}
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          className={`${inputClass} min-h-24 py-2`}
        />
      </FormField>
      <TurnstileWidget action="suggestion" resetKey={state} />
      {state && !state.ok && state.error === "blocked" ? (
        <p role="alert" className="text-[length:var(--text-small)] text-destructive">
          {BLOCKED_COPY}
        </p>
      ) : null}
      {state && !state.ok && state.error === "rate_limited" ? (
        <p role="alert" className="text-[length:var(--text-small)] text-destructive">
          Too many suggestions. Try again in a few minutes.
        </p>
      ) : null}
      {state && !state.ok && state.error === "failed" ? (
        <p role="alert" className="text-[length:var(--text-small)] text-destructive">
          Something went wrong. Try again.
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Sending" : "Suggest a resource"}
      </Button>
    </form>
  );
}
