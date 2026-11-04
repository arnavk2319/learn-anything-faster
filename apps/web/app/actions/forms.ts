"use server";
// Server actions behind the capture forms (spec F7). Contract: FormData in, FormResult out, no email ever returned.
import { headers } from "next/headers";
import { getDb } from "../../db";
import {
  submitResourceSuggestion,
  submitTransitionRequest,
  type FormDb,
} from "../../lib/forms/service";
import type { FormResult } from "../../lib/forms/schemas";
import { clientIp } from "../../lib/forms/client-ip";

const str = (d: FormData, k: string) => {
  const v = d.get(k);
  return typeof v === "string" ? v : "";
};

async function ctx(action: string, d: FormData) {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[0];
  return { ip: clientIp(h), action, host, token: str(d, "cf-turnstile-response") };
}

export async function requestTransitionAction(
  _prev: FormResult | null,
  d: FormData,
): Promise<FormResult> {
  const db = (await getDb()) as unknown as FormDb; // drivers differ only in type; insert API is identical
  return submitTransitionRequest(
    db,
    {
      fromRole: str(d, "fromRole"),
      toRole: str(d, "toRole"),
      email: str(d, "email"),
      kind: str(d, "kind"),
    },
    await ctx("transition", d),
  );
}

export async function suggestResourceAction(
  _prev: FormResult | null,
  d: FormData,
): Promise<FormResult> {
  const db = (await getDb()) as unknown as FormDb; // see above
  return submitResourceSuggestion(
    db,
    { topicId: str(d, "topicId"), url: str(d, "url"), note: str(d, "note") },
    await ctx("suggestion", d),
  );
}
