// T-037 sample packs predate ADR-0015 rev 4: sim blocks use `sim: {ref}` and faq blocks carry one block-level `src`.
// This maps those two shapes to the rev 4 shape (the schema stays strict). Shared by `pnpm learn:validate`
// (scripts/learn-validate.ts) and the Learn pages loader so both see the same content. Pure: no IO.

/** Returns a deep copy upgraded to the rev 4 shape; `onUpgrade` is called once per mapped block. */
export function upgradeLegacy(doc: unknown, onUpgrade?: () => void): unknown {
  if (Array.isArray(doc)) return doc.map((d) => upgradeLegacy(d, onUpgrade));
  if (doc === null || typeof doc !== "object") return doc;
  const o = { ...(doc as Record<string, unknown>) };
  if (
    o.type === "sim" &&
    o.ref === undefined &&
    typeof (o.sim as { ref?: unknown } | undefined)?.ref === "string"
  ) {
    o.ref = (o.sim as { ref: string }).ref;
    delete o.sim;
    onUpgrade?.();
  }
  if (o.type === "faq" && o.src !== undefined && Array.isArray(o.items)) {
    const src = o.src;
    o.items = (o.items as Record<string, unknown>[]).map((it) => ({ src, ...it }));
    delete o.src;
    onUpgrade?.();
  }
  for (const [k, v] of Object.entries(o)) o[k] = upgradeLegacy(v, onUpgrade);
  return o;
}
