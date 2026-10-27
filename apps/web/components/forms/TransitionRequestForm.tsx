"use client";
// Reusable by T-009 (unmapped pair, kind="request") and the Browse page (Coming soon, kind="notify").
import { useActionState } from "react";
import { requestTransitionAction } from "../../app/actions/forms";
import type { FormResult } from "../../lib/forms/schemas";
import { buttonClass, FormField, inputClass } from "./FormField";

const COPY = {
  request: {
    button: "Request this move",
    pending: "Requesting",
    done: "Requested. We'll email you when it's mapped.",
    placeholder: "Email me when it is",
  },
  notify: {
    button: "Notify me",
    pending: "Saving",
    done: "You'll be notified.",
    placeholder: "Your email",
  },
} as const;

export function TransitionRequestForm({
  fromRole,
  toRole,
  kind,
}: {
  fromRole: string;
  toRole: string;
  kind: "request" | "notify";
}) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(
    requestTransitionAction,
    null,
  );
  const c = COPY[kind];
  if (state?.ok) {
    return (
      <p role="status" className="text-sm font-medium">
        {c.done}
      </p>
    );
  }
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} noValidate className="flex flex-col gap-3" aria-label={c.button}>
      <input type="hidden" name="fromRole" value={fromRole} />
      <input type="hidden" name="toRole" value={toRole} />
      <input type="hidden" name="kind" value={kind} />
      <FormField id={`email-${kind}`} label="Email" error={fe?.email ?? fe?.toRole ?? fe?.fromRole}>
        <input
          id={`email-${kind}`}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={c.placeholder}
          aria-invalid={fe?.email ? true : undefined}
          aria-describedby={fe?.email ? `email-${kind}-error` : undefined}
          className={inputClass}
        />
      </FormField>
      {state && !state.ok && state.error === "rate_limited" ? (
        <p role="alert" className="text-destructive text-sm">
          Too many requests. Try again in a few minutes.
        </p>
      ) : null}
      {state && !state.ok && state.error === "failed" ? (
        <p role="alert" className="text-destructive text-sm">
          Something went wrong. Try again.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? c.pending : c.button}
      </button>
    </form>
  );
}
