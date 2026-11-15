---
paths:
  - "{{APP}}/**/*.{ts,js,mjs,cjs,mts,cts}"
  - "{{APP}}/package.json"
  - "{{APP}}/tsconfig*.json"
kit: {"name": "Node.js and TypeScript service", "commands": {"setup": "pnpm install", "dev": "pnpm dev", "test": "pnpm vitest run", "testOne": "pnpm vitest run -t \"<name>\"", "lint": "pnpm eslint .", "types": "pnpm tsc --noEmit", "build": "pnpm build", "audit": "pnpm audit --audit-level high"}, "check": {"ext": "ts,mts,cts,js,mjs,cjs", "cmd": "npx --no-install eslint --no-warn-ignored {file}", "requires": "node_modules/.bin/eslint"}}
---

# Stack: Node.js and TypeScript services (NestJS, Fastify, Express, Hono)

- Use the package manager the lockfile shows and never mix them; CI installs with a frozen lockfile.
- Check runtime and framework versions before using version-specific APIs.

## Language
- `strict` and `noUncheckedIndexedAccess` on. No `any` (use `unknown` and narrow); `@ts-expect-error` only with a reason.
- Validate every external input at runtime (zod, valibot, or the framework's validator): bodies, params, env vars
  at startup, and third-party responses.
- No silent catches. Map domain errors to the API error format in one place.
- Every outbound HTTP call has a timeout (`AbortSignal.timeout()`); retry only idempotent calls, with backoff.

## Service structure
- Thin routes or controllers → services → repositories, using the framework's dependency injection (NestJS modules).
- Security middleware: headers (helmet or equivalent), CORS allowlist, body size limits, rate limiting. Shut down
  gracefully on SIGTERM.
- Database through an ORM or query builder (Prisma, Drizzle, Kysely, TypeORM) with parameters; migrations committed.
- Never pass user input to `child_process`, `eval`, `new Function`, dynamic `import()` or `require`, or file paths
  without an allowlist.

## Testing
- Vitest or Jest, whichever exists. HTTP tests with supertest or the framework's injector, including 401, 403, and
  422, against a real database (Testcontainers or the compose service); MSW for third-party HTTP.

## Quality gates
- ESLint with typescript-eslint (`no-floating-promises` on), Prettier, `tsc --noEmit`, build, and the package
  manager's audit failing on high.
- Pin `typescript@~6.0` in devDependencies: typescript-eslint and vue-tsc need the TypeScript 6 compiler API,
  which TypeScript 7 doesn't ship. Never turn off type-aware rules to get green.
