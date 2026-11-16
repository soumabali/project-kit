// The secret guard against credential formats and ordinary edits, through every tool it watches, including when no
// JSON parser works. Tokens are assembled from fragments so this file never holds one whole.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // a file URL's pathname is not a path on Windows
const GUARD = path.join(root, 'scripts', 'hooks', 'pre-tool.mjs');
const j = (...p) => p.join('');
const r = (n, set = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') =>
  Array.from({ length: n }, (_, i) => set[(i * 7 + 3) % set.length]).join('');
const hex = (n) => r(n, '0123456789abcdef');
const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const cases = [
  ['AWS access key id', 'block', j('AKIA', r(16, UP))],
  ['RSA private key', 'block', j('-----BEGIN RSA ', 'PRIVATE KEY-----\n', r(64), '\n-----END RSA PRIVATE KEY-----')],
  ['PGP private key block', 'block', j('-----BEGIN PGP ', 'PRIVATE KEY BLOCK-----\n\n', r(64))],
  ['Stripe live secret', 'block', j('sk_', 'live_', r(24))],
  ['AWS secret access key in a credentials file', 'block', j('aws_secret_', 'access_key = ', r(40))],
  ['Stripe webhook secret', 'block', j('wh', 'sec_', r(32))],
  ['Anthropic key', 'block', j('sk-', 'ant-api03-', r(40))],
  ['OpenAI project key', 'block', j('sk-', 'proj-', r(40))],
  ['OpenAI service-account key', 'block', j('sk-svc', 'acct-', r(40))],
  ['GitHub token', 'block', j('gh', 'p_', r(36))],
  ['GitLab runner token', 'block', j('gl', 'rt-', r(20))],
  ['Slack bot token', 'block', j('xo', 'xb-', r(12, '0123456789'), '-', r(24))],
  ['Slack webhook URL', 'block', j('https://hooks.slack.com/', 'services/T0', r(8, UP), '/B0', r(8, UP), '/', r(24))],
  ['Google API key', 'block', j('AI', 'za', r(35))],
  ['Google OAuth client secret', 'block', j('GOC', 'SPX-', r(28))],
  ['npm token', 'block', j('np', 'm_', r(36))],
  ['PyPI token', 'block', j('pypi-', 'AgEIcHlwaS5vcmc', r(60))],
  ['Hugging Face token', 'block', j('h', 'f_', r(34))],
  ['SendGrid key', 'block', j('S', 'G.', r(22), '.', r(43))],
  ['DigitalOcean token', 'block', j('do', 'p_v1_', hex(64))],
  ['Telegram bot token', 'block', j('123456789', ':AA', r(33))],
  ['Midtrans server key', 'block', j('Mid-', 'server-', r(24))],
  ['Xendit secret key', 'block', j('xnd_', 'production_', r(48))],
  ['Azure AD client secret', 'block', j('abc1', 'Q~', r(34))],
  ['Laravel APP_KEY', 'block', j('APP_KEY=', 'base64:', r(44))],
  ['JWT secret in .env style', 'block', j('JWT_SECRET', '=', r(40))],
  ['JSON Web Token', 'block', j('const t = "eyJ', r(34), '.eyJ', r(60), '.', r(43), '"')],
  ['Password in YAML', 'block', j('db:\n  password: "', r(24), '"')],
  ['API key in JSON', 'block', j('{ "apiKey": "', r(32), '" }')],
  ['Lower-case token assignment', 'block', j("const access_token = '", r(40), "';")],
  ['Postgres URL with a password', 'block', j('DATABASE_URL=postgres://app:', 'S3cr3tP4ss', '@db.prod.internal:5432/app')],
  ['PEM built from an environment variable', 'allow', j('const pem = `-----BEGIN ', 'PRIVATE KEY-----\\n${process.env.KEY}`;')],
  ['PEM header check in code', 'allow', j("if (key.startsWith('-----BEGIN ", "PRIVATE KEY-----')) parse(key);")],
  ['Slack placeholder', 'allow', j('SLACK_BOT_TOKEN=xo', 'xb-your-bot-token')],
  ['Stripe placeholder', 'allow', j('STRIPE_SECRET=sk_', 'live_', 'x'.repeat(24))],
  ['Anthropic placeholder', 'allow', j('ANTHROPIC_API_KEY=sk-', 'ant-', 'your-api-key-goes-here')],
  ['AWS documented example key', 'allow', j('AKIA', 'IOSFODNN7', 'EXAMPLE')],
  ['Local database URL', 'allow', j('DATABASE_URL=postgres://app:', 'app-password', '@localhost:5432/app')],
  ['Compose database URL', 'allow', j('DATABASE_URL=mysql://root:', 'secret123', '@db:3306/app')],
  ['Secret from the environment', 'allow', 'const secret = process.env.JWT_SECRET;\nJWT_SECRET=${JWT_SECRET}'],
  ['Empty example values', 'allow', 'APP_KEY=\nJWT_SECRET=\nDB_PASSWORD='],
  ['Header name, not a key', 'allow', 'API_KEY_HEADER=X-Acme-Api-Key-Header'],
  ['Dotted path, not a secret', 'allow', 'JWT_SECRET=process.env.SIGNING_SECRET_VALUE'],
  ['A number, not a token', 'allow', 'CACHE_TOKEN_TTL_SECONDS=360000000000000000000'],
  ['Password field label', 'allow', 'const labels = { password: "Enter-your-password-here-please" };'],
  ['Token read from config', 'allow', 'const token = config.get("auth.token"); const password = "";'],
  ['jwt.io sample token', 'allow', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'],
  ['Ordinary code', 'allow', 'export function add(a: number, b: number) { return a + b; }'],
];

const run = (event, env = process.env) =>
  spawnSync(process.execPath, [GUARD], { input: JSON.stringify(event), encoding: 'utf8', env }).status;
const write = (content) => ({ tool_name: 'Write', tool_input: { file_path: '/p/f', content } });

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error(`    ${msg}`); } };
for (const [label, want, content] of cases) {
  const got = run(write(content)) === 2 ? 'block' : 'allow';
  check(got === want, `${label}: ${got}, wanted ${want}`);
}

// Every write path is scanned.
const key = j('AKIA', r(16, UP));
check(run({ tool_name: 'Edit', tool_input: { file_path: '/p/f', old_string: 'a', new_string: `k=${key}` } }) === 2, 'Edit not scanned');
check(run({ tool_name: 'MultiEdit', tool_input: { file_path: '/p/f', edits: [{ old_string: 'a', new_string: `k=${key}` }] } }) === 2, 'MultiEdit not scanned');
check(run({ tool_name: 'NotebookEdit', tool_input: { notebook_path: '/p/n.ipynb', new_source: `k = "${key}"` } }) === 2, 'NotebookEdit not scanned');
check(run({ tool_name: 'Bash', tool_input: { command: `cat > .env <<EOF\nAWS_ACCESS_KEY_ID=${key}\nEOF` } }) === 2, 'Bash heredoc not scanned');
check(run({ tool_name: 'Bash', tool_input: { command: 'npm test' } }) === 0, 'a plain command was blocked');
check(run({ tool_name: 'Edit', tool_input: { file_path: '/p/f', old_string: `k=${key}`, new_string: 'k=process.env.K' } }) === 0, 'removing a key was blocked');
check(run({ tool_name: 'Write', tool_input: { file_path: '/p/f', content: 'crates ' + j('cio', r(32)) } }) === 2, 'crates.io token not caught');

if (failures) { console.error(`  ${failures} guard check(s) failed`); process.exit(1); }
