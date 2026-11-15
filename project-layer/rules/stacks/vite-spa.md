---
paths:
  - "{{APP}}/**/*.{ts,tsx,js,jsx,vue,svelte,css}"
  - "{{APP}}/package.json"
  - "{{APP}}/index.html"
  - "{{APP}}/vite.config.*"
  - "{{APP}}/tsconfig*.json"
kit: {"name": "Vite single-page app (React, Vue, Svelte)", "commands": {"setup": "pnpm install", "dev": "pnpm dev", "test": "pnpm vitest run", "testOne": "pnpm vitest run -t \"<name>\"", "lint": "pnpm eslint .", "types": "pnpm tsc -b", "build": "pnpm build", "audit": "pnpm audit --audit-level high"}, "check": {"ext": "ts,tsx,js,jsx,vue,svelte", "cmd": "npx --no-install eslint --no-warn-ignored {file}", "requires": "node_modules/.bin/eslint"}}
---

# Stack: Vite single-page app (React, Vue, Svelte)

- A browser-only app: it talks to an API it doesn't own. Check the framework, router, and Vite versions in
  package.json before using version-specific APIs. Vue apps type-check with `vue-tsc -b`, Svelte with `svelte-check`.
- Use the package manager the lockfile shows; CI installs frozen.

## Structure
- Feature folders (`src/features/<feature>/` with its components, hooks or composables, API calls, and tests)
  over type folders. Shared UI lives in `src/components/ui/`, built on the component base DESIGN.md names.
- Server state through one data library (TanStack Query, SWR, or Pinia Colada): caching, retries, loading and
  error states in one place. Don't copy server data into a global store.
- The API client and its types are generated from `06-technical-docs/api/openapi.yaml` (openapi-typescript,
  orval, or hey-api) and regenerated when the spec changes; never hand-write response types.
- Routes are lazy-loaded; every route has loading, error (an error boundary or `errorComponent`), and not-found states.
- Forms with a schema library (Zod or Valibot) shared with the API types; validate on blur and on submit.

## Security specifics
- Everything in the bundle is public: only `VITE_`-prefixed public values, never secrets. Authorization happens
  on the API; hiding a button is UX, not security.
- Auth through HttpOnly cookies set by the API (with CSRF protection), or the OAuth authorization code flow with
  PKCE; never tokens in `localStorage`.
- No `dangerouslySetInnerHTML`, `v-html`, or `{@html}` with user content unless DOMPurify cleans it first.
- Production builds have no source maps on the public server (upload them to the error tracker instead) and send
  a CSP from the host.

## Testing
- Component and hook tests with Vitest and Testing Library, querying by role and label; mock the API at the network
  boundary with MSW, using fixtures typed from the generated client.
- Critical journeys run in the Playwright e2e app against a production build (`vite build && vite preview`) and
  the real API.

## Quality gates
- ESLint with the framework plugin and `jsx-a11y` (React) or the Vue and Svelte accessibility rules, `tsc -b`
  (or `vue-tsc -b`), Vitest, `vite build`, and a bundle size check on the main route.
