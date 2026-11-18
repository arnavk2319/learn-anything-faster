// Server component: renders every Learn block type (ADR-0015 section 1). Content is plain text via the Markdown
// subset: no raw HTML, no external images. Code is a plain <pre>. Only sim and quiz hydrate on the client.
import type { Block, Question, Sim } from "@/lib/learn/schemas";
import { toPublic } from "@/lib/learn/quickcheck";
import { Md, MdInline } from "./Md";
import { QuickCheck } from "./QuickCheck";
import { SimFrame } from "./SimFrame";
import { BlockFeedback } from "./Feedback";

export interface BlockContext {
  /** Resolve a sim block's ref to a sim (the item's own or a shared one). */
  sim: (ref: string) => Sim | null;
  /** Approved questions for a quiz block, in block order. */
  questions: (ids: string[]) => Question[];
  gradingUrl: string;
  /** The sim shown in the page's sticky side pane (T-080); its sim blocks render nothing in the text column. */
  sideSimId?: string;
}

const TONES = {
  pitfall: { label: "Pitfall", cls: "border-destructive" },
  tip: { label: "Tip", cls: "border-primary" },
  note: { label: "Note", cls: "border-border" },
} as const;

export function BlockView({ block, ctx }: { block: Block; ctx: BlockContext }) {
  switch (block.type) {
    case "text":
      return (
        <div className="flex flex-col gap-2 leading-(--text-body-lh)">
          <Md text={block.body} />
        </div>
      );
    case "table":
      return (
        // Focusable so keyboard users can scroll it when the (now narrower, T-079 shell) main column clips the table.
        <div
          tabIndex={0}
          role="region"
          aria-label="Table"
          className="overflow-x-auto rounded-lg border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <table className="w-full border-collapse text-left text-(length:--text-ui)">
            <thead>
              <tr>
                {block.columns.map((c) => (
                  <th key={c} scope="col" className="border-b bg-lane px-3 py-1.5 font-semibold">
                    <MdInline text={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 align-top">
                      <MdInline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "compare":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {[block.left, block.right].map((side) => (
            <section
              key={side.title}
              className="min-w-0 rounded-lg border border-border-firm bg-card p-(--pad-panel) shadow-1"
            >
              <h4 className="mb-1 font-display text-(length:--text-body) font-semibold">
                <MdInline text={side.title} />
              </h4>
              <div className="flex flex-col gap-2">
                <Md text={side.body} />
              </div>
            </section>
          ))}
        </div>
      );
    case "callout": {
      const t = TONES[block.tone];
      return (
        <aside
          data-tone={block.tone}
          className={`rounded-md border-l-4 bg-lane p-(--pad-panel) ${t.cls}`}
        >
          <p className="mb-1 text-(length:--text-small) font-semibold">{t.label}</p>
          <div className="flex flex-col gap-2">
            <Md text={block.body} />
          </div>
        </aside>
      );
    }
    case "code":
      return (
        <figure>
          <pre
            tabIndex={0}
            aria-label={block.caption || `${block.language} code`}
            className="overflow-x-auto rounded-md border bg-card p-(--pad-panel) font-mono text-(length:--text-small)"
            data-language={block.language}
          >
            <code>{block.code}</code>
          </pre>
          {block.caption ? (
            <figcaption className="mt-1 text-(length:--text-small) text-muted-foreground">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case "sim": {
      const sim = ctx.sim(block.ref);
      return sim && sim.id !== ctx.sideSimId ? <SimFrame sim={sim} title={sim.id} /> : null;
    }
    case "quiz": {
      const qs = ctx.questions(block.questionIds);
      return qs.length === 0 ? null : (
        <div>
          <h4 className="mb-2 font-display text-(length:--text-body) font-semibold">Quick check</h4>
          <QuickCheck questions={qs.map(toPublic)} gradingUrl={ctx.gradingUrl} />
        </div>
      );
    }
    case "faq":
      return (
        <div className="flex flex-col gap-2">
          {block.items.map((item, i) => (
            <details key={i} className="rounded-md border bg-card px-3 py-1.5">
              <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <MdInline text={item.q} />
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <Md text={item.a} />
              </div>
            </details>
          ))}
        </div>
      );
  }
}

/** Sim and quiz blocks carry their own feedback icons (sim card corner, each question). */
function FeedbackBlock({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const view = <BlockView block={block} ctx={ctx} />;
  if (block.type === "sim" || block.type === "quiz") return view;
  return <BlockFeedback blockId={block.id}>{view}</BlockFeedback>;
}

export function Blocks({ blocks, ctx }: { blocks: Block[]; ctx: BlockContext }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b) => (
        <FeedbackBlock key={b.id} block={b} ctx={ctx} />
      ))}
    </div>
  );
}
