import { useState } from 'react';
import { config } from '../auth.js';
import { request } from '../api.js';
import { E } from '../endpoints.js';
import { ErrorBox, useLoad } from '../ui.jsx';

// Lets you run ANY admin endpoint. If config.openapiUrl is set, every /admin operation is listed.
export default function Explorer() {
  const spec = useLoad(async () => {
    const url = config().openapiUrl;
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Could not load OpenAPI spec (${r.status})`);
    return r.json();
  });

  const known = Object.values(E).flatMap((g) => Object.values(g)).map(({ method, path, live }) => ({ method, path, label: live ? 'Configured' : 'Planned (not live)' }));
  const fromSpec = Object.entries(spec.data?.paths || {}).flatMap(([path, ops]) =>
    Object.entries(ops).filter(([m]) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
      .map(([m, op]) => ({ method: m.toUpperCase(), path, label: op.summary || op.operationId || '' })))
    .filter((o) => /admin/i.test(o.path));
  const catalog = fromSpec.length ? fromSpec : known;

  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/v1/admin/');
  const [query, setQuery] = useState('');
  const [body, setBody] = useState('');
  const [out, setOut] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = (i) => { const o = catalog[i]; if (o) { setMethod(o.method); setPath(o.path); } };

  async function run() {
    setBusy(true); setErr(null); setOut(null);
    try {
      const q = Object.fromEntries(new URLSearchParams(query));
      const b = body.trim() ? JSON.parse(body) : undefined;
      setOut(await request(method, path, { query: q, body: b }));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head"><h2>API Explorer</h2></div>
      <ErrorBox error={spec.error} />
      <div className="toolbar">
        <select onChange={(e) => pick(e.target.value)} defaultValue="">
          <option value="" disabled>{fromSpec.length ? 'Admin endpoints from OpenAPI…' : 'Configured endpoints…'}</option>
          {catalog.map((o, i) => <option key={i} value={i}>{o.method} {o.path} {o.label && `— ${o.label}`}</option>)}
        </select>
      </div>
      <div className="toolbar">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <input className="grow" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/v1/admin/…" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="query: a=1&b=2" />
      </div>
      <textarea className="mono" rows={8} placeholder='JSON body (optional)' value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="actions"><button className="primary" disabled={busy} onClick={run}>{busy ? 'Sending…' : 'Send request'}</button></div>
      <ErrorBox error={err} />
      {err?.body && <pre className="mono small">{JSON.stringify(err.body, null, 2)}</pre>}
      {out !== null && <pre className="mono small">{typeof out === 'string' ? out : JSON.stringify(out, null, 2)}</pre>}
    </>
  );
}
