// Weekly maintenance check (network): versions the kit writes into rules, skills, tests, and workflows, compared
// with what npm and GitHub publish now. Exits 1 when a newer major (or, for 0.x, minor) exists, so the scheduled
// workflow fails and the owner gets an email. Not part of tests/run.sh, which runs offline.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // a file URL's pathname is not a path on Windows
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['.git', 'node_modules'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(md|mjs|sh|yml|json)$/.test(e.name)) files.push(p); } };
walk(root);
const pins = new Map(); // package → { range, where }
const PIN = /(?<![\w/-])((?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9.-]*)@([~^]?\d+(?:\.\d+){0,2})(?![\w.])/g;
for (const f of files) {
  if (f.endsWith('check-pins.mjs') || f.endsWith('CHANGELOG.md')) continue;
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(PIN)) {
    if (/\.(com|org|net|io|dev)$/.test(m[1]) || m[1].includes('.') && !m[1].startsWith('@')) continue; // e-mail and hosts
    if (!pins.has(m[1])) pins.set(m[1], { range: m[2], where: path.relative(root, f) });
  }
}
const parts = v => v.replace(/^[~^]/, '').split('.').map(Number);
let stale = 0, checked = 0, unreachable = 0;
for (const [pkg, { range, where }] of pins) {
  let latest;
  try { latest = execFileSync('npm', ['view', pkg, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { unreachable++; console.log(`unknown   ${pkg}@${range}  (${where})  npm view failed`); continue; }
  if (!latest) { unreachable++; continue; }
  checked++;
  // Behind: a newer major, or, while both are 0.x, a newer minor.
  const [rMajor, rMinor = 0] = parts(range), [lMajor, lMinor = 0] = parts(latest);
  let behind = lMajor > rMajor || (rMajor === 0 && lMajor === 0 && lMinor > rMinor);
  // typescript stays on 6.x while typescript-eslint's peer range excludes 7; flag it once that range allows it.
  if (pkg === 'typescript' && behind) {
    try {
      const peer = execFileSync('npm', ['view', 'typescript-eslint', 'peerDependencies.typescript'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const upper = peer.match(/<\s*(\d+)/);
      behind = !upper || Number(latest.split('.')[0]) < Number(upper[1]);
    } catch { /* keep the plain comparison */ }
  }
  const note = pkg === '@anthropic-ai/claude-code' ? (latest !== range ? 'newer release; test it and bump on purpose' : '') : behind ? 'newer major' : '';
  console.log(`${note ? 'OUTDATED' : 'ok      '}  ${pkg}@${range} → ${latest}  (${where})${note ? `  ${note}` : ''}`);
  if (note && pkg !== '@anthropic-ai/claude-code') stale++;
}
if (stale) { console.error(`${stale} pinned package(s) have a newer major version: update the rules and skills that name them.`); process.exit(1); }
// A run that could not ask npm proves nothing; it must not pass.
if (unreachable || !checked) { console.error(`${unreachable} package(s) could not be looked up (${checked} checked): is the npm registry reachable?`); process.exit(1); }
