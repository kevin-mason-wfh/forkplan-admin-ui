# Deployment

| Event | Workflow | Target |
|---|---|---|
| PR opened/updated | `ci.yml` | build check only |
| PR merged to `main` | `deploy-dev.yml` | Amplify **dev** app |
| GitHub Release published (`vX.Y.Z`) | `release.yml` | Amplify **prod** app (approval gate) |

GitHub Actions builds `dist/` and pushes it to Amplify Hosting via manual deployment
(`create-deployment` → upload zip → `start-deployment`). Amplify is **not** connected to the
repo, so it never builds on its own. Runtime config is **not** in the repo: `scripts/write-config.mjs` writes `dist/config.json` at deploy time from
GitHub environment variables.

## One-time AWS setup (per environment: dev, prod)

1. Run `./scripts/bootstrap-amplify.sh` (dev) or `ENV_NAME=prod ./scripts/bootstrap-amplify.sh` (prod).
   It creates app `forkplan-admin-<env>`, branch `<env>`, and the SPA rewrite, and prints the
   `AMPLIFY_APP_ID` to store in GitHub. Same convention as the web project (`forkplan-web-<env>`).
   Optionally add custom headers in the console (HSTS, CSP, `Cache-Control: no-store` for `/config.json`).
2. GitHub OIDC: create the IAM identity provider `token.actions.githubusercontent.com` and a role
   trusting it, scoped to this repo and environment, e.g. condition
   `token.actions.githubusercontent.com:sub` = `repo:kevin-mason-wfh/forkplan-admin-ui:environment:dev`
   (`...:environment:production` for prod). Permissions:
   `amplify:CreateDeployment`, `amplify:StartDeployment`, `amplify:GetJob` on the app's ARN.
   Use separate AWS accounts for dev and prod if you can.
3. Cognito: add the Amplify domain to the admin client's allowed origins / `ADMIN_CORS_ORIGINS` on the API.

## One-time GitHub setup

Settings → Environments → create `dev` and `production`. In each, add **variables**:
`AWS_DEPLOY_ROLE_ARN`, `AMPLIFY_APP_ID`, `API_BASE_URL`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`. On `production`, add **required reviewers**
and restrict deployment to tags `v*`.

Also: protect `main` (require PR + the `build` check) so every merge has passed CI.
The build fails if any config variable is missing, so an unconfigured environment can't deploy.

## Releasing to production

```sh
# from an up-to-date main that is already green on dev
gh release create v1.0.0 --target main --generate-notes
```

Publishing the release triggers `release.yml`, which checks out the tag, verifies it is on
`main`, builds, injects prod config, waits for approval, and deploys.

- **Rollback:** re-run the workflow for the previous release in the Actions tab (it rebuilds that tag), or
  revert on `main` and cut a new patch release.
- Pre-releases (`--prerelease`) and drafts do not deploy.
- Use SemVer: patch for fixes, minor for features, major for breaking changes.
