// Dev-only harness for the capture forms (used by the Playwright smoke). 404s in production.
import { notFound } from "next/navigation";
import { SuggestResourceForm } from "../../../components/forms/SuggestResourceForm";
import { TransitionRequestForm } from "../../../components/forms/TransitionRequestForm";

export default function DevFormsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold">Capture forms</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Request</h2>
        <TransitionRequestForm fromRole="smoke-from" toRole="smoke-to" kind="request" />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Notify</h2>
        <TransitionRequestForm fromRole="smoke-from" toRole="smoke-to" kind="notify" />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Suggest</h2>
        <SuggestResourceForm topicId="smoke-topic" />
      </section>
    </main>
  );
}
