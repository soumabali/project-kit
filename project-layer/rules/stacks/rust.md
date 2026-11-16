---
paths:
  - "{{APP}}/**/*.rs"
  - "{{APP}}/**/Cargo.toml"
  - "{{APP}}/Cargo.lock"
  - "{{APP}}/{rust-toolchain,rust-toolchain.toml,clippy.toml,rustfmt.toml,deny.toml}"
  - "{{APP}}/.cargo/config.toml"
kit: {"name": "Rust", "commands": {"setup": "cargo fetch --locked", "dev": "cargo run", "test": "cargo test --locked --all-features", "testOne": "cargo test --locked <test_name>", "lint": "cargo fmt --all --check && cargo clippy --locked --all-targets --all-features -- -D warnings", "types": "cargo check --locked --all-targets --all-features", "build": "cargo build --locked --release", "audit": "cargo audit"}, "check": {"ext": "rs", "cmd": "rustfmt --check --edition 2024 {file}", "requires": "rustfmt"}}
---

# Stack: Rust

- Check `edition` and `rust-version` in Cargo.toml and the toolchain file before using newer features (for example
  let chains need edition 2024, async closures need Rust 1.85). In a workspace, pass `--workspace`, or `-p <crate>`
  for one crate; shared versions and lints live in `[workspace.dependencies]` and `[workspace.lints]`.
- Keep the framework the repo uses (axum, actix-web, Rocket, Leptos, Tauri, clap); on axum, `dev` with reload is
  `cargo watch -x run` or `bacon run`.

## Structure
- A thin `main.rs` over a library crate (`lib.rs`), so integration tests in `tests/` can drive the real code.
- Errors: return `Result`; `thiserror` enums in libraries, `anyhow` with `.context()` in binaries. No `unwrap()`,
  `expect()`, `panic!`, or slice indexing on input-derived data outside tests; `expect("reason")` only for
  invariants proven at startup. Map errors to HTTP responses in one place and never return their `Debug` output.
- No `unsafe` without a `// SAFETY:` comment that proves the invariant; application crates set
  `#![forbid(unsafe_code)]`. Prefer borrowing and ownership moves over `clone()` added to quiet the borrow checker.
- Async (Tokio): never block the runtime (`spawn_blocking` for CPU work and blocking I/O), never hold a
  `std::sync::Mutex` guard across `.await`, give every outbound call a timeout, and shut down gracefully.
- Shared state goes in `State<Arc<AppState>>` (or the framework's equivalent), not `static mut` or globals.
- Config is read from the environment once at startup into a typed struct; secrets sit in `secrecy::SecretString`
  so they can't be logged through `Debug`.

## Security specifics
- SQL through sqlx (`query!` and `query_as!` with bind parameters, checked at compile time), Diesel, or SeaORM;
  never `format!` a query. Commit sqlx's offline data (`cargo sqlx prepare`) so CI builds without a database.
- Deserialize input into typed structs with `#[serde(deny_unknown_fields)]`, then validate (`validator` or
  `garde`); make invalid states unrepresentable with newtypes and enums instead of re-checking strings.
- Cap request bodies (`DefaultBodyLimit`), add `tower_http` timeout and security-header layers, and an explicit
  CORS allow list. Auth is an extractor or middleware layer, so a handler can't forget it.
- Passwords with `argon2`; tokens from `rand`'s `OsRng`; compare secrets with `subtle::ConstantTimeEq`. TLS through
  rustls unless the platform needs native-tls.
- File paths from input: join to a root, canonicalize, and check the prefix. `std::process::Command` takes a fixed
  program and separate arguments, never a shell string.
- Templates escape by default (askama, maud, Leptos `view!`); never mark user input as pre-escaped.
- Integer math on untrusted sizes uses `checked_*` or `saturating_*`; release builds wrap silently on overflow.

## Testing
- Unit tests in a `#[cfg(test)] mod tests` beside the code; integration tests in `tests/`, driving the router
  in-process (`tower::ServiceExt::oneshot`) or over HTTP, including 401, 403, 404, and 422.
- Real database: `#[sqlx::test]` (a fresh migrated database per test) or testcontainers; never a mocked pool.
- `proptest` for parsers and invariants, `cargo fuzz` for anything that decodes untrusted bytes, `insta` for
  snapshots. `cargo nextest run` is faster where installed, but doctests still need `cargo test --doc`.
- Browser flows through the Playwright e2e app; Tauri and Leptos UIs follow the UI rule.

## Quality gates
- `cargo fmt --check`; clippy with `-D warnings` over all targets and features; `cargo audit` or
  `cargo deny check` (advisories, licenses, sources); `cargo machete` or `cargo udeps` for unused dependencies.
- Cargo.lock is committed for every crate, and CI and release builds pass `--locked`. A `build.rs` or proc-macro
  in a new dependency runs code at build time: review it as you would an install script.
