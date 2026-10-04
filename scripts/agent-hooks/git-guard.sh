#!/bin/sh
# Agent guard for shell/Bash commands (Claude PreToolUse[Bash]).
# Adapted from actualbudget/actual's scripts/agent-hooks/git-guard.sh.
#
# Deterministically enforces the git-safety and workspace rules in AGENTS.md.
# Reads the command from `.tool_input.command` on stdin. Exit code 2 + stderr
# blocks the call and feeds the reason back to the agent.
#
# Best-effort by design: it catches the honest mistakes agents actually make
# (--no-verify, force pushes, yarn in a child workspace). It does NOT try to
# defend against deliberate evasion via unusual shell forms.

block() {
  echo "$1" >&2
  exit 2
}

. "$(dirname "$0")/common.sh"
require_jq

# Fail closed: a malformed payload (jq parse failure) blocks rather than allows.
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) ||
  block "Blocked: could not parse the hook payload (.tool_input.command)."
[ -z "$cmd" ] && exit 0

# Enforce: always run yarn from the repo root, never in a child workspace.
case "$cmd" in
  *"cd packages/"* | *"cd ./packages/"* | *"cd packages "* | *"cd ./packages "* | \
    *"pushd packages/"* | *"pushd ./packages/"* | \
    *"yarn --cwd packages/"* | *"yarn --cwd ./packages/"* | \
    *"yarn --cwd=packages/"* | *"yarn --cwd=./packages/"*)
    case "$cmd" in
      *yarn*)
        block "Blocked: run yarn from the repo root, not a child workspace (AGENTS.md). Use 'yarn workspace <name> <cmd>' from the root instead." ;;
    esac ;;
esac

# Everything below only applies to actual git invocations. Match `git` as a
# whole token so commands that merely mention git aren't falsely blocked.
is_git=0
set -f
for tok in $cmd; do
  [ "$tok" = "git" ] && {
    is_git=1
    break
  }
done
set +f
[ "$is_git" -eq 1 ] || exit 0

# Never skip git hooks.
case "$cmd" in
  *--no-verify* | *--no-gpg-sign*)
    block "Blocked: skipping git hooks (--no-verify/--no-gpg-sign) is forbidden." ;;
esac

# Never change git config (reads are fine).
case "$cmd" in
  *"git config"*)
    case "$cmd" in
      *--get* | *--list* | *" -l "* | *" -l") ;;
      *) block "Blocked: 'git config' changes are forbidden." ;;
    esac ;;
esac

# Never force-push without an explicit user request.
case "$cmd" in
  *"git push"*)
    case "$cmd" in
      *--force-with-lease*) ;;
      *--force* | *" -f "* | *" -f")
        block "Blocked: force push only on explicit user request. Use --force-with-lease and confirm with the user first." ;;
    esac ;;
esac

exit 0
