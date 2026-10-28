import { RolePicker } from "../components/RolePicker";
import { getLandingData } from "../lib/roadmap/landing";
import { sharedDb } from "../lib/roadmap/db";

export const dynamic = "force-dynamic"; // roles come from the DB at request time

export default async function HomePage() {
  const data = await getLandingData(await sharedDb());
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-4xl font-bold">Learn Anything Faster</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        The shortest learning path from the role you have to the role you want.
      </p>
      <RolePicker {...data} />
    </main>
  );
}
