// Cognito username/password sign-in using the public Cognito IDP API (no SDK needed).
// Requires the app client to have ALLOW_USER_PASSWORD_AUTH + ALLOW_REFRESH_TOKEN_AUTH and no client secret.
let cfg = null;
const KEY = 'forkplan_admin_session';

export async function loadConfig() {
  const res = await fetch('/config.json', { cache: 'no-store' });
  cfg = await res.json();
  return cfg;
}
export const config = () => cfg;

async function idp(target, body) {
  const res = await fetch(`https://cognito-idp.${cfg.region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.message || data.__type || 'Authentication failed');
    e.code = (data.__type || '').split('#').pop();
    throw e;
  }
  return data;
}

export function parseJwt(token) {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(p))));
  } catch {
    return {};
  }
}

function save(tokens, prev) {
  const s = {
    idToken: tokens.IdToken,
    accessToken: tokens.AccessToken,
    refreshToken: tokens.RefreshToken || prev?.refreshToken,
  };
  sessionStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
const load = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
};

export function currentUser() {
  const s = load();
  if (!s) return null;
  const c = parseJwt(s.idToken);
  const groups = c['cognito:groups'] || [];
  return {
    username: c['cognito:username'] || c.email || c.sub,
    email: c.email,
    groups,
    isAdmin: groups.some((g) => (cfg.adminGroups || ['admin']).includes(g)),
  };
}

function finish(tokens) {
  save(tokens, null);
  const u = currentUser();
  if (!u.isAdmin) {
    sessionStorage.removeItem(KEY);
    throw new Error('This account is not in an admin group.');
  }
  return { user: u };
}

export async function signIn(username, password) {
  const r = await idp('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: cfg.clientId,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  });
  if (r.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    return { challenge: 'NEW_PASSWORD_REQUIRED', session: r.Session, username };
  }
  if (r.ChallengeName) throw new Error(`Unsupported sign-in challenge: ${r.ChallengeName}`);
  return finish(r.AuthenticationResult);
}

export async function completeNewPassword({ username, session, newPassword }) {
  const r = await idp('RespondToAuthChallenge', {
    ClientId: cfg.clientId,
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    Session: session,
    ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
  });
  return finish(r.AuthenticationResult);
}

export function signOut() {
  sessionStorage.removeItem(KEY);
}

let refreshing = null;
export async function refresh() {
  const s = load();
  if (!s?.refreshToken) throw new Error('Session expired');
  refreshing ||= idp('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: cfg.clientId,
    AuthParameters: { REFRESH_TOKEN: s.refreshToken },
  })
    .then((r) => save(r.AuthenticationResult, s))
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function getToken() {
  let s = load();
  if (!s) throw new Error('Not signed in');
  const key = cfg.tokenType === 'access' ? 'accessToken' : 'idToken';
  if ((parseJwt(s[key]).exp || 0) * 1000 - Date.now() < 60_000) s = await refresh();
  return s[key];
}
