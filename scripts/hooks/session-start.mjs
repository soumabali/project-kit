#!/usr/bin/env node
// SessionStart hook. Plain stdout becomes session context (capped at 10,000 characters), so output stays short.
// - In a project set up by project-kit (also when Claude starts in one of its subfolders): prints the project's
//   rigor and the session's autonomy, a notice when the project is on an older kit version, the resume point
//   (05-progress/STATUS.md), and git state.
// - At the start of a session at the root of a git repository without the kit, follows the plugin's `setup` option:
//     ask (default)  a short notice that /project-kit:kickoff can set the repo up
//     auto           installs the project layer with the detected apps, then says what it did
//     off            nothing
//   Never in the home folder, a subfolder, a linked worktree or submodule, CI, or a repo the user asked to skip,
//   and never on resume or after compaction.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readStdin, readJson, autonomyOf, rigorOf, newerVersion, KIT_VERSION, MANIFEST, PLUGIN_ROOT } from '../lib/project.mjs';

const KIT = path.join(PLUGIN_ROOT, 'scripts', 'kit.mjs');
const DATA = process.env.CLAUDE_PLUGIN_DATA || '';
let event = {};
if (!process.stdin.isTTY) { try { event = JSON.parse(readStdin() || '{}') || {}; } catch { event = {}; } }
const out = [];
const say = s => out.push(s);
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.replace(/\n$/, '') : null;
};
const real = p => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
const present = p => { try { fs.lstatSync(p); return true; } catch { return false; } };
const q = s => JSON.stringify(s);

function printContext(root) {
  const m = readJson(path.join(root, MANIFEST)) || {};
  const a = autonomyOf(m, event.permission_mode);
  const rigor = rigorOf(m);
  say(`[project-kit] rigor: ${rigor} · autonomy: ${a.mode}${a.mode === 'auto' ? ` (${a.why})` : ''}`);
  if (a.mode === 'auto') {
    say("[project-kit] Unattended development: don't stop to ask or wait for approval. Decide, record the decision in the task file, and continue, as CLAUDE.md says under Autonomy. Its never-list still holds (production, deploys, pushing, secrets).");
  }
  if (m.kitVersion && newerVersion(KIT_VERSION, m.kitVersion)) {
    say(`[project-kit] This project is on kit v${m.kitVersion} and the plugin is v${KIT_VERSION}: suggest /project-kit:sync to the user once.`);
  }
  const status = path.join(root, '05-progress', 'STATUS.md');
  if (fs.existsSync(status)) {
    say('[05-progress/STATUS.md]');
    say(fs.readFileSync(status).subarray(0, 6000).toString('utf8'));
  } else say('This project uses project-kit but has no 05-progress/STATUS.md yet.');
  const st = git(root, 'status', '--short', '--branch');
  if (st !== null) {
    say('[git status]');
    say(st.split('\n').slice(0, 25).map(l => l.slice(0, 160)).join('\n').slice(0, 2500));
  }
}

function main() {
  let here = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!fs.existsSync(here)) return;
  const top = git(here, 'rev-parse', '--show-toplevel');
  if (!fs.existsSync(path.join(here, MANIFEST)) && top && fs.existsSync(path.join(top, MANIFEST))) here = top;
  if (fs.existsSync(path.join(here, MANIFEST))) { printContext(here); return; }

  // Not set up yet: act only when a conversation starts, not on resume or after compaction.
  if (!['', undefined, 'startup', 'clear'].includes(event.source)) return;
  const raw = String(process.env.CLAUDE_PLUGIN_OPTION_SETUP ?? 'ask').toLowerCase().replace(/\s+/g, '');
  if (['off', 'false', 'no', 'none', 'never'].includes(raw)) return;
  const mode = ['auto', 'on', 'true', 'yes', 'always'].includes(raw) ? 'auto' : 'ask';
  if (process.env.CI) return;
  if (!top) return;
  let gitDir;
  try { gitDir = fs.statSync(path.join(here, '.git')).isDirectory(); } catch { gitDir = false; }
  if (!gitDir) return; // linked worktrees and submodules have a .git file
  const key = real(here);
  if (real(top) !== key) return; // started at the repository root...
  if (key === real(os.homedir())) return; // ...that isn't the home folder
  if (DATA) {
    const list = (() => { try { return fs.readFileSync(path.join(DATA, 'skipped-projects.txt'), 'utf8').split(/\r?\n/); } catch { return []; } })();
    if (list.includes(key)) return;
  }
  const dataArg = DATA ? ` --data-dir ${q(DATA)}` : '';

  let reason = '';
  if (mode === 'auto') {
    if (['CLAUDE.md', '.claude/CLAUDE.md'].some(f => present(path.join(key, f)))) {
      reason = 'CLAUDE.md already exists, and automatic setup never edits it';
    } else {
      const r = spawnSync(process.execPath, [KIT, 'install', '--auto', '--project-dir', key], { encoding: 'utf8' });
      const text = `${r.stdout || ''}${r.stderr || ''}`;
      if (r.status === 0) {
        const apps = (text.match(/^Apps: (.*)$/m) || [])[1];
        say(`[project-kit] Automatic setup (the plugin's setup option is "auto") just installed the project layer in this repo: CLAUDE.md, .claude/rules/kit/, .claude/templates/, tracking folders 01-06, permission rules in .claude/settings.json, and a .gitignore block. Apps: ${apps || 'none detected'}.`);
        say("- CLAUDE.md loads automatically from the next session. Read it now if it isn't in your context yet, and follow it.");
        say('- In your first reply, tell the user this happened, and that /project-kit:kickoff confirms the apps, fills in the project profile, picks the rigor level, and runs Phase 00.');
        say(`- If they don't want project-kit in this repo, undo it (only files nobody has edited are removed) with: node ${q(KIT)} uninstall --project-dir ${q(key)}${dataArg}`);
        printContext(key);
        return;
      }
      reason = text.split('\n')[0].replace(/^project-kit: /, '').slice(0, 300);
    }
  }
  if (reason) say(`[project-kit] Automatic setup skipped: ${reason}.`);
  say("[project-kit] This repo isn't set up with project-kit. If the user starts planning or building here, mention once that /project-kit:kickoff sets up the workflow (CLAUDE.md, task tracking, per-stack rules, real tests).");
  if (DATA) say(`If they don't want it in this repo, stop this notice with: node ${q(KIT)} skip --project-dir ${q(key)}${dataArg}`);
}

try { main(); } catch { /* a session must never fail to start because of this hook */ }
const text = out.join('\n');
if (text) process.stdout.write(`${text.slice(0, 9500)}\n`);
