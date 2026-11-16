---
paths:
  - "{{APP}}/**/*.{vue,ts,js,mjs,cjs}"
  - "{{APP}}/nuxt.config.*"
  - "{{APP}}/package.json"
kit: {"name": "Nuxt (Vue)", "commands": {"setup": "pnpm install", "dev": "pnpm dev", "test": "pnpm vitest run", "testOne": "pnpm vitest run -t \"<name>\"", "lint": "pnpm eslint .", "types": "pnpm nuxi typecheck", "build": "pnpm nuxi build", "audit": "pnpm audit --audit-level high"}, "check": {"ext": "ts,js,mjs,cjs,vue", "cmd": "npx --no-install eslint --no-warn-ignored {file}", "requires": "node_modules/.bin/eslint"}}
---

# Stack: Nuxt (Vue 3)

- Check the Nuxt and Vue versions in package.json and follow that version's directory structure (Nuxt 4 uses
  `app/` as its source directory). Use the package manager the lockfile shows.

## Structure
- `<script setup lang="ts">` with the Composition API. Shared state in Pinia or `useState`; never module-level
  mutable state on the server, which leaks between requests.
- Fetch with `useFetch` or `useAsyncData` (SSR-safe, keyed); `$fetch` for client-side actions; render pending,
  error, and empty states.
- Server routes in `server/api` (Nitro and h3): validate body and query with `readValidatedBody` and
  `getValidatedQuery` (zod), and authenticate and authorize inside each handler. Server middleware is not authorization.
- `runtimeConfig`: secrets at the top level stay server-only; everything under `runtimeConfig.public` ships to the browser.
- Prevent hydration mismatches: no `Date.now()` or random values during SSR render; use `<ClientOnly>` for
  browser-only widgets.

## Security specifics
- `v-html` never with user content (sanitize with DOMPurify if unavoidable).
- Security headers and CSP through `nuxt-security` or Nitro route rules; CSRF protection for cookie sessions;
  rate-limit auth endpoints.
- Auth cookies set on the server with `httpOnly`, `secure`, and `sameSite`.

## Testing
- Vitest with `@nuxt/test-utils` for components and composables; server route tests include 401, 403, and 422.
- Playwright E2E against the production build (`nuxi build`, then `node .output/server/index.mjs`).

## Quality gates
- `@nuxt/eslint`, Prettier, `nuxi typecheck`, `nuxi build`, and the package manager's audit. `nuxi typecheck` needs
  `typescript` and `vue-tsc` in devDependencies.
- Pin `typescript@~6.0` in devDependencies: typescript-eslint and vue-tsc need the TypeScript 6 compiler API,
  which TypeScript 7 doesn't ship. Never turn off type-aware rules to get green.
