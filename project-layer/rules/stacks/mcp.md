---
paths:
  - "{{APP}}/**/*.{ts,mts,cts,js,mjs,cjs,py,go,cs,java,kt,rb,php,rs,swift}"
kit: {"name": "MCP server or client"}
---

# Stack: MCP server or client

- Use an official SDK at its current major (Tier 1: TypeScript, Python, C#, Go, Rust, Ruby; Tier 2: Java; Tier 3:
  PHP, Kotlin, Swift). Check which protocol version it implements (the latest spec, 2026-07-28, is stateless) and
  follow the SDK docs; never hand-roll the protocol. Pair this rule with the app's language stack.
- The full design, build, and test procedure is `/project-kit:mcp-build`.

## Server design
- Tools: `verb_noun` names, one job each, descriptions that say when to use the tool and what it returns. JSON
  Schema inputs with required fields, enums, and limits; `outputSchema` with `structuredContent` for machine-readable
  results; a deterministic `tools/list` order.
- Mark side effects with tool annotations (read-only, destructive, idempotent). Destructive tools offer a dry run
  or a two-step confirm.
- Stateless: never rely on connection sessions. Cross-call state uses random, expiring, server-minted handles bound
  to the authenticated user (stored as `<user_id>:<handle>`); possessing a handle is never authorization.
- Don't add Roots, Sampling, or Logging support in new code (deprecated in 2026-07-28). Log to stderr for stdio
  servers, or to OpenTelemetry.
- Tool failures come back as results with `isError` and an actionable message; never leak stack traces or secrets.

## Transports and auth
- Local servers use stdio (stdout carries only protocol messages). Remote servers use Streamable HTTP; HTTP+SSE is deprecated.
- A local HTTP server binds to 127.0.0.1, validates the `Origin` header, and requires a token.
- Remote servers act as OAuth 2.1 resource servers: publish protected resource metadata, validate the token's
  audience and issuer, and use least-privilege scopes with step-up. Never accept or forward a token that wasn't
  issued for this server.
- Clients register through a Client ID Metadata Document; Dynamic Client Registration is deprecated. Clients check
  the authorization response's `iss` before redeeming the code.
- Proxies to third-party APIs get per-client consent before the third-party flow, exact `redirect_uri` matching,
  and single-use `state`.

## Client side
- Tool descriptions and results are untrusted input (prompt injection). Show the exact command and get consent
  before starting a local server.
- OAuth and resource URLs: https only (loopback http in development), reject `javascript:`, `data:`, and `file:`,
  block private and metadata IP ranges (SSRF), and never open URLs through a shell.

## Testing
- Unit-test tool handlers directly; protocol tests with the SDK's in-memory client and transport.
- CI contract check with a pinned Inspector. The server command comes first and `--` ends it:
  `npx --yes @modelcontextprotocol/inspector@<version> --cli <server command and args> -- --method tools/list --format json --protocol-era auto`.
- Security tests: unauthenticated, wrong audience, another user's handle, and malicious arguments.
