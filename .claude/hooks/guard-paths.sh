#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit|NotebookEdit). Exit 2 blocks.
# Blocks .env* (except .env.example), secrets/, .github/, .claude/, and content/ unless the
# current branch starts with content-. Human maintenance of protected paths: launch Claude Code
# with LAF_ALLOW_PROTECTED=1 (agents cannot set the hook's environment).
set -u
in=$(cat)
fp=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$in")
[ -z "$fp" ] && exit 0
[ "${LAF_ALLOW_PROTECTED:-}" = "1" ] && exit 0

root=${CLAUDE_PROJECT_DIR:-$(pwd)}
rel=${fp#"$root"/}
rel=${rel#./}
case "/$rel/" in
  */../*) echo "guard-paths: blocked path with '..' segments: $fp" >&2; exit 2 ;;
esac

base=$(basename "$rel")
case "$base" in
  .env.example) ;;
  .env | .env.*) echo "guard-paths: .env files are off limits to agents ($rel)" >&2; exit 2 ;;
esac

case "$rel" in
  secrets/* | */secrets/*) echo "guard-paths: secrets/ is off limits ($rel)" >&2; exit 2 ;;
  .github/*) echo "guard-paths: .github/ is human-only; describe the change in the ticket ($rel)" >&2; exit 2 ;;
  .claude/*) echo "guard-paths: .claude/ is human-only ($rel)" >&2; exit 2 ;;
  content/*)
    branch=${LAF_BRANCH:-$(git -C "$root" branch --show-current 2>/dev/null)}
    case "$branch" in
      content-*) ;;
      *) echo "guard-paths: content/ is editable only on a content-* branch (on '${branch:-none}')" >&2; exit 2 ;;
    esac
    ;;
esac
exit 0
