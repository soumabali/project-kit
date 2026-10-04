#!/usr/bin/env bash
# SessionStart hook. Plain stdout becomes session context (capped at 10,000 characters), so output stays short.
# - In a project set up by project-kit (also when Claude starts in one of its subfolders): prints the resume point
#   (05-progress/STATUS.md) and git state.
# - At the start of a session at the root of a git repository without the kit, follows the plugin's `setup` option:
#     ask (default)  a short notice that /project-kit:kickoff can set the repo up
#     auto           installs the project layer with the detected apps, then says what it did
#     off            nothing
#   Never in the home folder, a subfolder, a linked worktree or submodule, CI, or a repo the user asked to skip,
#   and never on resume or after compaction.
input=""
[ -t 0 ] || input="$(cat)"
KIT="$(cd "$(dirname "$0")" && pwd)/kit.mjs"
DATA="${CLAUDE_PLUGIN_DATA:-}"

print_context() {
  if [ -f 05-progress/STATUS.md ]; then
    echo "[05-progress/STATUS.md]"
    head -c 6000 05-progress/STATUS.md
    echo
  else
    echo "This project uses project-kit but has no 05-progress/STATUS.md yet."
  fi
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[git status]"
    git status --short --branch 2>/dev/null | head -n 25 | cut -c 1-160 | head -c 2500
  fi
}

main() {
  cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || return 0
  local top
  top="$(git rev-parse --show-toplevel 2>/dev/null)"
  if [ ! -f .claude/project-kit.json ] && [ -n "$top" ] && [ -f "$top/.claude/project-kit.json" ]; then
    cd "$top" || return 0
  fi
  if [ -f .claude/project-kit.json ]; then
    print_context
    return 0
  fi

  # Not set up yet: act only when a conversation starts, not on resume or after compaction.
  local started_by mode here here_win reason="" out apps data_arg=""
  started_by="$(printf '%s' "$input" | grep -o '"source"[[:space:]]*:[[:space:]]*"[a-z]*"' | head -n 1 | sed 's/.*"\([a-z]*\)"$/\1/')"
  case "$started_by" in ""|startup|clear) ;; *) return 0 ;; esac
  mode="$(printf '%s' "${CLAUDE_PLUGIN_OPTION_SETUP:-ask}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  case "$mode" in
    off|false|no|none|never) return 0 ;;
    auto|on|true|yes|always) mode=auto ;;
    *) mode=ask ;;
  esac
  [ -z "${CI:-}" ] || return 0
  [ -n "$top" ] && [ -d .git ] || return 0                     # the main checkout of a git repository...
  here="$(pwd -P)"
  [ "$(cd "$top" && pwd -P)" = "$here" ] || return 0           # ...started at its root...
  [ "$here" != "$(cd ~ 2>/dev/null && pwd -P)" ] || return 0  # ...that isn't the home folder
  if [ -n "$DATA" ] && [ -f "$DATA/skipped-projects.txt" ]; then
    grep -qxF -- "$here" "$DATA/skipped-projects.txt" && return 0
    here_win="$(pwd -W 2>/dev/null)"                           # Git Bash: node records C:/... paths
    [ -n "$here_win" ] && grep -qxF -- "$here_win" "$DATA/skipped-projects.txt" && return 0
  fi
  [ -z "$DATA" ] || data_arg=" --data-dir \"$DATA\""

  if [ "$mode" = auto ]; then
    if [ -e CLAUDE.md ] || [ -L CLAUDE.md ] || [ -e .claude/CLAUDE.md ] || [ -L .claude/CLAUDE.md ]; then
      reason="CLAUDE.md already exists, and automatic setup never edits it"
    elif ! command -v node >/dev/null 2>&1; then
      reason="Node.js is not installed"
    elif out="$(node "$KIT" install --auto --project-dir "$here" 2>&1)"; then
      apps="$(printf '%s\n' "$out" | sed -n 's/^Apps: //p' | head -n 1)"
      cat <<EOF
[project-kit] Automatic setup (the plugin's setup option is "auto") just installed the project layer in this repo: CLAUDE.md, .claude/rules/kit/, .claude/templates/, tracking folders 01-06, permission rules in .claude/settings.json, and a .gitignore block. Apps: ${apps:-none detected}.
- CLAUDE.md loads automatically from the next session. Read it now if it isn't in your context yet, and follow it.
- In your first reply, tell the user this happened, and that /project-kit:kickoff confirms the apps, fills in the project profile, and runs Phase 00.
- If they don't want project-kit in this repo, undo it (only files nobody has edited are removed) with: node "$KIT" uninstall --project-dir "$here"$data_arg
EOF
      print_context
      return 0
    else
      reason="$(printf '%s\n' "$out" | head -n 1 | sed 's/^project-kit: //' | cut -c 1-300)"
    fi
  fi

  [ -z "$reason" ] || echo "[project-kit] Automatic setup skipped: $reason."
  echo "[project-kit] This repo isn't set up with project-kit. If the user starts planning or building here, mention once that /project-kit:kickoff sets up the workflow (CLAUDE.md, task tracking, per-stack rules, real tests)."
  [ -z "$DATA" ] || echo "If they don't want it in this repo, stop this notice with: node \"$KIT\" skip --project-dir \"$here\"$data_arg"
  return 0
}

main | head -c 9500
exit 0
