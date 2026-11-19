import { hintText, type QuestionType } from "@/lib/learn/quickcheck";

/** The revealed hint. A text node only (React escapes it): never Markdown, never HTML. */
export function HintText({ type, hint }: { type: QuestionType; hint?: string }) {
  return (
    <p className="mt-2" data-testid="hint">
      {hintText(type, hint)}
    </p>
  );
}
