---
paths:
  - "**/{docker-compose,compose}*.{yml,yaml}"
  - "**/{Dockerfile,Containerfile}*"
  - "**/*.dockerfile"
  - ".github/**/*"
  - ".gitlab-ci.yml"
  - "**/Jenkinsfile"
  - ".circleci/**/*"
  - "azure-pipelines.yml"
  - "bitbucket-pipelines.yml"
  - "**/.dockerignore"
  - "**/*.{tf,tfvars}"
  - "**/{k8s,kubernetes,helm,charts,deploy,infra}/**/*.{yml,yaml}"
---

# CI, Container, and Infrastructure Rules

## CI
- Pin third-party actions and images to a full commit SHA or digest (with the version in a comment); keep them current with Dependabot or Renovate.
- Every workflow sets least-privilege `permissions:` (default `contents: read`); checkout uses `persist-credentials: false` unless the job pushes.
- Pull requests from forks run with `pull_request`, never `pull_request_target` with a checkout of their code.
- Never interpolate untrusted values (`${{ github.event.* }}` titles, branch names, bodies) into `run:` scripts; pass them through `env:`.
- Secrets live in the CI secret store, reach only the steps that need them, and never appear in logs or uploaded artifacts (traces, reports, screenshots).
- Deploys authenticate with OIDC to the cloud provider instead of long-lived keys, and production deploys need an approval (protected environment).

## Containers
- Run as a non-root user from a minimal, pinned base image; multi-stage builds keep compilers and dev dependencies out of the final image.
- No secrets in images, build args, or committed compose files; use runtime env or mounted secrets.
- Every service has a health check, resource limits, and graceful shutdown on SIGTERM.
- Local compose files bind databases and admin tools to `127.0.0.1`, never `0.0.0.0`.

## Infrastructure as code
- State files (`*.tfstate`) and filled-in variable files with secrets never enter the repo; state lives in an encrypted remote backend with locking.
- Changes go through `plan` reviewed by the user before `apply`; destroying or replacing data stores needs explicit approval and a backup.
