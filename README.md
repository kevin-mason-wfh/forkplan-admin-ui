# Forkplan Admin

React admin UI for the Forkplan API. Cognito username/password sign-in (access token sent as Bearer).

## Run
    npm install
    cp public/config.example.json public/config.json   # local only (gitignored); edit apiBaseUrl, userPoolId, clientId
    npm run dev      # http://localhost:5173
    npm run build    # static files in dist/ → S3 + CloudFront

## Cognito prerequisites
- Create a dedicated admin app client (TASK-030): no client secret, `ALLOW_USER_PASSWORD_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`, ~15 min access-token TTL.
- Backend: add it as `COGNITO_ADMIN_CLIENT_ID`, and set `ADMIN_CORS_ORIGINS` to this site's origin (the API has no CORS today, so browser calls fail until then).
- Users must be in an admin group (`admin`, or `catalog-admin` / `support-admin` once TASK-032/035 land).

## What it covers
- **Catalog** (recipes, ingredients): every status via `/v1/admin/*`; create as draft or published, edit, publish / retire / republish, delete drafts, image upload (presign + S3 PUT). Diet tags with auto-tag rules.
- **Accounts**: search by member email, account id or user id; detail with members, usage vs limits, subscription; suspend / restore, undo a customer deletion, purge; subscription override (and hand back to RevenueCat); per-account custom limits. Deep link: `#accounts/<account-id>`.
- **Plan limits**: compare and edit each tier's entitlements.
- **API Explorer** runs any request.

Writes that change existing records send `If-Match` with the ETag from the last GET (`callWithEtag` in `src/api.js`). Support actions always ask for an audit reason.

Not possible yet (needs backend work): password reset (Cognito `AdminResetUserPassword`), member emails in account detail, an audit-log view.

