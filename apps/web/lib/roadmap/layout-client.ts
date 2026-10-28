// Main-thread side of the layout worker. Client only; the worker is created lazily on first use.
// elk-api speaks to a Web Worker running elk-worker.min.js (see layout.worker.ts), so ELK's
// computation never runs on the main thread.
import ELK from "elkjs/lib/elk-api.js";
import type { ElkNode } from "elkjs/lib/elk-api";

let elk: InstanceType<typeof ELK> | undefined;

export function layoutInWorker(graph: ElkNode): Promise<ElkNode> {
  elk ??= new ELK({
    workerFactory: () =>
      new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" }),
  });
  return elk.layout(graph);
}
