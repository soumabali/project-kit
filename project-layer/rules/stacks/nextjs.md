---
paths:
  - "{{APP}}/**/*.{ts,tsx,js,jsx,mjs,cjs}"
  - "{{APP}}/next.config.*"
  - "{{APP}}/package.json"
kit: {"name": "Next.js (React)", "commands": {"setup": "pnpm install", "dev": "pnpm dev", "test": "pnpm vitest run", "testOne": "pnpm vitest run -t \"<name>\"", "lint": "pnpm eslint .", "types": "pnpm next typegen && pnpm tsc --noEmit", "build": "pnpm build", "audit": "pnpm audit --audit-level high"}, "check": {"ext": "ts,tsx,js,jsx,mjs,cjs", "cmd": "npx --no-install eslint --no-warn-ignored {file}", "requires": "node_modules/.bin/eslint"}}
---

# Stack: Next.js (React)

- Check the Next.js and React versions and whether the app uses the App Router or the Pages Router; follow that
  router's conventions. Use the package manager the lockfile shows.

## Structure
- Server Components by default; `"use client"` only where interactivity needs it, as low in the tree as possible.
- Data access lives in a server-only layer (`import "server-only"`) that authorizes every read and write;
  components call it, never the database directly.
- Server Actions and Route Handlers are public HTTP endpoints: validate input (zod), authenticate, authorize, and
  rate-limit inside each one.
- Middleware (`proxy` in newer versions) handles redirects and headers, not authorization; check again in the data layer.
- Caching and revalidation are explicit per route or fetch; user-specific data is never cached across users.
- Route states through `loading.tsx`, `error.tsx`, and `not-found.tsx`; `next/image` with `sizes`; `next/font`.

## Security specifics
- Secrets only in server code; `NEXT_PUBLIC_*` is public. Pass DTOs, never secrets or whole database rows, as props
  to Client Components.
- Security headers and CSP through `next.config` headers or middleware; `images.remotePatterns` as an allowlist.

## Testing
- Vitest or Jest with Testing Library for components; Server Action and Route Handler tests include 401, 403, and 422.
- Playwright E2E against `next build && next start`, never the dev server in CI.

## Quality gates
- ESLint (Next.js config with typescript-eslint), Prettier, `next typegen` then `tsc --noEmit` (route types such as
  `LayoutProps` don't exist on a clean checkout until typegen runs), `next build`, and the package manager's audit.
- Pin `typescript@~6.0` in devDependencies: typescript-eslint and vue-tsc need the TypeScript 6 compiler API,
  which TypeScript 7 doesn't ship. Never turn off type-aware rules to get green.
