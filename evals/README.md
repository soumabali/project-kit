# Skill evals

Trigger checks for the skills Claude can start on its own: each skill has one request that must start it and one
near miss that must not. Run them from the repo root with `claude plugin eval .` (they use your credentials and
cost tokens; CI runs them only when started by hand from the Evals workflow). Add a pair when a skill's
description changes or a new model-invocable skill lands.
