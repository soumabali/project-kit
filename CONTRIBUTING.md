# Contributing

1. Fork the repository and create a branch from `main`.
2. Make your change. Keep stack rules in `project-layer/rules/stacks/` to 70 lines or fewer.
3. Run `bash tests/run.sh`. It must pass with zero warnings.
4. Add a line under `## [Unreleased]` in CHANGELOG.md.
5. Open a pull request that says what changed and why.

Never include secrets, client data, or real credentials in a commit, test fixture, or example.
