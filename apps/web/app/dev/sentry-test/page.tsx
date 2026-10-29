// Test harness for T-016: triggers an unhandled server or client error. 404s in Vercel production.
import { notFound } from "next/navigation";
import { ThrowButton } from "./ThrowButton";

export default async function SentryTestPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const { kind } = await searchParams;
  if (kind === "server") {
    throw new Error(`Sentry server test error (contact ${["test", "example.com"].join("@")})`);
  }
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Sentry test</h1>
      <ThrowButton />
      <a className="underline" href="?kind=server">
        Throw server error
      </a>
    </main>
  );
}
