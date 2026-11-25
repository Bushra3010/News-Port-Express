#!/usr/bin/env bash
#
# Writes the Supabase secrets into .dev.vars.
#
# The values are read with `read -rs`, so they are never echoed to the screen,
# never land in shell history, and never appear in the process list. They are
# passed to python through the environment rather than argv for the same reason.
#
#   ./scripts/set-secrets.sh
#
# The database password is percent-encoded before it goes into the connection
# URI. That matters more than it looks: a bare "#" would start a URI fragment
# and silently truncate the password, and "@" or "/" would break the host.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.dev.vars
if [ ! -f "$ENV_FILE" ]; then
  echo "No $ENV_FILE found. Copy .dev.vars.example to .dev.vars first." >&2
  exit 1
fi

# Read from the terminal when there is one, so a redirect cannot leak the
# values into a log; fall back to stdin so the script stays scriptable.
if ( : < /dev/tty ) 2>/dev/null; then
  exec 3< /dev/tty
else
  exec 3<&0
fi

printf 'Supabase database password: '
IFS= read -rs NP_DB_PASSWORD <&3
printf '\n'
printf 'Supabase secret key (sb_secret_...): '
IFS= read -rs NP_SECRET_KEY <&3
printf '\n'
exec 3<&-

if [ -z "${NP_DB_PASSWORD:-}" ] || [ -z "${NP_SECRET_KEY:-}" ]; then
  echo "Both values are required; nothing was written." >&2
  exit 1
fi

export NP_DB_PASSWORD NP_SECRET_KEY ENV_FILE
python3 <<'PY'
import os, re, sys, urllib.parse

path = os.environ["ENV_FILE"]
pw = urllib.parse.quote(os.environ["NP_DB_PASSWORD"], safe="")
key = os.environ["NP_SECRET_KEY"]

if not key.startswith("sb_secret_") and not key.startswith("ey"):
    print("Warning: the secret key looks unusual (expected sb_secret_... or a JWT).", file=sys.stderr)

text = open(path, encoding="utf-8").read()
out, changed = [], {"pw": 0, "key": 0}

for line in text.split("\n"):
    if line.startswith(("DATABASE_URL=", "MIGRATION_DATABASE_URL=")):
        # Replace whatever sits between the final ":" of the userinfo and "@".
        # Count substitutions rather than comparing text: re-running with an
        # unchanged password rewrites the line to the same value, and that is
        # success, not failure.
        new, n = re.subn(r"(postgresql://[^:]+:)[^@]*(@)", lambda m: m.group(1) + pw + m.group(2), line)
        changed["pw"] += n
        out.append(new)
    elif line.startswith("SUPABASE_SECRET_KEY="):
        out.append("SUPABASE_SECRET_KEY=" + key)
        changed["key"] += 1
    else:
        out.append(line)

if changed["pw"] != 2 or changed["key"] != 1:
    print(
        f"Unexpected {path}: patched {changed['pw']} connection URIs (want 2) and "
        f"{changed['key']} secret key lines (want 1). Nothing written.",
        file=sys.stderr,
    )
    raise SystemExit(1)

open(path, "w", encoding="utf-8").write("\n".join(out))
print(f"Updated {path}: both connection URIs and the secret key. Values not shown.")
PY

unset NP_DB_PASSWORD NP_SECRET_KEY
