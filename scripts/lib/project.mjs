// Shared by the hooks: find the project-kit project around a folder, read its manifest, and work out the
// session's autonomy mode.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KIT_VERSION = readJson(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'))?.version || '0.0.0';
export const MANIFEST = '.claude/project-kit.json';

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

export function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// The nearest folder at or above `dir` with a project-kit manifest, or null.
export function findProject(dir) {
  let cur = path.resolve(dir || '.');
  for (let n = 0; n < 40; n++) {
    if (fs.existsSync(path.join(cur, MANIFEST))) return { root: cur, manifest: readJson(path.join(cur, MANIFEST)) || {} };
    const up = path.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
  return null;
}

export const RIGORS = ['prototype', 'standard', 'production'];
export const AUTONOMIES = ['guarded', 'auto'];
// Projects installed before 1.5.0 were built to the full rules, so a manifest without a rigor is production.
export const rigorOf = m => (RIGORS.includes(m && m.rigor) ? m.rigor : 'production');

// The session's autonomy and why: PROJECT_KIT_AUTONOMY for this session, then a session started with
// --dangerously-skip-permissions (the user chose no prompts), then the project's default.
export function autonomyOf(manifest, permissionMode, env = process.env) {
  const v = String(env.PROJECT_KIT_AUTONOMY || '').trim().toLowerCase();
  if (AUTONOMIES.includes(v)) return { mode: v, why: 'PROJECT_KIT_AUTONOMY' };
  if (permissionMode === 'bypassPermissions') return { mode: 'auto', why: 'bypass permissions mode' };
  const m = manifest && AUTONOMIES.includes(manifest.autonomy) ? manifest.autonomy : 'guarded';
  return { mode: m, why: 'project default' };
}

// The kit: metadata line of a stack rule (name, commands, quick check).
const metaCache = new Map();
export function stackMeta(stack) {
  if (!/^[a-z0-9-]+$/.test(String(stack))) return {};
  if (metaCache.has(stack)) return metaCache.get(stack);
  let meta = {};
  try {
    const head = fs.readFileSync(path.join(PLUGIN_ROOT, 'project-layer', 'rules', 'stacks', `${stack}.md`), 'utf8').split('\n---')[0];
    const m = head.match(/^kit:\s*(\{.*\})\s*$/m);
    if (m) meta = JSON.parse(m[1]);
  } catch { /* unknown stack */ }
  metaCache.set(stack, meta);
  return meta;
}

export function newerVersion(a, b) { // true when a > b
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
