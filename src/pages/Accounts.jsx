import { useState } from 'react';
import { call, items } from '../api.js';
import { E } from '../endpoints.js';
import { ActionButton, Badge, ErrorBox, Field, useLoad, useToast } from '../ui.jsx';

// Support tools (TASK-035). Buttons stay disabled until the routes exist in the API (flip `live` in endpoints.js).
export default function Accounts() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [acct, setAcct] = useState(null);
  const [reason, setReason] = useState('');
  const [ref, setRef] = useState('');
  const [err, setErr] = useState(null);
  const ent = useLoad(() => (E.accounts.entitlements.live ? call(E.accounts.entitlements).then(items) : Promise.resolve([])));
  const planned = !E.accounts.search.live;

  const run = async (fn, ok) => { setErr(null); try { const r = await fn(); if (ok) toast(ok); return r; } catch (e) { setErr(e); } };
  const lookup = async (e) => {
    e.preventDefault();
    const r = await run(() => call(E.accounts.search, { body: { email } }));
    if (r) setAcct(r.account || r);
  };
  const reload = () => run(() => call(E.accounts.get, { params: { id: acct.id } }).then(setAcct));

  return (
    <>
      <div className="page-head"><h2>Accounts</h2></div>
      {planned && <div className="error">Account lookup, suspend/restore and plan entitlements are planned (TASK-035) but not in the API yet. User management, subscription changes (RevenueCat is the source of truth) and password reset have no admin routes at all — see the README.</div>}
      <ErrorBox error={err} />
      <form className="toolbar" onSubmit={lookup}>
        <input type="email" placeholder="User email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <ActionButton def={E.accounts.search} className="primary">Look up</ActionButton>
      </form>
      {acct && (
        <div className="card">
          <h3>{acct.id} <Badge tone={acct.status === 'ACTIVE' ? 'green' : 'red'}>{acct.status}</Badge></h3>
          <pre className="mono small">{JSON.stringify(acct, null, 2)}</pre>
          <Field label="Reason (required)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label="User request reference (for restoring a deleted account)"><input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <div className="actions">
            <ActionButton def={E.accounts.suspend} className="danger" disabled={!reason}
              onClick={() => run(() => call(E.accounts.suspend, { params: { id: acct.id }, body: { reason } }), 'Account suspended').then(reload)}>Suspend</ActionButton>
            <ActionButton def={E.accounts.restore} className="primary" disabled={!reason}
              onClick={() => run(() => call(E.accounts.restore, { params: { id: acct.id }, body: { reason, ...(ref ? { user_request_reference: ref } : {}) } }), 'Account restored').then(reload)}>Restore</ActionButton>
          </div>
        </div>
      )}
      <h3>Plan entitlements</h3>
      <table>
        <thead><tr><th>Tier</th><th>Entitlements</th></tr></thead>
        <tbody>{(ent.data || []).map((t) => <tr key={t.tier}><td>{t.tier}</td><td><code>{JSON.stringify(t)}</code></td></tr>)}
          {!ent.data?.length && <tr><td colSpan="2">Not available yet.</td></tr>}</tbody>
      </table>
    </>
  );
}
