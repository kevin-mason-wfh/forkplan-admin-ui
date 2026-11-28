// Inputs and formatting for plan limits (per tier) and per-account custom limits (quota overrides).
import { ENTITLEMENTS } from './endpoints.js';

export const fmtEntitlement = (kind, v) => {
  if (v == null) return '—';
  if (kind === 'bool') return v ? 'On' : 'Off';
  return Number(v).toLocaleString();
};

// Form state <-> API values. Form keeps strings: '' = not set; bools as 'true' / 'false'.
export const toForm = (values = {}) =>
  Object.fromEntries(ENTITLEMENTS.map(([k]) => [k, values[k] == null ? '' : String(values[k])]));
export const fromForm = (form) =>
  Object.fromEntries(ENTITLEMENTS.map(([k, , kind]) => {
    const v = form[k];
    if (v === '' || v == null) return [k, null];
    return [k, kind === 'bool' ? v === 'true' : Number(v)];
  }));

// One input per limit. With `defaults`, an empty value means "use the plan default" (shown as placeholder).
export function EntitlementFields({ form, onChange, defaults }) {
  const set = (k, v) => onChange({ ...form, [k]: v });
  return (
    <div className="ent-grid">
      {ENTITLEMENTS.map(([k, label, kind]) => {
        const def = defaults?.[k];
        const custom = defaults && form[k] !== '';
        return (
          <label key={k} className={`field ${custom ? 'custom' : ''}`}>
            <span>{label}</span>
            {kind === 'bool' ? (
              <select value={form[k]} onChange={(e) => set(k, e.target.value)}>
                {defaults && <option value="">Plan default ({fmtEntitlement('bool', def)})</option>}
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            ) : (
              <input type="number" min="0" max="100000" step="1" value={form[k]}
                placeholder={defaults ? `Plan default (${fmtEntitlement('int', def)})` : ''}
                onChange={(e) => set(k, e.target.value)} />
            )}
          </label>
        );
      })}
    </div>
  );
}
