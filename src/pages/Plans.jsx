import { useMemo, useState } from 'react';
import { call, callWithEtag, items } from '../api.js';
import { E, ENTITLEMENTS, ENUMS } from '../endpoints.js';
import { EntitlementFields, fmtEntitlement, fromForm, toForm } from '../entitlements.jsx';
import { ErrorBox, ReasonDialog, StatusBadge, TableState, fmtDateTime, useLoad, useToast } from '../ui.jsx';

// Edit one tier's limits. Only changed fields are sent.
function EditPlanDialog({ plan, onClose, onSaved }) {
  const toast = useToast();
  const initial = useMemo(() => toForm(plan), [plan]);
  const [form, setForm] = useState(initial);
  const changes = Object.fromEntries(
    Object.entries(fromForm(form)).filter(([k, v]) => v !== null && v !== plan[k]),
  );
  const blank = ENTITLEMENTS.some(([k]) => form[k] === '');

  async function save(reason) {
    if (!Object.keys(changes).length) throw new Error('Nothing has changed.');
    if (blank) throw new Error('Every limit needs a value.');
    await callWithEtag(E.plans.get, E.plans.update, { params: { tier: plan.tier }, body: { ...changes, reason } });
    toast(`${plan.tier} plan updated`);
    onSaved();
  }

  return (
    <ReasonDialog title={`Edit ${plan.tier} plan limits`} confirmLabel="Save limits" onClose={onClose} onSubmit={save}
      intro={<>Applies straight away to <b>every account on {plan.tier}</b>, except accounts with their own custom limits. Accounts already over a lowered limit keep their data but can’t create more.</>}>
      <EntitlementFields form={form} onChange={setForm} />
      {Object.keys(changes).length > 0 && (
        <p className="muted small">Changing: {ENTITLEMENTS.filter(([k]) => k in changes).map(([k, label, kind]) =>
          `${label} ${fmtEntitlement(kind, plan[k])} → ${fmtEntitlement(kind, changes[k])}`).join(' · ')}</p>
      )}
    </ReasonDialog>
  );
}

// Tiers side by side so limits are easy to compare.
export default function Plans() {
  const plans = useLoad(() => call(E.plans.list).then(items));
  const [editing, setEditing] = useState(null);
  const byTier = Object.fromEntries((plans.data || []).map((p) => [p.tier, p]));
  const tiers = ENUMS.tier.filter((t) => byTier[t]).concat((plans.data || []).map((p) => p.tier).filter((t) => !ENUMS.tier.includes(t)));

  return (
    <>
      <div className="page-head">
        <h2>Plan limits</h2>
        <button onClick={plans.reload}>Refresh</button>
      </div>
      <p className="muted">What each subscription tier allows. To change one customer’s limits, open their account instead.</p>
      <ErrorBox error={plans.error} />
      <table className="compare">
        <thead>
          <tr>
            <th>Limit</th>
            {tiers.map((t) => (
              <th key={t}>
                <div className="th-split"><StatusBadge status={t} label={t} /><button onClick={() => setEditing(byTier[t])}>Edit</button></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <TableState loading={plans.loading} empty={!tiers.length} cols={tiers.length + 1 || 2} emptyText="No plans returned by the API.">
            {ENTITLEMENTS.map(([k, label, kind]) => (
              <tr key={k}>
                <td>{label}</td>
                {tiers.map((t) => <td key={t} className="num">{fmtEntitlement(kind, byTier[t][k])}</td>)}
              </tr>
            ))}
            <tr className="muted small">
              <td>Last changed</td>
              {tiers.map((t) => <td key={t} className="num">{fmtDateTime(byTier[t].updated_at)}</td>)}
            </tr>
          </TableState>
        </tbody>
      </table>
      {editing && <EditPlanDialog plan={editing} onClose={() => setEditing(null)} onSaved={plans.reload} />}
    </>
  );
}
