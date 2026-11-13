// Learn content validator (ADR-0015 section 3). Pure: takes raw objects, returns errors. No file IO here.
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ConceptSchema,
  ProblemSchema,
  QuestionSchema,
  QuestionSetSchema,
  SimSchema,
  TrackSchema,
  type Block,
  type Concept,
  type Problem,
  type Question,
  type QuestionSet,
  type Sim,
  type Src,
  type Track,
} from "../../../apps/web/lib/learn/schemas.ts";

export interface Issue {
  rule: string;
  id?: string;
  message: string;
}
export interface Denylist {
  terms: string[];
  hashes: string[];
}
export interface Pack {
  track: Track;
  concepts: Concept[];
  problems: Problem[];
  questions: Question[];
  sets: QuestionSet[];
  sims: Sim[];
  guides: Record<string, string>;
  previousApprovedIds: string[];
  templates: string[];
  denylist: Denylist;
  knownTopicIds?: string[];
}
export interface ParseResult {
  ok: boolean;
  pack?: Pack;
  issues: Issue[];
}
export interface ValidateResult {
  errors: Issue[];
  gap: { count: number; items: number; ratio: number };
  exceptions: number;
  report: string;
}

/** Plain list until the sim engine (T-044) exports its template registry. */
export const SIM_TEMPLATES = [
  "cache-aside",
  "load-balancer",
  "leader-follower",
  "producer-consumer",
  "consistent-hash-ring",
  "sharded-lookup",
];

export const GAP_RATIO_CAP = 0.35;
export const GAP_COUNT_CAP = 15;
export const EXCEPTION_CAP = 2;

export const hashTerm = (term: string): string =>
  createHash("sha256").update(term.toLowerCase()).digest("hex");

// ---------- parse (Zod only) ----------

const fmtPath = (path: PropertyKey[]) => path.map(String).join(".");
function zodIssues(kind: string, id: string | undefined, err: z.ZodError): Issue[] {
  return err.issues.map((i) => ({
    rule: "schema",
    id,
    message: `${kind}${id ? ` ${id}` : ""}: ${fmtPath(i.path) || "(root)"}: ${i.message}`,
  }));
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const idOf = (v: unknown): string | undefined => {
  const id = rec(v).id;
  return typeof id === "string" ? id : undefined;
};

export function parsePack(raw: unknown): ParseResult {
  const r = rec(raw);
  const issues: Issue[] = [];
  const one = <T>(kind: string, schema: z.ZodType<T>, v: unknown): T | undefined => {
    const res = schema.safeParse(v);
    if (res.success) return res.data;
    issues.push(...zodIssues(kind, idOf(v), res.error));
    return undefined;
  };
  const many = <T>(kind: string, schema: z.ZodType<T>, v: unknown): T[] =>
    arr(v)
      .map((x) => one(kind, schema, x))
      .filter((x): x is T => x !== undefined);

  const track = one("track", TrackSchema, r.track);
  const concepts = many("concept", ConceptSchema, r.concepts);
  const problems = many("problem", ProblemSchema, r.problems);
  const questions = many("question", QuestionSchema, r.questions);
  const sets = many("set", QuestionSetSchema, r.sets);
  const sims = many("sim", SimSchema, r.sims);
  if (issues.length > 0 || !track) return { ok: false, issues };
  const dl = rec(r.denylist);
  const strs = (v: unknown) => arr(v).filter((x): x is string => typeof x === "string");
  const pack: Pack = {
    track,
    concepts,
    problems,
    questions,
    sets,
    sims,
    guides: Object.fromEntries(
      Object.entries(rec(r.guides)).filter((e): e is [string, string] => typeof e[1] === "string"),
    ),
    previousApprovedIds: strs(r.previousApprovedIds),
    templates: r.templates === undefined ? SIM_TEMPLATES : strs(r.templates),
    denylist: { terms: strs(dl.terms), hashes: strs(dl.hashes) },
    knownTopicIds: r.knownTopicIds === undefined ? undefined : strs(r.knownTopicIds),
  };
  return { ok: true, pack, issues };
}

// ---------- guides ----------

const normWs = (s: string) => s.replace(/\s+/g, " ").trim();
export const normHeading = (h: string) => normWs(h.replace(/★/g, "").replace(/^\s*\d+\.\s+/, ""));

/** H2 sections of a guide: normalised heading -> RAW section text (up to the next H1/H2). Fenced code is skipped for headings. */
export function guideSections(md: string): Map<string, string> {
  const out = new Map<string, string>();
  let cur: string | undefined;
  let buf: string[] = [];
  let fence = false;
  const flush = () => {
    if (cur !== undefined && !out.has(cur)) out.set(cur, buf.join("\n"));
  };
  for (const line of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h2 = !fence ? /^##\s+(.*)$/.exec(line) : null;
    if (h2) {
      flush();
      cur = normHeading(h2[1] ?? "");
      buf = [];
    } else if (!fence && /^#\s/.test(line)) {
      flush();
      cur = undefined;
      buf = [];
    } else buf.push(line);
  }
  flush();
  return out;
}

// ---------- walking ----------

interface SrcNode {
  where: string;
  id: string;
  src: Src;
  approved: boolean;
}

function blockSrcs(blocks: Block[], owner: string, approved: boolean, out: SrcNode[]) {
  for (const b of blocks) {
    if (b.type === "faq") {
      b.items.forEach((it, i) =>
        out.push({
          where: `${owner} block ${b.id} faq item ${i + 1}`,
          id: owner,
          src: it.src,
          approved,
        }),
      );
    } else out.push({ where: `${owner} block ${b.id}`, id: owner, src: b.src, approved });
  }
}

const conceptBlocks = (c: Concept): Block[] => Object.values(c.levels).flatMap((l) => l ?? []);

function allSrcNodes(p: Pack): SrcNode[] {
  const out: SrcNode[] = [];
  for (const c of p.concepts) {
    const ok = c.status === "approved";
    blockSrcs(conceptBlocks(c), `concept ${c.id}`, ok, out);
    if ("nodes" in c.sim)
      out.push({ where: `sim ${c.sim.id}`, id: c.id, src: c.sim.src, approved: ok });
  }
  for (const pr of p.problems) {
    const ok = pr.status === "approved";
    blockSrcs(pr.blocks, `problem ${pr.id}`, ok, out);
    if ("nodes" in pr.sim)
      out.push({ where: `sim ${pr.sim.id}`, id: pr.id, src: pr.sim.src, approved: ok });
  }
  for (const q of p.questions)
    out.push({
      where: `question ${q.id}`,
      id: q.id,
      src: q.src,
      approved: q.status === "approved",
    });
  for (const s of p.sims) out.push({ where: `sim ${s.id}`, id: s.id, src: s.src, approved: true });
  return out;
}

function stringsOf(
  v: unknown,
  path: string,
  out: { path: string; text: string }[],
  skip: Set<string>,
) {
  if (typeof v === "string") out.push({ path, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => stringsOf(x, `${path}[${i}]`, out, skip));
  else if (v !== null && typeof v === "object")
    for (const [k, x] of Object.entries(v))
      if (!skip.has(k)) stringsOf(x, path ? `${path}.${k}` : k, out, skip);
}

// ---------- the rules ----------

const OPTION_LETTER =
  /\b[Oo]ptions?\s+\(?[A-E]\b|\b[Cc]hoices?\s+\(?[A-E]\b|\b(first|second|third|fourth|fifth|last|top|bottom)\s+(option|choice|answer)\b|\b(all|none|both)\s+of\s+the\s+above\b/i;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;
const EXTERNAL_IMAGE = /!\[[^\]]*\]\(\s*(?:https?:)?\/\/|<img\b/i;
const stripCode = (s: string) => s.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];

const WORD_CHAR = /[\p{L}\p{N}_]/u;
const lower = (t: string): string => t.toLowerCase();

// Case-insensitive, Unicode-aware whole-word search; `term` must already be lowercased.
function hasWholeWord(hay: string, term: string): boolean {
  for (let i = hay.indexOf(term); i !== -1; i = hay.indexOf(term, i + 1)) {
    const before = Array.from(hay.slice(Math.max(0, i - 2), i)).pop() ?? "";
    const after = Array.from(hay.slice(i + term.length, i + term.length + 2))[0] ?? "";
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
  }
  return false;
}

export function validateLearn(raw: unknown): ValidateResult {
  const parsed = parsePack(raw);
  const errors: Issue[] = [...parsed.issues];
  const r = rec(raw);
  const err = (rule: string, message: string, id?: string) => errors.push({ rule, id, message });

  // Denylist works on raw input, so it also runs when the schema fails.
  const dl = rec(r.denylist);
  const denyTerms = arr(dl.terms).filter((x): x is string => typeof x === "string");
  const denyHashes = new Set(arr(dl.hashes).filter((x): x is string => typeof x === "string"));
  const texts: { path: string; text: string }[] = [];
  for (const k of ["track", "concepts", "problems", "questions", "sets", "sims"])
    stringsOf(r[k], k, texts, new Set());
  for (const [g, md] of Object.entries(rec(r.guides)))
    if (typeof md === "string") texts.push({ path: `guide ${g}`, text: md });
  const plain = denyTerms.map((t) => t.toLowerCase());
  const denyHit = new Set<string>();
  for (const { path, text } of texts) {
    if (plain.some((t) => hasWholeWord(lower(text), t))) denyHit.add(path);
    else if (denyHashes.size > 0) {
      const w = words(text);
      for (let i = 0; i < w.length; i++) {
        if (
          denyHashes.has(hashTerm(w[i] ?? "")) ||
          (i + 1 < w.length && denyHashes.has(hashTerm(`${w[i]} ${w[i + 1]}`)))
        ) {
          denyHit.add(path);
          break;
        }
      }
    }
  }
  for (const path of denyHit)
    err("denylist", `denylisted term found at ${path} (term not shown)`, path);

  const empty = { count: 0, items: 0, ratio: 0 };
  const pack = parsed.pack;
  if (!pack) {
    return {
      errors,
      gap: empty,
      exceptions: 0,
      report: `learn:validate: ${errors.length} error(s); gap ratio not computed (schema errors)`,
    };
  }

  // ---- ids ----
  const seen = new Map<string, string>();
  const claim = (id: string, kind: string) => {
    const prev = seen.get(id);
    if (prev)
      err(
        "duplicate-id",
        `duplicate id "${id}" (${kind} and ${prev}); ids are unique per track`,
        id,
      );
    else seen.set(id, kind);
  };
  for (const c of pack.concepts) claim(c.id, "concept");
  for (const p of pack.problems) claim(p.id, "problem");
  for (const q of pack.questions) claim(q.id, "question");
  for (const s of pack.sets) claim(s.id, "set");
  const simIds = new Set<string>();
  const claimSim = (id: string) => {
    if (simIds.has(id) || seen.has(id))
      err("duplicate-id", `duplicate id "${id}" (sim); sim ids share the per-track namespace`, id);
    simIds.add(id);
  };
  for (const c of pack.concepts) if ("nodes" in c.sim) claimSim(c.sim.id);
  for (const p of pack.problems) if ("nodes" in p.sim) claimSim(p.sim.id);
  for (const s of pack.sims) claimSim(s.id);
  const blockIds = new Set<string>();
  const allBlocks = [
    ...pack.concepts.flatMap((c) => conceptBlocks(c).map((b) => [c.id, b] as const)),
    ...pack.problems.flatMap((p) => p.blocks.map((b) => [p.id, b] as const)),
  ];
  for (const [owner, b] of allBlocks) {
    if (blockIds.has(b.id))
      err("duplicate-id", `duplicate block id "${b.id}" (in ${owner})`, owner);
    blockIds.add(b.id);
  }

  const conceptById = new Map(pack.concepts.map((c) => [c.id, c]));
  const problemById = new Map(pack.problems.map((p) => [p.id, p]));
  const questionById = new Map(pack.questions.map((q) => [q.id, q]));
  const sharedSimIds = new Set(pack.sims.map((s) => s.id));

  // ---- sims present / exceptions ----
  let exceptions = 0;
  const items: {
    kind: string;
    id: string;
    sim: Concept["sim"];
    blocks: Block[];
    approved: boolean;
  }[] = [
    ...pack.concepts.map((c) => ({
      kind: "concept",
      id: c.id,
      sim: c.sim,
      blocks: conceptBlocks(c),
      approved: c.status === "approved",
    })),
    ...pack.problems.map((p) => ({
      kind: "problem",
      id: p.id,
      sim: p.sim,
      blocks: p.blocks,
      approved: p.status === "approved",
    })),
  ];
  for (const it of items) {
    if ("exception" in it.sim) {
      exceptions++;
      continue;
    }
    const own = "nodes" in it.sim ? it.sim.id : it.sim.ref;
    if ("ref" in it.sim && !sharedSimIds.has(it.sim.ref))
      err(
        "sim-ref-unresolved",
        `${it.kind} ${it.id}: sim ref "${it.sim.ref}" is not a shared sim`,
        it.id,
      );
    for (const b of it.blocks)
      if (b.type === "sim" && b.ref !== own && !sharedSimIds.has(b.ref))
        err(
          "sim-ref-unresolved",
          `${it.kind} ${it.id}: sim block ${b.id} ref "${b.ref}" is neither its own sim nor a shared sim`,
          it.id,
        );
  }
  if (exceptions > EXCEPTION_CAP)
    err(
      "sim-exception-cap",
      `${exceptions} sim exceptions in this pack; the maximum is ${EXCEPTION_CAP}`,
    );

  // ---- block shape ----
  for (const [owner, b] of allBlocks) {
    if (b.type === "table")
      b.rows.forEach((row, i) => {
        if (row.length !== b.columns.length)
          err(
            "table-row-width",
            `${owner} table ${b.id}: row ${i + 1} has ${row.length} cells, expected ${b.columns.length}`,
            owner,
          );
      });
    if (b.type === "quiz") {
      if (b.questionIds.length > 2)
        err("quiz-too-many", `${owner} quiz ${b.id} has more than 2 question ids`, owner);
      for (const qid of b.questionIds)
        if (!questionById.has(qid))
          err("ref-unresolved", `${owner} quiz ${b.id}: question "${qid}" does not exist`, owner);
    }
  }

  // ---- references ----
  const topics = pack.knownTopicIds ? new Set(pack.knownTopicIds) : undefined;
  const checkTopics = (kind: string, id: string, ids: string[]) => {
    if (topics)
      for (const t of ids)
        if (!topics.has(t)) err("ref-unresolved", `${kind} ${id}: topic "${t}" does not exist`, id);
  };
  for (const c of pack.concepts) {
    checkTopics("concept", c.id, c.topicIds);
    for (const pre of c.prerequisites)
      if (!conceptById.has(pre))
        err("ref-unresolved", `concept ${c.id}: prerequisite "${pre}" does not exist`, c.id);
  }
  for (const p of pack.problems) {
    checkTopics("problem", p.id, p.topicIds);
    for (const cid of p.conceptIds)
      if (!conceptById.has(cid))
        err("ref-unresolved", `problem ${p.id}: concept "${cid}" does not exist`, p.id);
  }
  for (const s of pack.sets) {
    for (const cid of s.conceptIds)
      if (!conceptById.has(cid))
        err("ref-unresolved", `set ${s.id}: concept "${cid}" does not exist`, s.id);
    for (const qid of s.questionIds ?? [])
      if (!questionById.has(qid))
        err("set-member-unresolved", `set ${s.id}: question "${qid}" does not exist`, s.id);
  }

  // ---- approved references only approved ----
  const refProposed = (from: string, kind: string, to: string) =>
    err("approved-refs-proposed", `approved ${from} references proposed ${kind} "${to}"`, from);
  for (const c of pack.concepts) {
    if (c.status !== "approved") continue;
    for (const pre of c.prerequisites)
      if (conceptById.get(pre)?.status === "proposed") refProposed(c.id, "concept", pre);
    for (const b of conceptBlocks(c))
      if (b.type === "quiz")
        for (const qid of b.questionIds)
          if (questionById.get(qid)?.status === "proposed") refProposed(c.id, "question", qid);
  }
  for (const p of pack.problems) {
    if (p.status !== "approved") continue;
    for (const cid of p.conceptIds)
      if (conceptById.get(cid)?.status === "proposed") refProposed(p.id, "concept", cid);
    for (const b of p.blocks)
      if (b.type === "quiz")
        for (const qid of b.questionIds)
          if (questionById.get(qid)?.status === "proposed") refProposed(p.id, "question", qid);
  }
  for (const s of pack.sets) {
    // Sets carry no status: a set is approved when every concept it covers is approved.
    const approved = s.conceptIds.every((cid) => conceptById.get(cid)?.status === "approved");
    if (!approved) continue;
    for (const qid of s.questionIds ?? [])
      if (questionById.get(qid)?.status === "proposed") refProposed(s.id, "question", qid);
  }

  // ---- questions ----
  for (const q of pack.questions) {
    const owner = q.conceptId ?? q.problemId ?? "";
    if (q.conceptId !== undefined && !conceptById.has(q.conceptId))
      err("ref-unresolved", `question ${q.id}: concept "${q.conceptId}" does not exist`, q.id);
    if (q.problemId !== undefined && !problemById.has(q.problemId))
      err("ref-unresolved", `question ${q.id}: problem "${q.problemId}" does not exist`, q.id);
    for (const cid of q.relatedConceptIds) {
      if (cid === owner)
        err(
          "related-includes-owner",
          `question ${q.id}: relatedConceptIds must not include its owner "${cid}"`,
          q.id,
        );
      else if (!conceptById.has(cid))
        err("ref-unresolved", `question ${q.id}: related concept "${cid}" does not exist`, q.id);
    }
    const needsOptions = q.type === "mcq" || q.type === "multi" || q.type === "ordering";
    const optIds = (q.options ?? []).map((o) => o.id);
    if (needsOptions && optIds.length === 0)
      err("options-missing", `question ${q.id}: ${q.type} needs options`, q.id);
    if (needsOptions) {
      const ans = Array.isArray(q.answer) ? q.answer : [];
      if (q.type === "mcq" && ans.length !== 1)
        err(
          "mcq-answer-count",
          `question ${q.id}: mcq needs exactly 1 answer, found ${ans.length}`,
          q.id,
        );
      if (q.type === "multi" && ans.length < 2)
        err(
          "multi-answer-count",
          `question ${q.id}: multi needs at least 2 answers, found ${ans.length}`,
          q.id,
        );
      if (
        q.type === "ordering" &&
        (ans.length !== optIds.length ||
          new Set(ans).size !== ans.length ||
          !ans.every((a) => optIds.includes(a)))
      )
        err(
          "ordering-incomplete",
          `question ${q.id}: ordering answer must list every option id exactly once`,
          q.id,
        );
      if (optIds.length > 0)
        for (const a of ans)
          if (!optIds.includes(a))
            err(
              "answer-not-in-options",
              `question ${q.id}: answer "${a}" is not an option id`,
              q.id,
            );
    }
    if (q.explanation.trim() === "")
      err("explanation-missing", `question ${q.id}: explanation is required`, q.id);
    for (const [field, text] of [
      ["prompt", q.prompt],
      ["explanation", q.explanation],
      ...(q.rubric ?? []).map((x, i) => [`rubric[${i}]`, x] as const),
    ] as const)
      if (OPTION_LETTER.test(text))
        err(
          "option-letter-ref",
          `question ${q.id}: ${field} refers to an option by letter or position; refer by content`,
          q.id,
        );
  }

  // ---- src ----
  const sections = new Map<string, Map<string, string>>();
  for (const [g, md] of Object.entries(pack.guides)) sections.set(g, guideSections(md));
  for (const n of allSrcNodes(pack)) {
    if (n.src.kind !== "guide") continue;
    const secs = sections.get(n.src.guide);
    if (!secs) {
      err(
        "src-guide-missing",
        `${n.where}: guide "${n.src.guide}" not found in content/learn/_guides`,
        n.id,
      );
      continue;
    }
    const sec = secs.get(normHeading(n.src.heading));
    if (sec === undefined) {
      err(
        "src-heading-missing",
        `${n.where}: heading "${n.src.heading}" is not an H2 of guide "${n.src.guide}"`,
        n.id,
      );
      continue;
    }
    const quote = normWs(n.src.quote);
    if (quote.length < 8)
      err("src-quote-missing", `${n.where}: quote is under 8 characters after normalising`, n.id);
    else if (!normWs(sec).includes(quote))
      err(
        "src-quote-missing",
        `${n.where}: quote is not in the raw Markdown of "${n.src.heading}" (${quote.slice(0, 40)}...)`,
        n.id,
      );
  }

  // ---- raw HTML and external images ----
  const content: { path: string; text: string }[] = [];
  for (const k of ["concepts", "problems", "questions", "sets", "sims"])
    stringsOf(r[k], k, content, new Set(["quote", "code"]));
  for (const { path, text } of content) {
    const id = path;
    if (HTML_TAG.test(stripCode(text))) err("raw-html", `raw HTML is not allowed (${id})`, id);
    if (EXTERNAL_IMAGE.test(text))
      err("external-image", `external images are not allowed (${id})`, id);
  }

  // ---- sims ----
  const allSims: Sim[] = [
    ...pack.concepts.flatMap((c) => ("nodes" in c.sim ? [c.sim] : [])),
    ...pack.problems.flatMap((p) => ("nodes" in p.sim ? [p.sim] : [])),
    ...pack.sims,
  ];
  for (const s of allSims) checkSim(s, pack.templates, err);

  // ---- approved ids never removed ----
  const status = new Map<string, string>();
  for (const c of pack.concepts) status.set(c.id, c.status);
  for (const p of pack.problems) status.set(p.id, p.status);
  for (const q of pack.questions) status.set(q.id, q.retired ? "retired" : q.status);
  for (const s of pack.sets) status.set(s.id, "approved");
  for (const s of allSims) status.set(s.id, "approved");
  for (const id of pack.previousApprovedIds) {
    const st = status.get(id);
    if (st === undefined)
      err(
        "approved-id-removed",
        `approved id "${id}" was removed or renamed; retire it (retired: true) and add a new id with supersedes`,
        id,
      );
    else if (st === "proposed")
      err(
        "approved-id-removed",
        `approved id "${id}" is now proposed; approved items are immutable`,
        id,
      );
  }

  // ---- gap cap (approved items; proposed shown for information) ----
  const nodes = allSrcNodes(pack);
  const tally = (ns: SrcNode[]) => {
    const count = ns.filter((n) => n.src.kind === "gap").length;
    return { count, items: ns.length, ratio: ns.length === 0 ? 0 : count / ns.length };
  };
  const gap = tally(nodes.filter((n) => n.approved));
  const gapAll = tally(nodes);
  if (gap.count > GAP_COUNT_CAP)
    err("gap-cap", `${gap.count} gap items; the maximum is ${GAP_COUNT_CAP} per pack`);
  if (gap.ratio > GAP_RATIO_CAP)
    err(
      "gap-cap",
      `gap ratio ${(gap.ratio * 100).toFixed(1)}% exceeds the ${GAP_RATIO_CAP * 100}% cap`,
    );

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const report =
    `learn:validate: gap ${gap.count}/${gap.items} approved items = ${pct(gap.ratio)} (cap ${GAP_RATIO_CAP * 100}% and ${GAP_COUNT_CAP}); ` +
    `all items incl. proposed ${gapAll.count}/${gapAll.items} = ${pct(gapAll.ratio)}; sim exceptions ${exceptions}/${EXCEPTION_CAP}`;
  return { errors, gap, exceptions, report };
}

function checkSim(
  s: Sim,
  templates: string[],
  err: (rule: string, message: string, id?: string) => void,
) {
  const nodeIds = new Set(s.nodes.map((n) => n.id));
  const edgeIds = new Set(s.edges.map((e) => e.id));
  if (s.template !== undefined && !templates.includes(s.template))
    err(
      "sim-template",
      `sim ${s.id}: template "${s.template}" is not in the template registry`,
      s.id,
    );
  for (const e of s.edges)
    for (const end of [e.from, e.to])
      if (!nodeIds.has(end))
        err("sim-edge-ref", `sim ${s.id}: edge ${e.id} references missing node "${end}"`, s.id);
  for (const n of s.nodes) {
    const st = n.state;
    if (st?.type === "lru" && st.init.length > st.capacity)
      err(
        "sim-state-init",
        `sim ${s.id}: node ${n.id} lru init has ${st.init.length} keys but capacity is ${st.capacity}`,
        s.id,
      );
  }
  for (const sc of s.scenarios) {
    let caption = false;
    for (const ev of sc.events) {
      if (ev.at > s.durationMs)
        err(
          "sim-duration",
          `sim ${s.id}: scenario ${sc.id} has an event at ${ev.at}ms after durationMs ${s.durationMs}`,
          s.id,
        );
      if ("caption" in ev) caption = true;
      const node = (n: string | undefined) => {
        if (n !== undefined && !nodeIds.has(n))
          err(
            "sim-edge-ref",
            `sim ${s.id}: scenario ${sc.id} references missing node "${n}"`,
            s.id,
          );
      };
      const edge = (e: string | undefined) => {
        if (e !== undefined && !edgeIds.has(e))
          err(
            "sim-edge-ref",
            `sim ${s.id}: scenario ${sc.id} references missing edge "${e}"`,
            s.id,
          );
      };
      if ("send" in ev) edge(ev.send.edge);
      if ("decide" in ev) node(ev.decide.node);
      if ("state" in ev) node(ev.state.node);
      if ("highlight" in ev) {
        node(ev.highlight.node);
        edge(ev.highlight.edge);
      }
      if ("spawn" in ev) node(ev.spawn.node);
    }
    if (!caption)
      err("sim-caption", `sim ${s.id}: scenario ${sc.id} needs at least one caption event`, s.id);
  }
}
