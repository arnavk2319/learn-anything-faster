#!/usr/bin/env bash
# PreToolUse (Bash). Exit 2 on push to main, force push, production deploys, rm -rf,
# destructive DB commands, and drizzle-kit push against a non-local database.
set -u
in=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$in")
[ -z "$cmd" ] && exit 0
root=${CLAUDE_PROJECT_DIR:-$(pwd)}

block() { echo "guard-bash: blocked: $1" >&2; exit 2; }
has() { grep -Eiq -- "$1" <<<"$cmd"; }

if has '(^|[;&|[:space:]])git[[:space:]]+push\b'; then
  has '(--force|--force-with-lease|[[:space:]]-f([[:space:]]|$)|[[:space:]]\+[^[:space:]]+)' && block "force push"
  has 'git[[:space:]]+push[^;&|]*[[:space:]:/](main|master)([[:space:]]|$)' && block "push to main"
  branch=${LAF_BRANCH:-$(git -C "$root" branch --show-current 2>/dev/null)}
  case "$branch" in main | master) block "push while on $branch" ;; esac
fi

has 'vercel[^;&|]*--prod\b' && block "vercel --prod (agents never promote)"
has 'vercel[^;&|]*[[:space:]]promote\b' && block "vercel promote"
has '(^|[;&|[:space:]])rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-r[[:space:]]+-f|-f[[:space:]]+-r|--recursive[[:space:]]+--force)' && block "rm -rf"
has '\b(drop[[:space:]]+(table|database|schema)|truncate[[:space:]]+(table[[:space:]]+)?[a-z_"]+|dropdb)\b' && block "destructive DB command"

if has 'drizzle-kit[[:space:]]+push'; then
  has '(localhost|127\.0\.0\.1|\[::1\])' || grep -Eq '(localhost|127\.0\.0\.1)' <<<"${DATABASE_URL:-}" ||
    block "drizzle-kit push against a non-local database"
fi
exit 0
