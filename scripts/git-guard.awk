# Used by git-guard.sh. Reads one shell command (bash or PowerShell) on stdin; prints a reason and exits 1 when the
# command would force-push or skip git hooks, and exits 0 otherwise.
# It reads the command the way a shell does: quotes (a quoted "-f" is still -f, and a commit message is one word),
# backslashes, line continuations, chains (; && || | &), subshells, $(...) and `...` (checked as commands of their
# own), eval and sh -c strings, and heredoc bodies (skipped, since they are data). It guards against mistakes; it
# is not a sandbox, because a command that builds another command at run time can always hide it.
# Portable POSIX awk: mawk, gawk, and the BSD awk on macOS.

{ src = src $0 "\n" }
END {
  gsub(/\\\n/, "", src)
  analyze(src)
  if (reason != "") { print reason; exit 1 }
}

function block(r) { if (reason == "") reason = r }

# Splits s into simple commands and checks each one.
function analyze(s,    n, i, c, d, e, st, word, inw, nw, w, pd, pt, np) {
  n = length(s); st = 0; word = ""; inw = 0; nw = 0; np = 0
  for (i = 1; i <= n && reason == ""; i++) {
    c = substr(s, i, 1)
    if (st == 1) { if (c == "'") st = 0; else word = word c; continue }
    if (st == 2) {
      if (c == "\"") { st = 0; continue }
      if (c == "\\") {
        d = substr(s, i + 1, 1)
        if (d == "\"" || d == "\\" || d == "$" || d == "`") { word = word d; i++ } else word = word c
        continue
      }
      if (c == "$" && substr(s, i + 1, 1) == "(") { e = subst_end(s, i + 2); analyze(substr(s, i + 2, e - i - 2)); word = word "$(...)"; i = e; continue }
      if (c == "`") { e = tick_end(s, i + 1); analyze(substr(s, i + 1, e - i - 1)); word = word "`...`"; i = e; continue }
      word = word c
      continue
    }
    if (c == "'") { st = 1; inw = 1; continue }
    if (c == "\"") { st = 2; inw = 1; continue }
    if (c == "\\") { word = word substr(s, i + 1, 1); inw = 1; i++; continue }
    if (c == "$" && substr(s, i + 1, 1) == "(") { e = subst_end(s, i + 2); analyze(substr(s, i + 2, e - i - 2)); word = word "$(...)"; inw = 1; i = e; continue }
    if (c == "`") { e = tick_end(s, i + 1); analyze(substr(s, i + 1, e - i - 1)); word = word "`...`"; inw = 1; i = e; continue }
    if (c == "<" && substr(s, i + 1, 1) == "<" && substr(s, i + 2, 1) != "<") {
      if (inw) { w[++nw] = word; word = ""; inw = 0 }
      i = heredoc_op(s, i + 2); np++; pd[np] = HD_DELIM; pt[np] = HD_TABS
      continue
    }
    if (c == " " || c == "\t" || c == "\r" || c == "<" || c == ">") { if (inw) { w[++nw] = word; word = ""; inw = 0 } continue }
    if (c == "\n" || c == ";" || c == "&" || c == "|" || c == "(" || c == ")") {
      if (inw) { w[++nw] = word; word = ""; inw = 0 }
      check(w, nw); nw = 0; split("", w)
      if (c == "\n" && np > 0) { i = skip_bodies(s, i + 1, pd, pt, np) - 1; np = 0 }
      continue
    }
    word = word c; inw = 1
  }
  if (inw) w[++nw] = word
  if (reason == "") check(w, nw)
}

# Index of the ")" that closes a "$(" whose content starts at p.
function subst_end(s, p,    n, c, q, depth, pd, pt, np) {
  n = length(s); depth = 1; np = 0
  for (; p <= n; p++) {
    c = substr(s, p, 1)
    if (c == "\\") { p++; continue }
    if (c == "'") { q = index(substr(s, p + 1), "'"); if (q == 0) return n; p += q; continue }
    if (c == "\"") { p = dq_end(s, p + 1); continue }
    if (c == "`") { p = tick_end(s, p + 1); continue }
    if (c == "$" && substr(s, p + 1, 1) == "(") { p = subst_end(s, p + 2); continue }
    if (c == "(") { depth++; continue }
    if (c == ")") { depth--; if (depth == 0) return p; continue }
    if (c == "<" && substr(s, p + 1, 1) == "<" && substr(s, p + 2, 1) != "<") { p = heredoc_op(s, p + 2); np++; pd[np] = HD_DELIM; pt[np] = HD_TABS; continue }
    if (c == "\n" && np > 0) { p = skip_bodies(s, p + 1, pd, pt, np) - 1; np = 0 }
  }
  return n
}

# Index of the '"' that closes a double-quoted string whose content starts at p.
function dq_end(s, p,    n, c) {
  n = length(s)
  for (; p <= n; p++) {
    c = substr(s, p, 1)
    if (c == "\\") { p++; continue }
    if (c == "\"") return p
    if (c == "$" && substr(s, p + 1, 1) == "(") { p = subst_end(s, p + 2); continue }
    if (c == "`") { p = tick_end(s, p + 1); continue }
  }
  return n
}

# Index of the backtick that closes a `...` substitution whose content starts at p.
function tick_end(s, p,    n, c) {
  n = length(s)
  for (; p <= n; p++) { c = substr(s, p, 1); if (c == "\\") { p++; continue } if (c == "`") return p }
  return n
}

# Reads the delimiter of a heredoc whose "<<" ends just before p; sets HD_DELIM and HD_TABS, returns the last index read.
function heredoc_op(s, p,    c, q, d) {
  HD_TABS = 0; d = ""
  if (substr(s, p, 1) == "-") { HD_TABS = 1; p++ }
  while (substr(s, p, 1) == " " || substr(s, p, 1) == "\t") p++
  c = substr(s, p, 1)
  if (c == "'" || c == "\"") {
    q = index(substr(s, p + 1), c)
    if (q == 0) { HD_DELIM = substr(s, p + 1); return length(s) }
    HD_DELIM = substr(s, p + 1, q - 1)
    return p + q
  }
  for (; p <= length(s); p++) {
    c = substr(s, p, 1)
    if (c == " " || c == "\t" || c == "\n" || index(";&|()<>", c)) break
    if (c != "\\" && c != "'" && c != "\"") d = d c
  }
  HD_DELIM = d
  return p - 1
}

# Skips the heredoc bodies that start at p, one per pending delimiter; returns the index after the last one.
function skip_bodies(s, p, pd, pt, np,    k, e, line) {
  for (k = 1; k <= np; k++) {
    while (p <= length(s)) {
      e = index(substr(s, p), "\n")
      if (e == 0) { line = substr(s, p); p = length(s) + 1 } else { line = substr(s, p, e - 1); p += e }
      if (pt[k]) sub(/^\t+/, "", line)
      if (line == pd[k]) break
    }
  }
  return p
}

function is_assign(x) { return x ~ /^[A-Za-z_][A-Za-z0-9_]*=/ }
function aname(x) { return substr(x, 1, index(x, "=") - 1) }
function aval(x) { return substr(x, index(x, "=") + 1) }
function basename_of(x) { x = tolower(x); sub(/.*[\/\\]/, "", x); return x }
function hookpath(kv) { return index(tolower(kv), "core.hookspath") == 1 }
# True when x is an abbreviation git accepts for the long option full (at least min characters).
function abbrev(x, full, min) { return length(x) >= min && length(x) <= length(full) && substr(full, 1, length(x)) == x }

# Variables that husky, pre-commit, lefthook, or git itself read to skip hooks.
function skips_hooks(name, val,    up) {
  up = toupper(name); val = tolower(val)
  if (up == "HUSKY" || up == "LEFTHOOK") return val == "0" || val == "false"
  if (up == "SKIP" || up == "HUSKY_SKIP_HOOKS" || up == "LEFTHOOK_EXCLUDE") return val != ""
  if (up == "GIT_CONFIG_PARAMETERS" || up ~ /^GIT_CONFIG_KEY_[0-9]+$/) return index(val, "core.hookspath") > 0
  return 0
}

# Long options whose value is the next word.
function takes_arg(sub_, x) {
  if (sub_ == "commit") return x ~ /^--(message|file|author|date|template|trailer|reuse-message|reedit-message|fixup|squash|cleanup)$/
  if (sub_ == "push") return x ~ /^--(repo|receive-pack|exec|push-option)$/
  return 0
}

function check(w, nw,    i, j, k, m, q, ch, word, rest, base, sub_, hookenv, hookcfg, name, val) {
  if (nw == 0) return
  # PowerShell: $env:NAME = value lasts for the rest of the session.
  if (tolower(substr(w[1], 1, 5)) == "$env:") {
    name = substr(w[1], 6); val = ""; k = index(name, "=")
    if (k) { val = substr(name, k + 1); name = substr(name, 1, k - 1) }
    else if (w[2] == "=") val = w[3]
    else if (substr(w[2], 1, 1) == "=") val = substr(w[2], 2)
    if (skips_hooks(name, val)) EXPORTED = 1
    return
  }
  if (w[1] == "export" || ((w[1] == "declare" || w[1] == "typeset") && w[2] == "-x")) {
    for (k = 2; k <= nw; k++) if (is_assign(w[k]) && skips_hooks(aname(w[k]), aval(w[k]))) EXPORTED = 1
    return
  }
  hookenv = 0
  for (i = 1; i <= nw && is_assign(w[i]); i++) if (skips_hooks(aname(w[i]), aval(w[i]))) hookenv = 1
  if (i > nw) { if (hookenv) EXPORTED = 1; return }
  # A command string given to eval or a shell is a command of its own.
  base = basename_of(w[i])
  if (base == "eval") { rest = ""; for (k = i + 1; k <= nw; k++) rest = rest " " w[k]; analyze(rest); return }
  if (base ~ /^((ba|z|da|k)?sh|pwsh|powershell)(\.exe)?$/) {
    for (k = i + 1; k < nw; k++) if (tolower(w[k]) ~ /^-(c|command)$/) { analyze(w[k + 1]); return }
    return
  }
  # The git word, after wrappers such as env, sudo, time, or xargs.
  for (j = i; j <= nw; j++) {
    base = basename_of(w[j])
    if (base == "git" || base == "git.exe") break
    if (is_assign(w[j]) && skips_hooks(aname(w[j]), aval(w[j]))) hookenv = 1
  }
  if (j > nw) return
  hookcfg = 0
  for (k = j + 1; k <= nw; k++) {
    word = w[k]
    if (word == "-c" || word == "--config-env") { if (hookpath(w[k + 1])) hookcfg = 1; k++; continue }
    if (index(word, "--config-env=") == 1) { if (hookpath(substr(word, 14))) hookcfg = 1; continue }
    if (word == "-C" || word == "--git-dir" || word == "--work-tree" || word == "--namespace" || word == "--super-prefix") { k++; continue }
    if (substr(word, 1, 1) == "-") continue
    break
  }
  if (k > nw) return
  sub_ = w[k]
  # Pointing core.hooksPath at nothing, or unsetting it, turns the project's hooks off for every later command.
  if (sub_ == "config") {
    for (m = k + 1; m <= nw; m++) if (hookpath(w[m])) {
      for (q = k + 1; q < m; q++) if (w[q] ~ /^--unset/) { block("unsetting core.hooksPath turns the project's hooks off"); return }
      if (m < nw && (w[m + 1] == "" || tolower(w[m + 1]) ~ /^(\/dev\/null|nul)$/)) { block("pointing core.hooksPath at nothing turns the project's hooks off"); return }
    }
    return
  }
  if (sub_ !~ /^(commit|push|merge|rebase|am|cherry-pick|revert|pull)$/) return
  if (hookcfg) { block("overriding core.hooksPath skips the project's hooks"); return }
  if (hookenv || EXPORTED) { block("an environment variable that skips the project's hooks"); return }
  for (m = k + 1; m <= nw; m++) {
    word = w[m]
    if (word == "--") break
    if (substr(word, 1, 2) == "--") {
      if (abbrev(word, "--no-verify", 9)) { block("--no-verify skips the project's hooks"); return }
      if (sub_ == "push" && (index(word, "--force") == 1 || abbrev(word, "--force", 4) || abbrev(word, "--mirror", 3))) { block("force-pushing rewrites history on the remote"); return }
      if (index(word, "=") == 0 && takes_arg(sub_, word)) m++
      continue
    }
    if (sub_ == "push" && substr(word, 1, 1) == "+") { block("force-pushing rewrites history on the remote"); return }
    if (substr(word, 1, 1) == "-" && length(word) > 1) {
      for (q = 2; q <= length(word); q++) {
        ch = substr(word, q, 1)
        if (sub_ == "commit" && ch == "n") { block("git commit -n skips the format check and secret scan"); return }
        if (sub_ == "push" && ch == "f") { block("force-pushing rewrites history on the remote"); return }
        # An option that takes a value ends the cluster; the value is the rest of it, or the next word.
        if ((sub_ == "commit" && index("mFCct", ch)) || (sub_ == "push" && ch == "o")) { if (q == length(word)) m++; break }
      }
    }
  }
}
