"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  filterRoles,
  nextActiveIndex,
  optionLabel,
  type NavKey,
  type RoleOption,
} from "@/lib/landing/filter-roles";

type Props = {
  label: string;
  icon: ReactNode;
  options: RoleOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder: string;
  error?: string;
};

// T-072. Controlled, presentational. ARIA combobox with a listbox popup; below 768px the popup is a
// full-width bottom sheet. Behaviour lives in lib/landing/filter-roles.ts.
export function RoleCombobox({ label, icon, options, value, onChange, placeholder, error }: Props) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const errId = `${uid}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);

  const selected = options.find((o) => o.id === value) ?? null;
  const { groups, flat, empty } = filterRoles(options, query);
  const optId = (id: string) => `${uid}-opt-${id}`;
  const activeOpt = active >= 0 ? flat[active] : undefined;

  function close() {
    setOpen(false);
    setQuery("");
    setActive(-1);
  }
  function choose(o: RoleOption) {
    onChange(o.id);
    close();
    inputRef.current?.focus();
  }
  function openList() {
    if (open) return;
    setOpen(true);
    const i = flat.findIndex((o) => o.id === value);
    setActive(i);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp" || k === "Home" || k === "End") {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActive(nextActiveIndex(active, flat.length, k as NavKey));
    } else if (k === "Enter") {
      if (open) {
        e.preventDefault();
        const o = activeOpt ?? flat[0];
        if (o) choose(o);
      }
    } else if (k === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (k === "Tab") {
      close();
    }
  }

  const shown = open ? query : (selected?.name ?? "");

  return (
    <div
      className="relative flex flex-col gap-1"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
    >
      <label htmlFor={inputId} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div
        className={`flex h-11 items-center gap-2 rounded-md border-[1.5px] bg-card px-3 focus-within:border-route focus-within:ring-2 focus-within:ring-ring ${
          error ? "border-destructive" : "border-input"
        }`}
      >
        <span aria-hidden="true" className="size-5 shrink-0 text-route">
          {icon}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          type="text"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && activeOpt ? optId(activeOpt.id) : undefined}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          placeholder={open && selected ? selected.name : placeholder}
          value={shown}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onClick={openList}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted-foreground ${open ? "rotate-180" : ""}`}
        />
      </div>
      {error ? (
        <p id={errId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {open ? (
        <div
          data-testid="role-panel"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-md border bg-popover p-2 shadow-md md:absolute md:inset-x-auto md:top-full md:bottom-auto md:left-0 md:mt-1 md:max-h-80 md:w-full md:rounded-md"
        >
          {empty ? (
            <>
              {/* Hidden empty listbox keeps aria-controls valid while expanded. */}
              <div id={listId} role="listbox" aria-label={label} hidden />
              <p role="status" className="px-3 py-3 text-base text-muted-foreground">
                No roles match &ldquo;{query}&rdquo;
              </p>
            </>
          ) : (
            <div
              id={listId}
              role="listbox"
              aria-label={label}
              // Keep focus in the input when pressing inside the list.
              onMouseDown={(e) => e.preventDefault()}
            >
              {groups.map((g) => (
                <div key={g.key} role="group" aria-labelledby={`${uid}-g-${g.key}`}>
                  <div
                    id={`${uid}-g-${g.key}`}
                    role="presentation"
                    className="px-3 pt-2 pb-1 text-sm font-medium text-muted-foreground"
                  >
                    {g.label}
                  </div>
                  {g.options.map((o) => {
                    const isSel = o.id === value;
                    const isActive = activeOpt?.id === o.id;
                    return (
                      <div
                        key={o.id}
                        id={optId(o.id)}
                        role="option"
                        aria-selected={isSel}
                        aria-label={optionLabel(o, isSel)}
                        onClick={() => choose(o)}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-l-[3px] px-3 text-base ${
                          isActive ? "border-route bg-muted" : "border-transparent hover:bg-muted"
                        }`}
                      >
                        <span className="flex-1">{o.name}</span>{" "}
                        {o.status === "soon" ? (
                          <span className="text-sm text-muted-foreground">
                            Coming soon, Get notified
                          </span>
                        ) : null}
                        {isSel ? (
                          <span className="flex items-center gap-1 text-sm font-medium">
                            <Check aria-hidden="true" className="size-4" />
                            Selected
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
