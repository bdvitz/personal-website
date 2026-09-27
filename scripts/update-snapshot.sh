#!/bin/bash

# Update the stored user snapshot that the /chess page renders before the server responds.
# Usage: scripts/update-snapshot.sh <server-url>
#   e.g. scripts/update-snapshot.sh https://<your-railway-app>.up.railway.app
# Works from any directory. The existing snapshot is only replaced if the new one is valid.

set -euo pipefail

SERVER_URL="${1:?Usage: $0 <server-url>}"
SERVER_URL="${SERVER_URL%/}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$REPO_ROOT/client/public/data/stored-user-snapshot.json"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Wake the server first; a sleeping Railway app can take a while to respond
echo "Checking server: $SERVER_URL"
if ! curl -sf --max-time 120 "$SERVER_URL/api/chess/stats/health" > /dev/null; then
  echo "Server did not respond. Wait for it to wake up and try again."
  exit 1
fi

echo "Fetching snapshot..."
if ! curl -sf --max-time 120 "$SERVER_URL/api/snapshot/generate" -o "$TMP"; then
  echo "Snapshot request failed. Existing snapshot left unchanged."
  exit 1
fi

# Validate before replacing: must be JSON with current stats and non-empty history
if ! node -e '
  const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (!s.currentStats || !Array.isArray(s.historicalData) || s.historicalData.length === 0) process.exit(1);
  const h = s.historicalData;
  console.log(`Valid snapshot: ${h.length} days (${h[0].date} to ${h[h.length - 1].date}), generated ${new Date(s.generatedAt).toISOString()}`);
' "$TMP"; then
  echo "Snapshot is invalid or empty. Existing snapshot left unchanged."
  exit 1
fi

mv "$TMP" "$TARGET"
trap - EXIT
echo "Updated $TARGET"
