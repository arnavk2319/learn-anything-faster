import { notFound } from "next/navigation";
import { Demo } from "./demo";

// Test-only harness for e2e/role-combobox.spec.ts (T-072). 404s in production.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Demo />;
}
