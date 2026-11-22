#!/usr/bin/env bash
# One-time: create the Amplify Hosting app + branch for an environment (manual-deploy, no Git).
# Uses your normal AWS credentials. Prints the app id to store as the GitHub env variable AMPLIFY_APP_ID.
#   ./scripts/bootstrap-amplify.sh              # dev  -> app forkplan-admin-dev,  branch dev
#   ENV_NAME=prod ./scripts/bootstrap-amplify.sh  # prod -> app forkplan-admin-prod, branch prod
#   BASIC_AUTH="user:password" ...              # optional password protection
set -euo pipefail

REGION="${AWS_REGION:-eu-west-2}"
ENV_NAME="${ENV_NAME:-dev}"
NAME="${APP_NAME:-forkplan-admin-${ENV_NAME}}"; BRANCH="${BRANCH:-$ENV_NAME}"
STAGE=DEVELOPMENT; [[ "$ENV_NAME" == "prod" ]] && STAGE=PRODUCTION

APP_ID="$(aws amplify create-app --name "$NAME" --region "$REGION" --query app.appId --output text)"
aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH" --stage "$STAGE" --region "$REGION" >/dev/null

# SPA fallback to /index.html
aws amplify update-app --app-id "$APP_ID" --region "$REGION" \
  --custom-rules "[{\"source\":\"</^[^.]+$|\\\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>\",\"target\":\"/index.html\",\"status\":\"200\"}]" >/dev/null

if [[ -n "${BASIC_AUTH:-}" ]]; then
  aws amplify update-branch --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" \
    --enable-basic-auth --basic-auth-credentials "$(printf '%s' "$BASIC_AUTH" | base64)" >/dev/null
fi

echo "AMPLIFY_APP_ID=$APP_ID"
echo "URL: https://${BRANCH}.${APP_ID}.amplifyapp.com  (add this origin to ADMIN_CORS_ORIGINS)"
