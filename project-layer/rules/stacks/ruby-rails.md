---
paths:
  - "{{APP}}/**/*.{rb,erb,rake,ru,jbuilder,haml,slim}"
  - "{{APP}}/Gemfile"
kit: {"name": "Ruby on Rails", "commands": {"setup": "bin/setup --skip-server", "dev": "bin/dev", "test": "bin/rails test", "testOne": "bin/rails test <file>:<line>", "lint": "bin/rubocop", "build": "bin/rails assets:precompile", "audit": "bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error && bin/bundler-audit check --update"}}
---

# Stack: Ruby on Rails

- Check `ruby -v`, `bin/rails -v`, and Gemfile.lock before using version-specific APIs. Use binstubs (`bin/rails`).
- If the app uses RSpec, its runner (`bin/rspec`) replaces `bin/rails test` in the Profile.

## Structure
- Thin controllers; strong parameters on every write (`params.expect` on Rails 8, `require`/`permit` before);
  business logic in models or the plain Ruby objects the app already uses.
- Authorization through the app's policy layer (Pundit or Action Policy) on every action, with a base-controller
  guard that fails when an action forgets to authorize.
- Authentication: the Rails authentication generator or Devise, whichever the app uses; `has_secure_password` for custom flows.
- Database constraints mirror validations (NOT NULL, unique indexes, foreign keys). Catch N+1 with `strict_loading` or Bullet.
- Jobs (Active Job with Solid Queue or Sidekiq) are idempotent with retries configured.

## Security specifics
- Secrets in `bin/rails credentials:edit`; `config/master.key` and `config/credentials/*.key` never enter the repo.
- ERB escapes by default; `html_safe` and `raw` never on user data; `sanitize` with an allowlist.
- No string interpolation in `where`; use hash conditions or placeholders. Never `send`, `constantize`, or `public_send` with user input.
- CSRF protection stays on; `config.force_ssl = true` in production; configure the Content Security Policy initializer.
- `encrypts` for sensitive attributes; add sensitive params to `filter_parameters`.

## Testing
- Minitest or RSpec, whichever exists, with fixtures or FactoryBot on a real test database.
- Request tests for every endpoint, including 401, 403, 404, and 422.
- System tests through a real browser (Capybara with a Playwright or Cuprite driver), or Playwright from the e2e app.

## Quality gates
- RuboCop (rubocop-rails-omakase or the app's config), Brakeman with no warnings, bundler-audit. Rails 8.1+ runs
  these through `bin/ci` (steps in `config/ci.rb`); keep it the single CI entry point.
- `bin/setup` starts the dev server at the end unless given `--skip-server`; always pass it in scripts and CI.
