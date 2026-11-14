// Pure quick-check logic (ADR-0015 sections 1 and 6): deterministic option shuffle, grading by option id,
// and the public (answer-free) shape rendered into server HTML. No React, no IO.
import type { Question } from "./schemas";

export type QuestionType = Question["type"];

/** What the server renders: prompt and options only. Never the answer, rubric or explanation. */
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: { id: string; text: string }[];
  level: Question["level"];
}

/** What the static JSON carries for grading. */
export interface GradingEntry {
  id: string;
  answer: string[] | string;
  explanation: string;
  rubric?: string[];
}

export function toPublic(q: Question): PublicQuestion {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    ...(q.options ? { options: q.options.map((o) => ({ id: o.id, text: o.text })) } : {}),
    level: q.level,
  };
}

export function toGrading(q: Question): GradingEntry {
  return {
    id: q.id,
    answer: q.answer,
    explanation: q.explanation,
    ...(q.rubric ? { rubric: q.rubric } : {}),
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic Fisher-Yates (mulberry32). Seed is `<question id>:<attempt>`; same on server and client. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  let a = hash(seed);
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));

export const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Display order for options. For `ordering`, the start order must differ from the answer: bump the
 * seed until it does (an answer of one item cannot differ and is returned as is).
 */
export function displayOptions<T extends { id: string }>(
  q: { id: string; type: QuestionType },
  options: readonly T[],
  attempt: number,
  answer?: readonly string[],
): T[] {
  for (let bump = 0; bump < 20; bump++) {
    const out = seededShuffle(options, `${q.id}:${attempt + bump}`);
    if (
      q.type !== "ordering" ||
      !answer ||
      !sameOrder(
        out.map((o) => o.id),
        answer,
      )
    )
      return out;
  }
  return [...options].reverse();
}

/** Grades by option id only. Returns null for self-graded questions (short-explain, free predict-output). */
export function grade(
  type: QuestionType,
  answer: string[] | string,
  response: readonly string[],
): boolean | null {
  if (typeof answer === "string") return null;
  if (type === "ordering") return sameOrder(response, answer);
  if (type === "mcq" || type === "predict-output")
    return response.length === 1 && answer.includes(response[0] as string);
  return sameSet(response, answer);
}
