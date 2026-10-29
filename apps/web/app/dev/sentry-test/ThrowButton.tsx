"use client";

export function ThrowButton() {
  return (
    <button
      type="button"
      className="rounded-md border px-3 py-2"
      onClick={() => {
        // Deferred so it surfaces as an unhandled window error, like a real bug.
        setTimeout(() => {
          throw new Error(`Sentry client test error (contact ${["test", "example.com"].join("@")})`);
        }, 0);
      }}
    >
      Throw client error
    </button>
  );
}
