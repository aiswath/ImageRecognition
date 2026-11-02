#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
: "${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT to the project you want to deploy to}"
region="${REGION:-asia-northeast3}"
service="${SERVICE_NAME:-dog-breed}"
# Private by default. Set PUBLIC=true when the app should accept public visitors.
access_flag=--no-allow-unauthenticated
if [[ "${PUBLIC:-false}" == true ]]; then
  access_flag=--allow-unauthenticated
fi
gcloud run deploy "$service" \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$region" \
  --source . \
  --memory 2Gi --cpu 1 \
  --concurrency 1 \
  --min-instances 0 --max-instances 1 \
  --timeout 120 \
  "$access_flag"
