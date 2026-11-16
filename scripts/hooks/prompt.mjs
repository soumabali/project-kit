#!/usr/bin/env node
// UserPromptSubmit hook for project-kit projects: tells Claude this session's autonomy when it differs from what the
// session was last told (the first prompt of a --dangerously-skip-permissions session, or a switch to or from
// bypass mode with Shift+Tab). Silent otherwise, so it costs nothing on ordinary prompts.
import { readStdin, findProject, autonomyOf } from '../lib/project.mjs';
import { lastAnnounced, remember, AUTO_NOTICE } from '../lib/announce.mjs';

try {
  const event = JSON.parse(readStdin() || '{}') || {};
  const project = findProject(event.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (project) {
    const { mode, why } = autonomyOf(project.manifest, event.permission_mode);
    const before = lastAnnounced(event.session_id);
    if (mode !== before && (before || mode === 'auto')) {
      remember(event.session_id, mode);
      process.stdout.write(mode === 'auto'
        ? `[project-kit] autonomy is now auto (${why}).\n${AUTO_NOTICE}\n`
        : `[project-kit] autonomy is now guarded (${why}): ask before risky changes and destructive commands again, as CLAUDE.md says.\n`);
    }
  }
} catch { /* never block a prompt */ }
