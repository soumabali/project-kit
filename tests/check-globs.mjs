// Installs the kit into a temporary project, then checks which rendered rules load for representative files.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-globs-'));
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'kit.mjs'), 'install', '--project-dir', tmp, '--name', 'Globs',
  '--app', 'api=laravel:07-application/api', '--app', 'web=nextjs:07-application/web', '--app', 'shop=nuxt:07-application/shop',
  '--app', 'mobile=flutter:07-application/mobile', '--app', 'svc=go:07-application/svc', '--app', 'e2e=playwright:07-application/e2e',
  '--app', 'agent=node-typescript+mcp:07-application/agent',
  '--app', 'py=python:07-application/py', '--app', 'rails=ruby-rails:07-application/rails', '--app', 'cc=claude-code:07-application/cc'], { encoding: 'utf8' });
if (run.status !== 0) { console.error(run.stderr || run.stdout); process.exit(1); }

const rulesDir = path.join(tmp, '.claude', 'rules', 'kit');
const rules = {};
for (const f of fs.readdirSync(rulesDir)) {
  const text = fs.readFileSync(path.join(rulesDir, f), 'utf8');
  if (/\{\{APP\}\}|^kit:/m.test(text)) { console.error(`    ${f}: unrendered placeholder or kit metadata left`); process.exit(1); }
  rules[f] = [...text.split('\n---')[0].matchAll(/^\s+-\s+"(.*)"$/gm)].map((m) => m[1]);
}

const cases = {
  '07-application/api/app/Http/Controllers/BookingController.php': ['api', 'security', 'stack-laravel'],
  '07-application/api/app/Models/Booking.php': ['database', 'security', 'stack-laravel'],
  '07-application/api/database/migrations/2026_10_01_create_bookings.php': ['database', 'security', 'stack-laravel'],
  '07-application/api/resources/views/home.blade.php': ['security', 'stack-laravel', 'ui-ux'],
  '07-application/api/resources/js/pages/Bookings.vue': ['security', 'stack-laravel', 'ui-ux'],
  '07-application/api/tests/Feature/BookingTest.php': ['security', 'stack-laravel', 'testing'],
  '07-application/web/src/app/bookings/page.tsx': ['security', 'stack-nextjs', 'ui-ux'],
  '07-application/web/src/app/api/bookings/route.ts': ['api', 'security', 'stack-nextjs'],
  '07-application/web/src/app/bookings/export/route.ts': ['api', 'security', 'stack-nextjs'],
  '07-application/shop/app/pages/index.vue': ['security', 'stack-nuxt', 'ui-ux'],
  '07-application/shop/server/api/cart.post.ts': ['api', 'security', 'stack-nuxt'],
  '07-application/mobile/lib/screens/home.dart': ['security', 'stack-flutter', 'ui-ux'],
  '07-application/mobile/lib/blocs/booking_bloc.dart': ['security', 'stack-flutter'],
  '07-application/mobile/integration_test/app_test.dart': ['security', 'stack-flutter', 'testing'],
  '07-application/mobile/android/app/src/main/AndroidManifest.xml': ['security', 'stack-flutter'],
  '07-application/svc/internal/booking/handler.go': ['api', 'security', 'stack-go'],
  '07-application/svc/internal/booking/store.go': ['security', 'stack-go'],
  '07-application/svc/internal/store/bookings.go': ['database', 'security', 'stack-go'],
  '07-application/mobile/lib/features/booking/presentation/bloc/booking_bloc.dart': ['security', 'stack-flutter'],
  '07-application/mobile/lib/features/booking/presentation/widgets/booking_card.dart': ['security', 'stack-flutter', 'ui-ux'],
  '07-application/agent/src/legacy/client.cjs': ['security', 'stack-mcp', 'stack-node-typescript'],
  '07-application/svc/internal/booking/handler_test.go': ['api', 'security', 'stack-go', 'testing'],
  '07-application/py/bookings/views.py': ['api', 'security', 'stack-python'],
  '07-application/py/bookings/models.py': ['database', 'security', 'stack-python'],
  '07-application/rails/config/routes.rb': ['api', 'security', 'stack-ruby-rails'],
  '07-application/rails/app/views/bookings/index.json.jbuilder': ['security', 'stack-ruby-rails'],
  '07-application/e2e/tests/flows/booking.spec.ts': ['security', 'stack-playwright', 'testing'],
  '07-application/agent/src/tools/search.ts': ['security', 'stack-mcp', 'stack-node-typescript'],
  '07-application/agent/README.md': [],
  '07-application/cc/.claude-plugin/plugin.json': ['stack-claude-code'],
  '07-application/cc/skills/deploy/SKILL.md': ['stack-claude-code'],
  '07-application/cc/skills/deploy/reference.md': ['stack-claude-code'],
  '07-application/cc/agents/reviewer.md': ['stack-claude-code'],
  '07-application/cc/commands/status.md': ['stack-claude-code'],
  '07-application/cc/.claude/agents/helper.md': ['stack-claude-code'],
  '07-application/cc/.claude/skills/notes/template.txt': ['stack-claude-code'],
  '07-application/cc/agents/notes.txt': [],
  '07-application/cc/hooks/hooks.json': ['stack-claude-code'],
  '07-application/cc/scripts/guard.sh': ['security', 'stack-claude-code'],
  '07-application/cc/evals/deploy-triggers/prompt.md': ['stack-claude-code'],
  '07-application/cc/README.md': [],
  '06-technical-docs/api/openapi.yaml': ['api'],
  '06-technical-docs/data-model.md': ['database'],
  'DESIGN.md': ['ui-ux'],
  'docker-compose.yml': ['infra'],
  'compose.yaml': ['infra'],
  '07-application/api/Dockerfile': ['infra'],
  'infra/main.tf': ['infra'],
  '.github/workflows/ci.yml': ['infra'],
  '02-prd/prd-booking-v1.md': [],
  '05-progress/STATUS.md': [],
};

let failures = 0;
for (const [file, expected] of Object.entries(cases)) {
  const got = Object.entries(rules).filter(([, pats]) => pats.some((p) => path.matchesGlob(file, p))).map(([f]) => f.replace(/\.md$/, '')).sort();
  if (JSON.stringify(got) !== JSON.stringify([...expected].sort())) {
    failures++;
    console.error(`    ${file}\n      got: ${got.join(', ') || '(none)'}\n      want: ${expected.join(', ') || '(none)'}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (failures) { console.error(`  ${failures} glob case(s) failed`); process.exit(1); }
