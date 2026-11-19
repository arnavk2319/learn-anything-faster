"use client";
// Shared question card and quick check (DESIGN.md 14.4). Grades client-side. The server HTML carries only the
// prompt and options; answers, rubric and explanation arrive from a static JSON file (`gradingUrl`) fetched on
// the client. Results are written with the progress module. T-048 (Questions tab) reuses QuestionCard.
import { useEffect, useId, useState } from "react";
import {
  displayOptions,
  grade,
  type GradingEntry,
  type PublicQuestion,
} from "@/lib/learn/quickcheck";
import { readProgress, recordAnswer, writeProgress } from "@/lib/learn/progress";
import { Md, MdInline } from "./Md";
import { useRewards } from "@/components/rewards/RewardsProvider";

const gradingCache = new Map<string, Promise<Record<string, GradingEntry>>>();

function loadGrading(url: string): Promise<Record<string, GradingEntry>> {
  let p = gradingCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<GradingEntry[]>;
      })
      .then((list) => Object.fromEntries(list.map((e) => [e.id, e])))
      .catch((e) => {
        gradingCache.delete(url);
        throw e;
      });
    gradingCache.set(url, p);
  }
  return p;
}

const btn =
  "min-h-10 rounded-md border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const primaryBtn = `${btn} border-transparent bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.98]`;
const outlineBtn = `${btn} bg-card hover:bg-lane active:scale-[0.98]`;

type Outcome = { correct: boolean; selfGraded: boolean };

/** Icon feedback on the option the learner got right (stamp; decorative, the status text carries the meaning). */
function OptionStamp() {
  return (
    <span
      data-testid="option-stamp"
      aria-hidden="true"
      className="reward-stamp flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3.5 8.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function QuestionCard({
  question,
  index,
  gradingUrl,
}: {
  question: PublicQuestion;
  index: number;
  gradingUrl: string;
}) {
  const q = question;
  const uid = useId();
  const [attempt, setAttempt] = useState(0);
  const [entry, setEntry] = useState<GradingEntry | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(() =>
    q.type === "ordering" ? displayOptions(q, q.options ?? [], 0).map((o) => o.id) : [],
  );
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [earlier, setEarlier] = useState(false);
  const [error, setError] = useState(false);
  const [hint, setHint] = useState(false);
  const rewards = useRewards();

  useEffect(() => {
    setEarlier(readProgress().answers[q.id] !== undefined);
    let live = true;
    loadGrading(gradingUrl)
      .then((m) => live && setEntry(m[q.id] ?? null))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [gradingUrl, q.id]);

  // Ordering needs a start order that differs from the answer, which the server cannot know.
  useEffect(() => {
    if (q.type !== "ordering" || !entry || typeof entry.answer === "string") return;
    const answer = entry.answer;
    setOrder((cur) =>
      cur.length === answer.length && cur.every((id, i) => id === answer[i])
        ? displayOptions(q, q.options ?? [], attempt + 1, answer).map((o) => o.id)
        : cur,
    );
  }, [entry, q, attempt]);

  const options = q.options ?? [];
  const byId = new Map(options.map((o) => [o.id, o]));
  const shown =
    q.type === "ordering"
      ? order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
      : displayOptions(q, options, attempt);
  const selfGraded = entry ? typeof entry.answer === "string" : q.type === "short-explain";

  function save(correct: boolean, self: boolean) {
    const before = readProgress();
    const after = recordAnswer(before, q.id, correct, Date.now(), self ? true : undefined);
    writeProgress(after);
    setEarlier(true);
    rewards.answered({ before, after, questionId: q.id, correct });
  }

  async function check() {
    let e = entry;
    if (!e) {
      try {
        e = (await loadGrading(gradingUrl))[q.id] ?? null;
      } catch {
        setError(true);
      }
      setEntry(e);
    }
    if (!e) return;
    const correct = grade(q.type, e.answer, q.type === "ordering" ? order : picked);
    if (correct === null) return;
    setOutcome({ correct, selfGraded: false });
    save(correct, false);
  }

  function selfGrade(correct: boolean) {
    setOutcome({ correct, selfGraded: true });
    save(correct, true);
  }

  function retry() {
    setOutcome(null);
    setRevealed(false);
    setHint(false);
    setPicked([]);
    const next = attempt + 1;
    setAttempt(next);
    if (q.type === "ordering")
      setOrder(
        displayOptions(
          q,
          options,
          next,
          entry && typeof entry.answer !== "string" ? entry.answer : undefined,
        ).map((o) => o.id),
      );
  }

  function move(i: number, d: -1 | 1) {
    setOrder((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j] as string, next[i] as string];
      return next;
    });
  }

  const done = outcome !== null;
  const inputType = q.type === "multi" ? "checkbox" : "radio";

  return (
    <div
      data-testid="question-card"
      data-question={q.id}
      className="rounded-lg border bg-card p-5 text-card-foreground sm:px-6"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Q{index + 1}</span>
        <span className="rounded-pill border px-2 py-0.5">{q.type}</span>
        <span className="rounded-pill border px-2 py-0.5">{q.level}</span>
        {earlier && !done ? <span>Answered before</span> : null}
      </div>
      <fieldset className="min-w-0">
        <legend className="mb-3 font-semibold">
          <MdInline text={q.prompt} />
        </legend>
        {q.type === "ordering" ? (
          <ol className="flex flex-col gap-2" aria-label="Put in order">
            {shown.map((o, i) => (
              <li
                key={o.id}
                className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-1"
              >
                <span className="flex-1">
                  <MdInline text={o.text} />
                </span>
                <button
                  type="button"
                  className={outlineBtn}
                  aria-label={`Move up: ${o.text}`}
                  disabled={done || i === 0}
                  onClick={() => move(i, -1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  className={outlineBtn}
                  aria-label={`Move down: ${o.text}`}
                  disabled={done || i === shown.length - 1}
                  onClick={() => move(i, 1)}
                >
                  Down
                </button>
              </li>
            ))}
          </ol>
        ) : options.length > 0 ? (
          <div className="flex flex-col gap-2">
            {shown.map((o) => {
              const id = `${uid}-${o.id}`;
              const on = picked.includes(o.id);
              // A wrong answer never reveals the correct option (ADR-0016 section 7).
              const isRight =
                done &&
                outcome.correct &&
                entry &&
                typeof entry.answer !== "string" &&
                entry.answer.includes(o.id);
              return (
                <label
                  key={o.id}
                  htmlFor={id}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-lane has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                    isRight
                      ? "border-known-ring bg-known text-known-foreground"
                      : done && on
                        ? "border-destructive"
                        : ""
                  }`}
                >
                  <input
                    id={id}
                    type={inputType}
                    name={`${uid}-q`}
                    value={o.id}
                    checked={on}
                    disabled={done}
                    onChange={() =>
                      setPicked((cur) =>
                        q.type === "multi"
                          ? cur.includes(o.id)
                            ? cur.filter((x) => x !== o.id)
                            : [...cur, o.id]
                          : [o.id],
                      )
                    }
                  />
                  <span className="flex-1">
                    <MdInline text={o.text} />
                  </span>
                  {isRight && on ? <OptionStamp /> : null}
                </label>
              );
            })}
          </div>
        ) : null}
      </fieldset>

      {selfGraded && !done ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {!revealed ? (
            <button type="button" className={primaryBtn} onClick={() => setRevealed(true)}>
              Show model answer
            </button>
          ) : null}
        </div>
      ) : !done ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryBtn}
            onClick={check}
            disabled={q.type !== "ordering" && picked.length === 0}
          >
            Check
          </button>
        </div>
      ) : null}

      {revealed && entry && typeof entry.answer === "string" && !done ? (
        <div className="mt-4 rounded-md border-l-4 border-primary bg-lane p-4">
          <Md text={entry.answer} />
          {entry.rubric ? (
            <ul className="mt-2 list-disc pl-6">
              {entry.rubric.map((r) => (
                <li key={r}>
                  <MdInline text={r} />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button type="button" className={primaryBtn} onClick={() => selfGrade(true)}>
              I got it
            </button>
            <button type="button" className={outlineBtn} onClick={() => selfGrade(false)}>
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      <div role="status" aria-live="polite">
        {done && entry ? (
          <div
            className={`mt-4 rounded-md border-l-4 bg-lane p-4 ${
              outcome.correct ? "border-primary" : "border-destructive"
            }`}
          >
            <p className="font-semibold">
              {outcome.selfGraded
                ? outcome.correct
                  ? "Marked as got it."
                  : "Marked as not yet."
                : outcome.correct
                  ? "Correct."
                  : "Not quite."}
            </p>
            {outcome.correct || outcome.selfGraded ? <Md text={entry.explanation} /> : null}
            {!outcome.correct && !outcome.selfGraded ? (
              <>
                {hint ? (
                  <p className="mt-2" data-testid="hint">
                    {q.type === "multi"
                      ? "More than one option can apply. Reread the section above and check each option on its own."
                      : "Reread the section above, then look at each option again."}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!hint ? (
                    <button type="button" className={outlineBtn} onClick={() => setHint(true)}>
                      Hint
                    </button>
                  ) : null}
                  <button type="button" className={outlineBtn} onClick={retry}>
                    Try again
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        {error && !entry ? (
          <p className="mt-3 text-sm text-destructive">
            Could not load the answers. Reload the page to try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function QuickCheck({
  questions,
  gradingUrl,
}: {
  questions: PublicQuestion[];
  gradingUrl: string;
}) {
  if (questions.length === 0) return null;
  return (
    <section aria-label="Quick check" className="flex flex-col gap-4">
      {questions.map((q, i) => (
        <QuestionCard key={q.id} question={q} index={i} gradingUrl={gradingUrl} />
      ))}
    </section>
  );
}
