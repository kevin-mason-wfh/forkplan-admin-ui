# Forkplan Admin

React admin UI for the Forkplan API. Cognito username/password sign-in (access token sent as Bearer).

## Run
    npm install
    # edit public/config.json: apiBaseUrl, clientId
    npm run dev      # http://localhost:5173
    npm run build    # static files in dist/ → S3 + CloudFront

## Cognito prerequisites
- Create a dedicated admin app client (TASK-030): no client secret, `ALLOW_USER_PASSWORD_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`, ~15 min access-token TTL.
- Backend: add it as `COGNITO_ADMIN_CLIENT_ID`, and set `ADMIN_CORS_ORIGINS` to this site's origin (the API has no CORS today, so browser calls fail until then).
- Users must be in an admin group (`admin`, or `catalog-admin` / `support-admin` once TASK-032/035 land).

## What works now (live routes in openapi.json)
Diet tags (create, edit, deactivate/reactivate, auto-tag rules), catalog recipe create, catalog ingredient create, image upload (presign + S3 PUT), plus read-only lists. API Explorer runs any request.

## Not in the API yet (UI is wired, buttons disabled)
- Recipe/ingredient edit, delete, publish, retire (TASK-032): flip `live` in `src/endpoints.js`.
- Account lookup, suspend/restore, plan entitlements (TASK-035).
- No backend design exists for: listing users, subscription changes (RevenueCat is the source of truth), password reset. Password reset needs a backend route calling Cognito `AdminResetUserPassword`; it can't be done from the browser.
