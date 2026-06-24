import React, { useState, useEffect } from 'react';
import { getLookups, createLookup, updateLookup, getScaleFigureTypes, addScaleFigureType, getPaintCosts, upsertPaintCost, getBasingCosts, upsertBasingCost, getFigureCosts, upsertFigureCost, getExchangeRates } from '../../api/client.js';
import { PAINT_QUALITY_LABELS } from '../../config.js';

// Maps each lookup type to the form fields it populates
const FIELD_MAP = {
  SCALE:          ['scaleId',          'scaleName'],
  MANUFACTURER:   ['manufacturerId',   'manufacturerName'],
  FIGUREMATERIAL: ['figureMaterialId', 'figureMaterialName'],
  NATIONALITY:    ['nationalityId',    'nationalityName'],
  BASESIZE:       ['baseSizeId',       'baseSizeName'],
  BASEMATERIAL:   ['baseMaterialId',   'baseMaterialName'],
};

export default function ItemModal({ initial, template, collectionCategory, onSave, onClose }) {
  const seed = initial || template || {};
  const [category, setCategory] = useState(seed.category || collectionCategory || 'MINIATURE');
  // Migrate old single-type items (figureTypeId + quantity) to the figures[] array format
  const migratedSeed = (!seed.figures && seed.figureTypeId)
    ? { ...seed, figures: [{ figureTypeId: seed.figureTypeId, figureTypeName: seed.figureTypeName || '', quantity: seed.quantity || 1 }] }
    : seed;
  const [form, setForm] = useState({ ...migratedSeed, figures: migratedSeed.figures || [{ figureTypeId: null, figureTypeName: '', quantity: null }] });
  const [lookups, setLookups] = useState({});
  const [scaleFigureTypes, setScaleFigureTypes] = useState([]);
  const [paintCosts, setPaintCosts] = useState([]);
  const [basingCosts, setBasingCosts] = useState([]);
  const [figureCosts, setFigureCosts] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(category === 'MINIATURE' || category === 'TERRAIN');

  useEffect(() => {
    if (category === 'MINIATURE' || category === 'TERRAIN') loadLookups();
  }, [category]);

  async function loadLookups() {
    setLoading(true);
    const types = category === 'MINIATURE'
      ? ['SCALE', 'MANUFACTURER', 'FIGUREMATERIAL', 'FIGURETYPE', 'NATIONALITY', 'BASESIZE', 'BASEMATERIAL', 'PAINTQUALITY']
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
    setLoading(false);
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

  async function handleSetPaintCost(figureTypeId, costUSD) {
    const scaleData = (lookups.SCALE || []).find(s => s.id === form.scaleId);
    const qualityId = (scaleData?.qualityNames?.length ?? 0) > 0 ? String(form.paintQualityId) : '0';
    const entry = { scaleId: form.scaleId, figureTypeId, qualityId, costUSD };
    await upsertPaintCost(entry);
    setPaintCosts(prev => {
      const idx = prev.findIndex(c => c.scaleId === entry.scaleId && c.figureTypeId === entry.figureTypeId && c.qualityId === entry.qualityId);
      if (idx === -1) return [...prev, entry];
      const next = [...prev]; next[idx] = entry; return next;
    });
    const alreadyLinked = scaleFigureTypes.some(l => l.scaleId === form.scaleId && l.figureTypeId === figureTypeId);
    if (!alreadyLinked) {
      const link = await addScaleFigureType({ scaleId: form.scaleId, figureTypeId });
      setScaleFigureTypes(prev => [...prev, link]);
    }
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

  async function handleSetFigureCost(figureTypeId, cost, currency) {
    const entry = { manufacturerId: form.manufacturerId, scaleId: form.scaleId, materialId: form.figureMaterialId, figureTypeId, cost, currency };
    await upsertFigureCost(entry);
    setFigureCosts(prev => {
      const idx = prev.findIndex(c => c.manufacturerId === entry.manufacturerId && c.scaleId === entry.scaleId && c.materialId === entry.materialId && c.figureTypeId === entry.figureTypeId);
      if (idx === -1) return [...prev, entry];
      const next = [...prev]; next[idx] = entry; return next;
    });
  }

  const figures = form.figures || [];
  const missingBasingCost = !loading && category === 'MINIATURE' && !!form.baseSizeId && !!form.baseMaterialId
    && !basingCosts.some(c => c.materialId === form.baseMaterialId && c.sizeId === form.baseSizeId);
  const selectedScaleData = (lookups.SCALE || []).find(s => s.id === form.scaleId);
  const scaleHasQualityLevels = (selectedScaleData?.qualityNames?.length ?? 0) > 0;
  // For scales with no quality levels, use qualityId "0" (flat rate sentinel, never conflicts with real quality IDs 1-4)
  const effectivePaintQualityId = scaleHasQualityLevels ? form.paintQualityId : (form.scaleId ? '0' : null);

  const missingFigureCosts = !loading && category === 'MINIATURE' && form.manufacturerId && form.scaleId && form.figureMaterialId
    ? figures.filter(f => f.figureTypeId && !figureCosts.some(c => c.manufacturerId === form.manufacturerId && c.scaleId === form.scaleId && c.materialId === form.figureMaterialId && c.figureTypeId === f.figureTypeId))
    : [];
  const missingPaintCosts = !loading && category === 'MINIATURE' && form.scaleId && effectivePaintQualityId
    ? figures.filter(f => f.figureTypeId && !paintCosts.some(c => c.scaleId === form.scaleId && c.figureTypeId === f.figureTypeId && c.qualityId === String(effectivePaintQualityId)))
    : [];
  const missingFigureCost = missingFigureCosts.length > 0;
  const missingPaintCost = missingPaintCosts.length > 0;

  const missingMiniatureFields = category !== 'MINIATURE' ? [] : [
    [!form.scaleId,            'Scale'],
    [!form.manufacturerId,     'Manufacturer'],
    [!form.figureMaterialId,   'Figure Material'],
    [figures.length === 0 || figures.some(f => !f.figureTypeId), 'Figure Type'],
    [figures.length === 0 || figures.some(f => f.quantity == null), 'Figures per Base'],
    [!form.nationalityId,      'Nationality'],
    [form.numberBases == null, 'Number of Bases'],
    [scaleHasQualityLevels && !form.paintQualityId, 'Paint Quality'],
    [missingPaintCost,         'Painting Rate'],
    [!form.baseSizeId,                                          'Base Size'],
    [form.baseSizeId !== 'base-none' && !form.baseMaterialId,  'Base Material'],
  ].filter(([missing]) => missing).map(([, label]) => label);
  const missingRequiredFields = missingMiniatureFields.length > 0;
  const canSave = !missingBasingCost && !missingFigureCost && !missingPaintCost && !missingRequiredFields;

  // Calculated item value
  const rateMap = { AUD: 1.0 };
  for (const er of exchangeRates) rateMap[er.currencyCode] = er.rateToAUD;
  const totalFigures = figures.reduce((s, f) => s + (f.quantity || 0), 0) * (form.numberBases || 0);

  const figureDetails = [];
  let figureValueAUD = null;
  if (category === 'MINIATURE') {
    for (const fig of figures) {
      if (!fig.figureTypeId || !form.manufacturerId || !form.scaleId) continue;
      const fc = figureCosts.find(c => c.manufacturerId === form.manufacturerId && c.scaleId === form.scaleId && c.materialId === form.figureMaterialId && c.figureTypeId === fig.figureTypeId);
      if (fc) {
        const qty = (fig.quantity || 0) * (form.numberBases || 0);
        figureValueAUD = (figureValueAUD || 0) + fc.cost * (rateMap[fc.currency] || 1) * qty;
        figureDetails.push({ qty, name: fig.figureTypeName, cost: fc.cost, currency: fc.currency });
      }
    }
  }

  const paintDetails = [];
  let paintValueAUD = null;
  if (category === 'MINIATURE' && effectivePaintQualityId) {
    for (const fig of figures) {
      if (!fig.figureTypeId || !form.scaleId) continue;
      const pc = paintCosts.find(c => c.scaleId === form.scaleId && c.figureTypeId === fig.figureTypeId && c.qualityId === String(effectivePaintQualityId));
      if (pc) {
        const qty = (fig.quantity || 0) * (form.numberBases || 0);
        paintValueAUD = (paintValueAUD || 0) + pc.costUSD * (rateMap['USD'] || 1) * qty;
        paintDetails.push({ qty, name: fig.figureTypeName, costUSD: pc.costUSD });
      }
    }
  }

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
                exchangeRates={exchangeRates}
                missingBasingCost={missingBasingCost}
                missingFigureCosts={missingFigureCosts}
                missingPaintCosts={missingPaintCosts}
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
                    Figures ({figureDetails.length === 1
                      ? `${figureDetails[0].qty} figs @ ${figureDetails[0].cost} ${figureDetails[0].currency} each`
                      : figureDetails.map(d => `${d.qty}× ${d.name} @ ${d.cost} ${d.currency}`).join(', ')
                    }): <strong>AUD ${figureValueAUD.toFixed(2)}</strong>
                  </div>
                )}
                {paintValueAUD !== null && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Painting ({paintDetails.length === 1
                      ? `${paintDetails[0].qty} figs @ ${paintDetails[0].costUSD} USD each`
                      : paintDetails.map(d => `${d.qty}× ${d.name} @ ${d.costUSD} USD`).join(', ')
                    }): <strong>AUD ${paintValueAUD.toFixed(2)}</strong>
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
            {missingRequiredFields && (
              <span style={{ fontSize: 12, color: 'var(--danger)', marginRight: 'auto', alignSelf: 'center' }}>
                Required: {missingMiniatureFields.join(', ')}
              </span>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving || !canSave}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inline cost setter ───────────────────────────────────────────────────────

function InlineCostSetter({ label, onSet, currencies }) {
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [saving, setSaving] = useState(false);

  async function handleSet() {
    const cost = parseFloat(value);
    if (!cost || cost < 0 || saving) return;
    setSaving(true);
    try { await onSet(cost, currency); } finally { setSaving(false); }
  }

  const currencyOptions = currencies
    ? ['AUD', ...currencies.map(r => r.currencyCode).filter(c => c !== 'AUD')]
    : null;

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
      {currencyOptions && (
        <select
          className="form-control"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          style={{ width: 80, padding: '4px 6px', fontSize: 13 }}
        >
          {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
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

function LookupSelect({ label, type, lookups, value, onChange, onQuickAdd, disabled }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select className="form-control" value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled}>
          <option value="">{disabled ? '— N/A —' : '— select —'}</option>
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
          disabled={disabled}
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

function MiniatureFields({ form, set, lookups, scaleFigureTypes, paintCosts, basingCosts, exchangeRates, handleLookupChange, onQuickAdd, onUpdateScale, missingBasingCost, missingFigureCosts, missingPaintCosts, onSetBasingCost, onSetFigureCost, onSetPaintCost }) {
  const [showAddQuality, setShowAddQuality] = useState(false);
  const allFigureTypes = lookups.FIGURETYPE || [];
  const hasAnyLinks = scaleFigureTypes.length > 0;
  const figureTypesWithAnyLink = hasAnyLinks ? new Set(scaleFigureTypes.map(l => l.figureTypeId)) : null;

  const filteredFigureTypes = hasAnyLinks && form.scaleId
    ? allFigureTypes.filter(ft =>
        scaleFigureTypes.some(l => l.scaleId === form.scaleId && l.figureTypeId === ft.id) ||
        !figureTypesWithAnyLink.has(ft.id)
      )
    : allFigureTypes;
  const figureTypeLookups = { ...lookups, FIGURETYPE: filteredFigureTypes };

  function handleScaleChange(id) {
    handleLookupChange('scaleId', 'scaleName', 'SCALE', id);
    const scale = (lookups.SCALE || []).find(s => s.id === id);
    const newMaxLevel = scale?.qualityNames?.length ?? 0;
    if (form.paintQualityId && parseInt(form.paintQualityId) > newMaxLevel) {
      set('paintQualityId', null);
      set('paintQualityName', '');
    }
    if (hasAnyLinks && id) {
      const cleaned = (form.figures || []).map(f => {
        const stillValid = scaleFigureTypes.some(l => l.scaleId === id && l.figureTypeId === f.figureTypeId);
        return stillValid ? f : { ...f, figureTypeId: null, figureTypeName: '' };
      });
      set('figures', cleaned);
    }
  }

  function handleChangeRow(index, updated) {
    const next = [...(form.figures || [])];
    next[index] = updated;
    set('figures', next);
  }

  function handleRemoveRow(index) {
    set('figures', (form.figures || []).filter((_, i) => i !== index));
  }

  function handleAddRow() {
    set('figures', [...(form.figures || []), { figureTypeId: null, figureTypeName: '', quantity: null }]);
  }

  const selectedScale = (lookups.SCALE || []).find(s => s.id === form.scaleId);
  const scaleQualityNames = selectedScale?.qualityNames?.length ? selectedScale.qualityNames : [];

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
        <LookupSelect label="Figure Material" type="FIGUREMATERIAL" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.figureMaterialId}
          onChange={id => handleLookupChange('figureMaterialId', 'figureMaterialName', 'FIGUREMATERIAL', id)} />
        <LookupSelect label="Nationality" type="NATIONALITY" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.nationalityId}
          onChange={id => handleLookupChange('nationalityId', 'nationalityName', 'NATIONALITY', id)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Number of Bases</label>
          <input className="form-control" type="number" min="0" value={form.numberBases ?? ''}
            onChange={e => set('numberBases', e.target.value !== '' ? parseInt(e.target.value) : null)} />
        </div>
      </div>
      <div className="form-group">
        <label>Composition per Base</label>
        {(form.figures || []).map((fig, idx) => (
          <FigureCompositionRow
            key={idx}
            figure={fig}
            index={idx}
            figureTypeLookups={figureTypeLookups}
            onChangeRow={handleChangeRow}
            onRemoveRow={handleRemoveRow}
            canRemove={(form.figures || []).length > 1}
            onQuickAdd={onQuickAdd}
          />
        ))}
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={handleAddRow}>
          + Add figure type
        </button>
      </div>
      {missingFigureCosts.map(f => (
        <div key={f.figureTypeId} style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>
            No figure cost set for <strong>{form.manufacturerName}</strong> {form.scaleName} {form.figureMaterialName} {f.figureTypeName} — save is blocked.
          </span>
          <InlineCostSetter label="Cost per figure" onSet={(cost, currency) => onSetFigureCost(f.figureTypeId, cost, currency)} currencies={exchangeRates} />
        </div>
      ))}
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
              {scaleQualityNames
                .map((name, i) => ({ name, id: i + 1 }))
                .filter(({ name }) => name.toLowerCase() !== 'n/a')
                .map(({ name, id }) => (
                  <option key={id} value={String(id)}>{name}</option>
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
      {missingPaintCosts.map(f => (
        <div key={f.figureTypeId} style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>
            No painting rate set for {form.scaleName} {f.figureTypeName}{scaleQualityNames.length > 0 ? ' at this quality level' : ''} — save is blocked.
          </span>
          <InlineCostSetter label="Painting rate per figure (USD)" onSet={costUSD => onSetPaintCost(f.figureTypeId, costUSD)} />
        </div>
      ))}
      <div className="form-row">
        <LookupSelect label="Base Size" type="BASESIZE" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.baseSizeId}
          onChange={id => {
            handleLookupChange('baseSizeId', 'baseSizeName', 'BASESIZE', id);
            if (id === 'base-none') handleLookupChange('baseMaterialId', 'baseMaterialName', 'BASEMATERIAL', '');
          }} />
        <LookupSelect label="Base Material" type="BASEMATERIAL" lookups={lookups} onQuickAdd={onQuickAdd}
          value={form.baseMaterialId}
          disabled={form.baseSizeId === 'base-none'}
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
          <select
            className="form-control"
            value={form.purchasePriceCurrency || 'AUD'}
            onChange={e => set('purchasePriceCurrency', e.target.value)}
          >
            <option value="AUD">AUD</option>
            {(exchangeRates || [])
              .filter(r => r.currencyCode !== 'AUD')
              .map(r => <option key={r.currencyCode} value={r.currencyCode}>{r.currencyCode}</option>)
            }
          </select>
        </div>
      </div>
    </>
  );
}

// ─── Figure composition row ───────────────────────────────────────────────────

function FigureCompositionRow({ figure, index, figureTypeLookups, onChangeRow, onRemoveRow, canRemove, onQuickAdd }) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
      <select
        className="form-control"
        value={figure.figureTypeId || ''}
        onChange={e => {
          const id = e.target.value;
          const item = (figureTypeLookups.FIGURETYPE || []).find(l => l.id === id);
          onChangeRow(index, { ...figure, figureTypeId: id || null, figureTypeName: item?.label || '' });
        }}
      >
        <option value="">— type —</option>
        {(figureTypeLookups.FIGURETYPE || []).map(ft => (
          <option key={ft.id} value={ft.id}>{ft.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-icon"
        title="Add new figure type"
        style={{ flexShrink: 0, fontSize: 18, lineHeight: 1 }}
        onClick={() => setShowAdd(true)}
      >
        +
      </button>
      <input
        className="form-control"
        type="text"
        inputMode="numeric"
        style={{ width: 72 }}
        value={figure.quantity ?? ''}
        placeholder="Qty"
        onChange={e => onChangeRow(index, { ...figure, quantity: e.target.value !== '' ? parseInt(e.target.value) : null })}
      />
      <button
        type="button"
        className="btn btn-icon"
        title="Remove row"
        style={{ flexShrink: 0, color: canRemove ? 'var(--danger)' : 'var(--text-muted)' }}
        disabled={!canRemove}
        onClick={() => onRemoveRow(index)}
      >
        ✕
      </button>
      {showAdd && (
        <QuickAddModal
          type="FIGURETYPE"
          label="Figure Type"
          onSave={newItem => {
            onQuickAdd('FIGURETYPE', newItem);
            onChangeRow(index, { ...figure, figureTypeId: newItem.id, figureTypeName: newItem.label });
            setShowAdd(false);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
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
      <hr className="divider" />
      <div className="form-row">
        <div className="form-group">
          <label>Cost</label>
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
          <select
            className="form-control"
            value={form.purchasePriceCurrency || ''}
            onChange={e => set('purchasePriceCurrency', e.target.value || null)}
          >
            <option value="">— select —</option>
            <option value="AUD">AUD</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
            <option value="CAD">CAD</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Date Purchased</label>
          <input
            className="form-control"
            type="date"
            value={form.datePurchased || ''}
            onChange={e => set('datePurchased', e.target.value || null)}
          />
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
      <hr className="divider" />
      <div className="form-row">
        <div className="form-group">
          <label>Cost</label>
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
          <select
            className="form-control"
            value={form.purchasePriceCurrency || ''}
            onChange={e => set('purchasePriceCurrency', e.target.value || null)}
          >
            <option value="">— select —</option>
            <option value="AUD">AUD</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
            <option value="CAD">CAD</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Date Purchased</label>
          <input
            className="form-control"
            type="date"
            value={form.datePurchased || ''}
            onChange={e => set('datePurchased', e.target.value || null)}
          />
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
