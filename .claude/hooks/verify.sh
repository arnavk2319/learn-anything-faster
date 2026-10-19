#!/usr/bin/env bash
# Stop: log usage, then (if code changed) run pnpm verify and require a decision-log entry.
# Exit 2 returns the errors so the agent keeps working. Skips verify when only docs/ and logs/ changed.
set -u
in=$(cat)
root=${CLAUDE_PROJECT_DIR:-$(pwd)}
cd "$root" || exit 0

printf '%s' "$in" | node scripts/log-usage.ts 2>/dev/null

[ "$(jq -r '.stop_hook_active // false' <<<"$in")" = "true" ] && exit 0

changed=$(git status --porcelain 2>/dev/null | grep -vE '^.{2} (docs|logs)/' | head -1)
[ -z "$changed" ] && exit 0

if ! out=$(pnpm --silent verify 2>&1); then
  echo "$out" | tail -50 >&2
  exit 2
fi

# A run that changed files must leave a decision-log entry written since the session began.
tp=$(jq -r '.transcript_path // empty' <<<"$in")
since=""
[ -n "$tp" ] && [ -f "$tp" ] && since=$(jq -rs '[.[] | .timestamp? // empty] | first // empty' "$tp" 2>/dev/null)
[ -z "$since" ] && since="$(date -u +%F)T00:00:00Z"
n=0
if ls logs/decisions/*.jsonl >/dev/null 2>&1; then
  n=$(cat logs/decisions/*.jsonl | jq -rs --arg s "$since" '[.[] | select(.ts >= $s)] | length' 2>/dev/null || echo 0)
fi
if [ "${n:-0}" -eq 0 ]; then
  echo "verify: no decision-log entry for this run. Run: node scripts/log-decision.ts --agent <name> --ticket <T-id> --stage <stage> --decision '...' --why '...'" >&2
  exit 2
fi
exit 0
