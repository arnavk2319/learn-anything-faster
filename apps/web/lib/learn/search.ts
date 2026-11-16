// Client-side Learn search (ADR-0015 section 4). Pure: no React, no IO, no dependency.
// Every query token must match (AND). A token matches a field word by prefix; an exact word match scores
// higher. Field weights: title 6, tags 3, summary 1.
export interface SearchDoc {
  id: string;
  type: "track" | "concept" | "problem" | "question";
  title: string;
  summary: string;
  tags: string[];
  url: string;
}

export const FIELD_WEIGHTS = { title: 6, tags: 3, summary: 1 } as const;
const EXACT_BONUS = 1.5;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

function fieldScore(words: string[], token: string, weight: number): number {
  let best = 0;
  for (const w of words) {
    if (w === token) return weight * EXACT_BONUS;
    if (w.startsWith(token)) best = weight;
  }
  return best;
}

/** Score one doc for a query: 0 when any token is unmatched. */
export function scoreDoc(doc: SearchDoc, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const title = tokenize(doc.title);
  const tags = tokenize(doc.tags.join(" "));
  const summary = tokenize(doc.summary);
  let total = 0;
  for (const t of tokens) {
    const s = Math.max(
      fieldScore(title, t, FIELD_WEIGHTS.title),
      fieldScore(tags, t, FIELD_WEIGHTS.tags),
      fieldScore(summary, t, FIELD_WEIGHTS.summary),
    );
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

/** Best matches first (score desc, then title), at most `limit`. */
export function searchDocs(docs: SearchDoc[], query: string, limit = 8): SearchDoc[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return docs
    .map((d) => ({ d, s: scoreDoc(d, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.d.title.localeCompare(b.d.title))
    .slice(0, limit)
    .map((x) => x.d);
}
