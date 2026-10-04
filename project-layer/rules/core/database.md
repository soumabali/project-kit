---
paths:
  - "**/{migrations,Migrations,migrate,migration}/**/*"
  - "**/database/**/*"
  - "**/db/**/*"
  - "**/drizzle/**/*"
  - "**/alembic/**/*"
  - "**/{models,Models,entities,Entities,entity,repositories,Repositories,repository}/**/*"
  - "**/models.py"
  - "**/{store,stores,storage}/**/*.go"
  - "**/*{DbContext,Repository}.{cs,java,kt}"
  - "**/*.prisma"
  - "**/*.sql"
  - "06-technical-docs/data-model.md"
---

# Database and Migration Rules

- Every schema change is a migration, committed together with the code that needs it. Never change a database by hand.
- Never modify a migration that has run anywhere other than your local machine. Add a new one.
- Zero-downtime by default, expand → migrate → contract across releases:
  - add columns as nullable or with a default, and backfill large tables in batches from a job or command, not inside the migration;
  - rename by adding the new column, dual-writing, backfilling, switching reads, and dropping the old column in a later release;
  - drop a column or table only when no deployed code reads it.
- Every migration has a tested way back: a down migration, or, for tools without them (Prisma Migrate, Drizzle, Flyway Community), a reverse forward migration written and run in the same task. The task file says when a change is truly irreversible.
- Data-altering or destructive migrations (drop, truncate, narrowing a type, mass update) need user approval and a backup and restore note in `06-technical-docs/runbook.md`.
- Invariants live in constraints: NOT NULL, foreign keys with an explicit ON DELETE, UNIQUE (composite where the rule is "no double booking"), CHECK.
- Index every foreign key and every column used to filter or sort hot queries. Check new heavy queries with EXPLAIN.
- No N+1 queries: eager-load relations for list endpoints, and guard hot endpoints with a query-count assertion in tests.
- Publicly exposed IDs are non-sequential (UUID or ULID), or every access to them is strictly authorized.
- Seeders and factories are for development and tests only; production never gets test accounts.
- CI runs all migrations against an empty database and, where the tool has down migrations, rolls back the newest one.
- Update `06-technical-docs/data-model.md` (Mermaid ERD) in the same commit as the schema change.
