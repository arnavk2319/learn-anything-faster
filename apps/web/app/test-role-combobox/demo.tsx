"use client";

import { useState } from "react";
import { RoleCombobox } from "@/components/landing/RoleCombobox";
import type { RoleOption } from "@/lib/landing/filter-roles";

const OPTIONS: RoleOption[] = [
  { id: "fs", name: "Full-stack engineer", status: "available" },
  { id: "ml", name: "ML engineer", status: "available" },
  { id: "mlops", name: "MLOps engineer", status: "soon" },
  { id: "data", name: "Data engineer", status: "soon" },
];

export function Demo() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <RoleCombobox
        label="I want to be a"
        icon={<span>●</span>}
        options={OPTIONS}
        value={value}
        onChange={setValue}
        placeholder="Pick a role"
      />
      <button type="button" className="h-11">
        After
      </button>
      <p data-testid="value">{value ?? "none"}</p>
    </main>
  );
}
