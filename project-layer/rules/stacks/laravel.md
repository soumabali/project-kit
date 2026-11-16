---
paths:
  - "{{APP}}/**/*.php"
  - "{{APP}}/composer.json"
  - "{{APP}}/resources/js/**/*.{ts,tsx,js,jsx,vue,svelte}"
kit: {"name": "Laravel", "commands": {"setup": "composer run setup", "dev": "composer run dev", "test": "composer test", "testOne": "php artisan config:clear && php artisan test --filter=<Name>", "lint": "vendor/bin/pint --test", "types": "vendor/bin/phpstan analyse", "build": "npm run build", "audit": "composer audit"}, "check": {"ext": "php", "cmd": "php -l {file}", "requires": "php"}}
---

# Stack: Laravel (PHP)

- Invoke `timedoor-laravel:laravel-standards` before reading or editing this app's code. Its code conventions
  (structure, naming, API response envelope) win over this file; the kit's security and test gates still apply. If
  it isn't installed, say so and apply the rules below.
- Check the installed version (`php artisan --version`, composer.lock) before using version-specific APIs.

## Structure
- Thin controllers: FormRequest (validation and `authorize()`) → Action or Service class → Eloquent → API Resource
  for every response.
- Authorization through Policies and Gates (`Gate::authorize()`, `can:` middleware). Ownership checks never live
  only in a controller.
- Models declare `$fillable` explicitly (never `$guarded = []`), `$hidden` for passwords, tokens, and secrets, and
  casts and enums for status fields.
- `DB::transaction()` for multi-write operations; `lockForUpdate()` for check-then-write races; unique indexes for invariants.
- Queued jobs are idempotent, use `ShouldBeUnique` where duplicate runs cause harm, and set `$tries`, `backoff`, and failure handling.
- Read config only through `config()`; call `env()` only inside `config/` files. Production runs `php artisan config:cache`;
  never cache config locally, because `RefreshDatabase` then migrates whatever database the cache names. Run tests
  with `composer test` (Laravel 12+) or `php artisan config:clear && php artisan test`; both clear the cache first.
- In `AppServiceProvider::boot()`: `Model::shouldBeStrict(! app()->isProduction());`.

## Security specifics
- Blade output uses `{{ }}`. Never `{!! !!}` with user data. `DB::raw()` and `whereRaw()` only with bindings.
- Sanctum tokens get an expiry and abilities. Passport keys and `APP_KEY` never enter the repo.
- Uploads validate `mimes` or `mimetypes` and `max`, are stored on a non-public disk, and are served with `Storage::temporaryUrl()`.
- Outside local: `APP_DEBUG=false`, `APP_ENV=production`. Apply `throttle` middleware to auth and heavy routes.

## Testing
- Pest or PHPUnit, whichever the app uses, with `RefreshDatabase` against a real test database (MySQL or Postgres
  from docker compose, matching production) and factories with states.
- Every endpoint gets feature tests for the happy path, 401, 403 (another user's resource), 404, and 422 per rule.
  Assert the JSON structure and that sensitive fields are absent (`assertJsonMissingPath('data.password')`).
- `Http::preventStrayRequests()`; fake Http, Mail, Queue, Notification, Event, and Storage; control time with `travelTo()`.
- Browser flows: Playwright from the e2e app against the running stack (Dusk only if the project already uses it).

## Quality gates
- Pint (`--test` in CI), Larastan (`larastan/larastan`, added in Phase 00; the skeleton has none) at the level in `phpstan.neon` (raise it, never lower it; no new
  baseline entries), `composer audit`.
