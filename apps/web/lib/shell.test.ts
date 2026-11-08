import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import seed from "../../../data/seed/fullstack-to-ml-engineer.json";
import { LandingError, LandingLoading } from "../components/landing/LandingStates";
import { PopularMoves } from "../components/landing/PopularMoves";
import { RouteLine } from "../components/route/RouteLine";
import { APP_NAME } from "@/lib/brand";
import {
  buildRoutePreview,
  pickPopular,
  roadmapHref,
  SEED_PREVIEW,
  type SeedShape,
} from "./landing-preview";
import { siteNameFor } from "./site";

afterEach(() => {
  vi.doUnmock("@/lib/brand");
  vi.resetModules();
});

async function renderLogoWith(appName: string): Promise<string> {
  vi.resetModules();
  vi.doMock("@/lib/brand", () => ({ APP_NAME: appName, APP_TAGLINE: "t" }));
  const { Logo } = await import("../components/brand/Logo");
  return renderToStaticMarkup(createElement(Logo));
}

describe("brand alias and Logo", () => {
  it("@/lib/brand resolves to the root brand file", () => {
    expect(typeof APP_NAME).toBe("string");
  });
  it("renders the product name from APP_NAME", async () => {
    expect(await renderLogoWith("Trailhead")).toContain("Trailhead");
    expect(await renderLogoWith("Pathfinder")).toContain("Pathfinder");
  });
  it("falls back to the working name for the placeholder", async () => {
    const html = await renderLogoWith("[App name]");
    expect(html).toContain("Learn Anything Faster");
    expect(html).not.toContain("[App name]");
    expect(siteNameFor("[App name]")).toBe("Learn Anything Faster");
  });
});

describe("landing preview comes from seed data", () => {
  it("derives stops, counts and hours from data/seed", () => {
    expect(SEED_PREVIEW.fromName).toBe("Full-stack engineer");
    expect(SEED_PREVIEW.toName).toBe("ML engineer");
    expect(SEED_PREVIEW.topicCount).toBe(18);
    expect(SEED_PREVIEW.knownCount).toBe(5);
    expect(SEED_PREVIEW.stops.map((s) => s.topics)).toEqual([3, 3, 5, 4, 3]);
    expect(SEED_PREVIEW.hours).toBeGreaterThan(0);
  });
  it("every link on the preview and popular list is an internal roadmap route", () => {
    const data = seed as SeedShape;
    const ids = new Set(data.roles.map((r) => r.id));
    expect(ids.has(SEED_PREVIEW.fromId) && ids.has(SEED_PREVIEW.toId)).toBe(true);
    const preview = renderToStaticMarkup(createElement(RouteLine, { preview: SEED_PREVIEW }));
    expect(preview).not.toContain("href");
    const moves = pickPopular([
      { from: "a", fromName: "A", to: "b", toName: "B", status: "coming_soon" },
      {
        from: "full-stack-engineer",
        fromName: "F",
        to: "ml-engineer",
        toName: "M",
        status: "live",
      },
    ]);
    const html = renderToStaticMarkup(createElement(PopularMoves, { moves }));
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toContain(roadmapHref("full-stack-engineer", "ml-engineer"));
    expect(hrefs.every((h) => h?.startsWith("/"))).toBe(true);
    expect(moves[0]?.from).toBe("full-stack-engineer");
  });
  it("buildRoutePreview skips areas with nothing to learn", () => {
    const p = buildRoutePreview(seed as SeedShape, "full-stack-engineer", "ml-engineer");
    expect(p.stops.some((s) => s.id === "general-engineering")).toBe(false);
  });
});

describe("states", () => {
  it("route line: live and unmapped", () => {
    const live = renderToStaticMarkup(createElement(RouteLine, { preview: SEED_PREVIEW }));
    expect(live).toContain("You are here");
    expect(live).toContain("Math foundations");
    const un = renderToStaticMarkup(
      createElement(RouteLine, { preview: SEED_PREVIEW, state: "unmapped" }),
    );
    expect(un).toContain("Not mapped yet");
    expect(un).toContain("Request it to get it mapped");
    expect(un).not.toContain("Math foundations");
  });
  it("popular moves: empty", () => {
    expect(renderToStaticMarkup(createElement(PopularMoves, { moves: [] }))).toContain(
      "popular-empty",
    );
  });
  it("loading and error", () => {
    expect(renderToStaticMarkup(createElement(LandingLoading))).toContain('aria-busy="true"');
    const err = renderToStaticMarkup(createElement(LandingError, { onRetry: () => {} }));
    expect(err).toContain('role="alert"');
    expect(err).toContain("Try again");
  });
});

describe("tokens only in touched components", () => {
  const files = [
    "components/brand/Logo.tsx",
    "components/brand/NavLinks.tsx",
    "components/brand/SiteHeader.tsx",
    "components/route/RouteLine.tsx",
    "components/landing/PopularMoves.tsx",
    "components/landing/LandingStates.tsx",
    "components/RolePicker.tsx",
    "app/roadmap/layout.tsx",
    "app/(marketing)/page.tsx",
  ];
  it.each(files)("%s has no hex, font names, hardcoded radii or durations", (f) => {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/Familjen|Hanken/);
    expect(src).not.toMatch(/rounded-\[/);
    expect(src).not.toMatch(/duration-(\d|\[)/);
    expect(src).not.toMatch(/\d+ms/);
  });
  it("no hardcoded product name in header or Logo", () => {
    for (const f of ["components/brand/Logo.tsx", "components/brand/SiteHeader.tsx"]) {
      const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
      expect(src).not.toMatch(/Learn Anything Faster/);
    }
  });
});
