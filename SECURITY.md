# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's
"Report a vulnerability" button on the Security tab of this repository
(private vulnerability reporting), and include the steps to reproduce.

You can expect a first reply within a few days. Fixes ship in a patch release
and are listed under "Security" in CHANGELOG.md.

## Scope

The hooks and scripts in this plugin (secret guard, git guard, setup writer)
run on your machine. Reports about them bypassing a protection, writing
outside the project, or leaking a secret are in scope.
