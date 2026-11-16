#!/usr/bin/env node
// PreToolUse hook for Write, Edit, MultiEdit, NotebookEdit, Bash, and PowerShell. Three guards, in order:
// 1. Secret guard (everywhere): blocks a call whose new content or command holds what looks like a real credential.
// 2. Git guard (everywhere): blocks force-pushes and skipped hooks in the forms permission rules can't see.
// 3. Command guard (project-kit projects): asks before destructive commands in guarded autonomy; in auto autonomy
//    lets them run and denies commands that print secrets or change remote infrastructure.
// Exit 2 blocks the call and shows stderr to Claude; a JSON permission decision asks or denies.
import path from 'node:path';
import { readStdin, readJson, findProject, autonomyOf, PLUGIN_ROOT } from '../lib/project.mjs';
import { findSecret, writtenText } from '../lib/secrets.mjs';
import { gitBlockReason, matchPattern } from '../lib/shell.mjs';

let event;
try { event = JSON.parse(readStdin() || '{}'); } catch { event = null; }
if (!event || typeof event !== 'object') {
  process.stderr.write('project-kit guard could not read the tool call; the permission rules still apply.\n');
  process.exit(0);
}
const input = event.tool_input || {};
const isShell = ['Bash', 'PowerShell'].includes(event.tool_name) || typeof input.command === 'string' && !event.tool_name;

const secret = findSecret(writtenText(input));
if (secret) {
  process.stderr.write(`Blocked by the project-kit secret guard: ${secret}. Read secrets from environment variables, put only placeholders in .env.example, and ask the user to set real values.\n`);
  process.exit(2);
}

const cmd = typeof input.command === 'string' ? input.command : '';
if (!isShell || !cmd) process.exit(0);

if (/git/i.test(cmd)) {
  const reason = gitBlockReason(cmd);
  if (reason) {
    process.stderr.write(`Blocked by the project-kit git guard: ${reason}. Don't look for another way to run it; if the user wants it, they run it themselves.\n`);
    process.exit(2);
  }
}

const project = findProject(event.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
if (!project) process.exit(0);
const rules = readJson(path.join(PLUGIN_ROOT, 'project-layer', 'guard-rules.json')) || {};
const { mode, why } = autonomyOf(project.manifest, event.permission_mode);
const decide = (decision, reason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason } }));
  process.exit(0);
};
const unattended = matchPattern(cmd, rules.unattended || []);
if (unattended && mode === 'auto') {
  decide('deny', `project-kit (autonomy auto, from ${why}) denies "${unattended}": it prints secrets or changes remote infrastructure, and nobody is watching. Leave it for the user: note it in the task file and continue with other work.`);
}
const risky = unattended || (mode === 'guarded' ? matchPattern(cmd, rules.ask || []) : '');
if (risky && mode === 'guarded') {
  decide('ask', `project-kit (autonomy guarded): "${risky}" is destructive or can reveal secrets. To run unattended development without these prompts, start the session with PROJECT_KIT_AUTONOMY=auto or --dangerously-skip-permissions.`);
}
process.exit(0);
