---
paths:
  - "06-technical-docs/api/**/*"
  - "**/openapi*.{yaml,yml,json}"
  - "**/routes/**/*"
  - "**/config/routes.rb"
  - "**/{app,pages,server,src}/api/**/*"
  - "**/app/**/route.{ts,js}"
  - "**/Http/**/*"
  - "**/{controllers,Controllers,controller}/**/*"
  - "**/*{Controller,Endpoints}.{php,cs,java,kt}"
  - "**/{handlers,handler,resolvers,graphql,routers,viewsets}/**/*"
  - "**/{urls,views,viewsets,serializers,routers,routes}.py"
  - "**/*handler*.go"
  - "**/{handlers,routes,router}.rs"
---

# API Rules

- Contract first: change `06-technical-docs/api/openapi.yaml` before or with the implementation. CI or a contract test checks that code and spec agree.
- Resource paths are plural nouns. Status codes: 201 created, 204 no content, 400 or 422 validation, 401 unauthenticated, 403 forbidden, 404 not found (also for another user's resource when its existence is sensitive), 409 conflict, 429 rate limited.
- One success envelope and one error format for the whole API; the stack rules file or stack skill names it. Errors carry a machine-readable code, a human message, and a correlation id, never a stack trace.
- Every list endpoint is paginated (cursor, or page and limit with a maximum), sorted stably, and filterable only by allowlisted fields.
- POSTs that create payments or orders accept an `Idempotency-Key`. Webhook handlers are idempotent.
- Clients (web, mobile, other services) use types or a client generated from the OpenAPI spec, regenerated in the
  same commit as a spec change, so a contract mismatch fails the build instead of the user.
- A breaking change (removed or renamed field, changed type or meaning, new required input) needs a new API version, or an ADR plus user approval. Additive changes are fine.
- Timestamps are ISO 8601 in UTC. Money is integer minor units plus a currency code.
- The spec documents auth requirements and rate limits for each endpoint.
- Clients (web, mobile) use types generated from the spec or runtime-validated schemas, never hand-copied types.
- The API collection (Bruno, Postman) is generated from or updated with the spec in the same commit, and its environments hold placeholders only.
