// Single place for product event names. PostHog is deferred (ADR-0008): track() is a no-op until
// it is wired in here. Props must never carry PII (no emails, free text, user ids).
export const EVENTS = {
  shareLinkCopied: "share_link_copied",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
export type EventProps = Record<string, string | number | boolean>;

export function track(name: EventName, props?: EventProps): void {
  void name;
  void props;
}
