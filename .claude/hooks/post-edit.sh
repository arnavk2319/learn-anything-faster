#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): Prettier + ESLint on the changed file; content/ → content:validate.
# Output is trimmed to 50 lines. Exit 2 returns the errors to the agent.
set -u
in=$(cat)
fp=$(jq -r '.tool_input.file_path // empty' <<<"$in")
[ -z "$fp" ] && exit 0
root=${CLAUDE_PROJECT_DIR:-$(pwd)}
cd "$root" || exit 0
rel=${fp#"$root"/}
[ -f "$rel" ] || exit 0
case "$rel" in node_modules/* | .next/* | docs/*.pdf | pnpm-lock.yaml) exit 0 ;; esac

out=""
fail=0
case "$rel" in
  *.ts | *.tsx | *.js | *.mjs | *.json | *.css | *.yaml | *.yml)
    pnpm exec prettier --write --log-level=warn "$rel" >/dev/null 2>&1 || { out+=$(pnpm exec prettier --check "$rel" 2>&1); fail=1; }
    ;;
esac
case "$rel" in
  *.ts | *.tsx | *.js | *.mjs)
    lint=$(pnpm exec eslint --max-warnings=0 "$rel" 2>&1) || { out+=$'\n'"$lint"; fail=1; }
    ;;
esac
case "$rel" in
  content/*)
    val=$(pnpm --silent content:validate 2>&1) || { out+=$'\n'"$val"; fail=1; }
    ;;
esac
if [ "$fail" = 1 ]; then
  echo "$out" | tail -50 >&2
  exit 2
fi
exit 0
