// Build-time Learn indexes (ADR-0015 sections 1 and 4). Approved items only.
import type { Pack } from "./validate.ts";

export interface SearchEntry {
  id: string;
  type: "concept" | "problem" | "question";
  title: string;
  summary: string;
  tags: string[];
  url: string;
}
export interface ConceptSet {
  id: string;
  conceptId: string;
  questionIds: string[];
}

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
};

export function buildSearchIndex(pack: Pack, trackId: string): SearchEntry[] {
  const base = `/learn/${trackId}`;
  const out: SearchEntry[] = [];
  for (const c of pack.concepts)
    if (c.status === "approved")
      out.push({
        id: c.id,
        type: "concept",
        title: c.title,
        summary: c.summary,
        tags: [c.stage],
        url: `${base}/concepts/${c.id}`,
      });
  for (const p of pack.problems)
    if (p.status === "approved")
      out.push({
        id: p.id,
        type: "problem",
        title: p.title,
        summary: p.summary,
        tags: [p.difficulty],
        url: `${base}/problems/${p.id}`,
      });
  for (const q of pack.questions) {
    if (q.status !== "approved" || q.retired) continue;
    out.push({
      id: q.id,
      type: "question",
      title: clip(q.prompt, 90),
      summary: typeof q.answer === "string" ? clip(q.answer, 100) : "",
      tags: q.tags,
      url:
        q.problemId !== undefined
          ? `${base}/problems/${q.problemId}`
          : `${base}/questions/set-${q.conceptId}`,
    });
  }
  return out;
}

export function buildConceptSets(pack: Pack): ConceptSet[] {
  const sets: ConceptSet[] = [];
  for (const c of pack.concepts) {
    if (c.status !== "approved") continue;
    const ids = pack.questions
      .filter(
        (q) =>
          q.status === "approved" &&
          !q.retired &&
          (q.conceptId === c.id || q.relatedConceptIds.includes(c.id)),
      )
      .map((q) => q.id);
    const questionIds = [...new Set(ids)];
    if (questionIds.length > 0) sets.push({ id: `set-${c.id}`, conceptId: c.id, questionIds });
  }
  return sets;
}
