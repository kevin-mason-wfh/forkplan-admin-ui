import { useMemo, useState } from 'react';
import { call, callWithEtag, items, toastWarnings } from '../api.js';
import { E, ENTITLEMENTS, ENUMS } from '../endpoints.js';
import { EntitlementFields, fmtEntitlement, fromForm, toForm } from '../entitlements.jsx';
import {
  CopyId, ErrorBox, Facts, Field, Modal, ReasonDialog, StatusBadge, TableState, fmtDate, fmtDateTime, humanize,
  useLoad, useToast,
} from '../ui.jsx';

const PAGE_SIZE = 20;
const notFoundAsNull = (e) => (e.status === 404 ? null : Promise.reject(e));

// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const addMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return toLocalInput(d.toISOString()); };

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function PlanOverrideDialog({ accountId, sub, onClose, onDone }) {
  const toast = useToast();
  const [tier, setTier] = useState(sub?.tier || 'PRO');
  const [status, setStatus] = useState(sub?.status || 'ACTIVE');
  const [expires, setExpires] = useState(toLocalInput(sub?.expires_at));
  const downgrade = sub && ENUMS.tier.indexOf(tier) < ENUMS.tier.indexOf(sub.tier);

  async function submit(reason) {
    const body = { tier, status, expires_at: fromLocalInput(expires), reason };
    const params = { id: accountId };
    const res = sub
      ? await callWithEtag(E.accounts.subscription, E.accounts.setOverride, { params, etag: sub.etag, body })
      : await call(E.accounts.setOverride, { params, body });
    toast('Subscription updated');
    toastWarnings(toast, res);
    onDone();
  }

  return (
    <ReasonDialog title="Change subscription" confirmLabel="Save subscription" onClose={onClose} onSubmit={submit}
      intro={<>This overrides RevenueCat: purchases and renewals from the app are <b>ignored</b> for this account until you hand it back.</>}>
      <div className="grid2">
        <Field label="Plan">
          <select value={tier} onChange={(e) => setTier(e.target.value)}>{ENUMS.tier.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {ENUMS.subscriptionStatus.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Expires" hint={expires ? `Your local time. ${new Date(expires).toUTCString()}` : 'No expiry: the plan lasts until changed.'}>
        <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
      </Field>
      <div className="toolbar">
        <button type="button" onClick={() => setExpires(addMonths(1))}>+1 month</button>
        <button type="button" onClick={() => setExpires(addMonths(3))}>+3 months</button>
        <button type="button" onClick={() => setExpires(addMonths(12))}>+1 year</button>
        <button type="button" onClick={() => setExpires('')}>No expiry</button>
      </div>
      {downgrade && <div className="callout danger">Downgrading archives anything over the {tier} plan’s limits.</div>}
    </ReasonDialog>
  );
}

function CustomLimitsDialog({ accountId, override, planDefaults, onClose, onDone }) {
  const toast = useToast();
  const initial = useMemo(() => toForm(override?.exists ? override.values : {}), [override]);
  const [form, setForm] = useState(initial);
  const anySet = ENTITLEMENTS.some(([k]) => form[k] !== '');

  async function submit(reason) {
    if (!anySet) throw new Error('Set at least one limit, or use “Remove custom limits” instead.');
    const headers = override?.exists && override.etag ? { 'If-Match': override.etag } : {};
    await call(E.accounts.putQuotaOverride, { params: { id: accountId }, headers, body: { ...fromForm(form), reason } });
    toast('Custom limits saved');
    onDone();
  }

  return (
    <ReasonDialog title={override?.exists ? 'Edit custom limits' : 'Set custom limits'} confirmLabel="Save limits"
      onClose={onClose} onSubmit={submit}
      intro="Leave a field empty to keep the plan’s default. Custom limits stay in place if the plan changes.">
      <EntitlementFields form={form} onChange={setForm} defaults={planDefaults || {}} />
    </ReasonDialog>
  );
}

// ---------------------------------------------------------------------------
// Account detail
// ---------------------------------------------------------------------------

function Meter({ used, limit }) {
  if (limit == null) return <span className="muted small">No limit</span>;
  const pct = limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  return <div className="meter" title={`${pct}%`}><span className={used >= limit ? 'full' : ''} style={{ width: `${pct}%` }} /></div>;
}

function AccountDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const acct = useLoad(() => call(E.accounts.get, { params: { id } }), [id]);
  const sub = useLoad(() => call(E.accounts.subscription, { params: { id }, withMeta: true })
    .then(({ data, etag }) => ({ ...data, etag })).catch(notFoundAsNull), [id]);
  const quota = useLoad(() => call(E.accounts.quotaOverride, { params: { id }, withMeta: true })
    .then(({ data, etag }) => ({ ...data, etag })).catch(notFoundAsNull), [id]);
  const plans = useLoad(() => call(E.plans.list).then(items), []);
  const [dialog, setDialog] = useState(null);

  const a = acct.data;
  const s = sub.data;
  const q = quota.data;
  const tier = s?.tier || a?.subscription?.tier;
  const planDefaults = (plans.data || []).find((p) => p.tier === tier);
  const refresh = () => { acct.reload(); sub.reload(); quota.reload(); onChanged(); };
  const close = () => setDialog(null);
  const postReason = (def, msg) => async (reason) => {
    await call(def, { params: { id }, body: { reason } });
    toast(msg);
    refresh();
  };

  return (
    <Modal title={`Account ${id.slice(0, 8)}`} onClose={onClose} wide>
      <ErrorBox error={acct.error} />
      {acct.loading && !a && <p className="muted">Loading…</p>}
      {a && (
        <>
          {a.status === 'SUSPENDED' && (
            <div className="callout danger">
              Suspended {fmtDateTime(a.archived_at)}{a.archive_reason ? `: “${a.archive_reason}”` : ''}. Members can’t sign in.
            </div>
          )}
          {a.status === 'DELETED' && (
            <div className="callout danger">
              Deleted by the customer {fmtDateTime(a.archived_at)}.
              {a.purge_after && <> Data will be permanently removed on <b>{fmtDate(a.purge_after)}</b> unless restored.</>}
            </div>
          )}
          <Facts rows={[
            ['Account ID', <CopyId id={a.id} />],
            ['Status', <StatusBadge status={a.status} />],
            ['Created', fmtDateTime(a.created_at)],
            ['Last updated', fmtDateTime(a.updated_at)],
          ]} />

          <h4>Members</h4>
          <table className="compact">
            <thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Left</th></tr></thead>
            <tbody>
              <TableState empty={!a.members.length} cols={4} emptyText="No members.">
                {a.members.map((m) => (
                  <tr key={m.user_id} className={m.deleted_at ? 'muted' : ''}>
                    <td><CopyId id={m.user_id} /></td><td>{humanize(m.role)}</td>
                    <td>{fmtDate(m.created_at)}</td><td>{m.deleted_at ? fmtDate(m.deleted_at) : '—'}</td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>

          <h4>Subscription</h4>
          <ErrorBox error={sub.error} />
          {s ? (
            <Facts rows={[
              ['Plan', <StatusBadge status={s.tier} label={s.tier} />],
              ['Status', <StatusBadge status={s.status} />],
              ['Expires', s.expires_at ? fmtDateTime(s.expires_at) : 'Never'],
              ['Managed by', s.admin_override
                ? <StatusBadge status="GRACE_PERIOD" label="Admin override" />
                : 'RevenueCat (app store purchases)'],
              ['RevenueCat customer', s.provider_customer_id ? <CopyId id={s.provider_customer_id} /> : '—'],
              ['Last RevenueCat update', fmtDateTime(s.provider_updated_at)],
            ]} />
          ) : !sub.loading && <p className="muted">No subscription record — the account is on the free plan.</p>}
          <div className="actions start">
            <button onClick={() => setDialog('plan')} disabled={sub.loading}>Change plan…</button>
            {s?.admin_override && <button onClick={() => setDialog('clearOverride')}>Hand back to RevenueCat…</button>}
          </div>

          <h4>Usage &amp; limits</h4>
          <table className="compact">
            <thead><tr><th>Resource</th><th className="num">Used</th><th className="num">Limit</th><th style={{ width: '30%' }}></th></tr></thead>
            <tbody>
              <TableState empty={!a.quota.length} cols={4} emptyText="No usage data.">
                {a.quota.map((r) => (
                  <tr key={r.resource}>
                    <td>{humanize(r.resource)}</td>
                    <td className="num">{r.used.toLocaleString()}</td>
                    <td className="num">{r.limit == null ? '—' : r.limit.toLocaleString()}</td>
                    <td><Meter used={r.used} limit={r.limit} /></td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
          {q?.effective && (
            <p className="muted small">
              Features: {ENTITLEMENTS.filter(([, , kind]) => kind === 'bool').map(([k, label]) => `${label} ${fmtEntitlement('bool', q.effective[k]).toLowerCase()}`).join(' · ')}
            </p>
          )}
          <ErrorBox error={quota.error} />
          {q?.exists ? (
            <div className="callout">
              <b>Custom limits</b> replace the {tier || 'plan'} defaults for:{' '}
              {ENTITLEMENTS.filter(([k]) => q.values[k] != null).map(([k, label, kind]) => `${label} (${fmtEntitlement(kind, q.values[k])})`).join(', ')}.
              <div className="muted small">Set {fmtDateTime(q.updated_at)}{q.updated_by ? ` by ${q.updated_by}` : ''}{q.reason ? ` — “${q.reason}”` : ''}</div>
            </div>
          ) : q && <p className="muted small">Uses the {tier || 'plan'} defaults.</p>}
          <div className="actions start">
            <button onClick={() => setDialog('limits')} disabled={quota.loading}>{q?.exists ? 'Edit custom limits…' : 'Set custom limits…'}</button>
            {q?.exists && <button onClick={() => setDialog('removeLimits')}>Remove custom limits…</button>}
          </div>

          <h4>Account actions</h4>
          <div className="danger-zone">
            {a.status === 'ACTIVE' && (
              <div><div><b>Suspend account</b><p className="muted small">Blocks sign-in for every member. Data is kept and you can restore it later.</p></div>
                <button className="danger" onClick={() => setDialog('suspend')}>Suspend…</button></div>
            )}
            {a.status === 'SUSPENDED' && (
              <div><div><b>Restore account</b><p className="muted small">Lets members sign in again.</p></div>
                <button className="primary" onClick={() => setDialog('restore')}>Restore…</button></div>
            )}
            {a.status === 'DELETED' && (
              <div><div><b>Undo customer deletion</b><p className="muted small">Only on the customer’s request, before the purge date.</p></div>
                <button className="primary" onClick={() => setDialog('restoreDeleted')}>Restore…</button></div>
            )}
            {a.status !== 'ACTIVE' && (
              <div><div><b>Purge permanently</b><p className="muted small">Deletes all data and members’ sign-ins now. Can’t be undone.</p></div>
                <button className="danger" onClick={() => setDialog('purge')}>Purge…</button></div>
            )}
          </div>
        </>
      )}

      {dialog === 'suspend' && (
        <ReasonDialog danger title="Suspend account" confirmLabel="Suspend account" onClose={close}
          intro="Every member is signed out and blocked from signing in until the account is restored. No data is deleted."
          onSubmit={postReason(E.accounts.suspend, 'Account suspended')} />
      )}
      {dialog === 'restore' && (
        <ReasonDialog title="Restore account" confirmLabel="Restore account" onClose={close}
          intro="Members will be able to sign in again." onSubmit={postReason(E.accounts.restore, 'Account restored')} />
      )}
      {dialog === 'restoreDeleted' && (
        <ReasonDialog title="Undo customer deletion" confirmLabel="Restore account" onClose={close}
          reasonLabel="Support ticket reference" reasonHint="The customer’s request this restore is based on."
          intro="Brings back an account the customer deleted, with its data and members."
          onSubmit={async (ref) => { await call(E.accounts.restoreDeleted, { params: { id }, body: { ticket_reference: ref } }); toast('Account restored'); refresh(); }} />
      )}
      {dialog === 'purge' && (
        <ReasonDialog danger title="Purge account permanently" confirmLabel="Purge permanently" onClose={close} typeToConfirm={id}
          intro="All of this account’s data is deleted, along with members’ sign-ins (unless they belong to another active account). This can’t be undone."
          onSubmit={async (reason) => {
            await call(E.accounts.purge, { params: { id }, body: { confirm: id, reason } });
            toast('Account purged'); onChanged(); onClose();
          }} />
      )}
      {dialog === 'plan' && <PlanOverrideDialog accountId={id} sub={s} onClose={close} onDone={refresh} />}
      {dialog === 'clearOverride' && (
        <ReasonDialog title="Hand back to RevenueCat" confirmLabel="Hand back" onClose={close}
          intro="The account keeps its current plan for now. The next purchase, renewal or expiry from the app store will update it."
          onSubmit={async (reason) => {
            await callWithEtag(E.accounts.subscription, E.accounts.clearOverride, { params: { id }, etag: s?.etag, body: { reason } });
            toast('RevenueCat manages this subscription again'); refresh();
          }} />
      )}
      {dialog === 'limits' && (
        <CustomLimitsDialog accountId={id} override={q} planDefaults={planDefaults} onClose={close} onDone={refresh} />
      )}
      {dialog === 'removeLimits' && (
        <ReasonDialog title="Remove custom limits" confirmLabel="Remove" onClose={close}
          intro={`The account goes back to the ${tier || 'plan'} defaults. If it’s over a limit it keeps its data but can’t create more.`}
          onSubmit={async (reason) => {
            await call(E.accounts.deleteQuotaOverride, { params: { id }, query: { reason }, headers: q?.etag ? { 'If-Match': q.etag } : {} });
            toast('Custom limits removed'); refresh();
          }} />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Search page
// ---------------------------------------------------------------------------

export default function Accounts({ param: openId }) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState({ query: '', status: '', offset: 0 });
  const results = useLoad(() => call(E.accounts.search, {
    body: { query: search.query || null, status: search.status || null, limit: PAGE_SIZE, offset: search.offset },
  }), [search]);

  const rows = items(results.data);
  const page = results.data?.pagination;
  const open = (id) => { window.location.hash = `accounts/${id}`; };
  const closeDetail = () => { window.location.hash = 'accounts'; };
  const setPage = (offset) => setSearch((s) => ({ ...s, offset }));
  const hasFilters = !!(search.query || search.status);

  return (
    <>
      <div className="page-head"><h2>Accounts</h2></div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setSearch((s) => ({ ...s, query: text.trim(), offset: 0 })); }}>
        <input className="grow" type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Member email, account ID or user ID (exact match)" aria-label="Search accounts" />
        <select aria-label="Filter by status" value={search.status} onChange={(e) => setSearch((s) => ({ ...s, status: e.target.value, offset: 0 }))}>
          <option value="">All statuses</option>
          {ENUMS.accountStatus.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <button className="primary">Search</button>
        {hasFilters && <button type="button" onClick={() => { setText(''); setSearch({ query: '', status: '', offset: 0 }); }}>Clear</button>}
        <button type="button" onClick={results.reload}>Refresh</button>
      </form>
      <ErrorBox error={results.error} />

      <table>
        <thead><tr><th>Account</th><th>Status</th><th>Plan</th><th className="num">Members</th><th>Created</th></tr></thead>
        <tbody>
          <TableState loading={results.loading} empty={!rows.length} cols={5}
            emptyText={search.query ? `No account matches “${search.query}”. Search needs the full email or ID.` : 'No accounts found.'}>
            {rows.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => open(r.id)}>
                <td><CopyId id={r.id} short /></td>
                <td>
                  <StatusBadge status={r.status} />
                  {r.status === 'DELETED' && r.purge_after && <div className="muted small">Purge {fmtDate(r.purge_after)}</div>}
                </td>
                <td>
                  {r.tier ? <StatusBadge status={r.tier} label={r.tier} /> : <span className="muted">—</span>}
                  {r.subscription_status && r.subscription_status !== 'ACTIVE' && <StatusBadge status={r.subscription_status} />}
                </td>
                <td className="num">{r.member_count}</td>
                <td>{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </TableState>
        </tbody>
      </table>
      {page && page.total > 0 && (
        <div className="pager">
          <span className="count">{page.offset + 1}–{page.offset + page.count} of {page.total.toLocaleString()} accounts</span>
          <button disabled={page.offset === 0 || results.loading} onClick={() => setPage(Math.max(0, page.offset - PAGE_SIZE))}>← Previous</button>
          <button disabled={!page.has_next || results.loading} onClick={() => setPage(page.offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}

      {openId && <AccountDetail key={openId} id={openId} onClose={closeDetail} onChanged={results.reload} />}
    </>
  );
}
