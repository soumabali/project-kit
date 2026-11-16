// Quick check commands a project sets itself (`checks` in .claude/project-kit.json) are committed with the repo, so
// they can come from someone else. The hook runs one only after it was approved on this machine: by setting it here
// with `kit.mjs check <app> --cmd …`, or by `kit.mjs check <app> --trust` after reading it. Approvals live outside
// the repo, per project folder and app, and stop applying when the command changes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const file = () => path.join(process.env.PROJECT_KIT_HOME || path.join(os.homedir(), '.claude', 'project-kit'), 'trusted-checks.json');
function keyOf(root) {
  let p;
  try { p = fs.realpathSync(root); } catch { p = path.resolve(root); }
  return process.platform === 'win32' ? p.toLowerCase() : p;
}
const hashOf = c => crypto.createHash('sha256').update(JSON.stringify([c.cmd, c.ext || '', c.requires || ''])).digest('hex').slice(0, 16);
function load() {
  try { const v = JSON.parse(fs.readFileSync(file(), 'utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
function save(all) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), `${JSON.stringify(all, null, 2)}\n`);
}

export const isCustomCheck = c => Boolean(c) && typeof c === 'object' && typeof c.cmd === 'string';
export function isTrusted(root, app, check) {
  const mine = load()[keyOf(root)];
  return Boolean(mine) && typeof mine === 'object' && mine[app] === hashOf(check);
}
export function trust(root, app, check) {
  const all = load();
  const key = keyOf(root);
  all[key] = { ...(all[key] && typeof all[key] === 'object' ? all[key] : {}), [app]: hashOf(check) };
  save(all);
}
export function untrust(root, app) {
  const all = load();
  const key = keyOf(root);
  if (!all[key] || typeof all[key] !== 'object' || !(app in all[key])) return;
  delete all[key][app];
  if (!Object.keys(all[key]).length) delete all[key];
  save(all);
}
