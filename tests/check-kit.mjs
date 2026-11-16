// Scenario tests for scripts/kit.mjs: install, idempotency, settings merge, sync safety, add-app, adoption, doctor.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // a file URL's pathname is not a path on Windows
const KIT = path.join(root, 'scripts', 'kit.mjs');
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error(`    ${msg}`); } };
// The kit keeps per-machine state (starters, approved quick checks) in its home folder; tests get their own.
process.env.PROJECT_KIT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-home-'));
process.on('exit', () => fs.rmSync(process.env.PROJECT_KIT_HOME, { recursive: true, force: true }));
const kit = (dir, ...args) => spawnSync(process.execPath, [KIT, ...args, '--project-dir', dir], { encoding: 'utf8' });
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const fresh = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-'));
  spawnSync('git', ['init', '-q'], { cwd: d });
  return d;
};
const APPS = ['--app', 'api=laravel:07-application/api', '--app', 'web=nextjs:07-application/web'];

// 1. Fresh install
{
  const d = fresh();
  write(d, '.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash(npm run test)'], deny: ['Read(!.env.example)', 'Read(./private/**)'] }, model: 'sonnet' }));
  const r = kit(d, 'install', '--name', 'Demo', ...APPS);
  check(r.status === 0, `install failed: ${r.stderr}`);
  const claude = read(d, 'CLAUDE.md');
  check(claude.includes('# Demo') && claude.includes('project-kit:core:begin') && claude.includes('project-kit:profile:end'), 'CLAUDE.md missing title or markers');
  check(!/\{\{[A-Z_]+\}\}/.test(claude), 'CLAUDE.md has unrendered placeholders');
  check(claude.includes('| api | `07-application/api` | Laravel |'), 'CLAUDE.md app rows missing');
  check(fs.existsSync(path.join(d, '.claude/rules/kit/stack-laravel.md')) && fs.existsSync(path.join(d, '.claude/rules/kit/stack-nextjs.md')), 'stack rules missing');
  check(!fs.existsSync(path.join(d, '.claude/rules/kit/stack-go.md')), 'unused stack rule installed');
  check(fs.existsSync(path.join(d, '05-progress/STATUS.md')) && fs.existsSync(path.join(d, 'CHANGELOG.md')), 'STATUS.md or CHANGELOG.md missing');
  const s = JSON.parse(read(d, '.claude/settings.json'));
  check(s.model === 'sonnet' && s.permissions.allow.includes('Bash(npm run test)'), 'existing settings not preserved');
  check(s.permissions.deny.includes('Read(./private/**)') && s.permissions.deny.includes('Read(.env)'), 'deny rules not merged');
  const deny = s.permissions.deny;
  check(deny.indexOf('Read(!.env.example)') > deny.indexOf('Read(.env.*)'), 'the .env.example exception must come after the rule it carves from');
  check(deny.indexOf('Read(!.env.example)') < deny.indexOf('Read(./private/**)'), "merge reordered the project's own deny rules");
  check(read(d, '.gitignore').includes('!.env.example'), '.gitignore block missing');
  const again = kit(d, 'install', ...APPS);
  check(again.status === 2, 'second install without --force should refuse');

  // 2. Sync with nothing to do
  const s1 = kit(d, 'sync');
  check(s1.status === 0 && /already up to date/.test(s1.stdout), `clean sync should be a no-op: ${s1.stdout}`);

  // 3. Locally edited kit file is protected; --force overwrites with a backup
  const rule = '.claude/rules/kit/stack-laravel.md';
  write(d, rule, `${read(d, rule)}\n- A local tweak.\n`);
  const s2 = kit(d, 'sync');
  check(s2.status === 1 && /skipped\s+\.claude\/rules\/kit\/stack-laravel\.md/.test(s2.stdout), 'edited rule should be skipped');
  check(read(d, rule).includes('A local tweak.'), 'edited rule was overwritten without --force');
  const s3 = kit(d, 'sync', '--force');
  check(s3.status === 0 && !read(d, rule).includes('A local tweak.') && fs.existsSync(path.join(d, `${rule}.orig`)), '--force should overwrite and keep a .orig backup');

  // 4. A pristine file from an older kit version gets updated
  const manifestPath = '.claude/project-kit.json';
  const m = JSON.parse(read(d, manifestPath));
  const tpl = '.claude/templates/task.md';
  write(d, tpl, 'old template\n');
  m.files[tpl] = sha('old template\n');
  // Simulate an older core block, and a project edit in the profile block that sync must keep.
  const cur = read(d, 'CLAUDE.md');
  const b = cur.indexOf('<!-- project-kit:core:begin'), e = cur.indexOf('<!-- project-kit:core:end -->') + '<!-- project-kit:core:end -->'.length;
  const oldCore = '<!-- project-kit:core:begin v0.9.0 -->\nold rules\n<!-- project-kit:core:end -->';
  write(d, 'CLAUDE.md', cur.slice(0, b).replace('**What:** TBD', '**What:** A booking app') + oldCore + cur.slice(e));
  m.coreHash = sha(oldCore);
  m.kitVersion = '0.9.0';
  write(d, manifestPath, JSON.stringify(m));
  const s4 = kit(d, 'sync');
  check(s4.status === 0, `upgrade sync failed: ${s4.stdout}${s4.stderr}`);
  check(read(d, tpl) !== 'old template\n', 'pristine template was not updated');
  const after = read(d, 'CLAUDE.md');
  check(!after.includes('old rules') && after.includes('### 1. Every session'), 'core block was not updated');
  check(after.includes('**What:** A booking app'), 'sync changed the project-owned profile block');
  check(JSON.parse(read(d, manifestPath)).kitVersion !== '0.9.0', 'manifest version not bumped');
  check(/kit sync v0\.9\.0/.test(read(d, '05-progress/log.md')), 'sync not logged');

  // 5. add-app renders the new stack and widens core rule paths
  const a = kit(d, 'add-app', '--app', 'mobile=flutter:07-application/mobile');
  check(a.status === 0 && fs.existsSync(path.join(d, '.claude/rules/kit/stack-flutter.md')), 'add-app did not add the stack rule');
  check(read(d, '.claude/rules/kit/security.md').includes('07-application/mobile/'), 'core rules not widened to the new app');
  check(/\| mobile \|/.test(a.stdout), 'add-app should print profile rows');

  // 6. doctor: clean repo passes, a tracked .env fails
  const doc = kit(d, 'doctor');
  check(doc.status === 0, `doctor should pass on a fresh install:\n${doc.stdout}`);
  write(d, '.env', 'SECRET=1\n');
  spawnSync('git', ['add', '-f', '.env'], { cwd: d });
  const doc2 = kit(d, 'doctor');
  check(doc2.status === 1 && /FAIL\s+secret-like files are tracked/.test(doc2.stdout), 'doctor should fail when .env is tracked');
  fs.rmSync(d, { recursive: true, force: true });
}

// 7. Adopting a repo that already has CLAUDE.md, AGENTS.md handling, and an app at the repo root
{
  const d = fresh();
  write(d, 'CLAUDE.md', '# Existing rules\n- Use tabs.\n');
  const r1 = kit(d, 'install', '--app', 'site=laravel:.');
  check(r1.status === 2 && /--merge-claude-md/.test(r1.stderr), 'existing CLAUDE.md should require --merge-claude-md');
  check(!fs.existsSync(path.join(d, '.claude/project-kit.json')), 'refused install must not write files');
  const r2 = kit(d, 'install', '--app', 'site=laravel:.', '--merge-claude-md');
  check(r2.status === 0, `merge install failed: ${r2.stderr}`);
  const t = read(d, 'CLAUDE.md');
  check(t.startsWith('# Existing rules') && t.includes('project-kit:core:begin'), 'merge should keep existing content first');
  check(read(d, '.claude/rules/kit/stack-laravel.md').includes('  - "**/*.php"'), 'root app path should render as **/*.php');
  fs.rmSync(d, { recursive: true, force: true });

  const d2 = fresh();
  write(d2, 'AGENTS.md', '# Shared agent rules\n');
  check(kit(d2, 'install', '--app', 'web=nextjs:apps/web').status === 0, 'install with AGENTS.md failed');
  check(read(d2, 'CLAUDE.md').startsWith('@AGENTS.md'), 'CLAUDE.md should import AGENTS.md first');
  fs.rmSync(d2, { recursive: true, force: true });
}

// 8. Bad input is rejected
{
  const d = fresh();
  check(kit(d, 'install', '--app', 'x=cobol:src').status === 2, 'unknown stack accepted');
  check(kit(d, 'install', '--app', 'x=go:../outside').status === 2, 'path outside the project accepted');
  check(kit(d, 'install', '--app', 'x=go:a', '--app', 'x=go:b').status === 2, 'duplicate app names accepted');
  check(kit(d, 'install').status === 2, 'install without --app or --auto accepted');
  check(kit(d, 'install', '--app', 'x=go:src/we"ird').status === 2, 'path with a quote accepted');
  fs.rmSync(d, { recursive: true, force: true });
}

// 9. detect: stacks from markers in app folders, the MCP add-on, root apps, workspace roots, unsupported stacks
const detected = (d) => {
  const r = kit(d, 'detect', '--json');
  check(r.status === 0, `detect failed: ${r.stderr}`);
  const found = JSON.parse(r.stdout);
  return { apps: found.apps.map(a => `${a.name}=${a.stacks.join('+')}:${a.path}`).sort().join(' '), notes: found.notes };
};
{
  const d = fresh();
  write(d, '07-application/api/artisan', '');
  write(d, '07-application/api/composer.json', '{}');
  write(d, '07-application/web/package.json', JSON.stringify({ dependencies: { next: '15.0.0', react: '19.0.0' } }));
  write(d, 'apps/agent/package.json', JSON.stringify({ dependencies: { '@modelcontextprotocol/sdk': '1.20.0' } }));
  write(d, 'apps/tools/package.json', JSON.stringify({ dependencies: { zod: '3.0.0' }, devDependencies: { '@modelcontextprotocol/inspector': '0.17.0' } }));
  write(d, 'services/assistant/pyproject.toml', '[project]\nname = "assistant"\ndependencies = ["mcp[cli]>=1.6", "httpx"]\n');
  write(d, 'services/git/pyproject.toml', '[project]\nname = "git"\ndependencies = ["mcp-server-git>=1.0"]\n');
  write(d, 'services/billing/go.mod', 'module example.com/billing\n\ngo 1.25\n');
  write(d, 'services/catalog/pom.xml', '<project/>');
  write(d, 'services/shop/Gemfile', "source 'https://rubygems.org'\ngem 'rails', '~> 8.0'\n");
  write(d, 'services/payments/Payments.csproj', '<Project><ItemGroup><PackageReference Include="ModelContextProtocol" Version="0.4.0" /></ItemGroup></Project>');
  write(d, 'mobile/pubspec.yaml', 'name: app\n');
  write(d, 'e2e/package.json', JSON.stringify({ devDependencies: { '@playwright/test': '1.63.0' } }));
  write(d, 'e2e/playwright.config.ts', 'export default {};\n');
  write(d, 'site/index.html', '<!doctype html>\n');
  write(d, 'apps/android/build.gradle.kts', '');
  write(d, 'apps/android/app/src/main/AndroidManifest.xml', '<manifest/>');
  write(d, 'apps/engine/Cargo.toml', '[package]\nname = "engine"\n\n[dependencies]\naxum = "0.8"\n');
  write(d, 'apps/bridge/Cargo.toml', '[package]\nname = "bridge"\n\n[dependencies]\nrmcp = { version = "0.8", features = ["server"] }\n');
  write(d, 'apps/live/mix.exs', '');
  write(d, 'apps/we#ird/go.mod', 'module weird\n');
  const want = [
    'agent=node-typescript+mcp:apps/agent', 'api=laravel:07-application/api', 'assistant=python+mcp:services/assistant',
    'billing=go:services/billing', 'bridge=rust+mcp:apps/bridge', 'catalog=java-spring:services/catalog', 'e2e=playwright:e2e',
    'engine=rust:apps/engine', 'git=python:services/git',
    'mobile=flutter:mobile', 'payments=dotnet+mcp:services/payments', 'shop=ruby-rails:services/shop',
    'site=html-css:site', 'tools=node-typescript:apps/tools', 'web=nextjs:07-application/web',
  ].join(' ');
  const got = detected(d);
  check(got.apps === want, `detect found:\n      ${got.apps}\n    wanted:\n      ${want}`);
  check(got.notes.some(n => n.startsWith('apps/android: Android app')) && got.notes.some(n => n.startsWith('apps/live: Elixir')), `detect notes: ${got.notes}`);
  check(got.notes.some(n => n.startsWith('apps/we#ird: skipped')), 'a folder name unsafe for globs should be skipped with a note');
  const human = kit(d, 'detect');
  check(/Install flags: --app api=laravel:07-application\/api/.test(human.stdout), 'detect should print install flags');
  fs.rmSync(d, { recursive: true, force: true });

  // An app at the root: its own folders (here a Vite index.html in web/) are not separate apps.
  const r = fresh();
  write(r, 'artisan', '');
  write(r, 'composer.json', '{}');
  write(r, 'package.json', JSON.stringify({ devDependencies: { vite: '7.0.0' } }));
  write(r, 'web/index.html', '<!doctype html>\n');
  write(r, 'mobile/pubspec.yaml', 'name: m\n');
  check(detected(r).apps === 'app=laravel:. mobile=flutter:mobile', `root app detection: ${detected(r).apps}`);
  fs.rmSync(r, { recursive: true, force: true });

  // A JavaScript workspace root is not an app; its workspaces are.
  const w = fresh();
  write(w, 'package.json', JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'] }));
  write(w, 'apps/web/package.json', JSON.stringify({ dependencies: { nuxt: '4.0.0' } }));
  write(w, 'packages/ui/package.json', JSON.stringify({ name: '@acme/ui' }));
  check(detected(w).apps === 'ui=node-typescript:packages/ui web=nuxt:apps/web', `workspace detection: ${detected(w).apps}`);
  fs.rmSync(w, { recursive: true, force: true });
}

// 10. install --auto: detected apps, zero apps allowed, never over an existing CLAUDE.md, too many apps refused
{
  const d = fresh();
  write(d, 'web/package.json', JSON.stringify({ dependencies: { next: '15.0.0' } }));
  const r = kit(d, 'install', '--auto');
  check(r.status === 0 && /^Apps: web=nextjs:web$/m.test(r.stdout), `auto install failed: ${r.stdout}${r.stderr}`);
  check(read(d, 'CLAUDE.md').includes('| web | `web` | Next.js (React) |'), 'auto install did not list the detected app');
  check(/kit install v[\d.]+ \(automatic\): web=nextjs/.test(read(d, '05-progress/log.md')), 'auto install not logged');
  fs.rmSync(d, { recursive: true, force: true });

  const e = fresh();
  const r2 = kit(e, 'install', '--auto');
  check(r2.status === 0 && /^Apps: none detected$/m.test(r2.stdout), `auto install with no apps failed: ${r2.stdout}${r2.stderr}`);
  const claude = read(e, 'CLAUDE.md');
  check(claude.includes('| TBD | TBD | TBD | TBD |') && !/\{\{[A-Z_]+\}\}/.test(claude), 'no-app profile should have TBD rows');
  check(read(e, '.claude/rules/kit/security.md').includes('  - "**/*.{php,'), 'with no apps, core rules should cover the whole repo');
  check(/warn\s+no apps yet/.test(kit(e, 'doctor').stdout), 'doctor should warn when there are no apps');

  // While the profile is unedited, add-app and remove-app keep its tables current.
  const a = kit(e, 'add-app', '--app', 'api=go:services/api');
  const c2 = read(e, 'CLAUDE.md');
  check(a.status === 0 && /now list the new app/.test(a.stdout), `add-app should update an unedited profile: ${a.stdout}`);
  check(c2.includes('| api | `services/api` | Go |') && !c2.includes('| TBD | TBD | TBD | TBD |'), 'profile tables not updated');
  check(read(e, '.claude/rules/kit/security.md').includes('services/api/**/*.{php'), 'core rules not narrowed to the new app');
  write(e, 'CLAUDE.md', c2.replace('**What:** TBD (what it is and who it serves, one sentence)', '**What:** A shop'));
  const b = kit(e, 'add-app', '--app', 'web=nuxt:apps/web');
  check(b.status === 0 && /Add these rows/.test(b.stdout) && !read(e, 'CLAUDE.md').includes('| web |'), 'add-app changed an edited profile');
  const rm = kit(e, 'remove-app', 'web');
  check(rm.status === 0 && /Remove the rows for web/.test(rm.stdout), `remove-app failed: ${rm.stdout}${rm.stderr}`);
  check(!fs.existsSync(path.join(e, '.claude/rules/kit/stack-nuxt.md')), 'remove-app left the stack rule');
  check(JSON.parse(read(e, '.claude/project-kit.json')).apps.map(x => x.name).join() === 'api', 'remove-app did not update the manifest');
  check(kit(e, 'remove-app', 'nope').status === 2, 'remove-app accepted an unknown app');
  fs.rmSync(e, { recursive: true, force: true });

  const m = fresh();
  write(m, 'CLAUDE.md', '# Mine\n');
  check(kit(m, 'install', '--auto').status === 2, 'auto install should refuse when CLAUDE.md exists');
  check(read(m, 'CLAUDE.md') === '# Mine\n' && !fs.existsSync(path.join(m, '.claude')), 'refused auto install wrote files');
  check(kit(m, 'install', '--auto', '--app', 'x=go:x').status === 2, '--auto with --app accepted');
  fs.rmSync(m, { recursive: true, force: true });

  const big = fresh();
  for (let i = 1; i <= 13; i++) write(big, `apps/app${i}/go.mod`, `module app${i}\n`);
  const r3 = kit(big, 'install', '--auto');
  check(r3.status === 2 && /found 13 apps/.test(r3.stderr) && !fs.existsSync(path.join(big, 'CLAUDE.md')), 'auto install should refuse too many apps');
  fs.rmSync(big, { recursive: true, force: true });
}

// 11. uninstall restores the repo, keeps edited files and project text, and records the skip
const snapshot = (dir) => {
  const out = {};
  for (const rel of fs.readdirSync(dir, { recursive: true }).map(String).sort()) {
    if (rel === '.git' || rel.startsWith(`.git${path.sep}`)) continue;
    const abs = path.join(dir, rel);
    out[rel] = fs.statSync(abs).isDirectory() ? '<dir>' : fs.readFileSync(abs, 'utf8');
  }
  return JSON.stringify(out);
};
{
  const d = fresh();
  write(d, '.gitignore', 'node_modules\n');
  write(d, '.claude/settings.json', `${JSON.stringify({ model: 'sonnet', permissions: { deny: ['Read(.env)'] } }, null, 2)}\n`);
  write(d, 'README.md', '# app\n');
  const before = snapshot(d);
  check(kit(d, 'install', '--app', 'api=go:api').status === 0, 'install before uninstall failed');
  check(kit(d, 'uninstall', '--dry-run').status === 0 && fs.existsSync(path.join(d, 'CLAUDE.md')), 'uninstall --dry-run changed files');
  const u = kit(d, 'uninstall');
  check(u.status === 0, `uninstall failed: ${u.stderr}`);
  check(snapshot(d) === before, `uninstall should restore the repo exactly:\n${u.stdout}`);
  fs.rmSync(d, { recursive: true, force: true });

  const e = fresh();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-data-'));
  write(e, 'CLAUDE.md', '# Team rules\n- Use tabs.\n');
  check(kit(e, 'install', '--app', 'api=go:api', '--merge-claude-md').status === 0, 'merge install failed');
  write(e, '05-progress/STATUS.md', 'my status\n');
  const u2 = kit(e, 'uninstall', '--data-dir', data);
  check(read(e, 'CLAUDE.md') === '# Team rules\n- Use tabs.\n', 'uninstall should give a merged CLAUDE.md its own content back');
  check(read(e, '05-progress/STATUS.md') === 'my status\n' && /kept\s+05-progress\/STATUS\.md/.test(u2.stdout), 'uninstall removed an edited file');
  check(read(data, 'skipped-projects.txt').split('\n').includes(e), 'uninstall --data-dir did not record the skip');
  check(kit(e, 'skip', '--data-dir', data).status === 0 && read(data, 'skipped-projects.txt').split('\n').filter(l => l === e).length === 1, 'skip duplicated an entry');
  check(kit(e, 'skip').status === 2, 'skip without --data-dir accepted');
  fs.rmSync(e, { recursive: true, force: true });
  fs.rmSync(data, { recursive: true, force: true });

  const f = fresh();
  check(kit(f, 'install', '--app', 'api=go:api').status === 0, 'install failed');
  write(f, 'CLAUDE.md', read(f, 'CLAUDE.md').replace('**What:** TBD (what it is and who it serves, one sentence)', '**What:** A shop'));
  check(kit(f, 'uninstall').status === 0, 'uninstall with an edited profile failed');
  const t = read(f, 'CLAUDE.md');
  check(t.includes('**What:** A shop') && !t.includes('project-kit:') && !t.includes('## How We Work'), 'uninstall should keep edited profile text and drop the kit blocks');
  fs.rmSync(f, { recursive: true, force: true });
}

// 12. Safety: existing files survive install, sync, and uninstall; nothing is half-written; the manifest is checked
{
  // A template from an earlier kit stays as it is, is never recorded as kit-owned, and survives sync and uninstall.
  const d = fresh();
  write(d, '.claude/templates/task.md', 'our own task template\n');
  const r = kit(d, 'install', '--app', 'api=go:api');
  check(r.status === 0 && /kept\s+\.claude\/templates\/task\.md/.test(r.stdout), `install should keep an existing template: ${r.stdout}`);
  check(read(d, '.claude/templates/task.md') === 'our own task template\n', 'install overwrote an existing template');
  check(!JSON.parse(read(d, '.claude/project-kit.json')).files['.claude/templates/task.md'], 'an existing template was recorded as kit-owned');
  kit(d, 'sync');
  check(read(d, '.claude/templates/task.md') === 'our own task template\n', 'sync overwrote an existing template');
  kit(d, 'sync');
  check(read(d, '.claude/templates/task.md') === 'our own task template\n', 'a second sync overwrote an existing template');
  kit(d, 'uninstall');
  check(read(d, '.claude/templates/task.md') === 'our own task template\n', 'uninstall removed an existing template');
  fs.rmSync(d, { recursive: true, force: true });

  // An edited rule that leaves the kit and comes back stays protected.
  const e = fresh();
  kit(e, 'install', '--app', 'web=nuxt:apps/web');
  write(e, '.claude/rules/kit/stack-nuxt.md', 'our nuxt rules\n');
  kit(e, 'remove-app', 'web');
  kit(e, 'add-app', '--app', 'site=nuxt:apps/site');
  kit(e, 'sync');
  kit(e, 'sync');
  check(read(e, '.claude/rules/kit/stack-nuxt.md') === 'our nuxt rules\n', 'an edited rule was overwritten after remove-app and add-app');
  fs.rmSync(e, { recursive: true, force: true });

  // A manifest naming files outside the kit's folders is refused before anything is touched.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-outside-'));
  write(outside, 'victim.txt', 'keep me\n');
  const f = fresh();
  kit(f, 'install', '--app', 'api=go:api');
  const m = JSON.parse(read(f, '.claude/project-kit.json'));
  m.files[path.relative(f, path.join(outside, 'victim.txt'))] = sha('keep me\n');
  write(f, '.claude/project-kit.json', JSON.stringify(m));
  for (const c of [['sync'], ['uninstall'], ['remove-app', 'api']]) {
    const res = kit(f, ...c);
    check(res.status === 2 && /refusing to continue/.test(res.stderr), `${c[0]} accepted a manifest path outside the kit`);
  }
  check(read(outside, 'victim.txt') === 'keep me\n', 'a file outside the project was touched');
  fs.rmSync(f, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });

  // A settings file that isn't valid JSON stops install before the first write.
  const g = fresh();
  write(g, '.claude/settings.json', '{ "model": "sonnet", }\n');
  const r2 = kit(g, 'install', '--auto');
  check(r2.status === 2 && /not valid JSON/.test(r2.stderr), 'install should refuse an invalid settings.json');
  check(!fs.existsSync(path.join(g, 'CLAUDE.md')) && !fs.existsSync(path.join(g, '01-ideas')), 'a refused install left files behind');
  fs.rmSync(g, { recursive: true, force: true });

  // CLAUDE.md as a symbolic link is never written through.
  const h = fresh();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-link-'));
  fs.symlinkSync(path.join(target, 'elsewhere.md'), path.join(h, 'CLAUDE.md'));
  check(kit(h, 'install', '--auto').status === 2, 'auto install accepted a dangling CLAUDE.md link');
  check(kit(h, 'install', '--app', 'api=go:api', '--merge-claude-md').status === 2, 'install wrote through a CLAUDE.md link');
  check(!fs.existsSync(path.join(target, 'elsewhere.md')), 'a file was created through a symbolic link');
  fs.rmSync(h, { recursive: true, force: true });

  // A folder on the way that links elsewhere stops the whole install before the first write.
  const l = fresh();
  fs.mkdirSync(path.join(l, '.claude'));
  fs.symlinkSync(target, path.join(l, '.claude', 'rules'));
  const r3 = kit(l, 'install', '--app', 'api=go:api');
  check(r3.status === 2 && /symbolic link/.test(r3.stderr), 'install wrote through a linked folder');
  check(fs.readdirSync(target).length === 0 && !fs.existsSync(path.join(l, 'CLAUDE.md')), 'a refused install wrote files');
  fs.rmSync(l, { recursive: true, force: true });
  fs.rmSync(target, { recursive: true, force: true });

  // A permission rule the project removed on purpose is not added back.
  const k = fresh();
  kit(k, 'install', '--app', 'api=go:api');
  const s = JSON.parse(read(k, '.claude/settings.json'));
  s.permissions.deny = s.permissions.deny.filter(x => x !== 'Read(*.p8)');
  write(k, '.claude/settings.json', JSON.stringify(s, null, 2));
  kit(k, 'add-app', '--app', 'web=nextjs:web');
  kit(k, 'sync');
  check(!JSON.parse(read(k, '.claude/settings.json')).permissions.deny.includes('Read(*.p8)'), 'a removed permission rule came back');
  fs.rmSync(k, { recursive: true, force: true });

  // Line endings and indentation of merged files come back exactly after uninstall.
  const n = fresh();
  write(n, '.gitignore', 'node_modules\r\ndist\r\n');
  write(n, '.claude/settings.json', '{\r\n    "model": "sonnet"\r\n}\r\n');
  write(n, 'CLAUDE.md', '# Ours\r\n- Tabs.\r\n');
  const before = snapshot(n);
  kit(n, 'install', '--app', 'api=go:api', '--merge-claude-md');
  check(read(n, '.claude/settings.json').includes('\r\n    "permissions"'), 'merge changed the indentation or line endings of settings.json');
  kit(n, 'uninstall');
  check(snapshot(n) === before, 'uninstall did not restore CRLF files and 4-space JSON exactly');
  fs.rmSync(n, { recursive: true, force: true });
}

// 14. Failures part-way, manifests from older and newer kits
{
  // A write that fails during commit (here .gitignore is a folder) puts back everything already written.
  const d = fresh();
  write(d, 'README.md', '# app\n');
  fs.mkdirSync(path.join(d, '.gitignore'));
  const before = snapshot(d);
  const r = kit(d, 'install', '--auto');
  check(r.status === 2 && /could not write \.gitignore \(EISDIR\); nothing was changed/.test(r.stderr), `a failed write should roll back: ${r.stderr}`);
  check(snapshot(d) === before, 'a failed install left changes behind');
  fs.rmSync(d, { recursive: true, force: true });

  // A manifest from before 1.1.0: sync doesn't re-add a removed rule, and uninstall says what it leaves.
  const e = fresh();
  kit(e, 'install', '--app', 'api=go:api');
  const m = JSON.parse(read(e, '.claude/project-kit.json'));
  for (const k of ['created', 'settingsAdded', 'settingsOffered', 'gitignoreAdded', 'profileHash']) delete m[k];
  m.kitVersion = '1.0.0';
  write(e, '.claude/project-kit.json', JSON.stringify(m));
  const s = JSON.parse(read(e, '.claude/settings.json'));
  s.permissions.deny = s.permissions.deny.filter(x => x !== 'Read(*.pem)');
  write(e, '.claude/settings.json', JSON.stringify(s, null, 2));
  check(kit(e, 'sync').status === 0, 'sync of a 1.0.0 manifest failed');
  check(!JSON.parse(read(e, '.claude/settings.json')).permissions.deny.includes('Read(*.pem)'), 'sync of a 1.0.0 manifest re-added a removed rule');
  const legacy = JSON.parse(read(e, '.claude/project-kit.json'));
  delete legacy.created; delete legacy.profileHash; delete legacy.gitignoreAdded;
  write(e, '.claude/project-kit.json', JSON.stringify(legacy));
  const u = kit(e, 'uninstall');
  check(u.status === 0 && /kept\s+the project profile text/.test(u.stdout) && /didn't record what it created/.test(u.stdout) && /kept\s+\d+ line\(s\) of the # project-kit block in \.gitignore/.test(u.stdout), `uninstall of an old install should say what it keeps:\n${u.stdout}`);
  fs.rmSync(e, { recursive: true, force: true });

  // A manifest from a newer kit, or with a stack this kit doesn't know, asks for a plugin update.
  const f = fresh();
  kit(f, 'install', '--app', 'api=go:api');
  const n = JSON.parse(read(f, '.claude/project-kit.json'));
  write(f, '.claude/project-kit.json', JSON.stringify({ ...n, kitVersion: '9.0.0' }));
  const r2 = kit(f, 'sync');
  check(r2.status === 2 && /newer than the installed/.test(r2.stderr), 'sync should refuse a manifest from a newer kit');
  write(f, '.claude/project-kit.json', JSON.stringify({ ...n, apps: [{ name: 'api', stacks: ['cobol'], path: 'api' }] }));
  const r3 = kit(f, 'doctor');
  check(r3.status === 2 && /stack\(s\) cobol .* update the plugin/.test(r3.stderr), `an unknown stack should ask for an update: ${r3.stderr}`);
  fs.rmSync(f, { recursive: true, force: true });
}

// 15. Options, doctor's secret scan, per-app rules, and ignore lines that reach existing projects
{
  const d = fresh();
  check(kit(d, 'install', '--app', 'api=laravel:07-application/api', '--app', 'shop=php:07-application/shop').status === 0, 'install failed');
  const r = kit(d, 'uninstall', '--dryrun');
  check(r.status === 2 && /unknown option --dryrun/.test(r.stderr) && fs.existsSync(path.join(d, 'CLAUDE.md')), 'a mistyped option must stop the command');
  const deny = JSON.parse(read(d, '.claude/settings.json')).permissions.deny;
  check(deny.includes('Read(/07-application/api/auth.json)') && deny.includes('Read(/07-application/shop/auth.json)'), "Composer's auth.json is not blocked per PHP app");
  check(deny.at(-1) === 'Read(!.env.example)', 'the .env.example exception must stay after the rules it carves from');
  check(read(d, '.gitattributes').includes('05-progress/log.md merge=union') && read(d, '.gitattributes').includes('CHANGELOG.md merge=union'), '.gitattributes merge rules missing');

  // An older install whose block lacks newer lines gets them inside the same block on sync.
  const m = JSON.parse(read(d, '.claude/project-kit.json'));
  write(d, '.gitignore', read(d, '.gitignore').replace('*.tfstate\n', ''));
  m.gitignoreAdded = m.gitignoreAdded.filter(l => l !== '*.tfstate');
  write(d, '.claude/project-kit.json', JSON.stringify(m));
  kit(d, 'sync');
  const gi = read(d, '.gitignore');
  check(gi.includes('*.tfstate\n') && gi.split('# project-kit').length === 2, `sync should add missing lines to the existing block:\n${gi}`);

  // doctor: secret-like files fail; a Symfony app's committed .env only warns.
  spawnSync('git', ['add', '.gitignore'], { cwd: d });
  for (const f of ['07-application/shop/.env', 'deploy/id_rsa', 'config/service-account.json', '.env.production']) write(d, f, 'x\n');
  spawnSync('git', ['add', '-f', '07-application/shop/.env'], { cwd: d });
  let doc = kit(d, 'doctor');
  check(/warn\s+tracked 07-application\/shop\/\.env/.test(doc.stdout) && !/FAIL\s+secret-like/.test(doc.stdout), `a Symfony .env should only warn:\n${doc.stdout}`);
  spawnSync('git', ['add', '-f', 'deploy/id_rsa', 'config/service-account.json', '.env.production'], { cwd: d });
  doc = kit(d, 'doctor');
  check(doc.status === 1 && /FAIL\s+secret-like files are tracked by git: .*\.env\.production.*config\/service-account\.json.*deploy\/id_rsa/.test(doc.stdout), `doctor missed tracked secrets:\n${doc.stdout}`);
  fs.rmSync(d, { recursive: true, force: true });
}

// 13. Detection of layouts that are easy to get wrong
{
  const d = fresh();
  write(d, 'apps/theme/style.css', '/* Theme Name: Shop */\n');
  write(d, 'apps/theme/functions.php', '<?php\n');
  write(d, 'apps/theme/package.json', JSON.stringify({ devDependencies: { sass: '1.0.0' } }));
  write(d, 'apps/landing/index.html', '<!doctype html>\n');
  write(d, 'apps/landing/package.json', JSON.stringify({ dependencies: { bootstrap: '5.3.0', jquery: '3.7.0' } }));
  write(d, 'apps/spa/index.html', '<!doctype html>\n');
  write(d, 'apps/spa/package.json', JSON.stringify({ dependencies: { react: '19.0.0' } }));
  fs.mkdirSync(path.join(d, 'apps/web'), { recursive: true });
  fs.writeFileSync(path.join(d, 'apps/web/package.json'), `﻿${JSON.stringify({ dependencies: { next: '15.0.0' } })}`);
  const got = detected(d).apps;
  const want = 'landing=html-css:apps/landing spa=node-typescript:apps/spa theme=php:apps/theme web=nextjs:apps/web';
  check(got === want, `tricky detection:\n      ${got}\n    wanted:\n      ${want}`);
  fs.rmSync(d, { recursive: true, force: true });
}

// 16. Claude Code skills and plugins: detected as their own stack, with any code they ship as a second one
{
  const d = fresh();
  write(d, 'apps/helper/.claude-plugin/plugin.json', JSON.stringify({ name: 'helper', version: '1.0.0' }));
  write(d, 'apps/helper/skills/deploy/SKILL.md', '---\ndescription: Deploy\n---\nSteps\n');
  write(d, 'apps/bridge/.claude-plugin/plugin.json', JSON.stringify({ name: 'bridge', version: '1.0.0' }));
  write(d, 'apps/bridge/package.json', JSON.stringify({ dependencies: { '@modelcontextprotocol/sdk': '1.20.0' } }));
  write(d, 'apps/notes/SKILL.md', '---\ndescription: Notes\n---\nSteps\n');
  write(d, 'apps/kit/skills/review/SKILL.md', '---\ndescription: Review\n---\nSteps\n');
  write(d, 'apps/docs-site/index.html', '<!doctype html>\n');
  const want = 'bridge=claude-code+node-typescript+mcp:apps/bridge docs-site=html-css:apps/docs-site helper=claude-code:apps/helper kit=claude-code:apps/kit notes=claude-code:apps/notes';
  check(detected(d).apps === want, `plugin detection:\n      ${detected(d).apps}\n    wanted:\n      ${want}`);
  fs.rmSync(d, { recursive: true, force: true });

  // A root marketplace is an app, and so is each plugin it holds, under plugins/ or wherever an entry points; the
  // plugins' own rule paths are installed, since the root's don't reach their hooks or agents.
  const m = fresh();
  write(m, '.claude-plugin/marketplace.json', JSON.stringify({ name: 'market', owner: { name: 'me' }, metadata: { pluginRoot: './extensions' }, plugins: [
    { name: 'one', source: './plugins/one' }, { name: 'tool', source: './tools/tool/' }, { name: 'self', source: './' },
    { name: 'up', source: '../outside' }, { name: 'gone', source: './missing' }, { name: 'gh', source: { source: 'github', repo: 'me/gh' } },
    { name: 'fmt', source: 'fmt' }, { name: 'lean', source: './plugins/lean' }, { name: 'nodot', source: 'nodot/x' },
  ] }));
  write(m, 'plugins/one/.claude-plugin/plugin.json', JSON.stringify({ name: 'one' }));
  write(m, 'tools/tool/.claude-plugin/plugin.json', JSON.stringify({ name: 'tool' }));
  write(m, 'extensions/fmt/.claude-plugin/plugin.json', JSON.stringify({ name: 'fmt' }));
  write(m, 'plugins/lean/agents/rev.md', '---\ndescription: Reviews\n---\nReview.\n'); // no plugin.json: the entry is its manifest
  write(m, 'nodot/x/agents/a.md', '---\ndescription: A\n---\nA.\n'); // a path without ./ isn't a valid source
  const mWant = 'app=claude-code:. fmt=claude-code:extensions/fmt lean=claude-code:plugins/lean one=claude-code:plugins/one tool=claude-code:tools/tool';
  check(detected(m).apps === mWant, `marketplace detection:\n      ${detected(m).apps}\n    wanted:\n      ${mWant}`);
  const mi = kit(m, 'install', '--auto');
  const mRule = mi.status === 0 ? read(m, '.claude/rules/kit/stack-claude-code.md') : '';
  const mGlobs = [...mRule.matchAll(/^  - "(.+)"$/gm)].map(x => x[1]);
  const uncovered = ['hooks/hooks.json', 'plugins/one/hooks/hooks.json', 'tools/tool/agents/reviewer.md', 'tools/tool/skills/a/ref.md',
    'extensions/fmt/hooks/hooks.json', 'plugins/lean/agents/rev.md'].filter(f => !mGlobs.some(g => path.matchesGlob(f, g)));
  check(mi.status === 0 && !uncovered.length, `marketplace install left these without the Claude Code rule: ${uncovered.join(', ')} ${mi.stdout}${mi.stderr}`);
  // Commands follow each app's layout: a plugin gets the stack defaults, the marketplace root validates its own file,
  // and a plugin with no plugin.json keeps only the test script.
  const row = (n) => (mi.status === 0 ? read(m, 'CLAUDE.md') : '').split('\n').find(l => l.startsWith(`| ${n} |`) && !l.includes('.claude/rules/')) || '';
  check(row('one').includes('`claude --plugin-dir .`') && row('one').includes('validate --strict .claude-plugin/plugin.json'), `plugin commands: ${row('one')}`);
  check(row('app').includes('validate --strict .claude-plugin/marketplace.json') && !row('app').includes('--plugin-dir'), `marketplace commands: ${row('app')}`);
  check(row('lean').includes('`bash tests/run.sh`') && !row('lean').includes('validate'), `commands for a plugin with no plugin.json: ${row('lean')}`);
  fs.rmSync(m, { recursive: true, force: true });

  // Without a root marketplace, each plugin under plugins/ is an app.
  const p = fresh();
  write(p, 'plugins/one/.claude-plugin/plugin.json', JSON.stringify({ name: 'one' }));
  write(p, 'plugins/two/.claude-plugin/plugin.json', JSON.stringify({ name: 'two' }));
  check(detected(p).apps === 'one=claude-code:plugins/one two=claude-code:plugins/two', `plugins folder detection: ${detected(p).apps}`);
  // Project skills inside an ordinary app don't make it a plugin.
  const q = fresh();
  write(q, 'package.json', JSON.stringify({ dependencies: { next: '16.0.0' } }));
  write(q, '.claude/skills/deploy/SKILL.md', '---\ndescription: Deploy\n---\n');
  check(detected(q).apps === 'app=nextjs:.', `project skills changed detection: ${detected(q).apps}`);
  const i = kit(p, 'install', '--auto');
  check(i.status === 0 && read(p, 'CLAUDE.md').includes('Claude Code skills, agents, hooks, and plugins') && fs.existsSync(path.join(p, '.claude/rules/kit/stack-claude-code.md')), `installing a plugin repo failed: ${i.stdout}${i.stderr}`);
  fs.rmSync(p, { recursive: true, force: true });
  fs.rmSync(q, { recursive: true, force: true });
}

// 1.5.0: ask rules moved from settings to the command guard hook; sync takes out the ones earlier versions added.
{
  const d = fresh();
  check(kit(d, 'install', '--app', 'svc=rust:07-application/svc').status === 0, 'install for the 1.5.0 checks failed');
  const perms = () => JSON.parse(read(d, '.claude/settings.json')).permissions;
  const manifest = () => JSON.parse(read(d, '.claude/project-kit.json'));
  check(!perms().ask && manifest().rigor === 'standard' && manifest().autonomy === 'guarded', `a fresh install should have no ask rules, rigor standard, autonomy guarded: ${JSON.stringify(perms())}`);
  check(read(d, 'CLAUDE.md').includes('| svc | `07-application/svc` | Rust |') && perms().deny.includes('Read(~/.cargo/credentials*)'), 'Rust app row or cargo credentials rule missing');
  check(fs.existsSync(path.join(d, '06-technical-docs/glossary.md')), 'install should create the glossary');
  // A project from 1.4: the kit had added ask rules and auto deny rules; the user added one of each too.
  const m = manifest();
  const s = JSON.parse(read(d, '.claude/settings.json'));
  s.permissions.ask = ['Bash(rm -rf *)', 'Bash(git push *)', 'Bash(make deploy*)'];
  s.permissions.deny.splice(1, 0, 'Bash(printenv*)', 'Bash(my-own-deny)');
  write(d, '.claude/settings.json', JSON.stringify(s, null, 2));
  m.settingsAdded.ask = ['Bash(rm -rf *)', 'Bash(git push *)'];
  m.settingsAdded.deny = [...m.settingsAdded.deny, 'Bash(printenv*)'];
  m.kitVersion = '1.4.0';
  write(d, '.claude/project-kit.json', JSON.stringify(m, null, 2));
  const sy = kit(d, 'sync');
  check(sy.status === 0, `sync of a 1.4.0 project failed: ${sy.stdout}${sy.stderr}`);
  check(JSON.stringify(perms().ask) === '["Bash(make deploy*)"]', `sync should take out only the ask rules the kit added: ${JSON.stringify(perms().ask)}`);
  check(!perms().deny.includes('Bash(printenv*)') && perms().deny.includes('Bash(my-own-deny)') && perms().deny.includes('Read(.env)'), 'sync should take out the retired deny rule and keep the rest');
  check(!(manifest().settingsAdded.ask || []).includes('Bash(rm -rf *)'), 'the manifest still records a retired rule as added');
  check(/1 ask rule\(s\).*make deploy/.test(kit(d, 'doctor').stdout), 'doctor should list the ask rule that still prompts');
  // Rigor and autonomy are manifest fields.
  check(/rigor: standard/.test(kit(d, 'rigor').stdout) && kit(d, 'rigor', 'prototype').status === 0 && manifest().rigor === 'prototype', 'rigor command failed');
  check(kit(d, 'autonomy', 'auto').status === 0 && manifest().autonomy === 'auto' && /autonomy guarded → auto/.test(read(d, '05-progress/log.md')), 'autonomy command failed');
  check(kit(d, 'autonomy', 'yolo').status === 2 && kit(d, 'rigor', 'sloppy').status === 2, 'unknown modes should be refused');
  check(/rigor: prototype · autonomy: auto/.test(kit(d, 'doctor').stdout), 'doctor should report rigor and autonomy');
  // A manifest without a rigor (from before 1.5.0) is production.
  const old = manifest(); delete old.rigor; write(d, '.claude/project-kit.json', JSON.stringify(old, null, 2));
  check(/rigor: production/.test(kit(d, 'rigor').stdout), 'a manifest without rigor should read as production');
  const u = kit(d, 'uninstall');
  check(u.status === 0 && JSON.parse(read(d, '.claude/settings.json')).permissions.deny.includes('Bash(my-own-deny)'), `uninstall dropped the project's own rule: ${u.stdout}`);
  fs.rmSync(d, { recursive: true, force: true });
  check(kit(fresh(), 'install', '--rigor', 'heroic', '--app', 'x=go:x').status === 2, 'install should refuse an unknown rigor');
}

// The daily loop: new, start, set, next, board, with STATUS.md and the log kept current.
{
  const d = fresh();
  const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: d, encoding: 'utf8' });
  git('commit', '-q', '--allow-empty', '-m', 'init');
  kit(d, 'install', '--app', 'web=vite-spa:web', '--app', 'api=laravel:api');
  git('add', '-A'); git('commit', '-q', '-m', 'kit');
  check(kit(d, 'new', 'phase', '--title', 'Booking MVP').status === 0 && fs.existsSync(path.join(d, '03-phases/phase-01-booking-mvp.md')), 'new phase failed');
  check(kit(d, 'new', 'task', '--title', 'List rooms').status === 2, 'new task without --app in a two-app project should be refused');
  check(kit(d, 'new', 'task', '--title', 'List rooms', '--app', 'web', '--ui').status === 0, 'new task failed');
  const t2 = kit(d, 'new', 'task', '--title', 'Book a room: create # validate', '--app', 'api', '--security', '--depends', 'task-001');
  check(t2.status === 0, `second new task failed: ${t2.stderr}`);
  const f2 = '04-tasks/phase-01/task-002-book-a-room-create-validate.md';
  const t2text = read(d, f2);
  check(/^title: "Book a room: create # validate"/m.test(t2text) && /^security_sensitive: true/m.test(t2text) && /^depends_on: \[task-001\]/m.test(t2text) && /^# task-002: Book a room/m.test(t2text), `task fields not filled:\n${t2text.slice(0, 600)}`);
  check(/^status: todo {16}# backlog/m.test(t2text), 'the status comment lost its column');
  const phase = read(d, '03-phases/phase-01-booking-mvp.md');
  check(phase.includes('| task-001 | List rooms | web |  |') && phase.includes('| task-002 | Book a room: create # validate | api | task-001 |') && !/\| task-001 \| \|/.test(phase), `phase table not updated:\n${phase}`);
  check(kit(d, 'new', 'adr', '--title', 'Use TanStack Query').status === 0 && fs.existsSync(path.join(d, '06-technical-docs/decisions/ADR-001-use-tanstack-query.md')), 'new adr failed');
  check(kit(d, 'new', 'hotfix', '--title', 'Login loop').status === 2, 'a hotfix needs --app in a two-app project');
  check(kit(d, 'new', 'hotfix', '--title', 'Login loop', '--app', 'api').status === 0 && fs.existsSync(path.join(d, '04-tasks/hotfix/hotfix-001-login-loop.md')), 'new hotfix failed');
  let n = kit(d, 'next', '--json');
  check(JSON.parse(n.stdout).map(t => t.id).join() === 'hotfix-001', `hotfixes come first: ${n.stdout}`);
  kit(d, 'set', 'hotfix-001', 'cancelled');
  n = kit(d, 'next', '--parallel', '--json');
  check(JSON.parse(n.stdout).map(t => t.id).join() === 'task-001', `task-002 waits on task-001: ${n.stdout}`);
  // Ids look across branches: a task created on another branch reserves its number.
  git('add', '-A'); git('commit', '-q', '-m', 'plan');
  git('switch', '-q', '-c', 'other'); kit(d, 'new', 'task', '--title', 'Elsewhere', '--app', 'web'); git('add', '-A'); git('commit', '-q', '-m', 'other'); git('switch', '-q', 'master');
  if (git('branch', '--show-current').stdout.trim() !== 'master') git('switch', '-q', 'main');
  check(/task-004/.test(kit(d, 'new', 'task', '--title', 'After', '--app', 'web', '--dry-run').stdout), 'the next id should skip one used on another branch');
  // Start: refuses a dirty tree, then branches and marks the task.
  write(d, 'CHANGELOG.md', `${read(d, 'CHANGELOG.md')}\nlocal edit\n`);
  check(kit(d, 'start', 'task-001').status === 2, 'start should refuse a dirty tree');
  git('checkout', '--', 'CHANGELOG.md');
  const st = kit(d, 'start', 'task-001');
  check(st.status === 0 && git('branch', '--show-current').stdout.trim() === 'task-001-list-rooms', `start failed: ${st.stdout}${st.stderr}`);
  check(/^status: in-progress/m.test(read(d, '04-tasks/phase-01/task-001-list-rooms.md')), 'start did not mark the task in-progress');
  check(/^Active task: task-001 List rooms$/m.test(read(d, '05-progress/STATUS.md')) && /^Branch: task-001-list-rooms$/m.test(read(d, '05-progress/STATUS.md')), `STATUS.md not refreshed:\n${read(d, '05-progress/STATUS.md')}`);
  check(kit(d, 'set', 'task-002', 'blocked').status === 2, 'blocked without a reason should be refused');
  check(kit(d, 'set', 'task-001', 'finished').status === 2, 'an unknown status should be refused');
  kit(d, 'set', 'task-001', 'done');
  check(/^Active task: none$/m.test(read(d, '05-progress/STATUS.md')) && /^Queue: task-002/m.test(read(d, '05-progress/STATUS.md')), 'STATUS.md queue not refreshed after done');
  kit(d, 'set', 'task-002', 'blocked', '--reason', 'needs the payment sandbox key');
  check(/^blocked_reason: "?needs the payment sandbox key"?/m.test(read(d, f2)), 'blocked reason not recorded');
  const b = kit(d, 'board');
  check(/blocked 1/.test(b.stdout) && /needs the payment sandbox key/.test(b.stdout), `board: ${b.stdout}`);
  check(/task-001 in-progress → done/.test(read(d, '05-progress/log.md')), 'status changes are not logged');
  // A free line in the log, and a task for an app that only the Profile table lists (a stack the kit has no rules for).
  check(kit(d, 'log', 'quick: fix a typo on the pricing page').status === 0 && /^\d{4}-\d\d-\d\d \d\d:\d\d quick: fix a typo on the pricing page$/m.test(read(d, '05-progress/log.md')), 'log did not add the line');
  check(kit(d, 'log').status === 2, 'log without text should be refused');
  write(d, 'CLAUDE.md', read(d, 'CLAUDE.md').replace(/^(\| web \| `[^`]+` \|.*)$/m, '$1\n| ios | `apps/ios` | Swift | `.claude/rules/project/stack-swift.md` |'));
  check(kit(d, 'new', 'task', '--title', 'Sign in on iOS', '--app', 'ios', '--dry-run').status === 0, 'an app listed only in the Profile table should be accepted');
  check(kit(d, 'new', 'task', '--title', 'Nowhere', '--app', 'ghost', '--dry-run').status === 2, 'an unknown app should still be refused');
  // A title is text: "$1" and "$&" mean something to String.replace and must reach the heading unchanged.
  const money = kit(d, 'new', 'task', '--title', 'Charge $1 fee and $& too', '--app', 'web');
  const moneyFile = (money.stdout.match(/04-tasks\/\S+\.md/) || [''])[0];
  check(money.status === 0 && /^# task-\d+: Charge \$1 fee and \$& too$/m.test(read(d, moneyFile)), `a title with $1 was rewritten: ${money.stdout}${money.stderr}`);
  // Ids grow past 999 and keep their order: task-1000 is seen, sorted after task-999, and followed by task-1001.
  write(d, '04-tasks/phase-01/task-999-last-three-digit.md', read(d, moneyFile).replace(/^id: .*$/m, 'id: task-999'));
  const k = kit(d, 'new', 'task', '--title', 'Past the thousand', '--app', 'web');
  check(/Created task-1000:/.test(k.stdout), `the id after task-999 should be task-1000: ${k.stdout}${k.stderr}`);
  const ids = JSON.parse(kit(d, 'board', '--json').stdout).map(t => t.id);
  check(ids.indexOf('task-1000') === ids.indexOf('task-999') + 1, `task-1000 should be listed after task-999: ${ids.join()}`);
  check(/task-1001/.test(kit(d, 'new', 'task', '--title', 'Next', '--app', 'web', '--depends', 'task-1000', '--dry-run').stdout), 'the id after task-1000 should be task-1001');
  check(kit(d, 'set', 'task-1000', 'backlog').status === 0, 'a four-digit task id should be accepted');
  fs.rmSync(d, { recursive: true, force: true });
}

// Quick checks, starter repositories, and the new frontend stacks.
{
  const d = fresh();
  kit(d, 'install', '--app', 'web=react-native:mobile', '--app', 'api=go:api');
  check(/api\s+gofmt -e -l \{file\}/.test(kit(d, 'check').stdout), 'the Go quick check should come from the stack');
  kit(d, 'check', 'api', '--off');
  check(/api\s+off/.test(kit(d, 'check').stdout), 'check --off did not turn it off');
  kit(d, 'check', 'api', '--cmd', 'node lint.js {file}', '--ext', 'go');
  check(JSON.parse(read(d, '.claude/project-kit.json')).checks.api.cmd === 'node lint.js {file}', 'check --cmd not saved');
  // Setting a command approves it on this machine; on another one (a different home) it waits for --trust.
  check(!/not approved/.test(kit(d, 'check').stdout), 'a command set here should be approved here');
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-home-'));
  const elsewhere = (...a) => spawnSync(process.execPath, [KIT, ...a, '--project-dir', d], { encoding: 'utf8', env: { ...process.env, PROJECT_KIT_HOME: other } });
  check(/api\s+node lint\.js \{file\}.*not approved on this machine/.test(elsewhere('check').stdout) && /not approved on this machine/.test(elsewhere('doctor').stdout), `a command from the repo should show as not approved: ${elsewhere('check').stdout}`);
  check(elsewhere('check', 'api', '--trust').status === 0 && !/not approved/.test(elsewhere('check').stdout), 'check --trust did not approve the command');
  check(elsewhere('check', 'web', '--trust').status === 2, 'check --trust on a built-in check should be refused');
  fs.rmSync(other, { recursive: true, force: true });
  kit(d, 'check', 'api', '--reset');
  check(!('api' in JSON.parse(read(d, '.claude/project-kit.json')).checks), 'check --reset did not clear it');
  check(fs.existsSync(path.join(d, '.claude/rules/kit/stack-react-native.md')), 'React Native rule not installed');
  fs.rmSync(d, { recursive: true, force: true });

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-home-'));
  const env = { ...process.env, PROJECT_KIT_HOME: home };
  const st = (...a) => spawnSync(process.execPath, [KIT, 'starters', ...a], { encoding: 'utf8', env });
  check(st('set', 'laravel', 'https://github.com/acme/laravel-starter').status === 0 && /laravel\s+https:\/\/github\.com\/acme/.test(st().stdout), 'starters set failed');
  check(st('set', 'cobol', 'https://x/y').status === 2 && st('set', 'go', 'not a url').status === 2, 'starters should refuse unknown stacks and bad URLs');
  check(st('remove', 'laravel').status === 0 && /No starter/.test(st().stdout), 'starters remove failed');
  fs.rmSync(home, { recursive: true, force: true });

  const f = fresh();
  write(f, 'apps/spa/package.json', JSON.stringify({ dependencies: { react: '19.0.0' }, devDependencies: { vite: '7.0.0' } }));
  write(f, 'apps/vue/package.json', JSON.stringify({ dependencies: { vue: '3.5.0' } }));
  write(f, 'apps/vue/vite.config.ts', 'export default {};\n');
  write(f, 'apps/mobile/package.json', JSON.stringify({ dependencies: { expo: '54.0.0', 'react-native': '0.82.0', react: '19.0.0' } }));
  write(f, 'apps/ssr/package.json', JSON.stringify({ dependencies: { react: '19.0.0', express: '5.0.0' }, devDependencies: { vite: '7.0.0' } }));
  check(detected(f).apps === 'mobile=react-native:apps/mobile spa=vite-spa:apps/spa ssr=node-typescript:apps/ssr vue=vite-spa:apps/vue', `frontend detection: ${detected(f).apps}`);
  fs.rmSync(f, { recursive: true, force: true });
}

if (failures) { console.error(`  ${failures} kit check(s) failed`); process.exit(1); }
