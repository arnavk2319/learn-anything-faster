// Pure vote-panel state for one feedback target (ADR-0017). The note is only offered after a "not helpful" vote.
import { NOTE_MAX_UI, type Rating } from "./client";

export type Status = "idle" | "sending" | "sent" | "queued" | "limited" | "error" | "retracted";
export type VoteState = { vote: Rating | null; status: Status; note: string; noteSent: boolean };
export type VoteAction =
  | { type: "load"; vote: Rating | null }
  | { type: "send"; vote: Rating | null }
  | { type: "result"; result: "ok" | "rate_limited" | "unavailable" | "invalid" }
  | { type: "note"; text: string }
  | { type: "noteSent" };

export const initialVote: VoteState = { vote: null, status: "idle", note: "", noteSent: false };

export const noteAllowed = (s: VoteState): boolean => s.vote === 1;

export function voteReducer(s: VoteState, a: VoteAction): VoteState {
  switch (a.type) {
    case "load":
      return { ...s, vote: a.vote };
    case "send":
      // Changing or retracting a vote drops the note (it belongs to a "not helpful" vote only).
      return {
        ...s,
        vote: a.vote,
        status: "sending",
        ...(a.vote === 1 && s.vote === 1 ? {} : { note: "", noteSent: false }),
      };
    case "result":
      return {
        ...s,
        status:
          a.result === "ok"
            ? s.vote === null
              ? "retracted"
              : "sent"
            : a.result === "rate_limited"
              ? "limited"
              : a.result === "unavailable"
                ? "queued"
                : "error",
      };
    case "note":
      return noteAllowed(s) ? { ...s, note: a.text.slice(0, NOTE_MAX_UI), noteSent: false } : s;
    case "noteSent":
      return { ...s, noteSent: true };
  }
}
