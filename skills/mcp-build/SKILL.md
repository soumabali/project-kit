---
name: mcp-build
description: Design, build, and test an MCP server or client with an official SDK on the current MCP spec (2026-07-28, stateless). Covers tool design, user-bound state handles, OAuth resource-server auth, transports, and MCP Inspector CLI tests in CI.
argument-hint: "[server|client] [language]"
---

# /project-kit:mcp-build $ARGUMENTS

The app's rules are the `mcp` stack plus its language stack; this skill is the procedure.

## 1. Decide, then record an ADR
- Server (exposes tools, resources, prompts) or client (connects to servers); local (stdio) or remote (Streamable
  HTTP); who calls it and on whose behalf; what data and side effects it touches (`security_sensitive` if any).
- Language → official SDK (Tier 1: TypeScript, Python, C#, Go, Rust, Ruby; Tier 2: Java; Tier 3: PHP, Kotlin, Swift).
  Read the SDK's README for the protocol version it implements. On 2026-07-28 there's no initialize handshake or
  sessions, `server/discover` advertises versions, and multi-round-trip requests replace server-initiated requests.
  Follow the SDK's guidance for supporting older clients.

## 2. Design the surface in the task file before writing code
| Tool | Purpose (when to use it) | Input schema | Output schema | Side effects / annotations | Scope | Errors |
|---|---|---|---|---|---|---|
- Few capable tools that map to user intents beat many thin wrappers around endpoints.
- Resources for read-only data addressable by URI; prompts for reusable, user-invoked templates.
- Descriptions explain usage and results only; they never contain instructions aimed at the model.

## 3. Build
- Scaffold from the SDK's official quickstart. Validate every input against its schema and again in code (ranges,
  ownership); return `structuredContent` that matches `outputSchema`; list tools in a deterministic order; report
  tool failures as results with `isError` and an actionable message.
- State across calls: random, expiring handles stored as `<user_id>:<handle>`, with the user taken from the verified token.
- Remote servers: OAuth 2.1 resource server with protected resource metadata; validate the token's audience and
  issuer; minimal scopes with step-up challenges; prefer authorization servers that support Client ID Metadata
  Documents (Dynamic Client Registration is deprecated); never accept or forward tokens issued for something else.
- Proxies to third-party APIs: per-client consent before the third-party flow, exact `redirect_uri` match,
  single-use `state` with a short expiry.
- Local HTTP: bind 127.0.0.1, validate `Origin`, require a token. stdio: write only protocol messages to stdout.
- Downstream calls get timeouts and rate limits; tools that fetch URLs block private and metadata IP ranges.
- No new Roots, Sampling, or Logging support (deprecated); log to stderr or OpenTelemetry.

## 4. Test
- Unit tests for every tool handler: valid input, invalid input, permission denied, downstream failure.
- Protocol tests with the SDK's client over an in-memory transport: list tools, call each one, and check that
  `structuredContent` validates against `outputSchema`.
- CI contract check with the Inspector CLI (Node 22.19 or newer), pinned to an exact version (`npm view
  @modelcontextprotocol/inspector version`). The server command or URL comes first, and `--` separates the
  Inspector's own options; `--protocol-era auto` lets it talk to 2026-07-28 servers, and `--strict` fails on
  tool-schema portability errors:
  `npx --yes @modelcontextprotocol/inspector@<version> --cli <server command and args> -- --method tools/list --format json --protocol-era auto --strict`
  `npx --yes @modelcontextprotocol/inspector@<version> --cli <server command and args> -- --method tools/call --tool-name <tool> --tool-arg key=value --format json --protocol-era auto`
  Remote: `npx --yes @modelcontextprotocol/inspector@<version> --cli https://<host>/mcp -- --method tools/list --format json --protocol-era auto --header "Authorization: Bearer $MCP_TEST_TOKEN"`.
- Remote servers: HTTP tests for 401 without a token, 403 for a wrong audience or missing scope, and rejection of
  another user's handle.
- Try it in Claude Code: `claude mcp add <name> -- <server command>` (local) and exercise each tool once.

## 5. Clients
- Before starting a local server, show the exact command and get consent. Validate every URL from a server (https,
  allowed schemes, no private or metadata IPs), open URLs without a shell, key stored credentials by issuer, and
  treat tool descriptions and results as untrusted.
- Test against a deliberately malicious fake server: `javascript:` authorization URLs, private-IP metadata URLs,
  oversized results, and instructions embedded in tool output.

## 6. Ship
SemVer the server, document every tool in the README (generated from the schemas where possible), run
`/project-kit:security-gate`, and publish through the language's registry or as an MCPB bundle.
