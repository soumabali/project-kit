#!/usr/bin/env node
// PostToolUse hook for Write, Edit, and MultiEdit in project-kit projects: runs the app's quick check (a syntax or
// lint check of just that file, a few seconds at most) so a mistake surfaces at once instead of at the end of the
// task. The check comes from the app's stack (the kit: line of its rule) or from `checks` in the manifest, which
// `kit.mjs check` sets. A missing tool, a timeout, or a file the check doesn't cover is skipped silently.
// Exit 2 shows the failure to Claude; the edit has already happened.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readStdin, findProject, stackMeta } from '../lib/project.mjs';

let event;
try { event = JSON.parse(readStdin() || '{}'); } catch { process.exit(0); }
const file = event && event.tool_input && event.tool_input.file_path;
if (typeof file !== 'string' || !file) process.exit(0);
const abs = path.resolve(event.cwd || process.cwd(), file);
const project = findProject(path.dirname(abs));
if (!project || !Array.isArray(project.manifest.apps)) process.exit(0);
const rel = path.relative(project.root, abs).split(path.sep).join('/');
if (rel.startsWith('..')) process.exit(0);

// The app holding the file: the longest app path that contains it.
const app = project.manifest.apps
  .filter(a => a && typeof a.path === 'string' && (a.path === '.' || rel === a.path || rel.startsWith(`${a.path}/`)))
  .sort((a, b) => b.path.length - a.path.length)[0];
if (!app) process.exit(0);
const override = project.manifest.checks && project.manifest.checks[app.name];
let check = null;
if (override === '' || override === false) process.exit(0);
if (override && typeof override === 'object') check = override;
else for (const s of app.stacks || []) { const c = stackMeta(s).check; if (c) { check = c; break; } }
if (!check || typeof check.cmd !== 'string') process.exit(0);

const ext = path.extname(abs).slice(1).toLowerCase();
const exts = String(check.ext || '').split(',').map(x => x.trim()).filter(Boolean);
if (exts.length && !exts.includes(ext)) process.exit(0);

const appDir = path.join(project.root, app.path);
const onPath = name => (process.env.PATH || '').split(path.delimiter).some(dir => ['', '.exe', '.cmd', '.bat']
  .some(e => { try { return fs.statSync(path.join(dir, name + e)).isFile(); } catch { return false; } }));
if (check.requires && !(String(check.requires).includes('/') ? fs.existsSync(path.join(appDir, check.requires)) : onPath(check.requires))) process.exit(0);

const fileArg = JSON.stringify(path.relative(appDir, abs).split(path.sep).join('/'));
const cmd = check.cmd.split('{file}').join(fileArg);
const r = spawnSync(cmd, { cwd: appDir, shell: true, encoding: 'utf8', timeout: 20000, maxBuffer: 1 << 20 });
if (r.error || r.signal || r.status === 0 || r.status === 127) process.exit(0);
const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
if (/not recognized as an internal or external command|command not found/i.test(out)) process.exit(0);
process.stderr.write(`project-kit quick check failed for ${rel} (\`${cmd}\` in ${app.path}):\n${out.slice(-3000)}\nFix it now, before moving on.\n`);
process.exit(2);
