---
paths:
  - "{{APP}}/**/*.php"
  - "{{APP}}/**/*.twig"
  - "{{APP}}/composer.json"
  - "{{APP}}/config/**/*.{yaml,yml}"
kit: {"name": "PHP (Symfony, WordPress, plain)", "commands": {"setup": "composer install", "dev": "php -S localhost:8000 -t public", "test": "vendor/bin/phpunit", "testOne": "vendor/bin/phpunit --filter <Name>", "lint": "vendor/bin/php-cs-fixer fix --dry-run --diff", "types": "vendor/bin/phpstan analyse", "audit": "composer audit"}, "check": {"ext": "php", "cmd": "php -l {file}", "requires": "php"}}
---

# Stack: PHP (Symfony, WordPress, plain PHP)

- Laravel apps use the Laravel rules instead. Check the PHP version (`php -v`, composer.json `require.php`).
- `declare(strict_types=1);` in new files; PSR-4 autoloading; PSR-12 style through the formatter, not by hand.

## Data and security
- PDO or Doctrine with prepared statements only; never interpolate input into SQL.
- Passwords with `password_hash()` and `password_verify()` (`PASSWORD_DEFAULT` or `PASSWORD_ARGON2ID`).
- Escape output with the template engine (Twig auto-escaping) or `htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`.
- `session_regenerate_id(true)` on login; session cookies `HttpOnly`, `Secure`, `SameSite`.
- CSRF tokens on every state-changing form. Uploads: check MIME with `finfo`, enforce size, store outside the web root.
- `display_errors=Off` outside local; log errors instead. Never `include` or `require` a path built from input.

## Symfony
- Security voters and `#[IsGranted]` for authorization; Form and Validator constraints on input; Doctrine
  Migrations; DTOs with serializer groups (never serialize entities directly).
- Symfony commits `.env` and `.env.test` with non-secret defaults; real secrets go in `.env.local` (git-ignored) or
  the secrets vault (`secrets:set`). The kit blocks Claude from reading `.env*` files, so ask the user for values,
  and when the app commits them, re-include them in `.gitignore` (`!<app path>/.env`, `!<app path>/.env.test`).

## WordPress
- Every action checks a nonce (`wp_verify_nonce`, `check_ajax_referer`) and a capability (`current_user_can`).
- `$wpdb->prepare()` for every query; sanitize early (`sanitize_text_field`, `absint`), escape late (`esc_html`,
  `esc_attr`, `esc_url`, `wp_kses_post`).
- Never edit WordPress core or third-party plugins; extend with your own plugin or child theme.

## Testing
- PHPUnit or Pest; Symfony `WebTestCase` with a real test database; WordPress `WP_UnitTestCase` or Playwright
  against `wp-env`. Endpoint tests include 401, 403, 404, and validation failures. Browser flows through Playwright.

## Quality gates
- PHP-CS-Fixer or PHP_CodeSniffer, PHPStan or Psalm at the configured level (raise it, never lower it), `composer audit`.
