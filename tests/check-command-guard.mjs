// The command guard (pre-tool.mjs) follows the session's autonomy in project-kit projects, the quick check
// (post-tool.mjs) reports a failing file to Claude, and the session hook names rigor, autonomy, and version drift.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PRE = path.join(root, 'scripts', 'hooks', 'pre-tool.mjs');
const POST = path.join(root, 'scripts', 'hooks', 'post-tool.mjs');
const SESSION = path.join(root, 'scripts', 'hooks', 'session-start.mjs');
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error(`    ${msg}`); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-guard-'));
const proj = path.join(tmp, 'proj');
const plain = path.join(tmp, 'plain');
fs.mkdirSync(path.join(proj, '.claude'), { recursive: true });
fs.mkdirSync(plain);
const manifest = extra => fs.writeFileSync(path.join(proj, '.claude/project-kit.json'), JSON.stringify({ kitVersion: '1.0.0', apps: [], ...extra }));
manifest({});
const clean = { ...process.env };
delete clean.PROJECT_KIT_AUTONOMY;

function guard(command, { cwd = proj, mode = 'default', env = {} } = {}) {
  const r = spawnSync(process.execPath, [PRE], {
    input: JSON.stringify({ tool_name: 'Bash', cwd, permission_mode: mode, tool_input: { command } }), encoding: 'utf8', env: { ...clean, ...env },
  });
  if (r.status !== 0) return `exit ${r.status}`;
  if (!r.stdout.trim()) return 'allow';
  return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision;
}

// guarded (the project default): destructive commands and secret printers ask, in every form a shell runs them.
for (const c of ['rm -rf node_modules', 'php artisan migrate:fresh --seed', 'FOO=1 rm -rf dist', 'npm test && rm -rf build',
  'bash -c "docker compose down -v"', 'git push -u origin task-001', 'printenv', 'env', 'Remove-Item -Path x -Recurse -Force', 'echo $(git reset --hard)']) {
  check(guard(c) === 'ask', `guarded should ask: ${c} → ${guard(c)}`);
}
for (const c of ['npm test', 'echo "rm -rf is dangerous"', 'git commit -m "explain rm -rf"', 'ls -la', 'environment-check', 'git status']) {
  check(guard(c) === 'allow', `guarded should allow: ${c} → ${guard(c)}`);
}
// auto, from the env, from bypass mode, or from the project: destructive commands run; secret printers are denied.
check(guard('rm -rf dist', { env: { PROJECT_KIT_AUTONOMY: 'auto' } }) === 'allow', 'PROJECT_KIT_AUTONOMY=auto should allow rm -rf');
check(guard('printenv', { env: { PROJECT_KIT_AUTONOMY: 'auto' } }) === 'deny', 'auto should deny printenv');
check(guard('rm -rf dist', { mode: 'bypassPermissions' }) === 'allow', 'bypass mode should count as auto');
check(guard('terraform apply -auto-approve', { mode: 'bypassPermissions' }) === 'deny', 'bypass mode should deny terraform apply');
check(guard('rm -rf dist', { mode: 'bypassPermissions', env: { PROJECT_KIT_AUTONOMY: 'guarded' } }) === 'ask', 'PROJECT_KIT_AUTONOMY=guarded should win over bypass mode');
manifest({ autonomy: 'auto' });
check(guard('git reset --hard') === 'allow' && guard('kubectl delete ns app') === 'deny', 'the project default auto should apply');
check(guard('git reset --hard', { env: { PROJECT_KIT_AUTONOMY: 'guarded' } }) === 'ask', 'a session can opt back into guarded');
manifest({});
// Outside a project-kit project only the secret and git guards run.
check(guard('rm -rf node_modules', { cwd: plain }) === 'allow', 'the command guard ran outside a project-kit project');
check(guard('git push --force', { cwd: plain }) === 'exit 2', 'the git guard should still block outside a project');

// Quick check after an edit: a failing file reaches Claude (exit 2); a passing one, a skipped type, or a missing tool is silent.
fs.mkdirSync(path.join(proj, 'api'), { recursive: true });
fs.writeFileSync(path.join(proj, 'api', 'lint.mjs'), "import fs from 'node:fs';\nif (fs.readFileSync(process.argv[2], 'utf8').includes('BAD')) { console.error('lint: BAD found'); process.exit(1); }\n");
manifest({ apps: [{ name: 'api', stacks: ['go'], path: 'api' }], checks: { api: { cmd: 'node lint.mjs {file}', ext: 'txt' } } });
const edit = (file, content) => {
  fs.writeFileSync(path.join(proj, file), content);
  return spawnSync(process.execPath, [POST], { input: JSON.stringify({ tool_name: 'Write', cwd: proj, tool_input: { file_path: path.join(proj, file) } }), encoding: 'utf8' });
};
let r = edit('api/a.txt', 'BAD line');
check(r.status === 2 && /lint: BAD found/.test(r.stderr), `a failing quick check should exit 2 with its output: ${r.status} ${r.stderr}`);
check(edit('api/a.txt', 'fine').status === 0, 'a passing quick check should be silent');
check(edit('api/a.md', 'BAD').status === 0, 'a file type the check does not cover should be skipped');
check(edit('notes.txt', 'BAD').status === 0, 'a file outside every app should be skipped');
manifest({ apps: [{ name: 'api', stacks: ['go'], path: 'api' }], checks: { api: { cmd: 'definitely-not-a-tool {file}', ext: 'txt', requires: 'definitely-not-a-tool' } } });
check(edit('api/a.txt', 'BAD').status === 0, 'a missing tool should be skipped');
manifest({ apps: [{ name: 'api', stacks: ['go'], path: 'api' }], checks: { api: '' } });
check(edit('api/a.txt', 'BAD').status === 0, 'a check turned off should not run');

// Session start: rigor and autonomy, the unattended notice, and the sync suggestion for an older project.
spawnSync('git', ['init', '-q'], { cwd: proj });
const session = (mode, env = {}) => spawnSync(process.execPath, [SESSION], {
  input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', permission_mode: mode }), encoding: 'utf8',
  env: { ...clean, CLAUDE_PROJECT_DIR: proj, ...env },
}).stdout;
manifest({ kitVersion: '1.0.0', rigor: 'prototype' });
let out = session('default');
check(/rigor: prototype · autonomy: guarded/.test(out) && !/Unattended development/.test(out), `guarded session context: ${out}`);
check(/kit v1\.0\.0 and the plugin is v[\d.]+: suggest \/project-kit:sync/.test(out), 'an older project should get the sync suggestion');
out = session('bypassPermissions');
check(/autonomy: auto \(bypass permissions mode\)/.test(out) && /Unattended development/.test(out), `bypass session context: ${out}`);
out = session('default', { PROJECT_KIT_AUTONOMY: 'auto' });
check(/autonomy: auto \(PROJECT_KIT_AUTONOMY\)/.test(out), 'PROJECT_KIT_AUTONOMY should show in the session context');

// Prompt hook: SessionStart may lack permission_mode, so the first prompt of a bypass session announces auto once,
// and a later switch back to default announces guarded once.
const data = path.join(tmp, 'data');
const prompt = (mode, id = 's1') => spawnSync(process.execPath, [path.join(root, 'scripts', 'hooks', 'prompt.mjs')], {
  input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: id, cwd: proj, permission_mode: mode, prompt: 'go' }), encoding: 'utf8',
  env: { ...clean, CLAUDE_PLUGIN_DATA: data },
}).stdout;
manifest({});
spawnSync(process.execPath, [SESSION], { input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: 's1' }), encoding: 'utf8', env: { ...clean, CLAUDE_PROJECT_DIR: proj, CLAUDE_PLUGIN_DATA: data } });
check(/autonomy is now auto \(bypass permissions mode\)/.test(prompt('bypassPermissions')) && /Unattended development/.test(prompt('bypassPermissions', 's2')), 'the first prompt of a bypass session should announce auto');
check(prompt('bypassPermissions') === '', 'auto should be announced only once per session');
check(/autonomy is now guarded/.test(prompt('default')) && prompt('default') === '', 'switching back should announce guarded once');
check(prompt('default', 's3') === '', 'a guarded session should stay silent');
check(spawnSync(process.execPath, [path.join(root, 'scripts', 'hooks', 'prompt.mjs')], { input: JSON.stringify({ session_id: 's4', cwd: plain, permission_mode: 'bypassPermissions' }), encoding: 'utf8', env: { ...clean, CLAUDE_PLUGIN_DATA: data } }).stdout === '', 'the prompt hook ran outside a project-kit project');

fs.rmSync(tmp, { recursive: true, force: true });
if (failures) { console.error(`  ${failures} command guard check(s) failed`); process.exit(1); }
