import React, { useState, useEffect } from 'react';
import { getLookups, createLookup, updateLookup, getScaleFigureTypes, getPaintCosts, upsertPaintCost, getBasingCosts, upsertBasingCost, getFigureCosts, upsertFigureCost, getExchangeRates } from '../../api/client.js';
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
  const [scaleFigureTypes, setScaleFigureTypes] = useState([]);
  const [paintCosts, setPaintCosts] = useState([]);
  const [basingCosts, setBasingCosts] = useState([]);
  const [figureCosts, setFigureCosts] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category === 'MINIATURE' || category === 'TERRAIN') loadLookups();
  }, [category]);

  async function loadLookups() {
    const types = category === 'MINIATURE'
      ? ['SCALE', 'MANUFACTURER', 'FIGURETYPE', 'NATIONALITY', 'BASESIZE', 'BASEMATERIAL', 'PAINTQUALITY']
      : ['SCALE'];
    const [results, sft, costs, baseCosts, figCosts, rates] = await Promise.all([
      Promise.all(types.map(t => getLookups(t).catch(() => []))),
      category === 'MINIATURE' ? getScaleFigureTypes().catch(() => []) : Promise.resolve([]),
      category === 'MINIATURE' ? getPaintCosts().catch(() => []) : Promise.resolve([]),
      category === 'MINIATURE' ? getBasingCosts().catch(() => []) : Promise.resolve([]),
      category === 'MINIATURE' ? getFigureCosts().catch(() => []) : Promise.resolve([]),
      category === 'MINIATURE' ? getExchangeRates().catch(() => []) : Promise.resolve([]),
    ]);
    const map = {};
    types.forEach((t, i) => { map[t] = results[i]; });
    setLookups(map);
    setScaleFigureTypes(sft);
    setPaintCosts(costs);
    setBasingCosts(baseCosts);
    setFigureCosts(figCosts);
    setExchangeRates(rates);
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleLookupChange(field, nameField, type, id) {
    const item = (lookups[type] || []).find(l => l.id === id);
    set(field, id || null);
    set(nameField, item?.label || '');
  }

  function handleUpdateScale(scaleId, updates) {
    setLookups(prev => ({
      ...prev,
      SCALE: (prev.SCALE || []).map(s => s.id === scaleId ? { ...s, ...updates } : s),
    }));
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
    if (field) {
      setForm(f => ({ ...f, [field]: newItem.id, [nameField]: newItem.label }));
      // If figure types are scale-filtered and a scale is selected, add a synthetic link
      // so the newly created type immediately appears in the filtered dropdown.
      if (type === 'FIGURETYPE' && form.scaleId) {
        setScaleFigureTypes(prev => [...prev, { scaleId: form.scaleId, figureTypeId: newItem.id }]);
      }
    }
  }

  async function handleSetPaintCost(costUSD) {
    const entry = { scaleId: form.scaleId, figureTypeId: form.figureTypeId, qualityId: String(form.paintQualityId), costUSD };
    await upsertPaintCost(entry);
    setPaintCosts(prev => {
      const idx = prev.findIndex(c => c.scaleId === entry.scaleId && c.figureTypeId === entry.figureTypeId && c.qualityId === entry.qualityId);
      if (idx === -1) return [...prev, entry];
      const next = [...prev]; next[idx] = entry; return next;
    });
  }

  async function handleSetBasingCost(costAUD) {
    const entry = { materialId: form.baseMaterialId, sizeId: form.baseSizeId, costAUD };
    await upsertBasingCost(entry);
    setBasingCosts(prev => {
      const idx = prev.findIndex(c => c.materialId === entry.materialId && c.sizeId === entry.sizeId);
      if (idx === -1) return [...prev, entry];
      const next = [...prev]; next[idx] = entry; return next;
    });
  }

  async function handleSetFigureCost(costAUD) {
    const entry = { manufacturerId: form.manufacturerId, scaleId: form.scaleId, figureTypeId: form.figureTypeId, cost: costAUD, currency: 'AUD' };
    await upsertFigureCost(entry);
    setFigureCosts(prev => {
      const idx = prev.findIndex(c => c.manufacturerId === entry.manufacturerId && c.scaleId === entry.scaleId && c.figureTypeId === entry.figureTypeId);
      if (idx === -1) return [...prev, entry];
      const next = [...prev]; next[idx] = entry; return next;
    });
  }

  const missingBasingCost = category === 'MINIATURE' && !!form.baseSizeId && !!form.baseMaterialId
    && !basingCosts.some(c => c.materialId === form.baseMaterialId && c.sizeId === form.baseSizeId);
  const missingFigureCost = category === 'MINIATURE' && !!form.manufacturerId && !!form.scaleId && !!form.figureTypeId
    && !figureCosts.some(c => c.manufacturerId === form.manufacturerId && c.scaleId === form.scaleId && c.figureTypeId === form.figureTypeId);
  const missingPaintCost = category === 'MINIATURE' && !!form.scaleId && !!form.figureTypeId && !!form.paintQualityId
    && !paintCosts.some(c => c.scaleId === form.scaleId && c.figureTypeId === form.figureTypeId && c.qualityId === String(form.paintQualityId));
  const canSave = !missingBasingCost && !missingFigureCost && !missingPaintCost;

  // Calculated item value
  const rateMap = { AUD: 1.0 };
  for (const er of exchangeRates) rateMap[er.currencyCode] = er.rateToAUD;
  const totalFigures = (form.quantity || 1) * (form.numberBases || 0);

  const selectedFigureCost = category === 'MINIATURE'
    ? figureCosts.find(c => c.manufacturerId === form.manufacturerId && c.scaleId === form.scaleId && c.figureTypeId === form.figureTypeId)
    : null;
  const figureValueAUD = selectedFigureCost
    ? selectedFigureCost.cost * (rateMap[selectedFigureCost.currency] || 1) * totalFigures
    : null;

  const selectedPaintCost = category === 'MINIATURE'
    ? paintCosts.find(c => c.scaleId === form.scaleId && c.figureTypeId === form.figureTypeId && c.qualityId === String(form.paintQualityId))
    : null;
  const paintValueAUD = selectedPaintCost
    ? selectedPaintCost.costUSD * (rateMap['USD'] || 1) * totalFigures
    : null;

  const selectedBasingCost = category === 'MINIATURE'
    ? basingCosts.find(c => c.materialId === form.baseMaterialId && c.sizeId === form.baseSizeId)
    : null;
  const basingValueAUD = selectedBasingCost ? selectedBasingCost.costAUD * (form.numberBases || 0) : null;

  const calculatedValueAUD = (figureValueAUD !== null || paintValueAUD !== null || basingValueAUD !== null)
    ? (figureValueAUD || 0) + (paintValueAUD || 0) + (basingValueAUD || 0) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;
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
                scaleFigureTypes={scaleFigureTypes}
                paintCosts={paintCosts}
                basingCosts={basingCosts}
                missingBasingCost={missingBasingCost}
                missingFigureCost={missingFigureCost}
                missingPaintCost={missingPaintCost}
                onSetBasingCost={handleSetBasingCost}
                onSetFigureCost={handleSetFigureCost}
                onSetPaintCost={handleSetPaintCost}
                handleLookupChange={handleLookupChange} onQuickAdd={handleQuickAdd}
                onUpdateScale={handleUpdateScale} />
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
              <textarea className="form-control" value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Condition, provenance, etc." />
            </div>

            {calculatedValueAUD !== null && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Calculated Value</div>
                {figureValueAUD !== null && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Figures: {totalFigures} figs
                    {selectedFigureCost && ` × ${selectedFigureCost.currency} $${selectedFigureCost.cost}`}
                    {selectedFigureCost && selectedFigureCost.currency !== 'AUD' && ` (× ${rateMap[selectedFigureCost.currency] || 1} rate)`}
                    {' = '}
                    <strong>AUD ${figureValueAUD.toFixed(2)}</strong>
                  </div>
                )}
                {paintValueAUD !== null && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Painting: {totalFigures} figs
                    {selectedPaintCost && ` × USD $${selectedPaintCost.costUSD}`}
                    {` (× ${(rateMap['USD'] || 1).toFixed(4)} USD→AUD)`}
                    {' = '}
                    <strong>AUD ${paintValueAUD.toFixed(2)}</strong>
                  </div>
                )}
                {basingValueAUD !== null && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Basing: {form.numberBases || 0} bases × AUD ${selectedBasingCost?.costAUD}
                    {' = '}
                    <strong>AUD ${basingValueAUD.toFixed(2)}</strong>
                  </div>
                )}
                <div style={{ marginTop: 6, fontWeight: 600, fontSize: 14 }}>
                  Total: AUD ${calculatedValueAUD.toFixed(2)}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !canSave}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inline cost setter ───────────────────────────────────────────────────────

function InlineCostSetter({ label, onSet }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSet() {
    const cost = parseFloat(value);
    if (!cost || cost < 0 || saving) return;
    setSaving(true);
    try { await onSet(cost); } finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}:</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSet(); } }}
        placeholder="0.00"
        style={{ width: 90, padding: '4px 8px', fontSize: 13 }}
        className="form-control"
      />
      <button
        type="button"
        className="btn btn-primary"
        style={{ padding: '4px 12px', fontSize: 13 }}
        disabled={!value || saving}
        onClick={handleSet}
      >
        {saving ? '…' : 'Set'}
      </button>
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
              {l.label}
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

// ─── Quick-add paint quality level ───────────────────────────────────────────

function QuickAddQualityModal({ levelNumber, onSave, onClose }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(name);
    } catch (err) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add Paint Quality Level {levelNumber}</span>
          <button type="button" className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <p style={{ color: 'var(--danger)', margin: '0 0 8px', fontSize: 13 }}>{error}</p>}
          <div className="form-group">
            <label>Level Name *</label>
            <input
              className="form-control"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
              placeholder={`e.g. Level ${levelNumber} — Competition`}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={saving || !name} onClick={handleSubmit}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category field groups ────────────────────────────────────────────────────

function MiniatureFields({ form, set, lookups, scaleFigureTypes, paintCosts, basingCosts, handleLookupChange, onQuickAdd, onUpdateScale, missingBasingCost, missingFigureCost, missingPaintCost, onSetBasingCost, onSetFigureCost, onSetPaintCost }) {
  const [showAddQuality, setShowAddQuality] = useState(false);
  const allFigureTypes = lookups.FIGURETYPE || [];
  const hasAnyLinks = scaleFigureTypes.length > 0;

  const linkedForScale = hasAnyLinks && form.scaleId
    ? allFigureTypes.filter(ft => scaleFigureTypes.some(l => l.scaleId === form.scaleId && l.figureTypeId === ft.id))
    : null;
  // Fall back to showing all types if the selected scale has no configured links yet
  const filteredFigureTypes = linkedForScale?.length ? linkedForScale : allFigureTypes;

  function handleScaleChange(id) {
    handleLookupChange('scaleId', 'scaleName', 'SCALE', id);
    const scale = (lookups.SCALE || []).find(s => s.id === id);
    const newMaxLevel = scale?.qualityNames?.length ?? scale?.paintLevels ?? Object.keys(PAINT_QUALITY_LABELS).length;
    if (form.paintQualityId && parseInt(form.paintQualityId) > newMaxLevel) {
      set('paintQualityId', null);
      set('paintQualityName', '');
    }
    if (hasAnyLinks && id && form.figureTypeId) {
      const stillValid = scaleFigureTypes.some(l => l.scaleId === id && l.figureTypeId === form.figureTypeId);
      if (!stillValid) {
        set('figureTypeId', null);
        set('figureTypeName', '');
      }
    }
  }

  const figureTypeLookups = { ...lookups, FIGURETYPE: filteredFigureTypes };

  const selectedScale = (lookups.SCALE || []).find(s => s.id === form.scaleId);
  const scaleQualityNames = selectedScale?.qualityNames?.length
    ? selectedScale.qualityNames
    : Object.values(PAINT_QUALITY_LABELS).slice(0, selectedScale?.paintLevels ?? Object.keys(PAINT_QUALITY_LABELS).length);

  const missingRates = form.scaleId && form.figureTypeId && scaleQualityNames.length > 0
    && scaleQualityNames.some((_, i) =>
      !paintCosts.some(c => c.scaleId === form.scaleId && c.figureTypeId === form.figureTypeId && c.qualityId === String(i + 1))
    );

  return (
    <>
      <hr className="divider" />
      <div className="form-row">
        <LookupSelect label="Scale" type="SCALE" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.scaleId}
          onChange={handleScaleChange} />
        <LookupSelect label="Manufacturer" type="MANUFACTURER" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.manufacturerId}
          onChange={id => handleLookupChange('manufacturerId', 'manufacturerName', 'MANUFACTURER', id)} />
      </div>
      <div className="form-row">
        <LookupSelect label="Figure Type" type="FIGURETYPE" lookups={figureTypeLookups} onQuickAdd={onQuickAdd}
          value={form.figureTypeId}
          onChange={id => handleLookupChange('figureTypeId', 'figureTypeName', 'FIGURETYPE', id)} />
        <LookupSelect label="Nationality" type="NATIONALITY" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.nationalityId}
          onChange={id => handleLookupChange('nationalityId', 'nationalityName', 'NATIONALITY', id)} />
      </div>
      {missingFigureCost && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>
            No figure cost set for <strong>{form.manufacturerName}</strong> {form.scaleName} {form.figureTypeName} — save is blocked.
          </span>
          <InlineCostSetter label="Cost per figure (AUD)" onSet={onSetFigureCost} />
        </div>
      )}
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select className="form-control" value={form.paintQualityId || ''}
              onChange={e => {
                const id = e.target.value;
                set('paintQualityId', id || null);
                set('paintQualityName', id ? (scaleQualityNames[parseInt(id) - 1] ?? '') : '');
              }}>
              <option value="">— select —</option>
              {scaleQualityNames.map((name, i) => (
                <option key={i + 1} value={String(i + 1)}>{name}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-icon"
              title={form.scaleId ? 'Add paint quality level' : 'Select a scale first'}
              disabled={!form.scaleId}
              style={{ flexShrink: 0, fontSize: 18, lineHeight: 1 }}
              onClick={() => setShowAddQuality(true)}
            >
              +
            </button>
          </div>
          {showAddQuality && (
            <QuickAddQualityModal
              levelNumber={scaleQualityNames.length + 1}
              onSave={async (name) => {
                const newNames = [...scaleQualityNames, name];
                await updateLookup('SCALE', form.scaleId, { qualityNames: newNames });
                onUpdateScale(form.scaleId, { qualityNames: newNames });
                const newId = String(newNames.length);
                set('paintQualityId', newId);
                set('paintQualityName', name);
                setShowAddQuality(false);
              }}
              onClose={() => setShowAddQuality(false)}
            />
          )}
        </div>
      </div>
      {missingPaintCost && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>
            No painting rate set for {form.scaleName} {form.figureTypeName} at this quality level — save is blocked.
          </span>
          <InlineCostSetter label="Painting rate per figure (USD)" onSet={onSetPaintCost} />
        </div>
      )}
      <div className="form-row">
        <LookupSelect label="Base Size" type="BASESIZE" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.baseSizeId}
          onChange={id => handleLookupChange('baseSizeId', 'baseSizeName', 'BASESIZE', id)} />
        <LookupSelect label="Base Material" type="BASEMATERIAL" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.baseMaterialId}
          onChange={id => handleLookupChange('baseMaterialId', 'baseMaterialName', 'BASEMATERIAL', id)} />
      </div>
      {missingBasingCost && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>
            No basing cost set for <strong>{form.baseSizeName}</strong> / <strong>{form.baseMaterialName}</strong>.
          </span>
          <InlineCostSetter label="Cost per base (AUD)" onSet={onSetBasingCost} />
        </div>
      )}
      <hr className="divider" />
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
        Only use these values to indicate for historical purpose what you paid for them.
      </p>
      <div className="form-row">
        <div className="form-group">
          <label>Purchase Price</label>
          <input
            className="form-control"
            type="number"
            min="0"
            step="0.01"
            value={form.purchasePriceAmt ?? ''}
            onChange={e => set('purchasePriceAmt', e.target.value !== '' ? parseFloat(e.target.value) : null)}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label>Currency</label>
          <input
            className="form-control"
            value={form.purchasePriceCurrency || ''}
            onChange={e => set('purchasePriceCurrency', e.target.value.toUpperCase().slice(0, 3))}
            placeholder="AUD"
            maxLength={3}
          />
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
