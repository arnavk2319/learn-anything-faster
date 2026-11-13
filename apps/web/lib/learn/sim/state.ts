// Node state ops for the sim engine (ADR-0015 section 2). Pure: every op returns a new state.
import type { Sim } from "../schemas";

export type SimState = NonNullable<Sim["nodes"][number]["state"]>;
export type StateOp = { op: string; key?: string; value?: string };

const bad = (type: string, op: string): never => {
  throw new Error(`unknown op "${op}" for state type "${type}"`);
};

export function applyStateOp(state: SimState, o: StateOp): SimState {
  const key = o.key ?? "";
  switch (state.type) {
    case "lru": {
      if (o.op === "touch") {
        if (!state.init.includes(key)) return { ...state, init: [...state.init] };
        return { ...state, init: [key, ...state.init.filter((k) => k !== key)] };
      }
      if (o.op === "put") {
        const next = [key, ...state.init.filter((k) => k !== key)];
        return { ...state, init: next.slice(0, state.capacity) };
      }
      return bad(state.type, o.op);
    }
    case "queue": {
      if (o.op === "push") return { ...state, init: [...state.init, key] };
      if (o.op === "pop") return { ...state, init: state.init.slice(1) };
      return bad(state.type, o.op);
    }
    case "kv": {
      if (o.op === "set") return { ...state, init: { ...state.init, [key]: o.value ?? "" } };
      if (o.op === "delete") {
        const rest = { ...state.init };
        delete rest[key];
        return { ...state, init: rest };
      }
      return bad(state.type, o.op);
    }
    case "counter": {
      const by = Number(o.value ?? 1);
      if (o.op === "inc") return { ...state, init: state.init + by };
      if (o.op === "dec") return { ...state, init: state.init - by };
      return bad(state.type, o.op);
    }
    case "ring": {
      if (o.op === "add")
        return { ...state, init: state.init.includes(key) ? [...state.init] : [...state.init, key] };
      if (o.op === "remove") return { ...state, init: state.init.filter((k) => k !== key) };
      return bad(state.type, o.op);
    }
  }
}
