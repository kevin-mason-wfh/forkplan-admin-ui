import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random();
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {list.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

// `dirty` = unsaved edits; closing then asks for confirmation so work isn't lost by a stray click/Escape.
export function Modal({ title, onClose, children, wide, dirty = false }) {
  const requestClose = useCallback(() => {
    if (!dirty || window.confirm('Discard your unsaved changes?')) onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && requestClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [requestClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button type="button" className="icon" aria-label="Close" onClick={requestClose}>✕</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function useLoad(fn, deps = []) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    set((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && set({ data, error: null, loading: false }),
      (error) => alive && set({ data: null, error, loading: false }),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

export function Field({ label, children, hint, required }) {
  return (
    <label className="field">
      <span>{label}{required && <em className="req"> *</em>}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Badge({ children, tone = 'grey' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function ErrorBox({ error }) {
  return error ? <div className="error">{error.message}</div> : null;
}

export const confirmAction = (msg) => window.confirm(msg);

// Button for an action that may not exist in the API yet.
// With `hideIfPlanned`, the button is omitted entirely until the API supports it (keeps rows uncluttered).
export function ActionButton({ def, children, hideIfPlanned, ...rest }) {
  if (hideIfPlanned && !def.live) return null;
  return (
    <button {...rest} disabled={!def.live || rest.disabled}
      title={def.live ? rest.title : `Not in the API yet (${def.task})`}>{children}</button>
  );
}
export const idOf = (o) => o?.id ?? o?.code;

// ---- Shared building blocks -------------------------------------------------

const STATUS_TONE = { PUBLISHED: 'green', RETIRED: 'red' };
export const StatusBadge = ({ status }) =>
  status ? <Badge tone={STATUS_TONE[status] || 'amber'}>{status}</Badge> : null;

export const STATUSES = ['PUBLISHED', 'DRAFT', 'RETIRED'];

// The API's image field name isn't pinned down, so accept the likely candidates.
const IMAGE_FIELDS = ['image_url', 'imageUrl', 'image', 'photo_url', 'thumbnail_url'];
export const imageUrlOf = (item) => {
  const found = IMAGE_FIELDS.map((key) => item?.[key]).find(Boolean);
  return typeof found === 'string' ? found : found?.url || null;
};

// Small square image for list rows; falls back to a placeholder.
export function Thumb({ src, alt = '' }) {
  return src ? <img className="thumb" src={src} alt={alt} loading="lazy" /> : <div className="thumb empty" aria-hidden="true">🍽</div>;
}

// Shows a newly picked file if any, otherwise the saved image.
export function ImagePreview({ savedUrl, newFile }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  useEffect(() => {
    if (!newFile) { setPreviewUrl(null); return undefined; }
    const url = URL.createObjectURL(newFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [newFile]);
  const src = previewUrl || savedUrl;
  return src ? <img className="recipe-image" src={src} alt="Preview" /> : <div className="recipe-image empty">No image yet</div>;
}

// Multi-select pill buttons. `options` is [[id, label], ...].
export function Chips({ options, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="chips">
      {options.map(([id, label]) => (
        <button type="button" key={id} aria-pressed={value.includes(id)} className={`chip ${value.includes(id) ? 'on' : ''}`} onClick={() => toggle(id)}>{label}</button>
      ))}
    </div>
  );
}

// Loading / empty rows for a table body.
export function TableState({ loading, empty, cols, emptyText = 'Nothing here yet.', children }) {
  if (loading) return <tr><td colSpan={cols} className="state">Loading…</td></tr>;
  if (empty) return <tr><td colSpan={cols} className="state">{emptyText}</td></tr>;
  return children;
}

// Notice shown once when some row actions aren't available in the API yet.
export const PlannedNotice = ({ defs, children }) =>
  defs.some((d) => !d.live) ? <div className="notice">{children}</div> : null;
