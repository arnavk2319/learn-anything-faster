// Tiny Markdown subset for Learn content: paragraphs, bullet and numbered lists, `code`, **bold**, *italic*.
// Output is a plain token tree rendered as React elements (no raw HTML, no links, no images), so content
// can never inject markup or load external resources. Pure.

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; v: Inline[] }
  | { t: "em"; v: Inline[] };

export type MdBlock =
  { t: "p"; v: Inline[] } | { t: "ul"; v: Inline[][] } | { t: "ol"; v: Inline[][] };

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (c === "*" && src[i + 1] === "*") {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "strong", v: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (c === "*" && src[i + 1] !== " " && src[i + 1] !== "*") {
      const end = src.indexOf("*", i + 1);
      if (end > i + 1 && src[end - 1] !== " ") {
        flush();
        out.push({ t: "em", v: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdown(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ t: "p", v: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ t: list.kind, v: list.items.map(parseInline) });
    list = null;
  };
  for (const line of src.split("\n")) {
    const b = BULLET.exec(line);
    const n = NUMBER.exec(line);
    if (line.trim() === "") {
      flushPara();
      flushList();
    } else if (b || n) {
      flushPara();
      const kind = b ? "ul" : "ol";
      if (list && list.kind !== kind) flushList();
      list ??= { kind, items: [] };
      list.items.push(((b ?? n) as RegExpExecArray)[1] as string);
    } else if (list) {
      // continuation line of the previous list item
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return blocks;
}
