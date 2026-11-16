#!/usr/bin/env node
// Inventory of the design values a template's CSS actually uses, ranked by frequency, to seed DESIGN.md tokens.
// Usage: node css-inventory.mjs <folder> [--top 15] [--json] [--include-min]
// Scans .css, .scss, .less, and .html files (inline <style> and style="…" included); skips node_modules, vendor,
// dist, build, .git, and *.min.css unless --include-min is given.
import fs from 'node:fs';
import path from 'node:path';

const USAGE = 'usage: node css-inventory.mjs <folder> [--top 15] [--json] [--include-min]';
const args = process.argv.slice(2);
let root = null;
let TOP = 15;
let JSON_OUT = false;
let INCLUDE_MIN = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--top') TOP = Number(args[++i]);
  else if (args[i] === '--json') JSON_OUT = true;
  else if (args[i] === '--include-min') INCLUDE_MIN = true;
  else if (!args[i].startsWith('--') && root === null) root = args[i];
  else { console.error(`unexpected argument ${args[i]}\n${USAGE}`); process.exit(2); }
}
if (!root || !Number.isInteger(TOP) || TOP < 1) { console.error(USAGE); process.exit(2); }
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) { console.error(`css-inventory: not a folder: ${root}`); process.exit(2); }
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', '.git', '.next', '.nuxt', 'coverage']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (entry.isFile() && /\.(css|scss|less|html?)$/i.test(entry.name) && (INCLUDE_MIN || !/\.min\.css$/i.test(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const counters = {
  colors: new Map(), customProperties: new Map(), fontFamilies: new Map(), fontSizes: new Map(), fontWeights: new Map(),
  lineHeights: new Map(), radii: new Map(), shadows: new Map(), spacing: new Map(), breakpoints: new Map(),
  fontFaces: new Map(), externalResources: new Map(),
};
const bump = (map, key) => { if (key) map.set(key, (map.get(key) || 0) + 1); };

function normalizeHex(hex) {
  let h = hex.slice(1).toUpperCase();
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  return `#${h}`;
}

// A declaration is "name: value" after "{", ";", or a nested rule's "}", and before ";" or "}", so selectors
// (a:hover, #id) never count. The name may be a Sass ($brand) or Less (@brand) variable.
const DECLARATION = /(?:^|[{};])\s*([$@]?-{0,2}[a-zA-Z][\w-]*)\s*:\s*([^;{}]+)(?=[;}])/g;
// What a url(...) or a quoted string holds is not a color (url(#fade), content: "#fff").
const withoutData = (value) => value.replace(/url\([^)]*\)/gi, '').replace(/"[^"]*"|'[^']*'/g, '');

function scanCss(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // A data: URL holds ";", which would end the declaration early; its content is not needed below.
  const body = css.replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\)/gi, 'url()')
    .replace(/"[^"\n]*"|'[^'\n]*'/g, (q) => q.replace(/[;{}]/g, ' ')); // nor may a quoted ";" end one
  const decls = [...body.matchAll(DECLARATION)].map((m) => [m[1].toLowerCase(), m[2].trim().replace(/\s*!important$/i, '')]);
  for (const [name, value] of decls) {
    const plain = withoutData(value);
    for (const m of plain.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) if ([4, 5, 7, 9].includes(m[0].length)) bump(counters.colors, normalizeHex(m[0]));
    for (const m of plain.matchAll(/\b(?:rgba?|hsla?|oklch|oklab|lch|lab)\((?:[^()]|\([^()]*\))*\)/gi)) bump(counters.colors, m[0].replace(/\s+/g, ' ').toLowerCase());
    if (/^(--|[$@])/.test(name)) bump(counters.customProperties, `${name}: ${value}`);
  }
  const decl = (prop) => decls.filter(([name]) => name === prop).map(([, value]) => value);
  decl('font-family').forEach((v) => bump(counters.fontFamilies, v.replace(/\s+/g, ' ')));
  decl('font-size').forEach((v) => bump(counters.fontSizes, v));
  decl('font-weight').forEach((v) => bump(counters.fontWeights, v));
  decl('line-height').forEach((v) => bump(counters.lineHeights, v));
  decl('border-radius').forEach((v) => bump(counters.radii, v));
  decl('box-shadow').forEach((v) => bump(counters.shadows, v.replace(/\s+/g, ' ')));
  for (const prop of ['margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'padding', 'padding-top',
    'padding-bottom', 'padding-left', 'padding-right', 'gap', 'row-gap', 'column-gap']) {
    decl(prop).forEach((v) => v.split(/\s+/).filter((x) => /^-?\d*\.?\d+(px|rem|em)$/.test(x)).forEach((x) => bump(counters.spacing, x)));
  }
  // Both (min-width: 768px) and range syntax such as (40rem <= width < 64rem).
  for (const q of css.matchAll(/@media([^{]+)\{/gi)) for (const m of q[1].matchAll(/([\d.]+(?:px|em|rem))/gi)) bump(counters.breakpoints, m[1]);
  for (const m of css.matchAll(/@font-face\s*{([^}]*)}/gi)) {
    const fam = m[1].match(/font-family\s*:\s*([^;]+)/i);
    bump(counters.fontFaces, fam ? fam[1].trim() : 'unnamed');
  }
  for (const m of css.matchAll(/@import\s+(?:url\()?['"]?(https?:\/\/[^'")\s]+)/gi)) {
    try { bump(counters.externalResources, new URL(m[1]).host); } catch { /* ignore bad URLs */ }
  }
}

function scanHtml(html) {
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) scanCss(m[1]);
  // The style attribute in either quote style, and not data-style.
  for (const m of html.matchAll(/(?<![\w-])style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) scanCss(`x{${m[1] ?? m[2]}}`);
  // Quoted or bare, with a scheme or protocol-relative (//cdn.example.com/a.css).
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)\s*=\s*["']?((?:https?:)?\/\/[^"'\s>]+)[^>]*>/gi)) {
    const sri = /\bintegrity\s*=/.test(m[0]) ? 'with SRI' : 'no SRI';
    try { bump(counters.externalResources, `${new URL(m[1], 'https://x').host} (${sri})`); } catch { /* ignore bad URLs */ }
  }
}

const files = walk(path.resolve(root));
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  if (/\.html?$/i.test(f)) scanHtml(text); else scanCss(text);
}

const ranked = Object.fromEntries(Object.entries(counters).map(([k, map]) => [k, [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP)]));
if (JSON_OUT) {
  console.log(JSON.stringify({ root, files: files.length, ...Object.fromEntries(Object.entries(ranked).map(([k, v]) => [k, v.map(([value, count]) => ({ value, count }))])) }, null, 2));
} else {
  console.log(`css-inventory: ${files.length} file(s) under ${root}`);
  for (const [k, rows] of Object.entries(ranked)) {
    if (!rows.length) continue;
    console.log(`\n${k}`);
    for (const [value, count] of rows) console.log(`  ${String(count).padStart(5)}  ${value}`);
  }
  console.log('\nMap frequent values to DESIGN.md tokens; treat one-off values as noise unless a key component uses them.');
}
