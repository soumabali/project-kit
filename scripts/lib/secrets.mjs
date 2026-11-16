// Credential patterns for the secret guard. gitleaks (its full rule set) runs when installed; these are the
// fallback and cover the common formats. A private key counts only with key material after its header, so code
// that builds a PEM from an environment variable passes.
import { spawnSync } from 'node:child_process';

const PATTERNS = [
  /(A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}/g,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----[^$`{}"']{0,120}[A-Za-z0-9+/]{40,}/g,
  /PuTTY-User-Key-File-[0-9]+: [a-z0-9-]+/g,
  /(sk|rk)_(live|prod)_[0-9A-Za-z]{16,}/g,
  /whsec_[0-9A-Za-z]{24,}/g,
  /sk-ant-[0-9A-Za-z_-]{20,}/g,
  /sk-(proj|svcacct|admin)-[0-9A-Za-z_-]{20,}/g,
  /sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g,
  /gh[pousr]_[0-9A-Za-z]{36,}/g,
  /github_pat_[0-9A-Za-z_]{40,}/g,
  /gl(pat|rt|dt|ptt|cbt|ft|imt|soat|oas|agent|ffct)-[0-9A-Za-z_-]{20,}/g,
  /xox[abeoprs]-[0-9A-Za-z-]{10,}/g,
  /xapp-[0-9]-[A-Z0-9]+-[0-9]+-[a-z0-9]+/g,
  /hooks\.slack\.com\/(services|workflows|triggers)\/[A-Za-z0-9+/]{20,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /GOCSPX-[0-9A-Za-z_-]{24,}/g,
  /npm_[0-9A-Za-z]{36}/g,
  /pypi-AgEIcHlwaS5vcmc[0-9A-Za-z_-]{40,}/g,
  /hf_[0-9A-Za-z]{30,}/g,
  /SG\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{40,}/g,
  /do[por]_v1_[0-9a-f]{64}/g,
  /[0-9]{8,10}:AA[0-9A-Za-z_-]{33}/g,
  /(SB-)?Mid-server-[0-9A-Za-z_-]{20,}/g,
  /xnd_(development|production)_[0-9A-Za-z+/=]{30,}/g,
  /[a-zA-Z0-9_~.]{3}[0-9]Q~[a-zA-Z0-9_~.-]{31,34}/g,
  /cio[0-9A-Za-z]{32}/g, // crates.io API token
  /APP_KEY=base64:[A-Za-z0-9+/]{40,}/g,
  /aws_?secret_?(access_?)?key["']?\s*[:=]\s*["']?[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+])/gi, // in any case, as in ~/.aws/credentials
  /(^|[^A-Za-z0-9_])[A-Z0-9_]*(SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*=["']?[A-Za-z0-9+/_.=-]{20,}/g,
  /[a-z][a-z0-9+.-]*:\/\/[^/:@ "'`]+:[^/@ "'`$]{6,}@[^ "'`/:]+/g,
];
// Placeholders, documented example keys, and local development URLs are not secrets.
const NOT_SECRET = /example|your|xxxx|placeholder|changeme|change_me|dummy|redacted|<[a-z_-]+>|@(localhost|127\.0\.0\.1|db|postgres|mysql|mariadb|redis|mongo|database)$/i;

// The text a tool call would write or run.
export function writtenText(toolInput) {
  const t = toolInput || {};
  const parts = [t.content, t.new_string, t.new_source, t.command];
  for (const e of Array.isArray(t.edits) ? t.edits : []) if (e && typeof e === 'object') parts.push(e.new_string);
  return parts.filter(x => typeof x === 'string').join('\n');
}

export function findSecret(text) {
  if (!text) return '';
  const g = spawnSync('gitleaks', ['stdin', '--no-banner', '--redact', '--log-level', 'error'], { input: text, stdio: ['pipe', 'ignore', 'ignore'], timeout: 15000 });
  if (!g.error && g.status === 1) return 'gitleaks found a credential';
  const flat = text.replace(/\n/g, ' ').replace(/\\n/g, ' ');
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (const m of flat.matchAll(re)) if (!NOT_SECRET.test(m[0])) return 'the new content contains what looks like a real credential';
  }
  return '';
}
