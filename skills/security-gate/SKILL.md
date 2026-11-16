---
name: security-gate
description: Security review gate. Use for every security_sensitive task before it closes; for changes to auth, permissions, payments, uploads, webhooks, personal data, mobile token storage, or MCP tools with side effects; and before every release. Records findings in the task file and blocks completion on open high or critical issues.
---

# /project-kit:security-gate

Scope: the active task's diff against its base branch. Before a release: everything since the last tag.

## 1. Threat sketch (5 to 10 lines in the task file's Security section)
Assets worth protecting · entry points (endpoints, jobs, webhooks, uploads, MCP tools, deep links) · trust
boundaries · abuse cases: how a malicious user, a curious user, and a compromised dependency would attack this change.

## 2. Checklist: pass, fail, or n/a, each with evidence (file:line or test name)
- AuthN: every new route, action, or tool requires authentication unless the API spec marks it public.
- AuthZ: ownership or role is enforced on the server for every resource; tests for another user's resource and
  for the wrong role exist and pass.
- Input: every field validated (type, length, format, range); unknown fields rejected; no mass assignment.
- Injection: no SQL, shell, path, template, or regex strings built from input.
- Output: no raw HTML with user data; responses expose allowlisted fields only (no password, token, or hash).
- Secrets: none in the diff, tests, fixtures, logs, docs, API collections, client bundles, or app binaries; new
  env var names are in `.env.example`.
- Sessions and tokens: expiry, rotation, revocation; cookie flags; CSRF for cookie auth; platform keystore on mobile.
- Abuse: rate limits on auth and expensive endpoints; no account enumeration; idempotency for payments and
  webhooks; races covered by constraints or locks.
- Files and URLs: upload allowlist, size limit, private storage; SSRF guard on user-supplied URLs; safe redirects.
- MCP: token audience validated, no token passthrough, handles bound to the user, Origin checked on local HTTP.
- Errors and logs: generic client errors with a correlation id; no secrets or personal data in logs.
- Dependencies: every new package justified; audit clean of high and critical.
- Config: debug off, security headers present, CORS allowlist unchanged or justified.

## 3. Tools (run what the project has; record each command and its result)
- The Profile's Audit command for every touched app.
- Secret scan of the branch: `gitleaks git --log-opts="<base>..HEAD"` (older gitleaks: `gitleaks detect --log-opts=…`).
- SAST if configured (Semgrep, CodeQL, Brakeman, gosec, Bandit).
- Optionally suggest the user also run Claude Code's built-in `/security-review` (only the user can run it).

## 4. Independent review
Delegate to the `project-kit:security-reviewer` agent with the diff range, the threat sketch, and this checklist.
It didn't write the code; don't substitute your own review. Fix every finding or record why it doesn't apply.

## 5. Result
Fill the task's Security section **Gate result**: date, scope, tools run with results, and findings with severity
and status. Any open high or critical finding: set the task `blocked` and tell the user. Otherwise move the task
to `in-review` for the user's approval.
Before a release there is no task: write the same block to the release record `05-progress/releases/v<version>.md`
(the release skill creates it) and one summary line to `05-progress/log.md`
(`node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" log "security gate v<version>: …"`). Any open high or critical finding
stops the release.
