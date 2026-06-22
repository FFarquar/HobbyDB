import React, { useState, useEffect } from 'react';
import { getLookups, createLookup } from '../../api/client.js';
import { PAINT_QUALITY_LABELS } from '../../config.js';

// Maps each lookup type to the form fields it populates
const FIELD_MAP = {
  SCALE:        ['scaleId',        'scaleName'],
  MANUFACTURER: ['manufacturerId', 'manufacturerName'],
  FIGURETYPE:   ['figureTypeId',   'figureTypeName'],
  NATIONALITY:  ['nationalityId',  'nationalityName'],
  BASESIZE:     ['baseSizeId',     'baseSizeName'],
  BASEMATERIAL: ['baseMaterialId', 'baseMaterialName'],
};

export default function ItemModal({ initial, template, collectionCategory, onSave, onClose }) {
  const seed = initial || template || { quantity: 1 };
  const [category, setCategory] = useState(seed.category || collectionCategory || 'MINIATURE');
  const [form, setForm] = useState(seed);
  const [lookups, setLookups] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category === 'MINIATURE' || category === 'TERRAIN') loadLookups();
  }, [category]);

  async function loadLookups() {
    const types = category === 'MINIATURE'
      ? ['SCALE', 'MANUFACTURER', 'FIGURETYPE', 'NATIONALITY', 'BASESIZE', 'BASEMATERIAL', 'PAINTQUALITY']
      : ['SCALE'];
    const results = await Promise.all(types.map(t => getLookups(t).catch(() => [])));
    const map = {};
    types.forEach((t, i) => { map[t] = results[i]; });
    setLookups(map);
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleLookupChange(field, nameField, type, id) {
    const item = (lookups[type] || []).find(l => l.id === id);
    set(field, id || null);
    set(nameField, item?.label || '');
  }

  // Called when a new value is created via the QuickAdd mini-modal.
  // Appends it to the local lookup list, then auto-selects it in the form.
  function handleQuickAdd(type, newItem) {
    setLookups(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), newItem].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
      ),
    }));
    const [field, nameField] = FIELD_MAP[type] || [];
    if (field) setForm(f => ({ ...f, [field]: newItem.id, [nameField]: newItem.label }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, category });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Edit Item' : 'Add Item'}</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="form-control" value={form.name || ''} onChange={e => set('name', e.target.value)} required autoFocus />
              </div>
            </div>

            {category === 'MINIATURE' && (
              <MiniatureFields form={form} set={set} lookups={lookups}
                handleLookupChange={handleLookupChange} onQuickAdd={handleQuickAdd} />
            )}
            {category === 'BOARDGAME' && <BoardGameFields form={form} set={set} />}
            {category === 'BOOK'      && <BookFields      form={form} set={set} />}
            {category === 'TERRAIN'   && (
              <TerrainFields form={form} set={set} lookups={lookups}
                handleLookupChange={handleLookupChange} onQuickAdd={handleQuickAdd} />
            )}
            {category === 'OTHER'     && <OtherFields     form={form} set={set} />}

            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Purchase price, condition, etc." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Lookup select with quick-add ────────────────────────────────────────────

function LookupSelect({ label, type, lookups, value, onChange, onQuickAdd }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select className="form-control" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">— select —</option>
          {(lookups[type] || []).map(l => (
            <option key={l.id} value={l.id}>
              {l.abbreviation ? `${l.abbreviation} — ${l.label}` : l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-icon"
          title={`Add new ${label}`}
          style={{ flexShrink: 0, fontSize: 18, lineHeight: 1 }}
          onClick={() => setShowAdd(true)}
        >
          +
        </button>
      </div>
      {showAdd && (
        <QuickAddModal
          type={type}
          label={label}
          onSave={newItem => { onQuickAdd(type, newItem); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ─── Quick-add mini-modal ─────────────────────────────────────────────────────

function QuickAddModal({ type, label, onSave, onClose }) {
  const [itemLabel, setItemLabel] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // No <form> here — QuickAddModal renders inside ItemModal's <form> and the
  // browser collapses nested forms, making the "Add" button submit the outer form.
  async function handleSubmit() {
    if (!itemLabel || saving) return;
    setSaving(true);
    setError('');
    try {
      const newItem = await createLookup(type, { label: itemLabel, abbreviation });
      onSave(newItem);
    } catch (err) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add {label}</span>
          <button type="button" className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <p style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{error}</p>}
          <div className="form-group">
            <label>Label *</label>
            <input
              className="form-control"
              value={itemLabel}
              onChange={e => setItemLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Abbreviation</label>
            <input
              className="form-control"
              value={abbreviation}
              onChange={e => setAbbreviation(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Optional short form"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={saving || !itemLabel} onClick={handleSubmit}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category field groups ────────────────────────────────────────────────────

function MiniatureFields({ form, set, lookups, handleLookupChange, onQuickAdd }) {
  return (
    <>
      <hr className="divider" />
      <div className="form-row">
        <LookupSelect label="Scale" type="SCALE" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.scaleId}
          onChange={id => handleLookupChange('scaleId', 'scaleName', 'SCALE', id)} />
        <LookupSelect label="Manufacturer" type="MANUFACTURER" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.manufacturerId}
          onChange={id => handleLookupChange('manufacturerId', 'manufacturerName', 'MANUFACTURER', id)} />
      </div>
      <div className="form-row">
        <LookupSelect label="Figure Type" type="FIGURETYPE" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.figureTypeId}
          onChange={id => handleLookupChange('figureTypeId', 'figureTypeName', 'FIGURETYPE', id)} />
        <LookupSelect label="Nationality" type="NATIONALITY" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.nationalityId}
          onChange={id => handleLookupChange('nationalityId', 'nationalityName', 'NATIONALITY', id)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Figures per Base</label>
          <input className="form-control" type="number" min="1" value={form.quantity || 1}
            onChange={e => set('quantity', parseInt(e.target.value) || 1)} />
        </div>
        <div className="form-group">
          <label>Number of Bases</label>
          <input className="form-control" type="number" min="0" value={form.numberBases || 0}
            onChange={e => set('numberBases', parseInt(e.target.value) || 0)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Paint Quality</label>
          <select className="form-control" value={form.paintQualityId || ''}
            onChange={e => {
              set('paintQualityId', e.target.value || null);
              set('paintQualityName', PAINT_QUALITY_LABELS[e.target.value] || '');
            }}>
            <option value="">— select —</option>
            {Object.entries(PAINT_QUALITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <LookupSelect label="Base Size" type="BASESIZE" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.baseSizeId}
          onChange={id => handleLookupChange('baseSizeId', 'baseSizeName', 'BASESIZE', id)} />
        <LookupSelect label="Base Material" type="BASEMATERIAL" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.baseMaterialId}
          onChange={id => handleLookupChange('baseMaterialId', 'baseMaterialName', 'BASEMATERIAL', id)} />
      </div>
    </>
  );
}

function BoardGameFields({ form, set }) {
  return (
    <>
      <hr className="divider" />
      <div className="form-row">
        <div className="form-group">
          <label>Publisher</label>
          <input className="form-control" value={form.publisher || ''} onChange={e => set('publisher', e.target.value)} />
        </div>
        <div className="form-group">
          <label>BGG ID</label>
          <input className="form-control" value={form.bggId || ''} onChange={e => set('bggId', e.target.value)} placeholder="BoardGameGeek ID" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Min Players</label>
          <input className="form-control" type="number" min="1" value={form.minPlayers || ''} onChange={e => set('minPlayers', parseInt(e.target.value) || null)} />
        </div>
        <div className="form-group">
          <label>Max Players</label>
          <input className="form-control" type="number" min="1" value={form.maxPlayers || ''} onChange={e => set('maxPlayers', parseInt(e.target.value) || null)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Play Time (minutes)</label>
          <input className="form-control" type="number" min="1" value={form.playTimeMinutes || ''} onChange={e => set('playTimeMinutes', parseInt(e.target.value) || null)} />
        </div>
      </div>
    </>
  );
}

function BookFields({ form, set }) {
  return (
    <>
      <hr className="divider" />
      <div className="form-row">
        <div className="form-group">
          <label>Author</label>
          <input className="form-control" value={form.author || ''} onChange={e => set('author', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Publisher</label>
          <input className="form-control" value={form.publisher || ''} onChange={e => set('publisher', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>ISBN</label>
          <input className="form-control" value={form.isbn || ''} onChange={e => set('isbn', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Publish Year</label>
          <input className="form-control" type="number" value={form.publishYear || ''} onChange={e => set('publishYear', parseInt(e.target.value) || null)} />
        </div>
      </div>
    </>
  );
}

function TerrainFields({ form, set, lookups, handleLookupChange, onQuickAdd }) {
  return (
    <>
      <hr className="divider" />
      <div className="form-row">
        <LookupSelect label="Scale" type="SCALE" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.scaleId}
          onChange={id => handleLookupChange('scaleId', 'scaleName', 'SCALE', id)} />
        <div className="form-group">
          <label>Material</label>
          <input className="form-control" value={form.material || ''} onChange={e => set('material', e.target.value)} placeholder="Resin, MDF, foam…" />
        </div>
      </div>
    </>
  );
}

function OtherFields({ form, set }) {
  return (
    <>
      <hr className="divider" />
      <div className="form-group">
        <label>Custom Details</label>
        <textarea className="form-control" value={form.customFields || ''} onChange={e => set('customFields', e.target.value)} placeholder="Any additional details…" />
      </div>
    </>
  );
}
