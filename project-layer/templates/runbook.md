# Runbook

Operational facts for running this system. Env var names only, never values.

## Run locally
1. `cp .env.example .env` and fill in values (ask the team for the secret store location).
2. `docker compose up -d --wait`
3. Seed data: …

## Environments
| Env | URL | Deploys from | Approver |
|---|---|---|---|
| staging | | `main` | |
| production | | tag `vX.Y.Z` | |

## Configuration
| Variable | App | Purpose | Required |
|---|---|---|---|
| `DATABASE_URL` | backend | | yes |

## Deploy
Steps, or the CI job that runs them.

## Rollback
1. Redeploy the previous tag.
2. Migrations: roll back the newest, or ship a forward fix when the migration can't be reversed safely.

## Background work
Queues, workers, and schedulers: how they run, how to see a backlog or failed jobs, and how to drain, retry, or
restart them safely.

## Secrets and rotation
Where each secret lives (the secret store, never the repo), who can rotate it, and the steps. After a leak,
rotate first, then clean history.

## Backups and restore
Schedule, retention, where they live, and a restore drill date.

## Monitoring and alerts
Uptime check on `/health`, error-rate and latency alerts, the dashboard link, and who gets paged.

## Incidents
Open a hotfix task (`04-tasks/hotfix/`), record impact in it, and add a CHANGELOG `Fixed` entry once shipped.
A personal-data breach also needs written notice to the people affected and the regulator within the legal
deadline: under Indonesia's UU PDP, 3×24 hours to both; under the GDPR, 72 hours to the supervisory authority.
Record who decides and who sends it.
