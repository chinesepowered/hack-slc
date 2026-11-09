#!/usr/bin/env bash
# Applies CapyKube's Dash0 dashboard and SLO from observability/dash0/.
# Idempotent: each object is upserted by its dash0.com/origin label.
#   DASH0_AUTH_TOKEN=... ./scripts/dash0-apply.sh
set -euo pipefail
API="${DASH0_API_ENDPOINT:-https://api.europe-west4.gcp.dash0.com}"
DATASET="${DASH0_DATASET:-default}"
DIR="$(cd "$(dirname "$0")/../observability/dash0" && pwd)"
: "${DASH0_AUTH_TOKEN:?set DASH0_AUTH_TOKEN}"

put() {
  local kind="$1" origin="$2" file="$3"
  local code
  code=$(curl -sS -o /tmp/dash0-apply.out -w '%{http_code}' -X PUT "$API/api/$kind/$origin?dataset=$DATASET" \
    -H "Authorization: Bearer $DASH0_AUTH_TOKEN" -H 'Content-Type: application/json' --data-binary "@$file")
  echo "$kind/$origin -> HTTP $code"
  if [ "$code" -ge 300 ]; then cat /tmp/dash0-apply.out; echo; return 1; fi
}

put dashboards capykube-overview "$DIR/dashboard.json"
put slos capykube-planb-latency "$DIR/slo-planb-latency.json"
