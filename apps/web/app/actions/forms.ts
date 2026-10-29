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

async function ctx(action: string) {
  const h = await headers();
  return { ip: clientIp(h), action };
}

const str = (d: FormData, k: string) => {
  const v = d.get(k);
  return typeof v === "string" ? v : "";
};

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
    await ctx("transition"),
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
    await ctx("suggestion"),
  );
}
