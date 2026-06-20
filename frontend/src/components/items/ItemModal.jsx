import React, { useState, useEffect } from 'react';
import { getLookups } from '../../api/client.js';
import { ITEM_CATEGORIES, PAINT_QUALITY_LABELS } from '../../config.js';

export default function ItemModal({ initial, collectionCategory, onSave, onClose }) {
  const [category, setCategory] = useState(initial?.category || collectionCategory || 'MINIATURE');
  const [form, setForm] = useState(initial || { quantity: 1 });
  const [lookups, setLookups] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category === 'MINIATURE' || category === 'TERRAIN') {
      loadLookups();
    }
  }, [category]);

  async function loadLookups() {
    const types = category === 'MINIATURE'
      ? ['SCALE', 'MANUFACTURER', 'FIGURETYPE', 'NATIONALITY', 'PERIOD', 'RULES', 'BASESIZE', 'BASEMATERIAL', 'PAINTQUALITY']
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

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, category });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Edit Item' : 'Add Item'}</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Common fields */}
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="form-control" value={form.name || ''} onChange={e => set('name', e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select className="form-control" value={category} onChange={e => setCategory(e.target.value)} disabled={!!initial}>
                  {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input className="form-control" type="number" min="1" value={form.quantity || 1} onChange={e => set('quantity', parseInt(e.target.value) || 1)} />
              </div>
            </div>

            {/* Category-specific fields */}
            {category === 'MINIATURE' && <MiniatureFields form={form} set={set} lookups={lookups} handleLookupChange={handleLookupChange} />}
            {category === 'BOARDGAME' && <BoardGameFields form={form} set={set} />}
            {category === 'BOOK' && <BookFields form={form} set={set} />}
            {category === 'TERRAIN' && <TerrainFields form={form} set={set} lookups={lookups} handleLookupChange={handleLookupChange} />}
            {category === 'OTHER' && <OtherFields form={form} set={set} />}

            {/* Notes - all categories */}
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

function LookupSelect({ label, type, lookups, value, onChange }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select className="form-control" value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">— select —</option>
        {(lookups[type] || []).map(l => <option key={l.id} value={l.id}>{l.abbreviation ? `${l.abbreviation} — ${l.label}` : l.label}</option>)}
      </select>
    </div>
  );
}

function MiniatureFields({ form, set, lookups, handleLookupChange }) {
  return (
    <>
      <hr className="divider" />
      <div className="form-row">
        <LookupSelect label="Scale" type="SCALE" lookups={lookups}
          value={form.scaleId}
          onChange={id => handleLookupChange('scaleId', 'scaleName', 'SCALE', id)} />
        <LookupSelect label="Manufacturer" type="MANUFACTURER" lookups={lookups}
          value={form.manufacturerId}
          onChange={id => handleLookupChange('manufacturerId', 'manufacturerName', 'MANUFACTURER', id)} />
      </div>
      <div className="form-row">
        <LookupSelect label="Figure Type" type="FIGURETYPE" lookups={lookups}
          value={form.figureTypeId}
          onChange={id => handleLookupChange('figureTypeId', 'figureTypeName', 'FIGURETYPE', id)} />
        <LookupSelect label="Nationality" type="NATIONALITY" lookups={lookups}
          value={form.nationalityId}
          onChange={id => handleLookupChange('nationalityId', 'nationalityName', 'NATIONALITY', id)} />
      </div>
      <div className="form-row">
        <LookupSelect label="Period" type="PERIOD" lookups={lookups}
          value={form.periodId}
          onChange={id => handleLookupChange('periodId', 'periodName', 'PERIOD', id)} />
        <LookupSelect label="Rules" type="RULES" lookups={lookups}
          value={form.rulesId}
          onChange={id => handleLookupChange('rulesId', 'rulesName', 'RULES', id)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Paint Quality</label>
          <select className="form-control" value={form.paintQualityId || ''} onChange={e => { set('paintQualityId', e.target.value || null); set('paintQualityName', PAINT_QUALITY_LABELS[e.target.value] || ''); }}>
            <option value="">— select —</option>
            {Object.entries(PAINT_QUALITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Number of Bases</label>
          <input className="form-control" type="number" min="0" value={form.numberBases || 0} onChange={e => set('numberBases', parseInt(e.target.value) || 0)} />
        </div>
      </div>
      <div className="form-row">
        <LookupSelect label="Base Size" type="BASESIZE" lookups={lookups}
          value={form.baseSizeId}
          onChange={id => handleLookupChange('baseSizeId', 'baseSizeName', 'BASESIZE', id)} />
        <LookupSelect label="Base Material" type="BASEMATERIAL" lookups={lookups}
          value={form.baseMaterialId}
          onChange={id => handleLookupChange('baseMaterialId', 'baseMaterialName', 'BASEMATERIAL', id)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Purchase Price</label>
          <input className="form-control" type="number" step="0.01" min="0" value={form.purchasePriceAmt || ''} onChange={e => set('purchasePriceAmt', parseFloat(e.target.value) || null)} />
        </div>
        <div className="form-group">
          <label>Currency</label>
          <select className="form-control" value={form.purchasePriceCurrency || 'AUD'} onChange={e => set('purchasePriceCurrency', e.target.value)}>
            <option>AUD</option><option>USD</option><option>GBP</option><option>EUR</option><option>NZD</option>
          </select>
        </div>
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

function TerrainFields({ form, set, lookups, handleLookupChange }) {
  return (
    <>
      <hr className="divider" />
      <div className="form-row">
        <LookupSelect label="Scale" type="SCALE" lookups={lookups}
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
