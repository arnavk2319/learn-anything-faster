import { describe, expect, it } from "vitest";
import {
  GUIDE_ID,
  addGrounded,
  gapSrc,
  goodSim,
  guideSrc,
  makeGaps,
  makePack,
  Q_CACHE,
} from "../../../tests/fixtures/learn/pack";
import { hashTerm, validateLearn } from "./validate";

type Raw = ReturnType<typeof makePack>;
const run = (mutate?: (p: Raw) => void) => {
  const p = makePack();
  mutate?.(p);
  return validateLearn(p);
};
const rules = (r: ReturnType<typeof validateLearn>) => r.errors.map((e) => e.rule);
/** Fails with `rule`; any of `alts` also accepted when Zod catches the shape first (rule "schema"). */
const expectRule = (r: ReturnType<typeof validateLearn>, rule: string, alsoSchema = false) => {
  const got = rules(r);
  expect(got.includes(rule) || (alsoSchema && got.includes("schema")), JSON.stringify(r.errors)).toBe(true);
  for (const e of r.errors) expect(e.message.length).toBeGreaterThan(10);
};
const concept = (p: Raw) => p.concepts[0];
const q = (p: Raw, id: string) => p.questions.find((x: any) => x.id === id);

describe("validateLearn: good fixture", () => {
  it("passes with no errors and reports the gap ratio and exception count", () => {
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.gap.items).toBeGreaterThan(0);
    expect(r.gap.count).toBe(0);
    expect(r.exceptions).toBe(0);
    expect(r.report).toMatch(/gap/i);
  });
});

describe("validateLearn: structural rules", () => {
  it("schema failure is reported with the rule 'schema'", () => {
    expectRule(run((p) => (concept(p).stage = "expert")), "schema");
  });
  it("duplicate ids across concepts, problems, questions, sets, sims", () => {
    expectRule(run((p) => (p.problems[0].id = "caching")), "duplicate-id");
    expectRule(run((p) => (q(p, "q-caching-2").id = "q-caching-1")), "duplicate-id");
    expectRule(run((p) => (p.sims[0].id = "cache-aside-read")), "duplicate-id");
    expectRule(run((p) => (p.sets[0].id = "caching")), "duplicate-id");
  });
  it("approved item without sim fails; sim exception is counted", () => {
    expectRule(run((p) => delete concept(p).sim), "sim-missing", true);
    const r = run((p) => (concept(p).sim = { exception: { reason: "abstract estimation topic" } }));
    expect(r.errors).toEqual([]);
    expect(r.exceptions).toBe(1);
  });
  it("more than 2 sim exceptions per pack fails", () => {
    const ex = { exception: { reason: "abstract estimation topic" } };
    const r = run((p) => {
      concept(p).sim = ex;
      p.problems[0].sim = ex;
      p.concepts.push({ ...structuredClone(concept(p)), id: "estimation", order: 2, levels: { basic: [] }, sim: ex });
      p.concepts[1].levels = structuredClone(concept(p).levels);
      for (const b of p.concepts[1].levels.basic) b.id = `est-${b.id}`;
      p.concepts[1].levels.basic = p.concepts[1].levels.basic.filter((b: any) => b.type !== "sim");
    });
    expect(r.exceptions).toBe(3);
    expectRule(r, "sim-exception-cap");
  });
  it("concept with zero levels fails", () => {
    expectRule(run((p) => (concept(p).levels = {})), "level-missing", true);
  });
  it("quiz block over 2 ids fails", () => {
    expectRule(
      run((p) => {
        p.questions.push({ ...structuredClone(q(p, "q-caching-4")), id: "q-caching-x" });
        concept(p).levels.basic[3].questionIds = ["q-caching-1", "q-caching-2", "q-caching-4"];
      }),
      "quiz-too-many",
      true,
    );
  });
  it("table row width must equal column count", () => {
    expectRule(run((p) => concept(p).levels.basic[1].rows.push(["only-one"])), "table-row-width", true);
  });
  it("faq item must carry its own src", () => {
    expectRule(run((p) => delete concept(p).levels.basic[4].items[0].src), "faq-src", true);
  });
  it("sim block ref must resolve to own or shared sim", () => {
    expectRule(run((p) => (concept(p).levels.basic[2].ref = "nope-sim")), "sim-ref-unresolved");
    expectRule(run((p) => (p.problems[0].sim = { ref: "nope-sim" })), "sim-ref-unresolved");
  });
});

describe("validateLearn: question rules", () => {
  it("mcq must have exactly 1 answer", () => {
    expectRule(run((p) => (q(p, "q-caching-1").answer = ["a", "b"])), "mcq-answer-count");
    expectRule(run((p) => (q(p, "q-caching-1").answer = [])), "mcq-answer-count");
  });
  it("multi needs at least 2 answers", () => {
    expectRule(run((p) => (q(p, "q-caching-2").answer = ["a"])), "multi-answer-count");
  });
  it("ordering must be a permutation of all option ids", () => {
    expectRule(run((p) => (q(p, "q-caching-3").answer = ["c", "a"])), "ordering-incomplete");
    expectRule(run((p) => (q(p, "q-caching-3").answer = ["c", "a", "a"])), "ordering-incomplete");
  });
  it("answer ids must exist in options", () => {
    expectRule(run((p) => (q(p, "q-caching-1").answer = ["zzz"])), "answer-not-in-options");
  });
  it("options required for mcq, multi, ordering", () => {
    expectRule(run((p) => delete q(p, "q-caching-1").options), "options-missing", true);
  });
  it("missing explanation fails", () => {
    expectRule(run((p) => delete q(p, "q-caching-1").explanation), "explanation-missing", true);
    expectRule(run((p) => (q(p, "q-caching-1").explanation = "")), "explanation-missing", true);
  });
  it("letter or position references to options fail (prompt, explanation, rubric)", () => {
    for (const bad of ["Why is option B wrong?", "Pick the first option.", "Choose all of the above.", "None of the above applies."]) {
      expectRule(run((p) => (q(p, "q-caching-1").prompt = bad)), "option-letter-ref");
    }
    expectRule(run((p) => (q(p, "q-caching-1").explanation = "Because option C is stale.")), "option-letter-ref");
    expectRule(run((p) => (q(p, "q-caching-4").rubric = ["Mentions the second option"])), "option-letter-ref");
  });
  it("plain prose using the word 'option' without position is allowed", () => {
    expect(run((p) => (q(p, "q-caching-1").prompt = "Which design option reduces latency?")).errors).toEqual([]);
  });
  it("question needs exactly one owner that resolves", () => {
    expectRule(run((p) => (q(p, "q-caching-1").conceptId = "ghost")), "ref-unresolved");
  });
  it("relatedConceptIds must resolve and must not include the owner", () => {
    expectRule(run((p) => (q(p, "q-caching-1").relatedConceptIds = ["ghost"])), "ref-unresolved");
    expectRule(run((p) => (q(p, "q-caching-1").relatedConceptIds = ["caching"])), "related-includes-owner");
  });
});

describe("validateLearn: references", () => {
  it("unresolved topicIds on concept and problem (known list supplied)", () => {
    const withTopics = (mut: (p: Raw) => void) => {
      const p = makePack();
      (p as any).knownTopicIds = ["http"];
      mut(p);
      return validateLearn(p);
    };
    expect(withTopics((p) => (concept(p).topicIds = ["http"])).errors).toEqual([]);
    expectRule(withTopics((p) => (concept(p).topicIds = ["ghost-topic"])), "ref-unresolved");
    expectRule(withTopics((p) => (p.problems[0].topicIds = ["ghost-topic"])), "ref-unresolved");
  });
  it("unresolved conceptIds on problem and set; prerequisites", () => {
    expectRule(run((p) => (p.problems[0].conceptIds = ["ghost"])), "ref-unresolved");
    expectRule(run((p) => (p.sets[0].conceptIds = ["ghost"])), "ref-unresolved");
    expectRule(run((p) => (concept(p).prerequisites = ["ghost"])), "ref-unresolved");
  });
  it("unresolved questionIds in quiz block and set", () => {
    expectRule(run((p) => (concept(p).levels.basic[3].questionIds = ["q-ghost-1"])), "ref-unresolved");
    expectRule(run((p) => (p.sets[0].questionIds = ["q-ghost-1"])), "set-member-unresolved");
  });
  it("approved item referencing a proposed question/concept/sim fails", () => {
    expectRule(run((p) => (concept(p).levels.basic[3].questionIds = ["q-caching-5"])), "approved-refs-proposed");
    expectRule(run((p) => (p.sets[0].questionIds = ["q-caching-5"])), "approved-refs-proposed");
    expectRule(run((p) => (concept(p).status = "proposed")), "approved-refs-proposed"); // problem approved -> proposed concept
  });
  it("proposed items may reference proposed questions", () => {
    const r = run((p) => {
      concept(p).status = "proposed";
      p.problems[0].status = "proposed";
      p.sets[0].questionIds = ["q-caching-5"];
      concept(p).levels.basic[3].questionIds = ["q-caching-5"];
    });
    expect(rules(r)).not.toContain("approved-refs-proposed");
  });
  it("approved ids removed or changed fail; retired ids are fine", () => {
    expect(run((p) => (p.previousApprovedIds = ["caching", "q-caching-1"])).errors).toEqual([]);
    expectRule(run((p) => (p.previousApprovedIds = ["gone-concept"])), "approved-id-removed");
    expectRule(
      run((p) => {
        p.previousApprovedIds = ["q-caching-1"];
        q(p, "q-caching-1").id = "q-caching-renamed";
        concept(p).levels.basic[3].questionIds = ["q-caching-renamed", "q-caching-2"];
        p.sets[0].questionIds = ["q-caching-renamed", "q-url-shortener-1"];
      }),
      "approved-id-removed",
    );
    expect(
      run((p) => {
        p.previousApprovedIds = ["q-caching-4"];
        q(p, "q-caching-4").retired = true;
      }).errors,
    ).toEqual([]);
  });
});

describe("validateLearn: src quote matching", () => {
  const withSrc = (src: unknown) => run((p) => (concept(p).levels.basic[0].src = src));
  it("accepts heading with or without 'N. ' and star, and quotes spanning bold/code markers", () => {
    for (const heading of ["Caching", "1. Caching ★", "Caching ★", "1. Caching"]) {
      expect(withSrc(guideSrc(Q_CACHE, heading)).errors, heading).toEqual([]);
    }
    expect(withSrc(guideSrc("evicts the `least recently used` key")).errors).toEqual([]);
    expect(withSrc(guideSrc("loads   data\non a miss and fills")).errors).toEqual([]); // whitespace normalised
  });
  it("unknown guide id", () => {
    expectRule(withSrc({ ...guideSrc(), guide: "no-such-guide" }), "src-guide-missing");
  });
  it("heading not an H2 of the guide", () => {
    expectRule(withSrc(guideSrc(Q_CACHE, "Nonexistent heading")), "src-heading-missing");
    expectRule(withSrc(guideSrc(Q_CACHE, "System design concepts")), "src-heading-missing"); // H1 is not an H2
  });
  it("quote not a substring of the raw section", () => {
    expectRule(withSrc(guideSrc("This sentence is nowhere in the guide")), "src-quote-missing");
    // rendered text (markers stripped) is not the raw Markdown
    expectRule(withSrc(guideSrc("the application loads data on a miss")), "src-quote-missing");
  });
  it("quote from another section of the guide fails", () => {
    expectRule(withSrc(guideSrc("spreads requests across healthy servers", "Caching")), "src-quote-missing");
  });
  it("quote under 8 chars after normalising fails", () => {
    expectRule(withSrc(guideSrc("a   b   c")), "src-quote-missing", true);
  });
  it("faq items are each checked", () => {
    expectRule(
      run((p) => (concept(p).levels.basic[4].items[0].src = guideSrc("this is not in the guide at all"))),
      "src-quote-missing",
    );
  });
  it("question src is checked too", () => {
    expectRule(run((p) => (q(p, "q-caching-1").src = guideSrc("not in the guide anywhere"))), "src-quote-missing");
  });
  it("gap src never needs a quote", () => {
    expect(withSrc(gapSrc()).errors).toEqual([]);
  });
});

describe("validateLearn: raw HTML and external images", () => {
  const withBody = (body: string) => run((p) => (concept(p).levels.basic[0].body = body));
  it("fails on raw HTML tags", () => {
    expectRule(withBody("Hello <div class='x'>there</div>"), "raw-html");
    expectRule(withBody("<script>alert(1)</script>"), "raw-html");
    expectRule(run((p) => (q(p, "q-caching-1").prompt = "Pick <b>one</b>")), "raw-html");
  });
  it("fails on external images, allows none-external", () => {
    expectRule(withBody("![x](https://evil.example/a.png)"), "external-image");
    expectRule(withBody("![x](//evil.example/a.png)"), "external-image");
    expectRule(withBody("![x](http://evil.example/a.png)"), "external-image");
  });
  it("allows comparison operators in prose", () => {
    expect(withBody("latency < 200ms and rate > 5").errors).toEqual([]);
  });
});

describe("validateLearn: gap cap", () => {
  it("prints the actual ratio", () => {
    const r = run((p) => makeGaps(p, 1));
    expect(r.gap.count).toBeGreaterThanOrEqual(1);
    expect(r.gap.ratio).toBeCloseTo(r.gap.count / r.gap.items, 5);
    expect(r.report).toContain(`${(r.gap.ratio * 100).toFixed(1)}%`);
  });
  it("fails above 35% of items", () => {
    const r = run((p) => makeGaps(p, 5));
    expect(r.gap.ratio).toBeGreaterThan(0.35);
    expectRule(r, "gap-cap");
  });
  it("passes below 35% and at most 15 gaps", () => {
    const r = run((p) => {
      addGrounded(p, 60);
      makeGaps(p, 15);
    });
    expect(r.gap.count).toBe(15);
    expect(r.gap.ratio).toBeLessThanOrEqual(0.35);
    expect(rules(r)).not.toContain("gap-cap");
  });
  it("fails at 16 gaps even when the ratio is under 35%", () => {
    const r = run((p) => {
      addGrounded(p, 60);
      makeGaps(p, 16);
    });
    expect(r.gap.ratio).toBeLessThan(0.35);
    expectRule(r, "gap-cap");
  });
  it("a gap sim counts as one item", () => {
    const base = run();
    const r = run((p) => (concept(p).sim.src = gapSrc()));
    expect(r.gap.count).toBe(base.gap.count + 1);
    expect(r.gap.items).toBe(base.gap.items);
  });
});

describe("validateLearn: denylist", () => {
  it("plain terms fail in guides and packs, case-insensitively", () => {
    expectRule(run((p) => (concept(p).levels.basic[0].body = "We used AcmeCorp internally.")), "denylist");
    expectRule(run((p) => (q(p, "q-caching-4").answer = "Ask acmecorp.")), "denylist");
    expectRule(run((p) => (p.guides[GUIDE_ID] += "\nAcmeCorp stuff\n")), "denylist");
  });
  it("hashed terms fail without the plain term being in the repo", () => {
    expect(hashTerm("Globex")).toBe(hashTerm("globex")); // case-insensitive, stable
    expect(hashTerm("globex")).toMatch(/^[0-9a-f]{64}$/);
    expectRule(run((p) => (concept(p).levels.basic[0].body = "Worked at Globex once.")), "denylist");
  });
  it("whole words only (substring of another word passes)", () => {
    expect(run((p) => (concept(p).levels.basic[0].body = "Globexity is not the term.")).errors).toEqual([]);
  });
  it("error messages never echo the hashed term", () => {
    const r = run((p) => (concept(p).levels.basic[0].body = "Worked at Globex once."));
    expect(JSON.stringify(r.errors).toLowerCase()).not.toContain("globex");
  });
});

describe("validateLearn: sim rules", () => {
  const sim = (p: Raw) => concept(p).sim;
  it("edge endpoints must exist", () => {
    expectRule(run((p) => (sim(p).edges[0].to = "ghost")), "sim-edge-ref");
  });
  it("event node/edge references must exist", () => {
    expectRule(run((p) => (sim(p).scenarios[0].events[0].send.edge = "ghost")), "sim-edge-ref");
    expectRule(run((p) => (sim(p).scenarios[0].events[1].state.node = "ghost")), "sim-edge-ref");
  });
  it("state.init is typed per state.type", () => {
    expectRule(run((p) => (sim(p).nodes[1].state = { type: "counter", init: "x" })), "sim-state-init", true);
    expectRule(run((p) => (sim(p).nodes[1].state = { type: "kv", init: ["a"] })), "sim-state-init", true);
    expectRule(run((p) => (sim(p).nodes[1].state = { type: "lru", capacity: 2, init: ["a", "b", "c"] })), "sim-state-init");
    expect(run((p) => (sim(p).nodes[1].state = { type: "counter", init: 3 })).errors).toEqual([]);
    expect(run((p) => (sim(p).nodes[1].state = { type: "kv", init: { k: "v" } })).errors).toEqual([]);
    expect(run((p) => (sim(p).nodes[1].state = { type: "ring", init: ["n1", "n2"] })).errors).toEqual([]);
    expect(run((p) => (sim(p).nodes[1].state = { type: "queue", init: ["m1"] })).errors).toEqual([]);
  });
  it("token colour must be in the vocabulary (request, response, replicate, error)", () => {
    expectRule(run((p) => (sim(p).scenarios[0].events[0].send.token.color = "purple")), "sim-token-color", true);
    for (const c of ["request", "response", "replicate", "error"]) {
      expect(run((p) => (sim(p).scenarios[0].events[0].send.token.color = c)).errors, c).toEqual([]);
    }
  });
  it("template name must be in the registry", () => {
    expectRule(run((p) => (sim(p).template = "not-a-template")), "sim-template");
  });
  it("scenario events must end at or before durationMs", () => {
    expectRule(run((p) => (sim(p).scenarios[0].events[2].at = 9001)), "sim-duration");
    expect(run((p) => (sim(p).scenarios[0].events[2].at = 9000)).errors).toEqual([]);
  });
  it("every node needs inspect text", () => {
    expectRule(run((p) => delete sim(p).nodes[0].inspect), "sim-inspect", true);
  });
  it("every scenario needs a caption event", () => {
    expectRule(
      run((p) => (sim(p).scenarios[0].events = sim(p).scenarios[0].events.filter((e: any) => !("caption" in e)))),
      "sim-caption",
    );
  });
  it("shared sims are checked too", () => {
    expectRule(run((p) => (p.sims[0].edges[0].from = "ghost")), "sim-edge-ref");
  });
  it("uses goodSim helper consistently", () => {
    expect(goodSim("x").id).toBe("x");
  });
});
