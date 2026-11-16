#!/usr/bin/env node
// PostToolUse hook for Write, Edit, and MultiEdit in project-kit projects: runs the app's quick check (a syntax or
// lint check of just that file, a few seconds at most) so a mistake surfaces at once instead of at the end of the
// task. The check comes from the app's stack (the kit: line of its rule) or from `checks` in the manifest, which
// `kit.mjs check` sets. A missing tool, a timeout, or a file the check doesn't cover is skipped silently.
// A command from the manifest runs only once it is approved on this machine (scripts/lib/trust.mjs); until then
// Claude is told once per session that it was skipped.
// Exit 2 shows the failure to Claude; the edit has already happened.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { readStdin, findProject, stackMeta, PLUGIN_ROOT } from '../lib/project.mjs';
import { isTrusted } from '../lib/trust.mjs';

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
if (override && typeof override === 'object') {
  if (typeof override.cmd !== 'string') process.exit(0);
  if (!isTrusted(project.root, app.name, override)) {
    const id = String(event.session_id || '').replace(/[^A-Za-z0-9_-]/g, '_');
    const dir = path.join(process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'project-kit'), 'sessions');
    const mark = path.join(dir, `${id}.unapproved-${app.name}`);
    if (!id || !fs.existsSync(mark)) {
      if (id) { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(mark, ''); } catch { /* best effort */ } }
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext:
        `[project-kit] The quick check for app "${app.name}" is a command from .claude/project-kit.json that hasn't been approved on this machine, so it did not run: \`${override.cmd}\`. Show the command to the user once; if they approve it, run: node "${path.join(PLUGIN_ROOT, 'scripts', 'kit.mjs')}" check ${app.name} --trust. Don't approve it on your own.` } }));
    }
    process.exit(0);
  }
  check = override;
}
else for (const s of app.stacks || []) { const c = stackMeta(s).check; if (c) { check = c; break; } }
if (!check || typeof check.cmd !== 'string') process.exit(0);

const ext = path.extname(abs).slice(1).toLowerCase();
const exts = String(check.ext || '').split(',').map(x => x.trim()).filter(Boolean);
if (exts.length && !exts.includes(ext)) process.exit(0);

const appDir = path.join(project.root, app.path);
const onPath = name => (process.env.PATH || '').split(path.delimiter).some(dir => ['', '.exe', '.cmd', '.bat']
  .some(e => { try { return fs.statSync(path.join(dir, name + e)).isFile(); } catch { return false; } }));
if (check.requires && !(String(check.requires).includes('/') ? fs.existsSync(path.join(appDir, check.requires)) : onPath(check.requires))) process.exit(0);

// Quoted for the shell that runs the check. sh: single quotes, where nothing expands, so a route file such as
// $postId.tsx stays itself and a file name can't run a command. cmd.exe: double quotes (a name can't hold one).
const relFile = path.relative(appDir, abs).split(path.sep).join('/');
const fileArg = process.platform === 'win32' ? `"${relFile}"` : `'${relFile.replace(/'/g, "'\\''")}'`;
const cmd = check.cmd.split('{file}').join(fileArg);
const r = spawnSync(cmd, { cwd: appDir, shell: true, encoding: 'utf8', timeout: 20000, maxBuffer: 1 << 20 });
if (r.error || r.signal || r.status === 0 || r.status === 127) process.exit(0);
const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
// The tool is missing, or (ESLint) installed without a config: nothing to check with, which isn't the file's fault.
if (/not recognized as an internal or external command|command not found|couldn't find an eslint\.config|could not find config file/i.test(out)) process.exit(0);
process.stderr.write(`project-kit quick check failed for ${rel} (\`${cmd}\` in ${app.path}):\n${out.slice(-3000)}\nFix it now, before moving on.\n`);
process.exit(2);
