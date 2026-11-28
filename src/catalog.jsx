// Shared pieces for the catalog pages (recipes and ingredients): status lifecycle, filters and audit info.
// Lifecycle: DRAFT --publish--> PUBLISHED --retire--> RETIRED --publish--> PUBLISHED. Only drafts can be deleted.
import { callWithEtag, toastWarnings } from './api.js';
import { STATUSES, StatusBadge, confirmAction, fmtDateTime, humanize, useToast } from './ui.jsx';

const DONE = { publish: 'Published', retire: 'Retired', remove: 'Deleted' };

// Returns run(kind, item) for kind = publish | retire | remove. Uses item.etag if present, else fetches it.
export function useLifecycle(defs, noun, onDone) {
  const toast = useToast();
  return async (kind, item) => {
    const confirmText = {
      retire: `Retire "${item.name}"?\n\nCustomers will stop seeing this ${noun}. You can publish it again later.`,
      remove: `Delete the draft "${item.name}"?\n\nThis can't be undone.`,
    }[kind];
    if (confirmText && !confirmAction(confirmText)) return false;
    try {
      const res = await callWithEtag(defs.get, defs[kind], { params: { id: item.id }, etag: item.etag });
      toast(`${DONE[kind]} “${item.name}”`);
      toastWarnings(toast, res);
      onDone();
      return true;
    } catch (e) {
      toast(e.message, 'bad');
      return false;
    }
  };
}

// The buttons that make sense for an item's current status.
export function LifecycleButtons({ item, run, disabled, title }) {
  const s = item.status;
  return (
    <>
      {(s === 'DRAFT' || s === 'RETIRED') && (
        <button type="button" disabled={disabled} title={title} onClick={() => run('publish', item)}>
          {s === 'RETIRED' ? 'Republish' : 'Publish'}
        </button>
      )}
      {s === 'PUBLISHED' && <button type="button" disabled={disabled} title={title} onClick={() => run('retire', item)}>Retire</button>}
      {s === 'DRAFT' && <button type="button" className="danger" disabled={disabled} title={title} onClick={() => run('remove', item)}>Delete</button>}
    </>
  );
}

// Status filter whose options show how many items are in each status.
export function StatusFilter({ rows, value, onChange }) {
  const counts = {};
  (rows || []).forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  return (
    <select aria-label="Filter by status" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All statuses</option>
      {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)} ({counts[s] || 0})</option>)}
    </select>
  );
}

// One-line summary of where an item is in its lifecycle and who touched it last.
export function AuditLine({ item }) {
  if (!item?.status) return null;
  const parts = [
    `Created ${fmtDateTime(item.created_at)}${item.created_by ? ` by ${item.created_by}` : ''}`,
    item.updated_at && item.updated_at !== item.created_at && `updated ${fmtDateTime(item.updated_at)}${item.updated_by ? ` by ${item.updated_by}` : ''}`,
    item.published_at && `published ${fmtDateTime(item.published_at)}`,
    item.retired_at && item.status === 'RETIRED' && `retired ${fmtDateTime(item.retired_at)}`,
  ].filter(Boolean);
  return <div className="audit"><StatusBadge status={item.status} /> {parts.join(' · ')}</div>;
}

// Hint for the editor about what saving will do.
export const saveHint = (status) => ({
  PUBLISHED: 'This item is published: saved changes are visible to customers straight away.',
  RETIRED: 'This item is retired: customers won’t see changes unless you republish it.',
  DRAFT: 'This is a draft: customers can’t see it until you publish it.',
}[status]);
