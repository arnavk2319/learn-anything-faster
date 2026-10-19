import { describe, it } from "vitest";

describe("data suite (T-022)", () => {
  it.todo("content schema validates every content file (needs T-005)");
  it.todo("referential integrity: every edge/resource/topic reference resolves (needs T-005)");
  it.todo("topic prerequisite edges are acyclic (needs T-005)");
  it.todo("topic ids unchanged vs production (needs T-005)");
  it.todo("seed is idempotent: running twice yields identical rows (needs T-004/T-005)");
  it.todo("migrations are reversible from empty and back (needs T-004)");
  it.todo("link checker marks dead links dead and live links live (needs T-017)");
});
