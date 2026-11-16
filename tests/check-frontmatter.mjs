// Checks front matter of skills, agents, rules, and templates without third-party YAML parsers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // a file URL's pathname is not a path on Windows
let failures = 0;
const fail = (file, msg) => { failures++; console.error(`    ${path.relative(root, file)}: ${msg}`); };

function frontMatter(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const data = {};
  let listKey = null;
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s+-\s+"(.*)"\s*$/);
    if (item && listKey) { data[listKey].push(item[1]); continue; }
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!kv) { listKey = null; continue; }
    const key = kv[1];
    let raw = kv[2].trim();
    // YAML comments start with " #"; JSON values and quoted strings may contain "#" (for example "C#").
    if (!raw.startsWith('{') && !raw.startsWith('"')) raw = raw.replace(/\s+#.*$/, '').trim();
    if (raw === '') { data[key] = []; listKey = key; continue; }
    listKey = null;
    data[key] = raw.replace(/^"(.*)"$/, '$1');
  }
  return data;
}

for (const dir of fs.readdirSync(path.join(root, 'skills'))) {
  const file = path.join(root, 'skills', dir, 'SKILL.md');
  if (!fs.existsSync(file)) { fail(file, 'missing SKILL.md'); continue; }
  const fm = frontMatter(file);
  if (!fm) { fail(file, 'no front matter'); continue; }
  if (fm.name !== dir) fail(file, `name "${fm.name}" should match folder "${dir}"`);
  if (!fm.description || fm.description.length < 40) fail(file, 'description missing or too short');
  if (fm.description && fm.description.length > 1024) fail(file, 'description over 1024 characters');
  const body = fs.readFileSync(file, 'utf8');
  for (const ref of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)) {
    const target = path.join(root, ref[1].replace(/[.,;:)`'"]+$/, ''));
    if (!fs.existsSync(target)) fail(file, `references missing file ${ref[1]}`);
  }
}

for (const f of fs.readdirSync(path.join(root, 'agents'))) {
  const file = path.join(root, 'agents', f);
  const fm = frontMatter(file);
  if (!fm || !fm.name || !fm.description) fail(file, 'agent needs name and description');
  if (fm && fm.name !== f.replace(/\.md$/, '')) fail(file, 'agent name should match file name');
  if (fm && !/Write/.test(fm.disallowedTools || '')) fail(file, 'reviewer agents must not write files');
}

for (const sub of ['core', 'stacks']) {
  const dir = path.join(root, 'project-layer', 'rules', sub);
  for (const f of fs.readdirSync(dir)) {
    const file = path.join(dir, f);
    const fm = frontMatter(file);
    if (!fm || !Array.isArray(fm.paths) || !fm.paths.length) { fail(file, 'rule needs a paths list'); continue; }
    if (sub === 'stacks') {
      if (!fm.paths.some((p) => p.includes('{{APP}}'))) fail(file, 'stack rule paths should be scoped with {{APP}}');
      try { JSON.parse(fm.kit); } catch { fail(file, 'kit: line must be valid JSON'); }
    }
    const lines = fs.readFileSync(file, 'utf8').split('\n').length;
    if (lines > 70) fail(file, `${lines} lines; keep rules short (70 max)`);
  }
}

const claudeLines = fs.readFileSync(path.join(root, 'project-layer', 'CLAUDE.md'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').split('\n').length;
if (claudeLines > 190) fail(path.join(root, 'project-layer', 'CLAUDE.md'), `${claudeLines} lines; must stay under 190 before profile rows`);

if (failures) { console.error(`  ${failures} front matter problem(s)`); process.exit(1); }
