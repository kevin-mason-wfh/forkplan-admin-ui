import { useMemo, useState } from 'react';
import { call, items, listAll, uploadImage } from '../api.js';
import { AuditLine, LifecycleButtons, StatusFilter, saveHint, useLifecycle } from '../catalog.jsx';
import { E, ENUMS } from '../endpoints.js';
import {
  Badge, Chips, ErrorBox, Field, ImagePreview, Modal, StatusBadge, TableState, Thumb, fmtDate, humanize,
  imageUrlOf, useLoad, useToast,
} from '../ui.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_RECIPE = {
  name: '',
  category: 'dinner',
  description: '',
  instructions: '',
  servings: 1,
  prep_time_seconds: null,
  cook_time_seconds: null,
  diet_tag_ids: [],
  ingredients: [],
};

// The form edits minutes; the API stores seconds.
const secondsToMinutes = (s) => (s == null ? '' : Math.round(s / 60));
const minutesToSeconds = (m) => (m === '' ? null : Math.round(Number(m) * 60));

const tagIdsOf = (recipe) => recipe.diet_tag_ids || recipe.diet_tags?.map((t) => t.id) || [];

// The API returns diet_tags / ingredient objects; the form edits ids and {catalog_ingredient_id, quantity} lines.
function toFormState(recipe) {
  if (!recipe) return { ...EMPTY_RECIPE };
  return {
    ...EMPTY_RECIPE,
    ...recipe,
    diet_tag_ids: tagIdsOf(recipe),
    ingredients: (recipe.ingredients || []).map((l) => ({ catalog_ingredient_id: l.catalog_ingredient_id || '', quantity: l.quantity })),
  };
}

const n0 = (x) => (x == null ? '—' : Math.round(x));
function NutritionSummary({ nutrition }) {
  if (!nutrition) return null;
  const p = nutrition.per_serving;
  const note = { partial: ' (some ingredients have no nutrition data)', insufficient_data: '' }[nutrition.status] ?? '';
  return (
    <p className="muted small">
      {p ? `Per serving: ${n0(p.kcal)} kcal · ${n0(p.protein)} g protein · ${n0(p.carbs)} g carbs · ${n0(p.fat)} g fat${note}`
        : 'Nutrition: none of the ingredients have nutrition data yet.'}
    </p>
  );
}

// Shape the form state into the request body the API expects.
function buildRequestBody(recipe) {
  return {
    name: recipe.name,
    category: recipe.category,
    description: recipe.description || null,
    instructions: recipe.instructions || null,
    servings: Number(recipe.servings) || 1,
    prep_time_seconds: recipe.prep_time_seconds,
    cook_time_seconds: recipe.cook_time_seconds,
    diet_tag_ids: recipe.diet_tag_ids || [],
    ingredients: (recipe.ingredients || [])
      .filter((line) => line.catalog_ingredient_id)
      .map((line) => ({ catalog_ingredient_id: line.catalog_ingredient_id, quantity: Number(line.quantity) })),
  };
}

// ---------------------------------------------------------------------------
// Form sections
// ---------------------------------------------------------------------------

function IngredientLines({ lines, catalog, onChange }) {
  const updateLine = (index, patch) => onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const removeLine = (index) => onChange(lines.filter((_, i) => i !== index));
  const addLine = () => onChange([...lines, { catalog_ingredient_id: '', quantity: 1 }]);

  return (
    <>
      {lines.map((line, i) => {
        const ing = catalog.find((g) => String(g.id) === String(line.catalog_ingredient_id));
        // Retired ingredients can't be newly picked, but stay visible on lines that already use them.
        const options = catalog.filter((g) => g.status !== 'RETIRED' || g.id === line.catalog_ingredient_id);
        return (
          <div className="toolbar" key={i} style={{ alignItems: 'center' }}>
            <select className="grow" value={line.catalog_ingredient_id || ''}
              onChange={(e) => updateLine(i, { catalog_ingredient_id: e.target.value })}>
              <option value="">Select ingredient…</option>
              {options.map((g) => (
                <option key={g.id} value={g.id}>{g.name}{g.brand ? ` (${g.brand})` : ''}{g.status && g.status !== 'PUBLISHED' ? ` — ${humanize(g.status)}` : ''}</option>
              ))}
            </select>
            <input type="number" min="0" step="any" placeholder="Qty" style={{ width: 80 }}
              value={line.quantity ?? ''} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
            <span className="muted" style={{ minWidth: 40, fontSize: 13 }}>
              {ing ? ing.unit : ''}
            </span>
            <button type="button" aria-label="Remove ingredient" onClick={() => removeLine(i)}>✕</button>
          </div>
        );
      })}
      <div><button type="button" onClick={addLine}>+ Add ingredient</button></div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------

function RecipeForm({ initial, tags, ingredients, onClose, onSaved, onLifecycle }) {
  const toast = useToast();
  const isNew = !initial?.id;
  const startingRecipe = useMemo(() => toFormState(initial), [initial]);
  const [recipe, setRecipe] = useState(startingRecipe);
  const [newImage, setNewImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (patch) => setRecipe((r) => ({ ...r, ...patch }));
  const isDirty = !!newImage || JSON.stringify(recipe) !== JSON.stringify(startingRecipe);
  const canSave = recipe.name.trim() !== '' && !saving;

  // `publish` only applies to new recipes: false creates a DRAFT customers can't see.
  async function save(publish) {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const body = buildRequestBody(recipe);
      const saved = isNew
        ? await call(E.recipes.create, { body: { ...body, publish } })
        : await call(E.recipes.update, {
          params: { id: recipe.id },
          body,
          headers: recipe.etag ? { 'If-Match': recipe.etag } : {},
        });

      const id = saved?.id ?? recipe.id;
      if (newImage && id) await uploadImage(E.recipes.presign, id, newImage);

      toast(isNew ? (publish ? 'Recipe created and published' : 'Recipe saved as draft') : 'Recipe saved');
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? 'New catalog recipe' : `Edit ${startingRecipe.name}`} onClose={onClose} dirty={isDirty} wide>
      {/* Enter submits as a draft for new recipes, so a stray keypress never publishes. */}
      <form onSubmit={(e) => { e.preventDefault(); save(false); }}>
        <ErrorBox error={error} />
        <AuditLine item={initial} />
        {!isNew && <NutritionSummary nutrition={initial.nutrition} />}

        <ImagePreview savedUrl={imageUrlOf(initial)} newFile={newImage} />
        <Field label="Image" hint="Uploaded after saving via a presigned S3 URL.">
          <input type="file" accept="image/*" onChange={(e) => setNewImage(e.target.files[0] || null)} />
        </Field>

        <h4>Basics</h4>
        <div className="grid2">
          <Field label="Name" required>
            <input value={recipe.name} autoFocus={isNew} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Category">
            <select value={recipe.category} onChange={(e) => update({ category: e.target.value })}>
              {ENUMS.mealCategory.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea rows={2} value={recipe.description || ''} onChange={(e) => update({ description: e.target.value })} />
        </Field>
        <div className="grid3">
          <Field label="Prep time (min)">
            <input type="number" min="0" value={secondsToMinutes(recipe.prep_time_seconds)}
              onChange={(e) => update({ prep_time_seconds: minutesToSeconds(e.target.value) })} />
          </Field>
          <Field label="Cook time (min)">
            <input type="number" min="0" value={secondsToMinutes(recipe.cook_time_seconds)}
              onChange={(e) => update({ cook_time_seconds: minutesToSeconds(e.target.value) })} />
          </Field>
          <Field label="Servings">
            <input type="number" min="1" value={recipe.servings} onChange={(e) => update({ servings: e.target.value })} />
          </Field>
        </div>

        <h4>Ingredients</h4>
        <IngredientLines lines={recipe.ingredients || []} catalog={ingredients}
          onChange={(lines) => update({ ingredients: lines })} />

        <h4>Method &amp; dietary info</h4>
        <Field label="Instructions">
          <textarea rows={6} value={recipe.instructions || ''} onChange={(e) => update({ instructions: e.target.value })} />
        </Field>
        <Field label="Diet tags">
          <Chips options={tags.filter((t) => t.is_active !== false).map((t) => [t.id, t.name])}
            value={recipe.diet_tag_ids || []} onChange={(ids) => update({ diet_tag_ids: ids })} />
        </Field>

        {!isNew && saveHint(initial.status) && <p className="muted small">{saveHint(initial.status)}</p>}
        <div className="actions sticky">
          {!isNew && (
            <div className="actions-left">
              <LifecycleButtons item={initial} run={onLifecycle} disabled={isDirty || saving}
                title={isDirty ? 'Save or discard your changes first' : undefined} />
            </div>
          )}
          <button type="button" onClick={onClose}>Cancel</button>
          {isNew ? (
            <>
              <button type="submit" disabled={!canSave} title={!recipe.name.trim() ? 'Name is required' : 'Customers can’t see drafts'}>
                {saving ? 'Saving…' : 'Save as draft'}
              </button>
              <button type="button" className="primary" disabled={!canSave} onClick={() => save(true)}
                title={!recipe.name.trim() ? 'Name is required' : undefined}>Create &amp; publish</button>
            </>
          ) : (
            <button type="submit" className="primary" disabled={!canSave || !isDirty}
              title={!recipe.name.trim() ? 'Name is required' : undefined}>{saving ? 'Saving…' : 'Save changes'}</button>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Recipes list page
// ---------------------------------------------------------------------------

function RecipeRow({ recipe, tagName, onOpen, onLifecycle }) {
  return (
    <tr className="clickable" onClick={() => onOpen(recipe)}>
      <td>
        <div className="name-cell">
          <Thumb src={imageUrlOf(recipe)} />
          <a href="#recipes" onClick={(e) => { e.preventDefault(); }}>{recipe.name}</a>
        </div>
      </td>
      <td>{recipe.category}</td>
      <td><StatusBadge status={recipe.status} /></td>
      <td>{tagIdsOf(recipe).map((id) => <Badge key={id}>{tagName[id] || recipe.diet_tags?.find((t) => t.id === id)?.name || id}</Badge>)}</td>
      <td className="muted small">{fmtDate(recipe.updated_at)}</td>
      <td className="row-actions" onClick={(e) => e.stopPropagation()}>
        <LifecycleButtons item={recipe} run={onLifecycle} />
        <button onClick={() => onOpen(recipe)}>Edit</button>
      </td>
    </tr>
  );
}

export default function Recipes() {
  const toast = useToast();
  const recipes = useLoad(() => listAll(E.recipes.list));
  const tags = useLoad(() => call(E.dietTags.list).then(items));
  const ingredients = useLoad(() => listAll(E.ingredients.list));

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, recipe = existing

  const tagName = useMemo(
    () => Object.fromEntries((tags.data || []).map((t) => [t.id, t.name])),
    [tags.data],
  );
  const visibleRecipes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (recipes.data || [])
      .filter((r) => !needle || (r.name || '').toLowerCase().includes(needle))
      .filter((r) => !category || r.category === category)
      .filter((r) => !status || r.status === status)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [recipes.data, search, category, status]);
  const hasFilters = !!(search || category || status);
  const clearFilters = () => { setSearch(''); setCategory(''); setStatus(''); };

  // Fetch the full recipe (with its ETag and image) before opening the editor.
  async function openRecipe(recipe) {
    try {
      const { data, etag } = await call(E.recipes.get, { params: { id: recipe.id }, withMeta: true });
      setEditing({ ...data, etag });
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  const lifecycle = useLifecycle(E.recipes, 'recipe', recipes.reload);
  // From inside the editor: run the action, then close the editor.
  const lifecycleFromEditor = async (kind, recipe) => { if (await lifecycle(kind, recipe)) setEditing(null); };

  const closeEditor = () => setEditing(null);
  const handleSaved = () => { closeEditor(); recipes.reload(); };

  return (
    <>
      <div className="page-head">
        <h2>Catalog recipes</h2>
        <button className="primary" onClick={() => setEditing({})}>+ New recipe</button>
      </div>

      <div className="toolbar">
        <input className="grow" type="search" placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {ENUMS.mealCategory.map((c) => <option key={c}>{c}</option>)}
        </select>
        <StatusFilter rows={recipes.data} value={status} onChange={setStatus} />
        {hasFilters && <button onClick={clearFilters}>Clear</button>}
        <button onClick={recipes.reload}>Refresh</button>
      </div>
      <ErrorBox error={recipes.error} />

      <table>
        <thead>
          <tr><th>Name</th><th>Category</th><th>Status</th><th>Diet tags</th><th>Updated</th><th></th></tr>
        </thead>
        <tbody>
          <TableState loading={recipes.loading} empty={!visibleRecipes.length} cols={6}
            emptyText={hasFilters ? 'No recipes match your filters.' : 'No recipes yet — click “+ New recipe” to add one.'}>
            {visibleRecipes.map((r) => (
              <RecipeRow key={r.id} recipe={r} tagName={tagName} onOpen={openRecipe} onLifecycle={lifecycle} />
            ))}
          </TableState>
        </tbody>
      </table>
      {!recipes.loading && <p className="count">{visibleRecipes.length} of {(recipes.data || []).length} recipes</p>}

      {editing && (
        <RecipeForm
          initial={editing.id ? editing : null}
          tags={tags.data || []}
          ingredients={ingredients.data || []}
          onClose={closeEditor}
          onSaved={handleSaved}
          onLifecycle={lifecycleFromEditor}
        />
      )}
    </>
  );
}
