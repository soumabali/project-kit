---
paths:
  - "{{APP}}/**/*.py"
  - "{{APP}}/**/*.{html,jinja,j2}"
  - "{{APP}}/pyproject.toml"
kit: {"name": "Python (Django, FastAPI, Flask)", "commands": {"setup": "uv sync", "dev": "uv run fastapi dev", "test": "uv run pytest", "testOne": "uv run pytest -k <name>", "lint": "uv run ruff check . && uv run ruff format --check .", "types": "uv run mypy .", "audit": "uv run pip-audit"}, "check": {"ext": "py", "cmd": "ruff check {file}", "requires": "ruff"}}
---

# Stack: Python (Django, FastAPI, Flask)

- Use the project's tool (uv, Poetry, or pip-tools) with the lockfile committed. Check the Python and framework
  versions in pyproject.toml. For Django, `dev` is `uv run python manage.py runserver`.

## Structure
- Type hints everywhere. Validate input at the edge: Pydantic models (FastAPI), forms or serializers (Django).
  Response models never expose internal fields.
- Business logic in service modules, not views. Settings from env (pydantic-settings, django-environ), validated at startup.
- Django: `select_related` and `prefetch_related` to avoid N+1; migrations committed; `DEBUG=False`,
  `ALLOWED_HOSTS`, and `SECRET_KEY` from env; `python manage.py check --deploy` clean.
- FastAPI: auth through dependencies (`Depends`) on every protected route; `response_model` on every route;
  no blocking calls inside async paths.
- HTTP clients (`httpx`, `requests`) always pass a timeout.

## Security specifics
- No `eval` or `exec`; no `pickle` or `yaml.load` on untrusted data (use `yaml.safe_load`); `subprocess` with
  argument lists and never `shell=True`; `defusedxml` for XML.
- Raw SQL only with parameters (`cursor.execute(sql, params)`). Templates keep autoescape on; `mark_safe` never on user data.
- Passwords through Django's hashers or argon2 or bcrypt libraries; tokens from the `secrets` module.

## Testing
- pytest (with pytest-django, or FastAPI's TestClient or httpx `AsyncClient`), factory_boy, and a real database
  from the compose service or Testcontainers.
- Endpoint tests include 401, 403, 404, and 422. Hypothesis for parsers and core logic.
- Browser flows through Playwright for Python or the e2e app.

## Quality gates
- Ruff (lint and format), mypy or pyright (strict for new code), pytest-cov, pip-audit, Bandit.
