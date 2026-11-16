#!/usr/bin/env node
// project-kit project-layer tool. Writes and maintains, inside a project:
//   CLAUDE.md (a project-owned profile block + a kit-owned core block), .claude/rules/kit/ (path-scoped rules),
//   .claude/templates/, permission rules merged into .claude/settings.json, tracking folders, and
//   .claude/project-kit.json (the manifest that lets `sync` update kit-owned files without clobbering local edits,
//   and lets `uninstall` remove only what nobody has edited).
// Every command plans its changes first and writes nothing if any check fails. It never writes through a
// symbolic link or outside the project, and never overwrites a file it didn't create unless asked to (--force).
// Usage: node kit.mjs <command> [options]   (run with --help for the list)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAYER = path.join(PLUGIN_ROOT, 'project-layer');
const KIT_VERSION = JSON.parse(read(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'))).version;

const MANIFEST = '.claude/project-kit.json';
const RULES_DIR = '.claude/rules/kit';
const TEMPLATES_DIR = '.claude/templates';
const SETTINGS = '.claude/settings.json';
const SKIP_LIST = 'skipped-projects.txt';
const GLOSSARY = '06-technical-docs/glossary.md';
const MAX_AUTO_APPS = 12;
const SAFE_PATH = /^[\w./@ +-]+$/; // app paths end up inside quoted YAML globs and Markdown tables
const APP_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const MARK = {
  profileBegin: '<!-- project-kit:profile:begin',
  profileEnd: '<!-- project-kit:profile:end -->',
  coreBegin: '<!-- project-kit:core:begin',
  coreEnd: '<!-- project-kit:core:end -->',
};
const FOLDERS = [
  '01-ideas', '02-prd', '03-phases', '04-tasks/hotfix', '06-technical-docs/api', '06-technical-docs/decisions',
  '06-technical-docs/design/references', '.claude/rules/project',
];
// The only non-kit files install creates; a manifest naming anything else is refused.
const CREATABLE = new Set([
  'CLAUDE.md', '05-progress/STATUS.md', '05-progress/log.md', 'CHANGELOG.md', '06-technical-docs/glossary.md', SETTINGS, '.gitignore', '.gitattributes',
  ...FOLDERS.map(d => `${d}/.gitkeep`),
]);
const GITIGNORE_HEADER = '# project-kit';
const GITIGNORE_LINES = [
  '.env', '.env.*', '!.env.example', '.envrc', '.dev.vars*', '*.pem', '*.key', '*.p8', '*.p12', '*.pfx', '*.jks',
  '*.keystore', 'key.properties', '*.tfstate', '*.tfstate.*', 'CLAUDE.local.md', '.claude/settings.local.json',
  '*.orig', '.worktrees/', '.auth/', 'playwright-report/', 'test-results/', 'blob-report/', 'ui-verify/', 'coverage/',
];
// Two task branches that both append to the log merge without a conflict.
const GITATTRIBUTES_LINES = ['05-progress/log.md merge=union', 'CHANGELOG.md merge=union'];
const OPTIONS = ['project-dir', 'data-dir', 'name', 'app', 'autonomy', 'rigor', 'title', 'phase', 'type', 'depends', 'reason', 'cmd', 'ext'];
// guarded: the command guard asks before destructive commands and Claude asks before risky changes. auto: unattended
// development; nothing asks, and what must never run unattended is denied. A session can override the project's
// default with PROJECT_KIT_AUTONOMY, and --dangerously-skip-permissions counts as auto (scripts/lib/project.mjs).
const AUTONOMY = ['guarded', 'auto'];
// How much process a project carries (CLAUDE.md "Rigor"). Manifests from before 1.5.0 have none and are production.
const RIGOR = ['prototype', 'standard', 'production'];
const rigorOf = m => (RIGOR.includes(m && m.rigor) ? m.rigor : 'production');
const STATUSES = ['backlog', 'todo', 'in-progress', 'blocked', 'in-review', 'done', 'cancelled'];
// Files that hold secrets when committed (doctor fails on them); .env.example and similar templates are fine.
const SECRET_FILE = new RegExp([
  String.raw`(^|/)\.env(\.(?!(example|sample|template|dist|defaults)$)[^/]+)?$`,
  String.raw`(^|/)(\.envrc|\.dev\.vars[^/]*|key\.properties|id_(rsa|dsa|ecdsa|ed25519))$`,
  String.raw`\.(pem|key|p8|p12|pfx|jks|keystore|tfstate)$`, String.raw`\.tfstate\.[^/]+$`,
  String.raw`(^|/)[^/]*(credentials|service-account)[^/]*\.json$`,
].join('|'));

// ---------- small helpers ----------
function read(p) { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'); }
function exists(p) { return fs.existsSync(p); }
function lstat(p) { try { return fs.lstatSync(p); } catch { return null; } }
function present(p) { return lstat(p) !== null; } // true for dangling symbolic links too
function isLink(p) { const s = lstat(p); return Boolean(s && s.isSymbolicLink()); }
function eolOf(p) { try { return fs.readFileSync(p, 'utf8').includes('\r\n') ? '\r\n' : '\n'; } catch { return '\n'; } }
function sha(text) { return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
function fail(msg) { console.error(`project-kit: ${msg}`); process.exit(2); }
function posix(p) { return p.split(path.sep).join('/'); }
function entriesOf(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } }
function textOf(file) { try { return read(file); } catch { return ''; } }
function jsonOf(file) { try { return JSON.parse(read(file)); } catch { return null; } }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
const fmtApp = a => `${a.name}=${a.stacks.join('+')}:${a.path}`;

function parseArgs(argv) {
  const args = { _: [], app: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { args._.push(a); continue; }
    const key = a.slice(2);
    if (['dry-run', 'force', 'merge-claude-md', 'auto', 'json', 'help', 'security', 'ui', 'off', 'reset', 'parallel'].includes(key)) { args[key] = true; continue; }
    // A mistyped flag must not be skipped: `uninstall --dryrun` would otherwise really uninstall.
    if (!OPTIONS.includes(key)) fail(`unknown option --${key}; run with --help for the list`);
    const val = argv[++i];
    if (val === undefined) fail(`--${key} needs a value`);
    if (key === 'app') args.app.push(val); else args[key] = val;
  }
  return args;
}

// ---------- rule library ----------
function parseRule(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('rule file has no front matter');
  const paths = [];
  let kit = {};
  let inPaths = false;
  for (const line of m[1].split('\n')) {
    if (/^paths:\s*$/.test(line)) { inPaths = true; continue; }
    const item = line.match(/^\s+-\s+"(.*)"\s*$/);
    if (inPaths && item) { paths.push(item[1]); continue; }
    inPaths = false;
    const k = line.match(/^kit:\s*(\{.*\})\s*$/);
    if (k) kit = JSON.parse(k[1]);
  }
  return { paths, kit, body: m[2] };
}

function loadDir(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
    out[f.replace(/\.md$/, '')] = parseRule(read(path.join(dir, f)));
  }
  return out;
}
const STACKS = loadDir(path.join(LAYER, 'rules', 'stacks'));
const CORE = loadDir(path.join(LAYER, 'rules', 'core'));
const KIT_SETTINGS = JSON.parse(read(path.join(LAYER, 'settings.json')));
// Manifests from before 1.1.0 don't record which permission rules the kit offered; this frozen list stands in.
const LEGACY_OFFERED = JSON.parse(read(path.join(LAYER, 'legacy-offered-rules.json')));
// Rules earlier versions merged into settings and this one no longer uses; sync takes out the ones it recorded adding.
const RETIRED = JSON.parse(read(path.join(LAYER, 'retired-rules.json')));
const autonomyOf = m => (AUTONOMY.includes(m && m.autonomy) ? m.autonomy : 'guarded');
function retiredIn(manifest) {
  const added = manifest && manifest.settingsAdded;
  if (!added) return null;
  return { ask: RETIRED.ask.filter(r => (added.ask || []).includes(r)), deny: RETIRED.deny.filter(r => (added.deny || []).includes(r)) };
}

function expandApp(pattern, appPath) {
  if (appPath === '.') return pattern.replace('{{APP}}/', '');
  return pattern.split('{{APP}}').join(appPath);
}

function renderRule(rule, appPaths) {
  const out = [];
  for (const p of rule.paths) {
    if (p.includes('{{APP}}')) appPaths.forEach(a => out.push(expandApp(p, a)));
    else out.push(p);
  }
  const body = rule.body.startsWith('\n') ? rule.body : `\n${rule.body}`;
  return `---\npaths:\n${[...new Set(out)].map(p => `  - "${p}"`).join('\n')}\n---\n${body}`;
}

function safeAppPath(p) { return SAFE_PATH.test(p) && !path.isAbsolute(p) && !p.split('/').includes('..'); }

function parseApp(spec) {
  const m = spec.match(/^([A-Za-z0-9][A-Za-z0-9_-]*)=([a-z0-9+-]+):(.+)$/);
  if (!m) fail(`bad --app "${spec}"; expected name=stack[+stack]:path, e.g. web=nextjs:07-application/web`);
  const [, name, stackList, rawPath] = m;
  const stacks = stackList.split('+');
  for (const s of stacks) if (!STACKS[s]) fail(`unknown stack "${s}". Run: node kit.mjs stacks`);
  let p = posix(path.normalize(rawPath)).replace(/\/+$/, '');
  if (p === '' || p === './') p = '.';
  if (path.isAbsolute(rawPath) || p.split('/').includes('..')) fail(`app path must be inside the project: ${rawPath}`);
  if (!SAFE_PATH.test(p)) fail(`app path "${rawPath}" has characters that can't go in a rule glob; rename the folder`);
  return { name, stacks, path: p };
}

// Every kit-owned file, keyed by project-relative path. With no apps yet, core rules cover the whole repo.
function renderKitFiles(apps) {
  const files = new Map();
  const allPaths = apps.length ? [...new Set(apps.map(a => a.path))] : ['.'];
  for (const [name, rule] of Object.entries(CORE)) files.set(`${RULES_DIR}/${name}.md`, renderRule(rule, allPaths));
  const used = [...new Set(apps.flatMap(a => a.stacks))].sort();
  for (const s of used) {
    const appPaths = [...new Set(apps.filter(a => a.stacks.includes(s)).map(a => a.path))];
    files.set(`${RULES_DIR}/stack-${s}.md`, renderRule(STACKS[s], appPaths));
  }
  const tdir = path.join(LAYER, 'templates');
  for (const f of fs.readdirSync(tdir).sort()) files.set(`${TEMPLATES_DIR}/${f}`, read(path.join(tdir, f)));
  return files;
}

// ---------- detection: suggest apps from stack markers (used by `detect` and `install --auto`) ----------
const APP_CONTAINERS = ['07-application', 'apps', 'services', 'packages', 'plugins'];
const APP_FOLDERS = ['frontend', 'backend', 'web', 'api', 'server', 'client', 'mobile', 'admin', 'site', 'worker', 'e2e'];
const WORKSPACE_MARKERS = ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json', 'rush.json'];
const JS_STACKS = new Set(['nuxt', 'nextjs', 'vite-spa', 'react-native', 'node-typescript', 'playwright', 'html-css']);
const SPA_DEPS = ['react', 'vue', 'svelte', 'solid-js', 'preact', '@angular/core', 'lit'];
// A package.json with one of these is an app or service, not a static template that uses npm for its assets.
const JS_APP_DEPS = [
  'react', 'vue', 'svelte', '@angular/core', 'preact', 'solid-js', 'lit', 'astro', '@sveltejs/kit', 'express',
  'fastify', 'koa', 'hono', '@nestjs/core', 'electron',
];
const UNSUPPORTED = [['mix.exs', 'Elixir'], ['Package.swift', 'Swift'], ['Gemfile', 'Ruby without Rails'], ['deno.json', 'Deno']];
const MCP_SDKS = [ // [manifest file, dependency on an MCP SDK]
  [/^package\.json$/, /"(@modelcontextprotocol\/(?!inspector")[\w.-]+|fastmcp|mcp-framework)"\s*:/],
  [/^(pyproject\.toml|Pipfile|requirements[\w.-]*\.txt)$/, /(^|["'])(mcp|fastmcp)(\[[\w,\s-]*\])?\s*([<>=!~;,"'#]|$)/m],
  [/^go\.mod$/, /github\.com\/(modelcontextprotocol\/go-sdk|mark3labs\/mcp-go)/],
  [/\.(cs|fs)proj$/, /"ModelContextProtocol/],
  [/^(pom\.xml|build\.gradle(\.kts)?)$/, /io\.modelcontextprotocol|spring-ai-(starter-)?mcp/],
  [/^Gemfile$/, /^\s*gem\s+["'](mcp|fast-mcp)["']/m],
  [/^Cargo\.toml$/, /^\s*(rmcp|rust-mcp-sdk)\s*=|^\[(workspace\.)?dependencies\.(rmcp|rust-mcp-sdk)\]/m],
  [/^composer\.json$/, /"(mcp\/sdk|php-mcp\/[\w-]+|laravel\/mcp)"\s*:/],
];
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[^a-z0-9]+|-+$/g, '') || 'app'; }

// The stack of one folder, judged by the files at its top level: { stacks: [...] | null, note: string | null }.
// `plugin` marks a folder a marketplace lists, which is a Claude Code plugin even with no plugin.json of its own.
function detectDir(dir, allowHtml, plugin = false) {
  const files = new Set(entriesOf(dir).filter(e => e.isFile()).map(e => e.name));
  const has = (...names) => names.some(n => files.has(n));
  const some = re => [...files].some(n => re.test(n));
  const pkg = files.has('package.json') ? jsonOf(path.join(dir, 'package.json')) || {} : null;
  const dep = n => Boolean(pkg && ((pkg.dependencies || {})[n] || (pkg.devDependencies || {})[n]));
  const runtimeDeps = pkg ? Object.keys(pkg.dependencies || {}).length : 0;
  const android = ['app/src/main/AndroidManifest.xml', 'src/main/AndroidManifest.xml'].some(p => exists(path.join(dir, p)));
  // A Claude Code plugin, marketplace, standalone skill, or folder of skills; any code in it is a second stack.
  const claudeCode = plugin || ['plugin.json', 'marketplace.json'].some(f => exists(path.join(dir, '.claude-plugin', f))) || has('SKILL.md')
    || entriesOf(path.join(dir, 'skills')).some(e => e.isDirectory() && exists(path.join(dir, 'skills', e.name, 'SKILL.md')));
  let stack = null;
  if (has('artisan') && has('composer.json')) stack = 'laravel';
  else if (has('composer.json')) stack = 'php';
  else if (exists(path.join(dir, 'config', 'application.rb')) || /^\s*gem\s+["']rails["']/m.test(textOf(path.join(dir, 'Gemfile')))) stack = 'ruby-rails';
  else if (some(/\.(sln|slnx|csproj|fsproj)$/)) stack = 'dotnet';
  else if (has('go.mod', 'go.work')) stack = 'go';
  else if (has('Cargo.toml')) stack = 'rust';
  else if (has('pubspec.yaml')) stack = 'flutter';
  else if (has('pom.xml', 'build.gradle', 'build.gradle.kts')) { if (!android) stack = 'java-spring'; }
  else if (dep('nuxt') || some(/^nuxt\.config\./)) stack = 'nuxt';
  else if (dep('next') || some(/^next\.config\./)) stack = 'nextjs';
  else if (dep('expo') || dep('react-native')) stack = 'react-native';
  else if ((dep('vite') || some(/^vite\.config\./)) && SPA_DEPS.some(dep) && !dep('express') && !dep('fastify') && !dep('@nestjs/core')) stack = 'vite-spa';
  else if (has('pyproject.toml', 'setup.py', 'Pipfile', 'manage.py') || some(/^requirements[\w.-]*\.txt$/)) stack = 'python';
  else if (some(/\.php$/)) stack = 'php'; // WordPress themes and plain PHP sites have no composer.json
  else if (some(/^playwright\.config\./) && !runtimeDeps) stack = 'playwright';
  else if (allowHtml && has('index.html') && !has('tsconfig.json') && !JS_APP_DEPS.some(dep)) stack = 'html-css';
  else if (pkg) stack = 'node-typescript';
  const mcp = [...files].some(n => MCP_SDKS.some(([f, re]) => f.test(n) && re.test(textOf(path.join(dir, n)))));
  if (claudeCode) {
    const code = stack && stack !== 'html-css' && stack !== 'playwright' ? [stack] : [];
    return { stacks: ['claude-code', ...code, ...(mcp && code.length ? ['mcp'] : [])], note: null };
  }
  if (!stack) return { stacks: null, note: android ? 'Android app' : (UNSUPPORTED.find(([f]) => files.has(f)) || [])[1] || null };
  return { stacks: mcp ? [stack, 'mcp'] : [stack], note: null };
}

// Apps at the repo root (unless it is a JS workspace root), in app container folders, at the paths a root
// marketplace lists, and in common app folders.
function detectApps(root) {
  const apps = [];
  const notes = [];
  const seen = new Set();
  const add = (rel, found, name) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    if (found.note) notes.push(`${rel}: ${found.note}, which no kit stack covers; add rules with /project-kit:add-stack`);
    if (!found.stacks) return;
    if (!SAFE_PATH.test(rel)) { notes.push(`${rel}: skipped, its name has characters that can't go in a rule glob`); return; }
    let unique = slug(name);
    for (let n = 2; apps.some(a => a.name === unique); n++) unique = `${slug(name)}-${n}`;
    apps.push({ name: unique, stacks: found.stacks, path: rel });
  };
  const rootPkg = jsonOf(path.join(root, 'package.json'));
  const workspace = WORKSPACE_MARKERS.some(f => exists(path.join(root, f))) || Boolean(rootPkg && rootPkg.workspaces);
  const top = detectDir(root, true);
  const rootIsApp = Boolean(top.stacks) && !(workspace && JS_STACKS.has(top.stacks[0]));
  add('.', rootIsApp ? top : { stacks: null, note: top.note }, 'app');
  // Each plugin a root marketplace lists by relative path is an app, wherever it sits: a `./` path, or a bare name
  // under metadata.pluginRoot. First, so a listed folder with no plugin.json isn't passed over in plugins/.
  const market = jsonOf(path.join(root, '.claude-plugin', 'marketplace.json'));
  const pluginRoot = market && market.metadata && typeof market.metadata.pluginRoot === 'string' ? market.metadata.pluginRoot : '';
  for (const entry of Array.isArray(market && market.plugins) ? market.plugins : []) {
    const s = entry && typeof entry.source === 'string' ? entry.source : '';
    const source = s.startsWith('./') ? s : pluginRoot && /^[^/\\]+$/.test(s) && s !== '.' && s !== '..' ? `${pluginRoot}/${s}` : '';
    const rel = source && !path.isAbsolute(source) ? posix(path.normalize(source)).replace(/\/+$/, '') : '';
    if (rel && rel !== '.' && !rel.split('/').includes('..') && isDir(path.join(root, rel))) add(rel, detectDir(path.join(root, rel), true, true), path.basename(rel));
  }
  for (const c of APP_CONTAINERS) {
    for (const e of entriesOf(path.join(root, c)).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') add(`${c}/${e.name}`, detectDir(path.join(root, c, e.name), true), e.name);
    }
  }
  // Inside a root app, these folders are usually part of it (Flutter's web/), so they need a real manifest to count.
  for (const d of APP_FOLDERS) if (isDir(path.join(root, d))) add(d, detectDir(path.join(root, d), !rootIsApp), d);
  return { apps, notes };
}

// ---------- CLAUDE.md ----------
function splitTemplate() {
  const t = read(path.join(LAYER, 'CLAUDE.md'));
  const pb = t.indexOf(MARK.profileBegin), pe = t.indexOf(MARK.profileEnd);
  const cb = t.indexOf(MARK.coreBegin), ce = t.indexOf(MARK.coreEnd);
  if ([pb, pe, cb, ce].includes(-1)) throw new Error('project-layer/CLAUDE.md is missing kit markers');
  return {
    profile: t.slice(pb, pe + MARK.profileEnd.length),
    core: t.slice(cb, ce + MARK.coreEnd.length).split('{{KIT_VERSION}}').join(KIT_VERSION),
  };
}

const cell = v => (v ? `\`${String(v).replace(/\|/g, '\\|')}\` (verify)` : 'TBD');
// The claude-code defaults assume a plugin at the app path. A marketplace root validates its marketplace file, and
// standalone skills keep only the test script; whatever doesn't fit the layout stays TBD.
function commandsFor(a, root) {
  const c = STACKS[a.stacks[0]].kit.commands || {};
  const dir = root ? path.join(root, a.path) : null;
  if (a.stacks[0] !== 'claude-code' || !dir || exists(path.join(dir, '.claude-plugin', 'plugin.json'))) return c;
  if (exists(path.join(dir, '.claude-plugin', 'marketplace.json'))) return { test: c.test, lint: 'claude plugin validate --strict .claude-plugin/marketplace.json' };
  return { test: c.test };
}
function appRows(apps) {
  if (!apps.length) return '| TBD | TBD | TBD | TBD |';
  return apps.map(a => {
    const names = a.stacks.map(s => STACKS[s].kit.name || s).join(' + ');
    const rules = a.stacks.map(s => `\`${RULES_DIR}/stack-${s}.md\``).join(', ');
    return `| ${a.name} | \`${a.path}\` | ${names} | ${rules} |`;
  }).join('\n');
}
function commandRows(apps, root) {
  if (!apps.length) return '| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |';
  return apps.map(a => {
    const c = commandsFor(a, root);
    const test = c.test ? `${cell(c.test)}${c.testOne ? ` · ${cell(c.testOne)}` : ''}` : 'TBD';
    return `| ${a.name} | ${cell(c.setup)} | ${cell(c.dev)} | ${test} | ${cell(c.lint)} | ${cell(c.types)} | ${cell(c.build)} | ${cell(c.audit)} |`;
  }).join('\n');
}
function renderProfile(tpl, name, apps, root) {
  return tpl.split('{{PROJECT_NAME}}').join(name).split('{{APP_ROWS}}').join(appRows(apps))
    .split('{{COMMAND_ROWS}}').join(commandRows(apps, root));
}
function extractBlock(text, begin, end) {
  const b = text.indexOf(begin), e = text.indexOf(end);
  if (b === -1 || e === -1 || e < b) return null;
  return { start: b, end: e + end.length, block: text.slice(b, e + end.length) };
}
// Removes a block and the blank lines after it.
function cutBlock(text, blk) { return text.slice(0, blk.start) + text.slice(blk.end).replace(/^\n+/, ''); }

// ---------- settings, .gitignore, .gitattributes ----------
const isNegation = r => r.startsWith('Read(!');
// The kit's permission rules for these apps: the shared list, plus Composer's auth.json (registry tokens) for each
// PHP app. A bare `auth.json` rule would also hide translation files of that name, so these are anchored per app.
function kitPermissions(apps) {
  const php = (apps || []).filter(a => a.stacks.includes('php') || a.stacks.includes('laravel'));
  const auth = [...new Set(php.map(a => `Read(/${a.path === '.' ? '' : `${a.path}/`}auth.json)`))];
  const deny = KIT_SETTINGS.permissions.deny || [];
  return { deny: [...deny.filter(r => !isNegation(r)), ...auth, ...deny.filter(isNegation)], ask: KIT_SETTINGS.permissions.ask || [] };
}
// Adds kit permission rules the project doesn't have yet, skipping any the kit offered before (the user may have
// removed them on purpose). The user's own rules keep their order: a "!" pattern only carves exceptions out of rules
// listed before it, so new rules go in front of the user's negations and new negations go last.
// `drop` lists rules to take out first: the ones a change of autonomy mode retires.
function mergeSettings(existing, offered, apps, drop) {
  const kit = kitPermissions(apps);
  const out = existing ? JSON.parse(JSON.stringify(existing)) : {};
  const hadPermissions = Boolean(out.permissions);
  out.permissions = out.permissions || {};
  const added = { schema: !out.$schema };
  const dropped = { deny: [], ask: [] };
  for (const key of ['deny', 'ask']) {
    let cur = Array.isArray(out.permissions[key]) ? out.permissions[key] : [];
    const retire = ((drop && drop[key]) || []).filter(r => !kit[key].includes(r));
    dropped[key] = cur.filter(r => retire.includes(r));
    if (dropped[key].length) {
      cur = cur.filter(r => !retire.includes(r));
      if (cur.length) out.permissions[key] = cur; else delete out.permissions[key];
    }
    const fresh = kit[key].filter(r => !cur.includes(r) && !((offered && offered[key]) || []).includes(r));
    added[key] = fresh;
    if (!fresh.length) continue;
    const firstNegation = cur.findIndex(isNegation);
    const at = firstNegation === -1 ? cur.length : firstNegation;
    out.permissions[key] = [...cur.slice(0, at), ...fresh.filter(r => !isNegation(r)), ...cur.slice(at), ...fresh.filter(isNegation)];
  }
  if (!hadPermissions && !Object.keys(out.permissions).length) delete out.permissions;
  const merged = out.$schema ? out : { $schema: KIT_SETTINGS.$schema, ...out };
  return { merged, added, dropped };
}
function offeredRules(previous, apps) {
  const kit = kitPermissions(apps);
  const out = {};
  for (const key of ['deny', 'ask']) out[key] = [...new Set([...((previous && previous[key]) || []), ...kit[key]])];
  return out;
}
// Serializes JSON the way the existing file was indented.
function jsonText(value, existingRaw) {
  const indent = ((existingRaw || '').match(/^([ \t]+)"/m) || [])[1] || 2;
  return `${JSON.stringify(value, null, indent)}\n`;
}
// The kit's lines in .gitignore and .gitattributes sit in one block under GITIGNORE_HEADER, up to the next blank line.
function kitBlock(lines) {
  const h = lines.indexOf(GITIGNORE_HEADER);
  if (h === -1) return null;
  let end = h + 1;
  while (end < lines.length && lines[end].trim() !== '') end++;
  return { h, end };
}
// Takes the given lines out of the kit block; drops the header too when nothing else is left in the block.
function removeBlockLines(text, remove) {
  const all = text.split('\n');
  const blk = kitBlock(all);
  if (!blk) return { text, kept: 0 };
  const keep = all.slice(blk.h + 1, blk.end).filter(l => !remove.includes(l));
  const start = !keep.length && blk.h > 0 && all[blk.h - 1] === '' ? blk.h - 1 : blk.h;
  const out = keep.length ? [...all.slice(0, blk.h + 1), ...keep, ...all.slice(blk.end)] : [...all.slice(0, start), ...all.slice(blk.end)];
  return { text: out.join('\n').replace(/\n*$/, '\n'), kept: keep.length };
}

// ---------- planned writes ----------
// Collects changes; commit() checks every target and only then writes, so a refused plan leaves no trace.
function makeWriter(root, dryRun) {
  const log = [];
  const ops = [];
  return {
    log,
    write(rel, content, label, eol = '\n') {
      if (label) log.push(`${label.padEnd(9)} ${rel}`);
      ops.push({ rel, content: eol === '\n' ? content : content.replace(/\n/g, eol) });
    },
    remove(rel) { log.push(`removed   ${rel}`); ops.push({ rel, remove: true }); },
    note(msg) { log.push(msg); },
    // Applies the plan. If any write fails (permissions, full disk), puts back everything already changed.
    commit() {
      for (const op of ops) checkTarget(root, op.rel);
      if (dryRun) return;
      const done = [];
      let current = '';
      try {
        for (const op of ops) {
          current = op.rel;
          const abs = path.join(root, op.rel);
          const newDirs = [];
          for (let d = path.dirname(abs); d.length > root.length && !present(d); d = path.dirname(d)) newDirs.push(d);
          done.push({ abs, before: present(abs) ? fs.readFileSync(abs) : null, newDirs });
          if (op.remove) { fs.rmSync(abs, { force: true }); continue; }
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, op.content);
        }
      } catch (err) {
        let restored = true;
        for (const d of done.reverse()) {
          try { if (d.before === null) fs.rmSync(d.abs, { force: true }); else fs.writeFileSync(d.abs, d.before); } catch { restored = false; }
          for (const dir of d.newDirs) { try { fs.rmdirSync(dir); } catch { /* not empty */ } }
        }
        fail(`could not write ${current} (${err.code || err.message}); ${restored ? 'nothing was changed' : 'some changes could not be undone, check git status'}`);
      }
    },
  };
}
// A target must be a relative path inside the project with no symbolic link anywhere along it.
function checkTarget(root, rel) {
  const parts = rel.split('/');
  if (path.isAbsolute(rel) || parts.includes('..') || parts.includes('')) fail(`refusing to touch ${rel}: not a path inside the project`);
  let cur = root;
  for (const part of parts) {
    cur = path.join(cur, part);
    const st = lstat(cur);
    if (!st) return;
    if (st.isSymbolicLink()) fail(`refusing to write ${rel}: ${posix(path.relative(root, cur))} is a symbolic link; replace it with a real file or folder first`);
  }
}

// Plans the settings merge; returns the rules it adds and, when it creates the file, the content.
function writeSettings(root, w, offered, apps, drop) {
  const abs = path.join(root, SETTINGS);
  let existing = null;
  let raw = null;
  if (present(abs)) {
    raw = textOf(abs);
    try { existing = JSON.parse(raw); } catch { fail(`${SETTINGS} is not valid JSON; fix it first (nothing was changed)`); }
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) fail(`${SETTINGS} is not a JSON object; fix it first (nothing was changed)`);
  }
  const { merged, added, dropped } = mergeSettings(existing, offered, apps, drop);
  if (existing && JSON.stringify(existing) === JSON.stringify(merged)) { w.note(`unchanged ${SETTINGS}`); return { added, dropped, created: null }; }
  const next = jsonText(merged, raw);
  w.write(SETTINGS, next, existing ? 'merged' : 'created', existing ? eolOf(abs) : '\n');
  return { added, dropped, created: existing ? null : next };
}

// Adds the missing lines to the kit block of .gitignore or .gitattributes (creating the block, and the file when
// `create` allows). Returns the lines added and, when it created the file, the content.
function writeBlock(root, w, rel, lines, create = true) {
  const abs = path.join(root, rel);
  const had = present(abs);
  if (!had && !create) return { added: [], created: null };
  const text = had ? textOf(abs) : '';
  const have = new Set(text.split('\n').map(l => l.trim()));
  const add = lines.filter(l => !have.has(l));
  if (!add.length) { w.note(`unchanged ${rel}`); return { added: [], created: null }; }
  const all = text.split('\n');
  const blk = kitBlock(all);
  let next;
  if (blk) next = [...all.slice(0, blk.end), ...add, ...all.slice(blk.end)].join('\n');
  else next = `${text}${text && !text.endsWith('\n') ? '\n' : ''}${text ? '\n' : ''}${GITIGNORE_HEADER}\n${add.join('\n')}\n`;
  w.write(rel, next, had ? 'appended' : 'created', had ? eolOf(abs) : '\n');
  return { added: add, created: had ? null : next };
}

// Returns the content when this call creates the log.
function appendLog(root, w, line) {
  const rel = '05-progress/log.md';
  const abs = path.join(root, rel);
  const had = present(abs);
  const base = had ? textOf(abs) : read(path.join(LAYER, 'templates', 'log.md'));
  const content = `${base}${base.endsWith('\n') ? '' : '\n'}${line}\n`;
  w.write(rel, content, had ? 'appended' : 'created', had ? eolOf(abs) : '\n');
  return had ? null : content;
}

function manifestText(manifest) { return `${JSON.stringify(manifest, null, 2)}\n`; }

// ---------- manifest ----------
function validApp(a) {
  return Boolean(a) && typeof a.name === 'string' && APP_NAME.test(a.name) && Array.isArray(a.stacks) && a.stacks.length > 0
    && a.stacks.every(s => typeof s === 'string' && STACKS[s]) && typeof a.path === 'string' && safeAppPath(a.path);
}
// The manifest is committed with the project, so treat it as input: it may only name files the kit writes.
function newerThanKit(version) {
  const a = String(version || '0').split('.').map(Number), b = KIT_VERSION.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return false;
}
function loadManifest(root) {
  const abs = path.join(root, MANIFEST);
  if (!present(abs)) fail('no .claude/project-kit.json here; run install first');
  const m = jsonOf(abs);
  if (!m || !Array.isArray(m.apps) || !m.files || typeof m.files !== 'object') fail(`${MANIFEST} is not a valid project-kit manifest`);
  if (newerThanKit(m.kitVersion)) fail(`this project uses project-kit ${m.kitVersion}, newer than the installed ${KIT_VERSION}; run /plugin update project-kit@project-kit first`);
  const kitFile = /^\.claude\/(rules\/kit|templates)\/[\w][\w.-]*$/;
  const bad = [
    ...Object.keys(m.files).filter(rel => !kitFile.test(rel)),
    ...Object.keys(m.created || {}).filter(rel => !CREATABLE.has(rel)),
    ...m.apps.filter(a => !validApp(a) && !(a && Array.isArray(a.stacks) && a.stacks.some(s => !STACKS[s]))).map(a => `app ${JSON.stringify(a)}`),
  ];
  if (bad.length) fail(`${MANIFEST} names things project-kit never writes (${bad.join(', ')}); refusing to continue. Restore it from git history.`);
  const unknown = [...new Set(m.apps.flatMap(a => (Array.isArray(a.stacks) ? a.stacks : []).filter(s => !STACKS[s])))];
  if (unknown.length) fail(`this project uses stack(s) ${unknown.join(', ')} that project-kit ${KIT_VERSION} doesn't have; update the plugin, or fix the apps list in ${MANIFEST}`);
  return m;
}

// ---------- skip list (projects where the session hook should not offer setup) ----------
// The hook passes the physical path it compares against, so absolute paths are kept as given.
function projectKey(args) {
  const raw = args['project-dir'] || '.';
  if (path.isAbsolute(raw)) return raw.replace(/[\\/]+$/, '') || raw;
  try { return fs.realpathSync(path.resolve(raw)); } catch { return fail(`no such folder: ${raw}`); }
}
function recordSkip(dataDir, key) {
  const file = path.join(dataDir, SKIP_LIST);
  const list = textOf(file).split('\n').filter(Boolean);
  if (!list.includes(key)) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, `${[...list, key].join('\n')}\n`);
  }
  return file;
}

// ---------- commands ----------
function cmdStacks() {
  console.log('Stacks (use with --app name=<stack>[+<stack>]:<path>):');
  for (const [id, r] of Object.entries(STACKS)) console.log(`  ${id.padEnd(16)} ${r.kit.name || id}`);
}

function cmdDetect(args) {
  const found = detectApps(path.resolve(args['project-dir'] || '.'));
  if (args.json) { console.log(JSON.stringify(found, null, 2)); return; }
  if (!found.apps.length) console.log('No apps detected. Name them with --app <name>=<stack>:<path> (stacks: node kit.mjs stacks).');
  else {
    console.log('Detected apps (a suggestion from stack markers; confirm with the user):');
    for (const a of found.apps) console.log(`  ${a.name.padEnd(14)} ${a.stacks.join('+').padEnd(22)} ${a.path}`);
    console.log(`Install flags: ${found.apps.map(a => `--app ${fmtApp(a)}`).join(' ')}`);
  }
  for (const n of found.notes) console.log(`Note: ${n}`);
}

function cmdInstall(args) {
  const root = path.resolve(args['project-dir'] || '.');
  if (present(path.join(root, MANIFEST)) && !args.force) fail('project-kit is already installed here; use sync, add-app, or remove-app');
  const claudeAbs = path.join(root, 'CLAUDE.md');
  let apps;
  if (args.auto) {
    if (args.app.length) fail('use --auto or --app, not both');
    if (present(claudeAbs) || present(path.join(root, '.claude', 'CLAUDE.md'))) {
      fail('CLAUDE.md already exists, and automatic setup never edits it; run /project-kit:kickoff to merge the kit into it');
    }
    apps = detectApps(root).apps;
    if (apps.length > MAX_AUTO_APPS) fail(`found ${apps.length} apps, more than automatic setup takes on (${MAX_AUTO_APPS}); run /project-kit:kickoff to choose them`);
  } else {
    if (!args.app.length) fail('give at least one --app name=stack:path, or --auto to detect them');
    apps = args.app.map(parseApp);
  }
  const names = apps.map(a => a.name);
  if (new Set(names).size !== names.length) fail('app names must be unique');
  const autonomy = args.autonomy || 'guarded';
  if (!AUTONOMY.includes(autonomy)) fail(`unknown --autonomy "${autonomy}"; use ${AUTONOMY.join(' or ')}`);
  const rigor = args.rigor || 'standard';
  if (!RIGOR.includes(rigor)) fail(`unknown --rigor "${rigor}"; use ${RIGOR.join(', ')}`);
  const name = (args.name || path.basename(root)).replace(/[<>`|\r\n]/g, '').trim() || 'Project';
  const w = makeWriter(root, args['dry-run']);
  const created = {};
  const create = (rel, content) => { w.write(rel, content, 'created'); created[rel] = sha(content); };

  const tpl = splitTemplate();
  const profile = renderProfile(tpl.profile, name, apps, root);
  const merging = present(claudeAbs);
  let claudeText;
  if (merging) {
    if (isLink(claudeAbs)) fail('CLAUDE.md is a symbolic link; replace it with a real file (for example one containing @AGENTS.md), then rerun');
    const cur = read(claudeAbs);
    if (cur.includes(MARK.profileBegin) || cur.includes(MARK.coreBegin)) fail('CLAUDE.md already has project-kit blocks; use sync');
    if (!args['merge-claude-md']) {
      fail('CLAUDE.md already exists. Review it, then rerun with --merge-claude-md to append the kit blocks after your content.');
    }
    claudeText = `${cur.replace(/\n*$/, '\n')}\n${profile}\n\n${tpl.core}\n`;
  } else {
    const agents = present(path.join(root, 'AGENTS.md')) ? '@AGENTS.md\n\n' : '';
    claudeText = `${agents}${profile}\n\n${tpl.core}\n`;
  }
  if (present(path.join(root, '.claude', 'CLAUDE.md'))) w.note('warning   .claude/CLAUDE.md also exists; keep project rules in one place');

  for (const d of FOLDERS) {
    if (!present(path.join(root, d))) create(`${d}/.gitkeep`, '');
  }
  // Kit files never replace a file that is already there: an older template or rule stays, and sync reports it.
  const hashes = {};
  for (const [rel, content] of renderKitFiles(apps)) {
    const abs = path.join(root, rel);
    if (!present(abs)) { w.write(rel, content, 'kit'); hashes[rel] = sha(content); continue; }
    if (!isLink(abs) && textOf(abs) === content) { hashes[rel] = sha(content); continue; }
    w.note(`kept      ${rel} (already there and different from the kit's; compare with sync --dry-run, take the kit's with sync --force)`);
  }
  if (merging) w.write('CLAUDE.md', claudeText, 'merged', eolOf(claudeAbs)); else create('CLAUDE.md', claudeText);

  const when = stamp();
  if (!present(path.join(root, '05-progress', 'STATUS.md'))) {
    create('05-progress/STATUS.md', read(path.join(LAYER, 'templates', 'status.md')).replace('YYYY-MM-DD HH:MM (timezone)', `${when} UTC`));
  }
  const logLine = `${when} kit install v${KIT_VERSION}${args.auto ? ' (automatic)' : ''}: ${apps.map(a => `${a.name}=${a.stacks.join('+')}`).join(', ') || 'no apps yet'}`;
  const log = appendLog(root, w, logLine);
  if (log !== null) created['05-progress/log.md'] = sha(log);
  if (!present(path.join(root, 'CHANGELOG.md'))) create('CHANGELOG.md', read(path.join(LAYER, 'templates', 'changelog.md')));
  if (!present(path.join(root, GLOSSARY))) create(GLOSSARY, read(path.join(LAYER, 'templates', 'glossary.md')));
  const settings = writeSettings(root, w, null, apps);
  if (settings.created) created[SETTINGS] = sha(settings.created);
  const gitignore = writeBlock(root, w, '.gitignore', GITIGNORE_LINES);
  if (gitignore.created) created['.gitignore'] = sha(gitignore.created);
  const gitattributes = writeBlock(root, w, '.gitattributes', GITATTRIBUTES_LINES);
  if (gitattributes.created) created['.gitattributes'] = sha(gitattributes.created);

  w.write(MANIFEST, manifestText({
    kitVersion: KIT_VERSION, project: name, rigor, autonomy, apps, files: hashes, coreHash: sha(tpl.core), profileHash: sha(profile),
    created, settingsAdded: settings.added, settingsOffered: offeredRules(null, apps), gitignoreAdded: gitignore.added,
    gitattributesAdded: gitattributes.added, installedAt: today(), updatedAt: today(),
  }), null);
  w.commit();
  console.log(`${args['dry-run'] ? 'Dry run: would install' : 'Installed'} project-kit v${KIT_VERSION} in ${root}`);
  console.log(`Apps: ${apps.length ? apps.map(fmtApp).join(', ') : 'none detected'}`);
  console.log(`Rigor: ${rigor} · autonomy: ${autonomy}`);
  console.log(w.log.map(l => `  ${l}`).join('\n'));
}

function syncInto(root, manifest, args, w, drop) {
  const desired = renderKitFiles(manifest.apps);
  const files = {};
  const skipped = [];
  for (const [rel, content] of desired) {
    const abs = path.join(root, rel);
    const known = manifest.files[rel];
    if (isLink(abs)) {
      if (known) files[rel] = known;
      w.note(`skipped   ${rel} (a symbolic link; the kit doesn't write through links)`);
      continue;
    }
    if (!present(abs)) { w.write(rel, content, 'added'); files[rel] = sha(content); continue; }
    const cur = read(abs);
    if (cur === content) { files[rel] = sha(content); continue; }
    const pristine = Boolean(known) && sha(cur) === known;
    if (pristine || args.force) {
      if (!pristine) w.write(`${rel}.orig`, cur, 'backup');
      w.write(rel, content, 'updated');
      files[rel] = sha(content);
    } else {
      // Not the kit's content: keep only the hash the kit itself wrote, so the file stays protected.
      if (known) files[rel] = known;
      skipped.push(rel);
      w.note(`skipped   ${rel} (edited locally; move project-specific rules to .claude/rules/project/, or rerun with --force)`);
    }
  }
  for (const rel of Object.keys(manifest.files)) {
    const abs = path.join(root, rel);
    if (desired.has(rel) || !present(abs)) continue;
    if (!isLink(abs) && sha(read(abs)) === manifest.files[rel]) w.remove(rel);
    else w.note(`kept      ${rel} (no longer part of the kit, but edited locally)`);
  }
  // CLAUDE.md: the kit-owned core block, plus the profile block while it is still exactly as the kit rendered it.
  const claudeAbs = path.join(root, 'CLAUDE.md');
  const tpl = splitTemplate();
  let coreHash = manifest.coreHash;
  let profileHash = manifest.profileHash;
  let profileUpdated = false;
  const text = present(claudeAbs) && !isLink(claudeAbs) ? read(claudeAbs) : null;
  let next = text;
  const prof = text && extractBlock(text, MARK.profileBegin, MARK.profileEnd);
  if (prof && profileHash && sha(prof.block) === profileHash) {
    const rendered = renderProfile(tpl.profile, manifest.project, manifest.apps, root);
    if (rendered !== prof.block) { next = next.slice(0, prof.start) + rendered + next.slice(prof.end); profileUpdated = true; }
    profileHash = sha(rendered);
  }
  const core = next && extractBlock(next, MARK.coreBegin, MARK.coreEnd);
  if (!core) {
    w.note('problem   CLAUDE.md has no project-kit core block (or is a symbolic link); restore the markers or reinstall');
  } else if (core.block === tpl.core) {
    coreHash = sha(tpl.core);
  } else if (sha(core.block) === manifest.coreHash || args.force) {
    if (sha(core.block) !== manifest.coreHash) w.write('CLAUDE.md.orig', text, 'backup');
    next = next.slice(0, core.start) + tpl.core + next.slice(core.end);
    coreHash = sha(tpl.core);
  } else {
    skipped.push('CLAUDE.md core block');
    w.note('skipped   CLAUDE.md core block (edited locally; put project rules outside the block, or rerun with --force)');
  }
  if (text !== null && next !== text) w.write('CLAUDE.md', next, 'updated', eolOf(claudeAbs));
  const settings = writeSettings(root, w, manifest.settingsOffered || LEGACY_OFFERED, manifest.apps, drop || retiredIn(manifest));
  // New ignore and merge lines reach existing projects too. Installs from before 1.1.0 didn't record what they
  // created, so for those only files that already exist are extended.
  const canCreate = Boolean(manifest.created);
  const gitignore = writeBlock(root, w, '.gitignore', GITIGNORE_LINES, canCreate);
  const gitattributes = writeBlock(root, w, '.gitattributes', GITATTRIBUTES_LINES, canCreate);
  const created = {};
  if (gitignore.created) created['.gitignore'] = sha(gitignore.created);
  if (gitattributes.created) created['.gitattributes'] = sha(gitattributes.created);
  return {
    files, coreHash, profileHash, profileUpdated, settingsAdded: settings.added, settingsDropped: settings.dropped, skipped, created,
    gitignoreAdded: gitignore.added, gitattributesAdded: gitattributes.added,
  };
}

const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];
const minus = (a, b) => (a || []).filter(r => !(b || []).includes(r));
// Rules a mode change took out are no longer "added" or "offered", so switching back restores them, while a rule
// the project deleted by hand stays offered and never comes back.
function manifestAfter(manifest, res) {
  const gone = res.settingsDropped || {};
  const settingsAdded = manifest.settingsAdded && {
    schema: Boolean(manifest.settingsAdded.schema),
    deny: union(minus(manifest.settingsAdded.deny, gone.deny), res.settingsAdded.deny),
    ask: union(minus(manifest.settingsAdded.ask, gone.ask), res.settingsAdded.ask),
  };
  const before = manifest.settingsOffered || LEGACY_OFFERED;
  const offered = { deny: minus(before.deny, gone.deny), ask: minus(before.ask, gone.ask) };
  return {
    ...manifest, kitVersion: KIT_VERSION, files: res.files, coreHash: res.coreHash, profileHash: res.profileHash,
    settingsAdded, settingsOffered: offeredRules(offered, manifest.apps),
    created: manifest.created && { ...manifest.created, ...res.created },
    gitignoreAdded: union(manifest.gitignoreAdded, res.gitignoreAdded),
    gitattributesAdded: union(manifest.gitattributesAdded, res.gitattributesAdded),
    updatedAt: today(),
  };
}

function cmdSync(args) {
  const root = path.resolve(args['project-dir'] || '.');
  const manifest = loadManifest(root);
  const w = makeWriter(root, args['dry-run']);
  const res = syncInto(root, manifest, args, w);
  const from = manifest.kitVersion;
  if (w.log.some(l => /^(added|updated|removed)/.test(l))) appendLog(root, w, `${stamp()} kit sync v${from} → v${KIT_VERSION}`);
  w.write(MANIFEST, manifestText(manifestAfter(manifest, res)), null);
  w.commit();
  const changed = w.log.filter(l => !/^unchanged/.test(l));
  console.log(`${args['dry-run'] ? 'Dry run: sync' : 'Synced'} project-kit v${from} → v${KIT_VERSION}`);
  console.log(changed.length ? changed.map(l => `  ${l}`).join('\n') : '  everything already up to date');
  if (res.skipped.length) process.exitCode = 1;
}

// add-app and remove-app: change the app list, re-render rules, and refresh the profile tables while unedited.
function changeApps(args, next, summary) {
  const root = path.resolve(args['project-dir'] || '.');
  const w = makeWriter(root, args['dry-run']);
  const res = syncInto(root, next, args, w);
  w.write(MANIFEST, manifestText(manifestAfter(next, res)), null);
  w.commit();
  console.log(`${args['dry-run'] ? 'Dry run: ' : ''}${summary}`);
  console.log(w.log.filter(l => !/^unchanged/.test(l)).map(l => `  ${l}`).join('\n'));
  return res;
}

function cmdAddApp(args) {
  const root = path.resolve(args['project-dir'] || '.');
  const manifest = loadManifest(root);
  if (!args.app.length) fail('give --app name=stack:path');
  const add = args.app.map(parseApp);
  for (const a of add) if (manifest.apps.some(x => x.name === a.name)) fail(`app "${a.name}" already exists`);
  if (new Set(add.map(a => a.name)).size !== add.length) fail('app names must be unique');
  const res = changeApps(args, { ...manifest, apps: [...manifest.apps, ...add] }, `add ${add.map(fmtApp).join(', ')}`);
  if (res.profileUpdated) { console.log('The Project Profile tables in CLAUDE.md now list the new app(s).'); return; }
  console.log('\nAdd these rows to the Project Profile tables in CLAUDE.md (replacing any TBD row):');
  console.log(appRows(add));
  console.log(commandRows(add, root));
}

function cmdRemoveApp(args) {
  const manifest = loadManifest(path.resolve(args['project-dir'] || '.'));
  const names = args._.slice(1);
  if (!names.length) fail('give the name of each app to remove, e.g. remove-app web');
  for (const n of names) if (!manifest.apps.some(a => a.name === n)) fail(`no app named "${n}"`);
  const res = changeApps(args, { ...manifest, apps: manifest.apps.filter(a => !names.includes(a.name)) }, `remove ${names.join(', ')}`);
  if (res.profileUpdated) console.log('The Project Profile tables in CLAUDE.md are updated.');
  else console.log(`\nRemove the rows for ${names.join(', ')} from the Project Profile tables in CLAUDE.md.`);
}

// ---------- autonomy and rigor: project defaults kept in the manifest ----------
const UI_STACKS = new Set(['flutter', 'nuxt', 'nextjs', 'vite-spa', 'react-native', 'html-css']);
function askRulesIn(root) {
  const s = jsonOf(path.join(root, SETTINGS));
  const ask = s && s.permissions && s.permissions.ask;
  return Array.isArray(ask) ? ask : [];
}
function setManifestField(args, field, allowed, explain) {
  const root = path.resolve(args['project-dir'] || '.');
  const manifest = loadManifest(root);
  const from = field === 'rigor' ? rigorOf(manifest) : autonomyOf(manifest);
  const to = args._[1];
  if (!to) { console.log(`${field}: ${from}`); console.log(`  ${explain[from]}`); return; }
  if (!allowed.includes(to)) fail(`unknown ${field} "${to}"; use ${allowed.join(', ')}`);
  const w = makeWriter(root, args['dry-run']);
  if (from !== to) appendLog(root, w, `${stamp()} kit ${field} ${from} → ${to}`);
  w.write(MANIFEST, manifestText({ ...manifest, [field]: to, updatedAt: today() }), null);
  w.commit();
  console.log(`${args['dry-run'] ? 'Dry run: ' : ''}${field} ${from} → ${to}`);
  console.log(`  ${explain[to]}`);
  if (field === 'autonomy' && to === 'auto') {
    const left = askRulesIn(root);
    if (left.length) console.log(`  note: ${left.length} ask rule(s) in ${SETTINGS} still prompt in every permission mode: ${left.join(', ')}. Run sync to take out the ones the kit added; remove your own by hand if you want no prompts.`);
  }
}
function cmdAutonomy(args) {
  setManifestField(args, 'autonomy', AUTONOMY, {
    guarded: 'Claude asks before destructive commands and risky changes. A session can still run unattended with PROJECT_KIT_AUTONOMY=auto or --dangerously-skip-permissions.',
    auto: "Unattended by default: nothing asks; commands that print secrets or change remote infrastructure are denied. A session can opt back in with PROJECT_KIT_AUTONOMY=guarded.",
  });
}
function cmdRigor(args) {
  setManifestField(args, 'rigor', RIGOR, {
    prototype: 'Demos, spikes, and internal tools: smoke tests on the critical journey, light task files, no coverage floor or visual baselines. Security rules still apply.',
    standard: 'Most client work: test first, real-database integration tests, E2E for critical journeys, a reviewer per task.',
    production: 'Long-lived or regulated systems: every gate, including coverage floors, visual baselines, and the security gate on every sensitive task.',
  });
}

// ---------- task files: create, start, move, pick ----------
const TASK_FILE = /^(task|hotfix)-(\d{3})(?:-[\w.-]+)?\.md$/;
function slugOf(title) { return String(title).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'item'; }
function parseValue(raw) {
  const v = raw.trim();
  if (v.startsWith('"')) { const m = v.match(/^"((?:[^"\\]|\\.)*)"/); return m ? JSON.parse(`"${m[1]}"`) : v; }
  if (v.startsWith('[')) { const m = v.match(/^\[([^\]]*)\]/); return m ? m[1].split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : []; }
  const plain = v.replace(/\s+#.*$/, '').trim();
  return plain === 'null' || plain === '' ? null : plain === 'true' ? true : plain === 'false' ? false : plain;
}
function frontMatterOf(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^([a-z_]+):(.*)$/); if (kv) out[kv[1]] = parseValue(kv[2]); }
  return out;
}
function setFields(text, fields) {
  let out = text;
  for (const [key, value] of Object.entries(fields)) {
    const v = value === null ? 'null' : Array.isArray(value) ? `[${value.join(', ')}]` : typeof value === 'string' && /[:#"'[\]{}]|^\s|\s$|^$/.test(value) ? JSON.stringify(value) : String(value);
    const re = new RegExp(`^(${key}:)[ \\t]*(?:"(?:[^"\\\\]|\\\\.)*"|\\[[^\\]\\n]*\\]|[^#\\n]*?)([ \\t]+#.*)?$`, 'm');
    // Keep a trailing comment, at its old column when the new value still fits before it.
    if (re.test(out)) out = out.replace(re, (whole, k, comment) => {
      if (!comment) return `${k} ${v}`;
      const head = `${k} ${v}`;
      return `${head.padEnd(Math.max(whole.length - comment.trimStart().length, head.length + 1))}${comment.trimStart()}`;
    });
  }
  return out;
}
function walkMd(dir) {
  const out = [];
  for (const e of entriesOf(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(p)); else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}
function listTasks(root) {
  return walkMd(path.join(root, '04-tasks')).filter(f => TASK_FILE.test(path.basename(f))).map(f => {
    const fm = frontMatterOf(textOf(f));
    const id = path.basename(f).match(TASK_FILE).slice(1, 3).join('-');
    return {
      id, file: posix(path.relative(root, f)), title: fm.title || '', status: fm.status || 'todo', app: fm.app || '',
      phase: fm.phase || '', type: fm.type || '', depends_on: Array.isArray(fm.depends_on) ? fm.depends_on : [],
      blocked_reason: fm.blocked_reason || null, security_sensitive: fm.security_sensitive === true,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
function findTask(root, id) {
  if (!/^(task|hotfix)-\d{3}$/.test(String(id))) fail(`give a task id such as task-007 or hotfix-002 (got "${id || ''}")`);
  const t = listTasks(root).find(x => x.id === id);
  if (!t) fail(`no task file for ${id} under 04-tasks/`);
  return t;
}
function gitOut(root, ...a) { const r = spawnSync('git', a, { cwd: root, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; }
// One above the highest id in the folders and anywhere in git history, since other branches may hold newer ones.
function nextNumber(root, prefix, dirs) {
  const re = new RegExp(`(?:^|/)${prefix}-(\\d{2,3})`);
  const names = dirs.flatMap(d => walkMd(path.join(root, d)).map(f => posix(path.relative(root, f))));
  const logged = gitOut(root, 'log', '--all', '--format=', '--name-only', '--', ...dirs);
  if (logged) names.push(...logged.split('\n'));
  return names.reduce((max, n) => { const m = n.match(re); return m ? Math.max(max, Number(m[1])) : max; }, 0) + 1;
}
const isReady = (t, byId) => t.status === 'todo' && t.depends_on.every(d => byId.get(d) && byId.get(d).status === 'done');
const order = (a, b) => (a.id.startsWith('hotfix') === b.id.startsWith('hotfix') ? a.phase.localeCompare(b.phase) || a.id.localeCompare(b.id) : a.id.startsWith('hotfix') ? -1 : 1);
function readyTasks(tasks) { const byId = new Map(tasks.map(t => [t.id, t])); return tasks.filter(t => isReady(t, byId)).sort(order); }
function templateText(root, name) {
  const own = path.join(root, TEMPLATES_DIR, name);
  return present(own) && !isLink(own) ? read(own) : read(path.join(LAYER, 'templates', name));
}
function activePhase(root) {
  const phases = walkMd(path.join(root, '03-phases')).map(f => ({ f, fm: frontMatterOf(textOf(f)) })).filter(p => /^phase-\d+$/.test(p.fm.id || ''));
  const active = phases.find(p => p.fm.status === 'active') || phases.filter(p => p.fm.status === 'planned').sort((a, b) => a.fm.id.localeCompare(b.fm.id))[0];
  return active ? active.fm.id : null;
}
const mainCheckout = root => isDir(path.join(root, '.git'));
// Rewrites the Updated, Active task, Branch, and Queue lines of STATUS.md (main checkout only); the rest is Claude's.
function refreshStatus(root, w, tasks) {
  const rel = '05-progress/STATUS.md';
  const abs = path.join(root, rel);
  if (!mainCheckout(root) || !present(abs) || isLink(abs)) return;
  const active = tasks.filter(t => t.status === 'in-progress');
  const queue = readyTasks(tasks).slice(0, 5).map(t => t.id);
  const line = {
    'Updated:': `${stamp()} UTC`,
    'Active task:': active.length ? active.map(t => `${t.id} ${t.title}`.trim()).join('; ') : 'none',
    'Branch:': gitOut(root, 'branch', '--show-current') || 'unknown',
    'Queue:': queue.length ? queue.join(', ') : 'none',
  };
  const text = textOf(abs);
  const next = text.split('\n').map(l => { const k = Object.keys(line).find(x => l.startsWith(x)); return k ? `${k} ${line[k]}` : l; }).join('\n');
  if (next !== text) w.write(rel, next, 'updated', eolOf(abs));
}

function cmdNew(args) {
  const root = path.resolve(args['project-dir'] || '.');
  const manifest = loadManifest(root);
  const kind = args._[1];
  const title = (args.title || args._.slice(2).join(' ')).replace(/[\r\n]+/g, ' ').trim();
  if (!['task', 'hotfix', 'adr', 'phase'].includes(kind)) fail('use: new task|hotfix|adr|phase --title "…"');
  if (!title) fail(`give the ${kind} a --title`);
  const w = makeWriter(root, args['dry-run']);
  const date = today();
  let rel, text, id;
  if (kind === 'phase') {
    if (args.phase && !/^phase-\d{2}$/.test(args.phase)) fail(`bad --phase "${args.phase}"; expected phase-00 or similar`);
    id = args.phase || `phase-${String(nextNumber(root, 'phase', ['03-phases'])).padStart(2, '0')}`;
    rel = `03-phases/${id}-${slugOf(title)}.md`;
    text = setFields(templateText(root, 'phase.md'), { id, title, status: 'planned', created: date, updated: date })
      .replace(/^# phase-\d+: .*$/m, `# ${id}: ${title}`);
  } else if (kind === 'adr') {
    id = `ADR-${String(nextNumber(root, 'ADR', ['06-technical-docs/decisions'])).padStart(3, '0')}`;
    rel = `06-technical-docs/decisions/${id}-${slugOf(title)}.md`;
    text = setFields(templateText(root, 'adr.md'), { id, status: 'proposed', date })
      .replace(/^# ADR-\d+: .*$/m, `# ${id}: ${title}`);
  } else {
    const prefix = kind;
    id = `${prefix}-${String(nextNumber(root, prefix, ['04-tasks'])).padStart(3, '0')}`;
    const phase = kind === 'hotfix' ? 'hotfix' : args.phase || activePhase(root) || 'phase-01';
    if (!/^(phase-\d+|hotfix)$/.test(phase)) fail(`bad --phase "${phase}"; expected phase-01 or similar`);
    const names = manifest.apps.map(a => a.name);
    const app = (args.app[0] || (names.length === 1 ? names[0] : '')).trim();
    if (!app) fail(`give --app (one of: ${names.join(', ') || 'none; add apps first'})`);
    for (const a of app.split(',')) if (!names.includes(a.trim())) fail(`no app named "${a.trim()}" (apps: ${names.join(', ')})`);
    const type = args.type || (kind === 'hotfix' ? 'fix' : 'feat');
    if (!['feat', 'fix', 'refactor', 'test', 'docs', 'chore'].includes(type)) fail(`bad --type "${type}"`);
    const depends = String(args.depends || '').split(',').map(x => x.trim()).filter(Boolean);
    for (const d of depends) if (!/^(task|hotfix)-\d{3}$/.test(d)) fail(`bad --depends entry "${d}"`);
    rel = `04-tasks/${phase}/${id}-${slugOf(title)}.md`;
    text = setFields(templateText(root, 'task.md'), {
      id, type, title, phase, app, status: 'todo', security_sensitive: Boolean(args.security), ui: Boolean(args.ui),
      depends_on: depends, created: date, updated: date, owner: 'claude',
    }).replace(/^# (task|hotfix)-\d+: .*$/m, `# ${id}: ${title}`);
    // The phase's task table gets the row (status lives only in the task file).
    const phaseFile = walkMd(path.join(root, '03-phases')).find(f => path.basename(f).startsWith(`${phase}-`) || path.basename(f) === `${phase}.md`);
    if (phaseFile && !isLink(phaseFile)) {
      const lines = textOf(phaseFile).split('\n');
      const h = lines.findIndex(l => /^\|\s*id\s*\|\s*title\s*\|/.test(l));
      if (h !== -1) {
        let end = h + 2;
        while (end < lines.length && lines[end].startsWith('|')) end++;
        const rows = lines.slice(h + 2, end).filter(l => !/^\|\s*task-\d{3}\s*\|\s*\|/.test(l));
        rows.push(`| ${id} | ${title.replace(/\|/g, '\\|')} | ${app} | ${depends.join(', ')} |`);
        lines.splice(h + 2, end - h - 2, ...rows);
        w.write(posix(path.relative(root, phaseFile)), lines.join('\n'), 'updated', eolOf(phaseFile));
      }
    }
  }
  if (present(path.join(root, rel))) fail(`${rel} already exists`);
  w.write(rel, text, 'created');
  appendLog(root, w, `${stamp()} ${id} created: ${title}`);
  if (kind === 'task' || kind === 'hotfix') refreshStatus(root, w, [...listTasks(root), { id, title, status: 'todo', depends_on: String(args.depends || '').split(',').map(x => x.trim()).filter(Boolean), phase: '', app: '' }]);
  w.commit();
  console.log(`${args['dry-run'] ? 'Dry run: would create' : 'Created'} ${id}: ${rel}`);
  if (kind === 'task' || kind === 'hotfix') console.log(`  Fill in its acceptance criteria and test plan, then: node kit.mjs start ${id}`);
}

function changeTask(root, args, id, fields, logText) {
  const t = findTask(root, id);
  const w = makeWriter(root, args['dry-run']);
  const abs = path.join(root, t.file);
  if (isLink(abs)) fail(`${t.file} is a symbolic link; the kit doesn't write through links`);
  w.write(t.file, setFields(read(abs), { ...fields, updated: today() }), 'updated', eolOf(abs));
  appendLog(root, w, `${stamp()} ${id} ${logText}`);
  refreshStatus(root, w, listTasks(root).map(x => (x.id === id ? { ...x, ...fields } : x)));
  w.commit();
  return t;
}

function cmdStart(args) {
  const root = path.resolve(args['project-dir'] || '.');
  loadManifest(root);
  const id = args._[1];
  const t = findTask(root, id);
  const byId = new Map(listTasks(root).map(x => [x.id, x]));
  const waiting = t.depends_on.filter(d => !byId.get(d) || byId.get(d).status !== 'done');
  if (waiting.length) console.log(`note: ${id} depends on ${waiting.map(d => `${d} (${byId.get(d) ? byId.get(d).status : 'missing'})`).join(', ')}; cut its branch from the branch of the unmerged one`);
  const branch = `${id}-${slugOf(path.basename(t.file, '.md').replace(/^(task|hotfix)-\d{3}-?/, '') || t.title)}`;
  const inGit = gitOut(root, 'rev-parse', '--is-inside-work-tree') === 'true';
  if (inGit && !args['dry-run']) {
    const current = gitOut(root, 'branch', '--show-current');
    if (current !== branch) {
      if (gitOut(root, 'status', '--porcelain', '--untracked-files=no') && !args.force) fail('the working tree has uncommitted changes; commit or park them (wip commit) first, or pass --force');
      const exists = gitOut(root, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`) !== null;
      const r = spawnSync('git', exists ? ['switch', branch] : ['switch', '-c', branch], { cwd: root, encoding: 'utf8' });
      if (r.status !== 0) fail(`git switch failed: ${(r.stderr || '').trim()}`);
    }
  }
  changeTask(root, args, id, { status: 'in-progress', blocked_reason: null }, `${t.status} → in-progress`);
  console.log(`${args['dry-run'] ? 'Dry run: would start' : 'Started'} ${id} on branch ${inGit ? branch : '(not a git repository)'}: ${t.file}`);
}

function cmdSet(args) {
  const root = path.resolve(args['project-dir'] || '.');
  loadManifest(root);
  const [, id, status] = args._;
  if (!STATUSES.includes(status)) fail(`give a status: ${STATUSES.join(', ')}`);
  if (status === 'blocked' && !args.reason) fail('a blocked task needs --reason "…"');
  const t = findTask(root, id);
  changeTask(root, args, id, { status, blocked_reason: status === 'blocked' ? args.reason : null }, `${t.status} → ${status}${args.reason ? `: ${args.reason}` : ''}`);
  console.log(`${args['dry-run'] ? 'Dry run: ' : ''}${id} ${t.status} → ${status}`);
}

function cmdNext(args) {
  const root = path.resolve(args['project-dir'] || '.');
  loadManifest(root);
  const tasks = listTasks(root);
  const ready = readyTasks(tasks);
  const pick = args.parallel ? ready : ready.slice(0, 1);
  if (args.json) { console.log(JSON.stringify(pick, null, 2)); return; }
  const doing = tasks.filter(t => t.status === 'in-progress');
  if (doing.length) console.log(`in progress: ${doing.map(t => t.id).join(', ')} (finish or park it before starting another in this checkout)`);
  if (!pick.length) {
    const blocked = tasks.filter(t => t.status === 'blocked');
    console.log(`No ready task.${blocked.length ? ` Blocked: ${blocked.map(t => `${t.id} (${t.blocked_reason || 'no reason'})`).join('; ')}` : ''}`);
    return;
  }
  for (const t of pick) console.log(`${t.id}  ${t.title}  [${t.app}${t.security_sensitive ? ', security-sensitive' : ''}]  ${t.file}`);
  if (args.parallel && pick.length > 1) {
    const apps = pick.map(t => t.app);
    const shared = [...new Set(apps.filter((a, i) => apps.indexOf(a) !== i))];
    console.log(`These can run in parallel, one worktree each.${shared.length ? ` Tasks on the same app (${shared.join(', ')}) may touch the same files; run those one after another.` : ''}`);
  } else console.log(`Start it: node kit.mjs start ${pick[0].id}`);
}

function cmdBoard(args) {
  const root = path.resolve(args['project-dir'] || '.');
  loadManifest(root);
  const tasks = listTasks(root);
  if (args.json) { console.log(JSON.stringify(tasks, null, 2)); return; }
  const ready = new Set(readyTasks(tasks).map(t => t.id));
  console.log(STATUSES.map(s => `${s} ${tasks.filter(t => t.status === s).length}`).join(' · '));
  for (const s of ['in-progress', 'in-review', 'blocked', 'todo']) {
    const list = tasks.filter(t => t.status === s);
    if (!list.length) continue;
    console.log(`\n${s}`);
    for (const t of list) console.log(`  ${t.id}  ${t.title}${s === 'blocked' ? `  — ${t.blocked_reason || 'no reason'}` : ''}${s === 'todo' ? (ready.has(t.id) ? '  (ready)' : `  (waits on ${t.depends_on.join(', ')})`) : ''}`);
  }
}

// ---------- quick checks and starter repositories ----------
function cmdCheck(args) {
  const root = path.resolve(args['project-dir'] || '.');
  const manifest = loadManifest(root);
  const name = args._[1];
  const checks = { ...(manifest.checks || {}) };
  const effective = a => (a.name in checks ? checks[a.name] : a.stacks.map(s => STACKS[s].kit.check).find(Boolean) || '');
  if (!name) {
    for (const a of manifest.apps) { const c = effective(a); console.log(`  ${a.name.padEnd(14)} ${c ? `${c.cmd}${c.ext ? `  (.${c.ext.split(',').join(', .')})` : ''}` : 'off'}`); }
    return;
  }
  if (!manifest.apps.some(a => a.name === name)) fail(`no app named "${name}"`);
  if (args.reset) delete checks[name];
  else if (args.off) checks[name] = '';
  else if (args.cmd) checks[name] = { cmd: args.cmd, ...(args.ext ? { ext: args.ext } : {}) };
  else fail('give --cmd "…{file}…" [--ext php,inc], --off, or --reset');
  const w = makeWriter(root, args['dry-run']);
  w.write(MANIFEST, manifestText({ ...manifest, checks, updatedAt: today() }), null);
  w.commit();
  const c = effective({ ...manifest.apps.find(a => a.name === name), name });
  console.log(`${name}: quick check ${c ? `\`${c.cmd}\`` : 'off'}`);
}

function startersFile() { return path.join(process.env.PROJECT_KIT_HOME || path.join(os.homedir(), '.claude', 'project-kit'), 'starters.json'); }
function cmdStarters(args) {
  const file = startersFile();
  const list = jsonOf(file) || {};
  const [, action, stack, url] = args._;
  if (!action) {
    const keys = Object.keys(list);
    if (!keys.length) console.log(`No starter repositories yet. Add one: node kit.mjs starters set <stack> <git-url> (kept in ${file})`);
    for (const k of keys) console.log(`  ${k.padEnd(16)} ${list[k]}`);
    return;
  }
  if (!['set', 'remove'].includes(action)) fail('use: starters, starters set <stack> <git-url>, or starters remove <stack>');
  if (!STACKS[stack]) fail(`unknown stack "${stack}". Run: node kit.mjs stacks`);
  if (action === 'set') {
    if (!/^(https:\/\/|ssh:\/\/|git@|file:\/\/|\/|[A-Za-z]:[\\/])\S+$/.test(url || '')) fail('give a git URL (https://…, git@…:…, or a local path)');
    list[stack] = url;
  } else delete list[stack];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(list, null, 2)}\n`);
  console.log(`${action === 'set' ? `starter for ${stack}: ${url}` : `removed the starter for ${stack}`} (${file})`);
}

// Removes what install created and nobody has edited since, gives merged files their own content back, and
// reports everything it keeps.
function cmdUninstall(args) {
  const root = path.resolve(args['project-dir'] || '.');
  const manifest = loadManifest(root);
  const dryRun = args['dry-run'];
  const w = makeWriter(root, dryRun);
  const created = manifest.created || {};
  const removed = [];
  const removeIfUnchanged = (rel, hash) => {
    const abs = path.join(root, rel);
    if (!present(abs)) return;
    if (!isLink(abs) && sha(read(abs)) === hash) { w.remove(rel); removed.push(rel); } else w.note(`kept      ${rel} (changed since install)`);
  };
  for (const [rel, hash] of Object.entries(manifest.files)) removeIfUnchanged(rel, hash);
  for (const [rel, hash] of Object.entries(created)) {
    if (!['CLAUDE.md', SETTINGS, '.gitignore', '.gitattributes'].includes(rel)) removeIfUnchanged(rel, hash);
  }

  // CLAUDE.md: drop the core block if unedited; drop the profile block if unedited, else keep its text without markers.
  const claudeAbs = path.join(root, 'CLAUDE.md');
  if (isLink(claudeAbs)) w.note('kept      CLAUDE.md (a symbolic link; remove the kit blocks by hand)');
  else if (present(claudeAbs)) {
    const text = read(claudeAbs);
    const core = extractBlock(text, MARK.coreBegin, MARK.coreEnd);
    if (!core || sha(core.block) !== manifest.coreHash) {
      w.note('kept      CLAUDE.md (its project-kit core block was edited; remove the kit blocks by hand)');
    } else {
      let next = cutBlock(text, core);
      let keptProfile = false;
      const prof = extractBlock(next, MARK.profileBegin, MARK.profileEnd);
      if (prof && manifest.profileHash && sha(prof.block) === manifest.profileHash) next = cutBlock(next, prof);
      else if (prof) {
        const inner = prof.block.slice(prof.block.indexOf('\n') + 1, prof.block.length - MARK.profileEnd.length).replace(/\n$/, '');
        next = next.slice(0, prof.start) + inner + next.slice(prof.end);
        keptProfile = true;
      }
      next = next.replace(/\s+$/, '');
      if (created['CLAUDE.md'] && (next === '' || next === '@AGENTS.md')) { w.remove('CLAUDE.md'); removed.push('CLAUDE.md'); }
      else {
        w.write('CLAUDE.md', `${next}\n`, keptProfile ? 'updated' : 'restored', eolOf(claudeAbs));
        if (keptProfile) w.note('kept      the project profile text in CLAUDE.md (edited, or from an older install); only the kit rules block is gone');
      }
    }
  }
  if (!manifest.created) {
    const leftovers = [...CREATABLE].filter(rel => !['CLAUDE.md', SETTINGS, '.gitignore', '.gitattributes'].includes(rel) && present(path.join(root, rel)));
    if (leftovers.length) w.note(`kept      ${leftovers.map(rel => rel.replace(/\/\.gitkeep$/, '/')).join(', ')} (project-kit ${manifest.kitVersion} didn't record what it created; delete what you don't need)`);
  }

  // .claude/settings.json: take out what install and sync added.
  const settingsAbs = path.join(root, SETTINGS);
  const added = manifest.settingsAdded;
  if (!present(settingsAbs)) { /* nothing to restore */ }
  else if (!added) w.note(`kept      ${SETTINGS} (this install didn't record which rules it added; remove them by hand)`);
  else if (isLink(settingsAbs)) w.note(`kept      ${SETTINGS} (a symbolic link; remove the project-kit rules by hand)`);
  else {
    const raw = textOf(settingsAbs);
    const s = jsonOf(settingsAbs);
    if (!s || typeof s !== 'object') w.note(`kept      ${SETTINGS} (not valid JSON; remove the project-kit rules by hand)`);
    else {
      const perms = s.permissions || {};
      for (const key of ['deny', 'ask']) {
        if (!Array.isArray(perms[key])) continue;
        perms[key] = perms[key].filter(r => !(added[key] || []).includes(r));
        if (!perms[key].length) delete perms[key];
      }
      if (s.permissions && !Object.keys(s.permissions).length) delete s.permissions;
      if (added.schema) delete s.$schema;
      if (created[SETTINGS] && !Object.keys(s).length) { w.remove(SETTINGS); removed.push(SETTINGS); }
      else w.write(SETTINGS, jsonText(s, raw), 'restored', eolOf(settingsAbs));
    }
  }

  // .gitignore and .gitattributes: take the recorded lines out of the kit block.
  for (const [rel, lines] of [['.gitignore', manifest.gitignoreAdded], ['.gitattributes', manifest.gitattributesAdded]]) {
    const abs = path.join(root, rel);
    if (!present(abs) || isLink(abs)) continue;
    const text = textOf(abs);
    if (!text.split('\n').includes(GITIGNORE_HEADER)) continue;
    const res = removeBlockLines(text, lines || []);
    if (res.kept) w.note(`kept      ${res.kept} line(s) of the ${GITIGNORE_HEADER} block in ${rel} (added by an install that didn't record them; remove by hand if unwanted)`);
    if (created[rel] && !res.text.trim()) { w.remove(rel); removed.push(rel); }
    else if (res.text !== text) w.write(rel, res.text, 'restored', eolOf(abs));
  }

  w.remove(MANIFEST);
  removed.push(MANIFEST);
  w.commit();
  if (!dryRun) {
    // Remove folders the removals left empty, deepest first.
    const dirs = new Set();
    for (const rel of removed) for (let d = path.dirname(rel); d !== '.'; d = path.dirname(d)) dirs.add(d);
    for (const d of [...dirs].sort((a, b) => b.length - a.length)) { try { fs.rmdirSync(path.join(root, d)); } catch { /* not empty */ } }
    if (args['data-dir']) {
      recordSkip(args['data-dir'], projectKey(args));
      w.note('skip list: the session hook will not offer or run setup in this repo again');
    }
  }
  console.log(`${dryRun ? 'Dry run: uninstall would change' : 'Uninstalled project-kit from'} ${root}`);
  console.log(w.log.map(l => `  ${l}`).join('\n'));
}

function cmdSkip(args) {
  if (!args['data-dir']) fail('give --data-dir (the plugin data folder; the session notice prints the full command)');
  const key = projectKey(args);
  const file = recordSkip(args['data-dir'], key);
  console.log(`project-kit won't offer setup in ${key} again (listed in ${file}; delete that line to undo).`);
}

function has(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'sh', process.platform === 'win32' ? [cmd] : ['-c', `command -v ${cmd}`], { stdio: 'ignore' });
  return r.status === 0;
}

function cmdDoctor(args) {
  const root = path.resolve(args['project-dir'] || '.');
  const out = [];
  let problems = 0;
  const ok = m => out.push(`  ok    ${m}`);
  const warn = m => out.push(`  warn  ${m}`);
  const bad = m => { problems++; out.push(`  FAIL  ${m}`); };

  if (!present(path.join(root, MANIFEST))) { console.log('project-kit doctor\n  FAIL  not installed (no .claude/project-kit.json); run /project-kit:kickoff'); process.exit(1); }
  const manifest = loadManifest(root);
  (manifest.kitVersion === KIT_VERSION ? ok : warn)(`kit version ${manifest.kitVersion} (plugin ${KIT_VERSION})${manifest.kitVersion === KIT_VERSION ? '' : ' → run /project-kit:sync'}`);
  if (manifest.apps.length) ok(`apps: ${manifest.apps.map(a => `${a.name} (${a.stacks.join('+')}) at ${a.path}`).join('; ')}`);
  else warn('no apps yet → add them with /project-kit:add-stack or /project-kit:kickoff');
  for (const a of manifest.apps) if (a.path !== '.' && !exists(path.join(root, a.path))) warn(`app folder ${a.path} does not exist yet`);
  ok(`rigor: ${rigorOf(manifest)} · autonomy: ${autonomyOf(manifest)} (a session can override it with PROJECT_KIT_AUTONOMY or --dangerously-skip-permissions)`);
  const leftover = askRulesIn(root);
  if (leftover.length) warn(`${leftover.length} ask rule(s) in ${SETTINGS} prompt in every permission mode, also in unattended sessions: ${leftover.slice(0, 5).join(', ')}${leftover.length > 5 ? ', …' : ''}`);
  const uiApps = manifest.apps.filter(a => a.stacks.some(s => UI_STACKS.has(s)));
  const design = textOf(path.join(root, 'DESIGN.md'));
  if (uiApps.length && !design) warn('DESIGN.md missing; UI apps need a chosen design direction (/project-kit:design-intake)');
  else if (uiApps.length && /UNCHOSEN/.test(design)) warn('DESIGN.md is still the unchosen starter; pick a direction with /project-kit:design-intake before building screens');
  if (!exists(path.join(root, GLOSSARY)) || /^\|\s*\*\*Term\*\*/m.test(textOf(path.join(root, GLOSSARY)))) warn(`${GLOSSARY} has no terms yet; add the client's words as they come up`);
  const node = Number(process.versions.node.split('.')[0]);
  (node >= 20 ? ok : bad)(`Node.js ${process.versions.node} runs the hooks${node >= 20 ? '' : '; the hooks need Node 20 or later'}`);

  const desired = renderKitFiles(manifest.apps);
  let missing = 0, edited = 0;
  for (const rel of desired.keys()) {
    const abs = path.join(root, rel);
    if (!exists(abs)) missing++;
    else if (!manifest.files[rel] || sha(read(abs)) !== manifest.files[rel]) edited++;
  }
  if (missing) bad(`${missing} kit file(s) missing → run /project-kit:sync`); else ok('kit rules and templates present');
  if (edited) warn(`${edited} kit file(s) differ from the kit's version (sync skips them; see sync --dry-run)`);

  const claudeAbs = path.join(root, 'CLAUDE.md');
  if (!exists(claudeAbs)) bad('CLAUDE.md missing');
  else {
    const t = read(claudeAbs);
    if (!extractBlock(t, MARK.coreBegin, MARK.coreEnd)) bad('CLAUDE.md has no project-kit core block');
    else ok('CLAUDE.md core block present');
    const lines = t.replace(/<!--[\s\S]*?-->/g, '').split('\n').length;
    (lines <= 200 ? ok : warn)(`CLAUDE.md is ${lines} lines without comments (aim for under 200)`);
    const tbd = (t.match(/\bTBD\b/g) || []).length;
    const verify = (t.match(/\(verify\)/g) || []).length;
    if (tbd) warn(`${tbd} TBD value(s) in the Project Profile`);
    if (verify) warn(`${verify} command(s) still marked (verify)`);
  }

  const statusAbs = path.join(root, '05-progress', 'STATUS.md');
  if (!exists(statusAbs)) bad('05-progress/STATUS.md missing');
  else {
    const s = read(statusAbs);
    (s.length <= 7000 && s.split('\n').length <= 60 ? ok : warn)(`STATUS.md ${s.split('\n').length} lines, ${s.length} chars (keep under 60 lines)`);
  }

  const settingsAbs = path.join(root, SETTINGS);
  if (!exists(settingsAbs)) bad(`${SETTINGS} missing (secret file deny rules)`);
  else {
    const deny = ((jsonOf(settingsAbs) || {}).permissions || {}).deny || [];
    if (deny.includes('Read(.env)')) ok('Claude is blocked from reading .env files'); else bad('Read(.env) deny rule missing');
  }

  const inGit = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, encoding: 'utf8' }).status === 0;
  if (!inGit) warn('not a git repository');
  else {
    const files = (spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).stdout || '').split('\0').filter(Boolean);
    // Symfony commits .env and .env.test with non-secret defaults, so in a PHP app's folder those two only warn.
    const phpDirs = manifest.apps.filter(a => a.stacks.includes('php')).map(a => a.path);
    const defaults = files.filter(f => /(^|\/)\.env(\.test)?$/.test(f) && phpDirs.includes(path.posix.dirname(f)));
    const secretLike = files.filter(f => !defaults.includes(f) && SECRET_FILE.test(f));
    if (secretLike.length) bad(`secret-like files are tracked by git: ${secretLike.join(', ')} → remove them from history and rotate what they hold`);
    else ok('no key, credential, or .env files tracked by git');
    if (defaults.length) warn(`tracked ${defaults.join(', ')}: make sure they hold only non-secret defaults`);
    const ignored = spawnSync('git', ['check-ignore', '-q', '.env'], { cwd: root }).status === 0;
    (ignored ? ok : bad)('.env is git-ignored');
  }

  for (const t of ['git', 'docker', 'node', 'npx', 'gitleaks']) (has(t) ? ok : warn)(`${t} ${has(t) ? 'found' : 'not found'}`);
  console.log(`project-kit doctor (${root})\n${out.join('\n')}\n${problems ? `${problems} problem(s) found` : 'no blocking problems'}`);
  process.exitCode = problems ? 1 : 0;
}

const HELP = `project-kit ${KIT_VERSION}
  node kit.mjs stacks                      list stack ids
  node kit.mjs detect [--json]             suggest apps from stack markers in the repo
  node kit.mjs install --app <name>=<stack>[+<stack>]:<path> [--app ...] [--name "Project"] [--rigor prototype|standard|production]
                   [--autonomy guarded|auto] [--merge-claude-md] [--dry-run]
  node kit.mjs install --auto [--dry-run]  install with the detected apps; refuses when CLAUDE.md exists
  node kit.mjs add-app --app <name>=<stack>:<path> [--dry-run]
  node kit.mjs remove-app <name> [<name> ...] [--dry-run]
  node kit.mjs sync [--dry-run] [--force]
  node kit.mjs autonomy [guarded|auto]      show or set the project's default autonomy
  node kit.mjs rigor [prototype|standard|production]   show or set how much process the project carries
  node kit.mjs new task --title "…" [--phase phase-01] [--app web] [--type feat] [--security] [--ui] [--depends task-001,task-002]
  node kit.mjs new hotfix|adr --title "…"      new phase --title "…" [--phase phase-00]
  node kit.mjs start <id>                   branch <id>-<slug>, mark it in-progress, update STATUS.md
  node kit.mjs set <id> <status> [--reason "…"]   backlog todo in-progress blocked in-review done cancelled
  node kit.mjs next [--parallel] [--json]   the next ready task (dependencies done), or every ready one
  node kit.mjs board [--json]               tasks by status
  node kit.mjs check <app> [--cmd "…{file}…" --ext php,inc | --off | --reset]   the quick check after each edit
  node kit.mjs starters [set <stack> <git-url> | remove <stack>]   starter repositories kickoff clones for new apps
  node kit.mjs doctor
  node kit.mjs uninstall [--data-dir <plugin data dir>] [--dry-run]   remove what install created and nobody edited
  node kit.mjs skip --data-dir <plugin data dir>   stop the session hook from offering setup in this repo
Options: --project-dir <dir> (default: current directory)`;

const COMMANDS = {
  stacks: cmdStacks, detect: cmdDetect, install: cmdInstall, 'add-app': cmdAddApp, 'remove-app': cmdRemoveApp,
  sync: cmdSync, autonomy: cmdAutonomy, rigor: cmdRigor, new: cmdNew, start: cmdStart, set: cmdSet,
  next: cmdNext, board: cmdBoard, check: cmdCheck, starters: cmdStarters, doctor: cmdDoctor, uninstall: cmdUninstall, skip: cmdSkip,
};
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (!cmd || args.help) { console.log(HELP); process.exit(0); }
if (!COMMANDS[cmd]) fail(`unknown command "${cmd}"\n${HELP}`);
try {
  COMMANDS[cmd](args);
} catch (err) {
  fail(`${cmd} stopped on an unexpected error: ${err.message}`);
}
