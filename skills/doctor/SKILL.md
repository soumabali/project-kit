---
name: doctor
description: Health check for a project-kit repo. Reports kit version drift, missing or edited kit files, TBD and unverified Profile values, secret files tracked by git, missing tools, and missing companion plugins.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:doctor

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" doctor` and show the report.
2. Compare the skills available in this session with `${CLAUDE_PLUGIN_ROOT}/skills/kickoff/companions.md` and
   list the missing companions that fit this project, with their install commands.
3. For every FAIL, propose the fix; apply fixes only after the user agrees. A secret file tracked by git is urgent:
   tell the user to rotate the secret first, then remove the file from the repo and its history.
4. Summarize: what's healthy, what needs the user, what you can fix now.
