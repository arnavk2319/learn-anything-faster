// T-072 harness: mounts RoleCombobox in a bare page with no app route. Bundles a tiny entry with
// esbuild (a tsx dependency, resolved through tsx; no new dependency) and compiles the theme CSS with
// the same @tailwindcss/postcss the app uses, so layout assertions are real.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const web = path.join(root, "apps/web");
const req = createRequire(import.meta.url);
// Neither esbuild nor postcss is a direct dependency, so they are loaded untyped and described locally.
type Resolve = (p: string, o: { kind: string; resolveDir: string }) => Promise<unknown>;
type Build = {
  onResolve: (
    o: { filter: RegExp },
    cb: (a: { path: string; kind: string }) => Promise<unknown>,
  ) => void;
  resolve: Resolve;
};
const esbuild = createRequire(req.resolve("tsx"))("esbuild") as {
  build: (o: object) => Promise<{ outputFiles: { text: string }[] }>;
};
type PostcssFn = (plugins: unknown[]) => {
  process: (css: string, o: { from: string }) => Promise<{ css: string }>;
};
const postcss = req("postcss") as PostcssFn;

const ENTRY = `
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RoleCombobox } from "@/components/landing/RoleCombobox";

const OPTIONS = [
  { id: "fs", name: "Full-stack engineer", status: "available" },
  { id: "ml", name: "ML engineer", status: "available" },
  { id: "mlops", name: "MLOps engineer", status: "soon" },
  { id: "data", name: "Data engineer", status: "soon" },
];

function Demo() {
  const [value, setValue] = useState(null);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <RoleCombobox label="I want to be a" icon={<span>●</span>} options={OPTIONS}
        value={value} onChange={setValue} placeholder="Pick a role" />
      <button type="button" className="h-11">After</button>
      <p data-testid="value">{value ?? "none"}</p>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Demo />);
`;

let built: Promise<{ js: string; css: string }> | undefined;

async function build() {
  const out = await esbuild.build({
    stdin: { contents: ENTRY, resolveDir: web, loader: "tsx", sourcefile: "harness.tsx" },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    nodePaths: [path.join(web, "node_modules"), path.join(root, "node_modules")],
    plugins: [
      {
        name: "at-alias",
        setup(b: Build) {
          b.onResolve({ filter: /^@\// }, (a) =>
            b.resolve("./" + a.path.slice(2), { kind: a.kind, resolveDir: web }),
          );
        },
      },
    ],
  });
  const cssPath = path.join(web, "app/globals.css");
  const tw = req("@tailwindcss/postcss") as (o?: object) => unknown;
  const css = await postcss([tw({ base: root })]).process(readFileSync(cssPath, "utf8"), {
    from: cssPath,
  });
  return { js: out.outputFiles[0]!.text, css: css.css };
}

/** Replaces the page with the harness (viewport is the caller's). */
export async function mountCombobox(page: Page): Promise<void> {
  built ??= build();
  const { js, css } = await built;
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>harness</title></head><body><div id="root"></div></body></html>',
  );
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page.getByTestId("value").waitFor();
}
