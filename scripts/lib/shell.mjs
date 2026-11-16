// Reads a shell command (bash or PowerShell) the way a shell does and returns its simple commands, each as a list
// of words with quotes removed: quotes (a quoted "-f" is still -f, and a commit message is one word), backslashes,
// line continuations, chains (; && || | &), subshells, $(...) and `...` (commands of their own), eval and sh -c
// strings, and heredoc bodies (skipped, since they are data). It guards against mistakes; it is not a sandbox,
// because a command that builds another command at run time can always hide it.

export function simpleCommands(src) {
  const out = [];
  analyze(String(src).replace(/\\\r?\n/g, ''), out, 0);
  return out;
}

const SHELLS = /^((ba|z|da|k)?sh|pwsh|powershell)(\.exe)?$/;
export const isAssign = x => /^[A-Za-z_][A-Za-z0-9_]*=/.test(x);
export const basename = x => x.toLowerCase().replace(/.*[/\\]/, '');

function analyze(s, out, depth) {
  if (depth > 8) return;
  let st = 0, word = '', inw = false, w = [], pend = [];
  const flush = () => { if (inw) { w.push(word); word = ''; inw = false; } };
  const emit = () => { flush(); if (w.length) push(w, out, depth); w = []; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (st === 1) { if (c === "'") st = 0; else word += c; continue; }
    if (st === 2) {
      if (c === '"') { st = 0; continue; }
      if (c === '\\') {
        const d = s[i + 1];
        if (d === '"' || d === '\\' || d === '$' || d === '`') { word += d; i++; } else word += c;
        continue;
      }
      if (c === '$' && s[i + 1] === '(') { const e = substEnd(s, i + 2); analyze(s.slice(i + 2, e), out, depth + 1); word += '$(...)'; i = e; continue; }
      if (c === '`') { const e = tickEnd(s, i + 1); analyze(s.slice(i + 1, e), out, depth + 1); word += '`...`'; i = e; continue; }
      word += c;
      continue;
    }
    if (c === "'") { st = 1; inw = true; continue; }
    if (c === '"') { st = 2; inw = true; continue; }
    if (c === '\\') { word += s[i + 1] ?? ''; inw = true; i++; continue; }
    if (c === '$' && s[i + 1] === '(') { const e = substEnd(s, i + 2); analyze(s.slice(i + 2, e), out, depth + 1); word += '$(...)'; inw = true; i = e; continue; }
    if (c === '`') { const e = tickEnd(s, i + 1); analyze(s.slice(i + 1, e), out, depth + 1); word += '`...`'; inw = true; i = e; continue; }
    if (c === '<' && s[i + 1] === '<' && s[i + 2] !== '<') { flush(); const h = heredocOp(s, i + 2); pend.push(h); i = h.end; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '<' || c === '>') { flush(); continue; }
    if (c === '\n' || c === ';' || c === '&' || c === '|' || c === '(' || c === ')') {
      emit();
      if (c === '\n' && pend.length) { i = skipBodies(s, i + 1, pend) - 1; pend = []; }
      continue;
    }
    word += c; inw = true;
  }
  emit();
}

// A command, then the commands inside an eval string or a `sh -c` / `pwsh -Command` string.
function push(w, out, depth) {
  out.push(w);
  let i = 0;
  while (i < w.length && isAssign(w[i])) i++;
  if (i >= w.length) return;
  const base = basename(w[i]);
  if (base === 'eval') analyze(w.slice(i + 1).join(' '), out, depth + 1);
  else if (SHELLS.test(base)) {
    for (let k = i + 1; k < w.length - 1; k++) if (/^-(c|command)$/i.test(w[k])) { analyze(w[k + 1], out, depth + 1); break; }
  }
}

// Index of the ")" that closes a "$(" whose content starts at p.
function substEnd(s, p) {
  let depth = 1, pend = [];
  for (; p < s.length; p++) {
    const c = s[p];
    if (c === '\\') { p++; continue; }
    if (c === "'") { const q = s.indexOf("'", p + 1); if (q === -1) return s.length; p = q; continue; }
    if (c === '"') { p = dqEnd(s, p + 1); continue; }
    if (c === '`') { p = tickEnd(s, p + 1); continue; }
    if (c === '$' && s[p + 1] === '(') { p = substEnd(s, p + 2); continue; }
    if (c === '(') { depth++; continue; }
    if (c === ')') { if (--depth === 0) return p; continue; }
    if (c === '<' && s[p + 1] === '<' && s[p + 2] !== '<') { const h = heredocOp(s, p + 2); pend.push(h); p = h.end; continue; }
    if (c === '\n' && pend.length) { p = skipBodies(s, p + 1, pend) - 1; pend = []; }
  }
  return s.length;
}

function dqEnd(s, p) {
  for (; p < s.length; p++) {
    const c = s[p];
    if (c === '\\') { p++; continue; }
    if (c === '"') return p;
    if (c === '$' && s[p + 1] === '(') { p = substEnd(s, p + 2); continue; }
    if (c === '`') { p = tickEnd(s, p + 1); continue; }
  }
  return s.length;
}

function tickEnd(s, p) {
  for (; p < s.length; p++) { if (s[p] === '\\') { p++; continue; } if (s[p] === '`') return p; }
  return s.length;
}

// The delimiter of a heredoc whose "<<" ends just before p, and the last index read.
function heredocOp(s, p) {
  let tabs = false, d = '';
  if (s[p] === '-') { tabs = true; p++; }
  while (s[p] === ' ' || s[p] === '\t') p++;
  const c = s[p];
  if (c === "'" || c === '"') {
    const q = s.indexOf(c, p + 1);
    return q === -1 ? { delim: s.slice(p + 1), tabs, end: s.length } : { delim: s.slice(p + 1, q), tabs, end: q };
  }
  for (; p < s.length; p++) {
    const ch = s[p];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ';&|()<>'.includes(ch)) break;
    if (ch !== '\\' && ch !== "'" && ch !== '"') d += ch;
  }
  return { delim: d, tabs, end: p - 1 };
}

// Skips the heredoc bodies that start at p, one per pending delimiter; returns the index after the last one.
function skipBodies(s, p, pend) {
  for (const h of pend) {
    while (p < s.length) {
      const e = s.indexOf('\n', p);
      let line;
      if (e === -1) { line = s.slice(p); p = s.length; } else { line = s.slice(p, e); p = e + 1; }
      if (h.tabs) line = line.replace(/^\t+/, '');
      if (line.replace(/\r$/, '') === h.delim) break;
    }
  }
  return p;
}

// ---------- git guard: force-pushes and skipped hooks ----------
const hookpath = kv => String(kv || '').toLowerCase().startsWith('core.hookspath');
const abbrev = (x, full, min) => x.length >= min && x.length <= full.length && full.startsWith(x);
const aname = x => x.slice(0, x.indexOf('='));
const aval = x => x.slice(x.indexOf('=') + 1);

// Variables that husky, pre-commit, lefthook, or git itself read to skip hooks.
function skipsHooks(name, val) {
  const up = name.toUpperCase();
  val = String(val).toLowerCase();
  if (up === 'HUSKY' || up === 'LEFTHOOK') return val === '0' || val === 'false';
  if (up === 'SKIP' || up === 'HUSKY_SKIP_HOOKS' || up === 'LEFTHOOK_EXCLUDE') return val !== '';
  if (up === 'GIT_CONFIG_PARAMETERS' || /^GIT_CONFIG_KEY_[0-9]+$/.test(up)) return val.includes('core.hookspath');
  return false;
}

function takesArg(sub, x) {
  if (sub === 'commit') return /^--(message|file|author|date|template|trailer|reuse-message|reedit-message|fixup|squash|cleanup)$/.test(x);
  if (sub === 'push') return /^--(repo|receive-pack|exec|push-option)$/.test(x);
  return false;
}

// The reason a command force-pushes or skips the project's hooks, or '' when it doesn't.
export function gitBlockReason(src) {
  const state = { exported: false };
  for (const w of simpleCommands(src)) {
    const r = checkGit(w, state);
    if (r) return r;
  }
  return '';
}

function checkGit(w, state) {
  const nw = w.length;
  if (!nw) return '';
  // PowerShell: $env:NAME = value lasts for the rest of the session.
  if (w[0].toLowerCase().startsWith('$env:')) {
    let name = w[0].slice(5), val = '';
    const k = name.indexOf('=');
    if (k >= 0) { val = name.slice(k + 1); name = name.slice(0, k); }
    else if (w[1] === '=') val = w[2] ?? '';
    else if ((w[1] ?? '').startsWith('=')) val = w[1].slice(1);
    if (skipsHooks(name, val)) state.exported = true;
    return '';
  }
  if (w[0] === 'export' || ((w[0] === 'declare' || w[0] === 'typeset') && w[1] === '-x')) {
    for (let k = 1; k < nw; k++) if (isAssign(w[k]) && skipsHooks(aname(w[k]), aval(w[k]))) state.exported = true;
    return '';
  }
  let hookenv = false, i = 0;
  for (; i < nw && isAssign(w[i]); i++) if (skipsHooks(aname(w[i]), aval(w[i]))) hookenv = true;
  if (i >= nw) { if (hookenv) state.exported = true; return ''; }
  const first = basename(w[i]);
  if (first === 'eval' || SHELLS.test(first)) return ''; // their strings are commands of their own
  // The git word, after wrappers such as env, sudo, time, or xargs.
  let j = i;
  for (; j < nw; j++) {
    const b = basename(w[j]);
    if (b === 'git' || b === 'git.exe') break;
    if (isAssign(w[j]) && skipsHooks(aname(w[j]), aval(w[j]))) hookenv = true;
  }
  if (j >= nw) return '';
  let hookcfg = false, k = j + 1;
  for (; k < nw; k++) {
    const word = w[k];
    if (word === '-c' || word === '--config-env') { if (hookpath(w[k + 1])) hookcfg = true; k++; continue; }
    if (word.startsWith('--config-env=')) { if (hookpath(word.slice(13))) hookcfg = true; continue; }
    if (['-C', '--git-dir', '--work-tree', '--namespace', '--super-prefix'].includes(word)) { k++; continue; }
    if (word.startsWith('-')) continue;
    break;
  }
  if (k >= nw) return '';
  const sub = w[k];
  // Pointing core.hooksPath at nothing, or unsetting it, turns the project's hooks off for every later command.
  if (sub === 'config') {
    for (let m = k + 1; m < nw; m++) if (hookpath(w[m])) {
      for (let q = k + 1; q < m; q++) if (w[q].startsWith('--unset') || w[q] === 'unset') return "unsetting core.hooksPath turns the project's hooks off";
      if (m < nw - 1 && (w[m + 1] === '' || /^(\/dev\/null|nul)$/i.test(w[m + 1]))) return "pointing core.hooksPath at nothing turns the project's hooks off";
    }
    return '';
  }
  if (!/^(commit|push|merge|rebase|am|cherry-pick|revert|pull)$/.test(sub)) return '';
  if (hookcfg) return "overriding core.hooksPath skips the project's hooks";
  if (hookenv || state.exported) return "an environment variable that skips the project's hooks";
  const FORCE = 'force-pushing rewrites history on the remote';
  for (let m = k + 1; m < nw; m++) {
    const word = w[m];
    if (word === '--') break;
    if (word.startsWith('--')) {
      if (abbrev(word, '--no-verify', 9)) return "--no-verify skips the project's hooks";
      if (sub === 'push' && (word.startsWith('--force') || abbrev(word, '--force', 4) || abbrev(word, '--mirror', 3))) return FORCE;
      if (!word.includes('=') && takesArg(sub, word)) m++;
      continue;
    }
    if (sub === 'push' && word.startsWith('+')) return FORCE;
    if (word.startsWith('-') && word.length > 1) {
      for (let q = 1; q < word.length; q++) {
        const ch = word[q];
        // -S and -u take an optional value in the same word (-Skeyid, -uno): the rest of the cluster is that value.
        if (sub === 'commit' && (ch === 'S' || ch === 'u')) break;
        if (sub === 'commit' && ch === 'n') return 'git commit -n skips the format check and secret scan';
        if (sub === 'push' && ch === 'f') return FORCE;
        // An option that takes a value ends the cluster; the value is the rest of it, or the next word.
        if ((sub === 'commit' && 'mFCct'.includes(ch)) || (sub === 'push' && ch === 'o')) { if (q === word.length - 1) m++; break; }
      }
    }
  }
  return '';
}

// ---------- permission-style patterns ("git push *", "*migrate:fresh*") against each simple command ----------
function toRegex(glob) {
  const esc = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // "cmd *" also matches "cmd" with no arguments, as Claude Code's permission rules do.
  const trailing = glob.endsWith(' *');
  const body = (trailing ? glob.slice(0, -2) : glob).split('*').map(esc).join('.*');
  return new RegExp(`^${body}${trailing ? '( .*)?' : ''}$`, 'is');
}
// Wrappers that run the command after them, with their options that take a value.
const WRAPPERS = {
  sudo: 'ughpCDRTU', doas: 'uC', env: 'uCS', command: '', builtin: '', exec: 'a', time: '', nohup: '', nice: 'n',
  xargs: 'IinPLsEda',
};
const GIT_VALUE_OPTS = ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--exec-path'];

// The forms a pattern is tried against: the command as written, without its VAR=value prefix, without wrappers
// (sudo, env, xargs, ...), and in the spelling the patterns use: git without its global options (git -C api reset
// --hard is git reset --hard), and rm with its recursive and force flags, however they are written, as rm -rf.
function forms(w) {
  const out = [w];
  let i = 0;
  while (i < w.length && isAssign(w[i])) i++;
  if (i) out.push(w.slice(i));
  let j = i;
  for (let n = 0; n < 6 && j < w.length; n++) {
    const takes = WRAPPERS[basename(w[j])];
    if (takes === undefined) break;
    let k = j + 1;
    for (; k < w.length; k++) {
      if (isAssign(w[k])) continue;
      if (!w[k].startsWith('-') || w[k] === '-' || w[k] === '--') break;
      if (!w[k].startsWith('--') && w[k].length === 2 && takes.includes(w[k][1])) k++;
    }
    if (k < w.length && w[k] === '--') k++;
    j = k;
  }
  if (j >= w.length) return out;
  let base = w.slice(j);
  if (j > i) out.push(base);
  const first = basename(base[0]).replace(/\.exe$/, '');
  if (first === 'git') {
    let k = 1;
    for (; k < base.length && base[k].startsWith('-'); k++) if (GIT_VALUE_OPTS.includes(base[k])) k++;
    if (k > 1 && k < base.length) out.push(['git', ...base.slice(k)]);
  } else if (first === 'rm') {
    let recursive = false, force = false, k = 1;
    const rest = [];
    for (; k < base.length; k++) {
      const x = base[k];
      if (x === '--') { rest.push(...base.slice(k + 1)); break; }
      if (x === '--recursive') recursive = true;
      else if (x === '--force') force = true;
      else if (x.startsWith('-') && !x.startsWith('--') && x.length > 1) { if (/[rR]/.test(x)) recursive = true; if (x.includes('f')) force = true; }
      else if (!x.startsWith('-')) rest.push(x);
    }
    if (recursive && force) out.push(['rm', '-rf', ...rest]);
  }
  return out;
}

const cache = new Map();
export function matchPattern(src, patterns) {
  const cmds = simpleCommands(src).flatMap(forms).map(w => w.join(' '));
  for (const p of patterns) {
    if (!cache.has(p)) cache.set(p, toRegex(p));
    const re = cache.get(p);
    if (cmds.some(c => re.test(c))) return p;
  }
  return '';
}
