---
name: rigor
description: Show or change how much process this project carries. prototype for demos, spikes, and internal tools; standard (default) for most client work; production for long-lived or regulated systems. Changes the tests, reviews, UI checks, and docs each task needs (CLAUDE.md §2); security rules apply at every level.
disable-model-invocation: true
argument-hint: "[prototype|standard|production]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:rigor $ARGUMENTS

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" rigor $ARGUMENTS` and report the result.
2. On a change, explain what it means for the open work, using CLAUDE.md §2: which gates tasks now need or no
   longer need, and whether Phase 00 needs more groups (`${CLAUDE_PLUGIN_ROOT}/skills/kickoff/phase-00.md` lists
   them per level).
3. Moving up (prototype → standard → production) before a release is normal: list what's missing for the new
   level (coverage floor, visual baselines, CI groups) as tasks with `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs"
   new task`. Moving down on a project with real users or data: say what protection is lost and ask first.
4. Commit `chore(kit): rigor <level>` on a branch.
