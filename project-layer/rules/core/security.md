---
paths:
  - "{{APP}}/**/*.{php,rb,py,go,java,kt,kts,scala,cs,fs,ts,tsx,mts,cts,js,jsx,mjs,cjs,vue,svelte,astro,dart,rs,swift,ex,exs,heex,html,erb,jbuilder,haml,slim,twig,tmpl,gohtml,cshtml,razor,sql,sh}"
  - "{{APP}}/**/*.{yml,yaml,toml,xml,gradle,properties}"
---

# Security Rules for Code

## Authentication and sessions
- Use the framework's auth and password hashing (argon2id or bcrypt). Never write your own crypto, hashing, or session handling.
- Access tokens are short-lived; refresh tokens are revocable and stored hashed. Rotate on privilege change; revoke on logout and password change.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`. Cookie-authenticated state changes need CSRF protection.
- Login, password reset, and OTP endpoints are rate-limited, give the same answer whether or not the account exists, and compare secrets in constant time.

## Authorization
- Authorize inside the server-side handler or data layer on every request. Hidden UI and middleware alone are not authorization.
- Scope queries by owner or tenant in the query itself, not by fetching first and checking afterwards.
- IDs from URLs, bodies, and tool arguments are untrusted. Every endpoint has a test that accesses another user's resource.

## Input and output
- Validate type, length, format, and range on the server with the framework validator. Reject unknown fields (no mass assignment).
- Never concatenate input into SQL, shell commands, file paths, templates, or regexes. Use ORM or query-builder bindings.
- Output uses the framework's auto-escaping. Raw HTML only after an allowlist sanitizer.
- File uploads: allowlist MIME type and extension, enforce a size limit, use a random server-side name, store outside the web root or in a private bucket, and serve through signed URLs.
- Requests to user-supplied URLs: allowlist hosts, block private, loopback, and link-local addresses (SSRF), set timeouts, and re-check every redirect.
- Redirect only to relative paths or allowlisted hosts.

## Data exposure
- Responses go through explicit serializers or resources with allowlisted fields. Never serialize a whole model.
- Clients get a generic error message plus a correlation id; details stay in server logs. Debug mode is off outside local.
- Logs are structured and never contain secrets, tokens, passwords, full card or ID numbers, or auth request bodies. Redact personal data.
- Mobile and desktop binaries are public: no secrets in them; tokens live in the platform keystore.

## Platform
- CORS uses an explicit origin allowlist; never `*` together with credentials.
- Security headers: HSTS, CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors`, `Referrer-Policy`.
- Rate-limit auth, expensive, and write endpoints. Set request body size limits.
- Races in business logic are handled with database constraints, transactions, or row locks. Payments and webhooks use idempotency keys; webhook signatures are verified before any processing.

## Dependencies
- Lockfiles are committed and CI installs from them (frozen). Before adding a package, check maintenance, license, and known vulnerabilities (the Profile's Audit command); a new dependency needs the user's approval.
- New versions wait out a cooldown before they are installed (pnpm `minimumReleaseAge`, npm `min-release-age`, Renovate `minimumReleaseAge`, Dependabot `cooldown`), unless the update fixes a vulnerability you are exposed to.
- Install scripts of new packages run only after review (pnpm allows them per package; npm `--ignore-scripts` when in doubt).
