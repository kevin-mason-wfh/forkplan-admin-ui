import { useState } from 'react';
import { call, items } from '../api.js';
import { E } from '../endpoints.js';
import { Badge, ErrorBox, Field, Modal, TableState, confirmAction, useLoad, useToast } from '../ui.jsx';

function RuleEditor({ tag, onClose }) {
  const toast = useToast();
  const rule = useLoad(() => call(E.dietTags.getRule, { params: { id: tag.id } }).catch((e) => (e.status === 404 ? null : Promise.reject(e))), [tag.id]);
  const [criteria, setCriteria] = useState(null);
  const [version, setVersion] = useState(1);
  const [source, setSource] = useState('');
  const [err, setErr] = useState(null);
  const shown = criteria ?? JSON.stringify(rule.data?.criteria ?? {}, null, 2);

  const save = async () => {
    setErr(null);
    try {
      await call(E.dietTags.putRule, { params: { id: tag.id }, body: {
        criteria: JSON.parse(shown), rule_version: Number(rule.data?.rule_version ?? version), source: source || rule.data?.source || 'admin-ui' } });
      toast('Rule saved'); onClose();
    } catch (e) { setErr(e); }
  };
  const del = async () => {
    if (!confirmAction('Delete this rule?')) return;
    try { await call(E.dietTags.deleteRule, { params: { id: tag.id } }); toast('Rule deleted'); onClose(); } catch (e) { setErr(e); }
  };
  return (
    <Modal title={`Auto-tag rule: ${tag.name}`} onClose={onClose}>
      <ErrorBox error={err || rule.error} />
      <Field label="Criteria (JSON)"><textarea className="mono" rows={10} value={shown} onChange={(e) => setCriteria(e.target.value)} /></Field>
      <div className="grid2">
        <Field label="Rule version"><input type="number" min="1" value={rule.data?.rule_version ?? version} onChange={(e) => setVersion(e.target.value)} /></Field>
        <Field label="Source"><input value={source || rule.data?.source || ''} onChange={(e) => setSource(e.target.value)} placeholder="e.g. EU regulation 1169/2011" /></Field>
      </div>
      <div className="actions">
        {rule.data && <button className="danger" onClick={del}>Delete rule</button>}
        <button className="primary" onClick={save}>Save rule</button>
      </div>
    </Modal>
  );
}

export default function DietTags() {
  const toast = useToast();
  const tags = useLoad(() => call(E.dietTags.list).then(items));
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [edit, setEdit] = useState(null);
  const [rule, setRule] = useState(null);

  const run = async (fn, ok) => { try { await fn(); toast(ok); tags.reload(); return true; } catch (e) { toast(e.message, 'bad'); return false; } };

  return (
    <>
      <div className="page-head"><h2>Diet tags</h2></div>
      <form className="toolbar" onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (await run(() => call(E.dietTags.create, { body: { name: name.trim(), ...(desc ? { description: desc } : {}) } }), 'Tag added')) { setName(''); setDesc(''); }
      }}>
        <input placeholder="New diet tag (e.g. Vegan)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="grow" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <button className="primary">Add tag</button>
      </form>
      <ErrorBox error={tags.error} />
      <table>
        <thead><tr><th>Name</th><th>Description</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <TableState loading={tags.loading} empty={!(tags.data || []).length} cols={4} emptyText="No diet tags yet — add one above.">
          {(tags.data || []).map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td><td>{t.description}</td>
              <td><Badge tone={t.is_active ? 'green' : 'red'}>{t.is_active ? 'Active' : 'Inactive'}</Badge></td>
              <td className="row-actions">
                <button onClick={() => setEdit({ ...t })}>Edit</button>
                <button onClick={() => setRule(t)}>Rule</button>
                {t.is_active
                  ? <button className="danger" onClick={() => confirmAction(`Deactivate "${t.name}"?`) && run(() => call(E.dietTags.deactivate, { params: { id: t.id } }), 'Tag deactivated')}>Deactivate</button>
                  : <button onClick={() => run(() => call(E.dietTags.update, { params: { id: t.id }, body: { is_active: true } }), 'Tag reactivated')}>Reactivate</button>}
              </td>
            </tr>
          ))}
          </TableState>
        </tbody>
      </table>
      {edit && (
        <Modal title="Edit diet tag" onClose={() => setEdit(null)}>
          <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Description"><textarea rows={3} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <div className="actions"><button className="primary" onClick={async () => {
            if (await run(() => call(E.dietTags.update, { params: { id: edit.id }, body: { name: edit.name, description: edit.description } }), 'Tag updated')) setEdit(null);
          }}>Save</button></div>
        </Modal>
      )}
      {rule && <RuleEditor tag={rule} onClose={() => setRule(null)} />}
    </>
  );
}
