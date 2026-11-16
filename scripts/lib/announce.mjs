// Remembers, per session, which autonomy Claude was last told about, so the session and prompt hooks announce a
// mode once and again only when it changes (SessionStart input may lack permission_mode; prompt input has it).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = () => path.join(process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'project-kit'), 'sessions');
const file = id => path.join(dir(), `${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}.autonomy`);
export function lastAnnounced(sessionId) {
  if (!sessionId) return '';
  try { return fs.readFileSync(file(sessionId), 'utf8').trim(); } catch { return ''; }
}
export function remember(sessionId, mode) {
  if (!sessionId) return;
  try { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(file(sessionId), mode); } catch { /* best effort */ }
}
export const AUTO_NOTICE = "[project-kit] Unattended development: don't stop to ask or wait for approval. Decide, record the decision in the task file, and continue, as CLAUDE.md says under Autonomy. Its never-list still holds (production, deploys, pushing, secrets).";
