#!/usr/bin/env bash
#
# Pushes the three Worker secrets from .dev.vars to Cloudflare.
#
# Each value is piped to `wrangler secret put` on stdin, so it never appears in
# argv, in the process list or in shell history. Nothing is printed.
#
#   ./scripts/push-secrets.sh
#
# Run ./scripts/set-secrets.sh first to fill .dev.vars in.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.dev.vars
[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE. Run ./scripts/set-secrets.sh first." >&2; exit 1; }

# Node 22 is needed by Wrangler and is not always on PATH here.
[ -d "$HOME/.local/node22/bin" ] && PATH="$HOME/.local/node22/bin:$PATH"

value_of() {
  # First match only, everything after the first "=", no surrounding quotes.
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1
}

# Verify the credentials before sending them. Wrangler will happily accept a
# password the database rejects, and the failure then surfaces as a 500 on a
# page rather than here, where it is obvious.
echo "checking credentials before pushing..."
if ! node --env-file="$ENV_FILE" scripts/check-db-url.mjs; then
  echo "Nothing pushed." >&2
  exit 1
fi

for name in DATABASE_URL SUPABASE_SECRET_KEY SETUP_TOKEN; do
  value=$(value_of "$name")
  if [ -z "$value" ]; then
    echo "$name is empty in $ENV_FILE; nothing pushed for it." >&2
    exit 1
  fi
  case "$value" in
    *"[DB-PASSWORD]"*|*"[SECRET-KEY]"*)
      echo "$name still holds a placeholder. Run ./scripts/set-secrets.sh first." >&2
      exit 1
      ;;
  esac
  printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null
  echo "pushed $name"
done

echo
echo "All three secrets set. Redeploy to pick them up:"
echo "  npm run deploy"
