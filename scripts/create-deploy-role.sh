#!/usr/bin/env bash
# One-time: create the GitHub OIDC deploy role for an environment's Amplify app.
#   AMPLIFY_APP_ID=d36nfwphvx2sfl ./scripts/create-deploy-role.sh                  # dev
#   ENV_NAME=prod GH_ENV=production AMPLIFY_APP_ID=<prod id> ./scripts/create-deploy-role.sh
# Requires the GitHub OIDC provider (token.actions.githubusercontent.com) to already exist in the account.
set -euo pipefail

: "${AMPLIFY_APP_ID:?set AMPLIFY_APP_ID}"
REGION="${AWS_REGION:-eu-west-2}"
ENV_NAME="${ENV_NAME:-dev}"
GH_ENV="${GH_ENV:-$ENV_NAME}"                       # GitHub environment name (dev | production)
REPO="${GH_REPO:-kevin-mason-wfh/forkplan-admin-ui}"
ROLE="forkplan-admin-ci-${ENV_NAME}-deploy"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
PROVIDER="arn:aws:iam::${ACCOUNT}:oidc-provider/token.actions.githubusercontent.com"

TRUST=$(cat <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"${PROVIDER}"},
 "Action":"sts:AssumeRoleWithWebIdentity",
 "Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com",
  "token.actions.githubusercontent.com:sub":"repo:${REPO}:environment:${GH_ENV}"}}}]}
JSON
)
POLICY=$(cat <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Action":["amplify:CreateDeployment","amplify:StartDeployment","amplify:GetJob"],
 "Resource":["arn:aws:amplify:${REGION}:${ACCOUNT}:apps/${AMPLIFY_APP_ID}","arn:aws:amplify:${REGION}:${ACCOUNT}:apps/${AMPLIFY_APP_ID}/*"]}]}
JSON
)

aws iam create-role --role-name "$ROLE" --assume-role-policy-document "$TRUST" >/dev/null
aws iam put-role-policy --role-name "$ROLE" --policy-name amplify-deploy --policy-document "$POLICY"
echo "AWS_DEPLOY_ROLE_ARN=arn:aws:iam::${ACCOUNT}:role/${ROLE}"
