import { useMemo, useState } from 'react';
import { call, items, listAll, uploadImage } from '../api.js';
import { E, ENUMS } from '../endpoints.js';
import {
  ActionButton, Chips, ErrorBox, Field, ImagePreview, Modal, PlannedNotice, STATUSES, StatusBadge,
  TableState, Thumb, idOf, imageUrlOf, useLoad, useToast,
} from '../ui.jsx';

const NUTRIENTS = ['kcal', 'fat', 'protein', 'carbs'];
const EMPTY_INGREDIENT = {
  name: '', brand: '', category: 'OTHER', unit: 'g', size: 100,
  allergens: [], dietary_attributes: [], ingredient_tag_ids: [],
  nutrition: { kcal: '', fat: '', protein: '', carbs: '' },
};

// Nutrition is all-or-nothing in the API.
function buildRequestBody(ingredient) {
  const n = ingredient.nutrition;
  const hasNutrition = NUTRIENTS.every((k) => n[k] !== '' && n[k] != null);
  return {
    name: ingredient.name,
    brand: ingredient.brand || null,
    category: ingredient.category,
    unit: ingredient.unit,
    size: Number(ingredient.size),
    allergens: ingredient.allergens,
    dietary_attributes: ingredient.dietary_attributes,
    ingredient_tag_ids: ingredient.ingredient_tag_ids,
    nutrition_facts: hasNutrition ? Object.fromEntries(NUTRIENTS.map((k) => [k, Number(n[k])])) : null,
  };
}

function IngredientForm({ initial, allergens, tags, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !initial?.id;
  const startingIngredient = useMemo(() => ({
    ...EMPTY_INGREDIENT,
    ...initial,
    nutrition: { ...EMPTY_INGREDIENT.nutrition, ...(initial?.nutrition_facts || initial?.nutrition) },
  }), [initial]);
  const [ingredient, setIngredient] = useState(startingIngredient);
  const [newImage, setNewImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (patch) => setIngredient((x) => ({ ...x, ...patch }));
  const nutrition = ingredient.nutrition;
  const filledNutrients = NUTRIENTS.filter((k) => nutrition[k] !== '' && nutrition[k] != null).length;
  const nutritionIncomplete = filledNutrients > 0 && filledNutrients < NUTRIENTS.length;
  const isDirty = !!newImage || JSON.stringify(ingredient) !== JSON.stringify(startingIngredient);
  const canSave = ingredient.name.trim() !== '' && !nutritionIncomplete && !saving;
  const saveAction = isNew ? E.ingredients.create : E.ingredients.update;

  async function save(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const body = buildRequestBody(ingredient);
      const saved = isNew
        ? await call(E.ingredients.create, { body })
        : await call(E.ingredients.update, {
          params: { id: ingredient.id },
          body,
          headers: ingredient.etag ? { 'If-Match': ingredient.etag } : {},
        });
      const id = saved?.id ?? ingredient.id;
      if (newImage && id) await uploadImage(E.ingredients.presign, id, newImage);
      toast(isNew ? 'Ingredient created' : 'Ingredient saved');
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? 'New catalog ingredient' : `Edit ${startingIngredient.name}`} onClose={onClose} dirty={isDirty} wide>
      <form onSubmit={save}>
        <ErrorBox error={error} />
        {!isNew && !E.ingredients.update.live && (
          <div className="error">Editing existing ingredients isn't in the API yet ({E.ingredients.update.task}).</div>
        )}

        <ImagePreview savedUrl={imageUrlOf(initial)} newFile={newImage} />
        <Field label="Image" hint="Uploaded after saving via a presigned S3 URL.">
          <input type="file" accept="image/*" onChange={(e) => setNewImage(e.target.files[0] || null)} />
        </Field>

        <h4>Basics</h4>
        <div className="grid2">
          <Field label="Name" required>
            <input value={ingredient.name} autoFocus={isNew} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Brand">
            <input value={ingredient.brand || ''} onChange={(e) => update({ brand: e.target.value })} />
          </Field>
        </div>
        <div className="grid3">
          <Field label="Category">
            <select value={ingredient.category} onChange={(e) => update({ category: e.target.value })}>
              {ENUMS.ingredientCategory.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Size">
            <input type="number" min="0" step="any" value={ingredient.size} onChange={(e) => update({ size: e.target.value })} />
          </Field>
          <Field label="Unit">
            <select value={ingredient.unit} onChange={(e) => update({ unit: e.target.value })}>
              {ENUMS.unit.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <h4>Nutrition</h4>
        <Field label="Per size above" hint={nutritionIncomplete ? 'Fill in all four values, or clear them all.' : 'Optional — all four values or none.'}>
          <div className="grid4">
            {NUTRIENTS.map((k) => (
              <input key={k} type="number" min="0" step="any" aria-label={k}
                placeholder={k === 'kcal' ? 'kcal' : `${k} (g)`} value={nutrition[k] ?? ''}
                onChange={(e) => update({ nutrition: { ...nutrition, [k]: e.target.value } })} />
            ))}
          </div>
        </Field>

        <h4>Classification</h4>
        <Field label="Dietary attributes">
          <Chips options={ENUMS.dietaryAttribute.map((a) => [a, a])} value={ingredient.dietary_attributes}
            onChange={(v) => update({ dietary_attributes: v })} />
        </Field>
        <Field label="Allergens">
          <Chips options={allergens.map((a) => [idOf(a), a.name || idOf(a)])} value={ingredient.allergens}
            onChange={(v) => update({ allergens: v })} />
        </Field>
        <Field label="Ingredient tags">
          <Chips options={tags.map((t) => [t.id, t.name])} value={ingredient.ingredient_tag_ids}
            onChange={(v) => update({ ingredient_tag_ids: v })} />
        </Field>

        <div className="actions sticky">
          <button type="button" onClick={onClose}>Cancel</button>
          <ActionButton def={saveAction} type="submit" className="primary" disabled={!canSave}
            title={!ingredient.name.trim() ? 'Name is required' : nutritionIncomplete ? 'Complete the nutrition values' : undefined}>
            {saving ? 'Saving…' : isNew ? 'Create ingredient' : 'Save changes'}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}

const ROW_ACTIONS = [E.ingredients.publish, E.ingredients.retire, E.ingredients.remove];

function IngredientRow({ ingredient, onOpen, onAction }) {
  return (
    <tr className="clickable" onClick={() => onOpen(ingredient)}>
      <td>
        <div className="name-cell">
          <Thumb src={imageUrlOf(ingredient)} />
          <a href="#ingredients" onClick={(e) => e.preventDefault()}>{ingredient.name}</a>
        </div>
      </td>
      <td>{ingredient.category}</td>
      <td>{ingredient.size} {ingredient.unit}</td>
      <td><StatusBadge status={ingredient.status} /></td>
      <td className="row-actions" onClick={(e) => e.stopPropagation()}>
        <ActionButton hideIfPlanned def={E.ingredients.publish} onClick={onAction(E.ingredients.publish, ingredient, 'Published')}>Publish</ActionButton>
        <ActionButton hideIfPlanned def={E.ingredients.retire} onClick={onAction(E.ingredients.retire, ingredient, 'Retired')}>Retire</ActionButton>
        <button onClick={() => onOpen(ingredient)}>Edit</button>
        <ActionButton hideIfPlanned def={E.ingredients.remove} className="danger"
          onClick={onAction(E.ingredients.remove, ingredient, 'Deleted', `Delete "${ingredient.name}"?`)}>Delete</ActionButton>
      </td>
    </tr>
  );
}

export default function Ingredients() {
  const toast = useToast();
  const ingredients = useLoad(() => listAll(E.ingredients.list));
  const allergens = useLoad(() => call(E.refs.allergens).then(items));
  const tags = useLoad(() => call(E.refs.ingredientTags).then(items));

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, ingredient = existing

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (ingredients.data || [])
      .filter((r) => !needle || (r.name || '').toLowerCase().includes(needle))
      .filter((r) => !category || r.category === category)
      .filter((r) => !status || r.status === status)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [ingredients.data, search, category, status]);
  const hasFilters = !!(search || category || status);
  const clearFilters = () => { setSearch(''); setCategory(''); setStatus(''); };

  async function openIngredient(ingredient) {
    try {
      const { data, etag } = await call(E.ingredients.get, { params: { id: ingredient.id }, withMeta: true });
      setEditing({ ...data, etag });
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  const runAction = (def, ingredient, successMessage, confirmMessage) => async () => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    try {
      await call(def, { params: { id: ingredient.id } });
      toast(successMessage);
      ingredients.reload();
    } catch (e) {
      toast(e.message, 'bad');
    }
  };

  const closeEditor = () => setEditing(null);
  const handleSaved = () => { closeEditor(); ingredients.reload(); };

  return (
    <>
      <div className="page-head">
        <h2>Catalog ingredients</h2>
        <button className="primary" onClick={() => setEditing({})}>+ New ingredient</button>
      </div>

      <div className="toolbar">
        <input className="grow" type="search" placeholder="Search ingredients…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {ENUMS.ingredientCategory.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {hasFilters && <button onClick={clearFilters}>Clear</button>}
        <button onClick={ingredients.reload}>Refresh</button>
      </div>
      <ErrorBox error={ingredients.error} />
      <PlannedNotice defs={ROW_ACTIONS}>Publish, retire and delete will appear here once the API supports them.</PlannedNotice>

      <table>
        <thead><tr><th>Name</th><th>Category</th><th>Size</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <TableState loading={ingredients.loading} empty={!visible.length} cols={5}
            emptyText={hasFilters ? 'No ingredients match your filters.' : 'No ingredients yet — click “+ New ingredient” to add one.'}>
            {visible.map((r) => <IngredientRow key={r.id} ingredient={r} onOpen={openIngredient} onAction={runAction} />)}
          </TableState>
        </tbody>
      </table>
      {!ingredients.loading && <p className="count">{visible.length} of {(ingredients.data || []).length} ingredients</p>}

      {editing && (
        <IngredientForm initial={editing.id ? editing : null} allergens={allergens.data || []} tags={tags.data || []}
          onClose={closeEditor} onSaved={handleSaved} />
      )}
    </>
  );
}
