#!/usr/bin/env bash
#
# Runs a Wrangler or OpenNext command with the Hyperdrive local connection
# string taken from .dev.vars.
#
# Wrangler refuses to build or deploy a Worker with a Hyperdrive binding unless
# it also has a connection string for local emulation. That value holds the
# database password, so it must not live in wrangler.jsonc, which is committed.
# Passing it through the environment keeps it in .dev.vars, which is not.
#
#   ./scripts/cf.sh npx opennextjs-cloudflare deploy
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d "$HOME/.local/node22/bin" ] && PATH="$HOME/.local/node22/bin:$PATH"

if [ -z "${CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:-}" ]; then
  hd=""
  [ -f .dev.vars ] && hd=$(sed -n 's/^MIGRATION_DATABASE_URL=//p' .dev.vars | head -1)
  if [ -z "$hd" ]; then
    # Wrangler only wants this for `wrangler dev`, where it emulates Hyperdrive
    # against a local database. Build and deploy never open it, so CI — which
    # has no .dev.vars and should not have the real credentials — can satisfy
    # the check with an address that goes nowhere.
    hd="postgresql://placeholder:placeholder@127.0.0.1:5432/postgres"
  fi
  export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$hd"
fi

exec "$@"
