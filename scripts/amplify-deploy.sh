#!/usr/bin/env bash
# Deploy ./dist to an Amplify Hosting app via manual deployment.
# Usage: AMPLIFY_APP_ID=... AMPLIFY_BRANCH=main scripts/amplify-deploy.sh
set -euo pipefail

: "${AMPLIFY_APP_ID:?}" "${AMPLIFY_BRANCH:?}"
zip_file="$(mktemp -d)/dist.zip"
(cd dist && zip -qr "$zip_file" .)

read -r job_id upload_url < <(aws amplify create-deployment \
  --app-id "$AMPLIFY_APP_ID" --branch-name "$AMPLIFY_BRANCH" \
  --query '[jobId,zipUploadUrl]' --output text)

curl -fsS -H 'Content-Type: application/zip' -T "$zip_file" "$upload_url"
aws amplify start-deployment \
  --app-id "$AMPLIFY_APP_ID" --branch-name "$AMPLIFY_BRANCH" --job-id "$job_id" >/dev/null

echo "Deployment job $job_id started; waiting..."
for _ in $(seq 1 60); do
  status=$(aws amplify get-job --app-id "$AMPLIFY_APP_ID" --branch-name "$AMPLIFY_BRANCH" \
    --job-id "$job_id" --query 'job.summary.status' --output text)
  case "$status" in
    SUCCEED) echo "Deployed."; exit 0 ;;
    FAILED|CANCELLED) echo "Deployment $status" >&2; exit 1 ;;
  esac
  sleep 5
done
echo "Timed out waiting for deployment" >&2; exit 1
