import { config, getToken, refresh, signOut } from './auth.js';

export class ApiError extends Error {
  constructor(status, message, body) { super(message); this.status = status; this.body = body; }
}

export function fill(path, params = {}) {
  return path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(params[k] ?? ''));
}

async function raw(method, url, body, token, extra = {}) {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...extra,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function request(method, path, { params, query, body, headers, withMeta } = {}) {
  const qs = query && Object.keys(query).length
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)) : '';
  const url = config().apiBaseUrl.replace(/\/$/, '') + fill(path, params) + qs;
  let res = await raw(method, url, body, await getToken(), headers);
  if (res.status === 401) {
    try { await refresh(); res = await raw(method, url, body, await getToken(), headers); } catch { /* fall through */ }
    if (res.status === 401) { signOut(); window.location.reload(); }
  }
  const text = await res.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* plain text */ }
  if (!res.ok) throw new ApiError(res.status, errorMessage(res, data), data);
  return withMeta ? { data, etag: res.headers.get('ETag') } : data;
}

// Turn the API's error bodies into one readable sentence.
function errorMessage(res, data) {
  if (res.status === 412) return 'Someone else changed this since you opened it. Reload and try again.';
  if (res.status === 428) return 'The API needs the latest version of this item. Reload and try again.';
  let msg;
  if (Array.isArray(data?.detail)) {
    // FastAPI validation errors: [{ loc: ['body', 'field'], msg }]
    msg = data.detail.map((d) => `${(d.loc || []).filter((p) => p !== 'body').join('.') || 'request'}: ${d.msg}`).join('; ');
  } else if (data && typeof data === 'object') {
    msg = typeof data.detail === 'string' ? data.detail : data.message || data.error;
  }
  msg = msg || `${res.status} ${res.statusText}`;
  return res.status === 403 ? `Forbidden: ${msg}` : msg;
}

export const call = (def, opts) => request(def.method, def.path, opts);

const ifMatch = (etag) => (etag ? { 'If-Match': etag } : {});

// For writes that need If-Match: use the ETag we have, or fetch the current one first.
export async function callWithEtag(getDef, def, { params, etag, ...opts } = {}) {
  const tag = etag ?? (await call(getDef, { params, withMeta: true })).etag;
  return call(def, { ...opts, params, headers: { ...opts.headers, ...ifMatch(tag) } });
}

// Lists may come back as an array or wrapped.
export const items = (d) =>
  Array.isArray(d) ? d : d?.items || d?.data || d?.results || d?.recipes || d?.users || d?.tags || [];

// Show API `warnings` (set on publish / subscription override) as a toast.
export function toastWarnings(toast, res) {
  if (res?.warnings?.length) toast(res.warnings.join(' · '), 'warn');
}

// The API caps list `limit` at 100; fetch every page.
const PAGE_SIZE = 100;
export async function listAll(def, { query = {}, ...opts } = {}) {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await call(def, { ...opts, query: { ...query, limit: PAGE_SIZE, offset } });
    const batch = items(page);
    all.push(...batch);
    if (!page?.pagination?.has_next || batch.length === 0) return all;
  }
}

// Upload an image: presign (authenticated, needs content_length) then PUT to S3 (no auth header).
export async function uploadImage(def, id, file) {
  const p = await call(def, { params: { id }, body: { content_type: file.type, content_length: file.size, filename: file.name } });
  const put = await fetch(p.upload_url, { method: 'PUT', headers: { 'Content-Type': p.content_type || file.type }, body: file });
  if (!put.ok) throw new Error(`Image upload failed (${put.status})`);
  return p;
}
