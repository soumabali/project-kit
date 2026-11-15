---
paths:
  - "{{APP}}/**/*.go"
  - "{{APP}}/go.{mod,sum}"
  - "{{APP}}/**/*.{tmpl,gohtml}"
kit: {"name": "Go", "commands": {"setup": "go mod download", "dev": "go run ./cmd/<app>", "test": "go test -race ./...", "testOne": "go test -race -run <TestName> ./<pkg>", "lint": "golangci-lint run", "types": "go vet ./...", "build": "go build ./...", "audit": "govulncheck ./..."}, "check": {"ext": "go", "cmd": "gofmt -e -l {file}", "requires": "gofmt"}}
---

# Stack: Go

- Check the `go` and `toolchain` lines in go.mod before using version-specific features (for example, the
  method-and-wildcard routing patterns in `net/http` since Go 1.22, or `os.Root` since Go 1.24).

## Structure
- Keep the layout the repo uses (`cmd/`, `internal/`). No global mutable state; pass dependencies explicitly.
- `context.Context` is the first parameter for request-scoped work; respect cancellation; set timeouts on every outbound call.
- Errors: return them, wrap with `%w`, check with `errors.Is` and `errors.As`; never discard one. Panic only for
  programmer errors at startup.
- HTTP servers set `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, and `IdleTimeout`, cap bodies with
  `http.MaxBytesReader`, and shut down gracefully.
- `database/sql`, pgx, or sqlc with placeholders only; close rows; run transactions through a helper that rolls back on error.

## Security specifics
- `html/template` for HTML (never `text/template`), `crypto/rand` for tokens, `subtle.ConstantTimeCompare` for secrets.
- File paths from input: resolve within a root (`os.Root`, or `filepath.Clean` plus a prefix check).
- Never build shell commands from input; `exec.Command` with fixed program names and argument lists only.
- Decode strict JSON inputs with `DisallowUnknownFields()` and validate after decoding.
- Cookie-authenticated handlers sit behind `http.CrossOriginProtection` (Go 1.25+) or a token CSRF middleware.

## Testing
- Table-driven tests with `t.Run`; always run with `-race`. Handler tests with `httptest`, including 401, 403, 404, and 422.
- Integration tests against a real database (Testcontainers for Go or the compose service), behind a build tag if slow.
- Fuzz tests (`go test -fuzz`) for parsers and decoders. Browser flows through the Playwright e2e app.

## Quality gates
- `gofmt` or `goimports`, `go vet`, golangci-lint (with gosec, errcheck, staticcheck), `govulncheck ./...`.
