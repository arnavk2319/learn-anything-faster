// Renders the Learn Markdown subset (lib/learn/markdown.ts) as React elements. No raw HTML, links or images.
import type { ReactNode } from "react";
import { parseInline, parseMarkdown, type Inline } from "@/lib/learn/markdown";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return n.v;
      case "code":
        return (
          <code key={i} className="rounded-sm bg-lane px-1 py-0.5 font-mono text-[0.9em]">
            {n.v}
          </code>
        );
      case "strong":
        return <strong key={i}>{renderInline(n.v)}</strong>;
      case "em":
        return <em key={i}>{renderInline(n.v)}</em>;
    }
  });
}

/** Inline-only (table cells, headings, prompts). */
export function MdInline({ text }: { text: string }) {
  return <>{renderInline(parseInline(text))}</>;
}

/** Block Markdown: paragraphs and lists. */
export function Md({ text }: { text: string }) {
  return (
    <>
      {parseMarkdown(text).map((b, i) => {
        if (b.t === "p") return <p key={i}>{renderInline(b.v)}</p>;
        const Tag = b.t;
        return (
          <Tag key={i} className={b.t === "ul" ? "list-disc pl-6" : "list-decimal pl-6"}>
            {b.v.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </Tag>
        );
      })}
    </>
  );
}
