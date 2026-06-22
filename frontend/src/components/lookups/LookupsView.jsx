import React, { useState, useEffect } from 'react';
import {
  getLookups, createLookup, updateLookup, deleteLookup,
  getPaintCosts, upsertPaintCost,
  getBasingCosts, upsertBasingCost,
  getExchangeRates, upsertExchangeRate, deleteExchangeRate,
  getFigureCosts, upsertFigureCost, deleteFigureCost,
  getManufacturerNotes, upsertManufacturerNote,
  getScaleFigureTypes, addScaleFigureType, removeScaleFigureType,
} from '../../api/client.js';
import { PAINT_QUALITY_LABELS } from '../../config.js';
import { useToast } from '../Toast.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';

// ─── Sidebar structure ───────────────────────────────────────────────────────

const SIDEBAR = [
  {
    heading: 'Miniature Lookups',
    items: [
      { key: 'SCALE',        label: 'Scales',          hint: 'e.g. 6mm, 10mm, 15mm, 25mm' },
      { key: 'MANUFACTURER', label: 'Manufacturers',   hint: 'e.g. AB Miniatures, Essex, Baccus' },
      { key: 'FIGURETYPE',   label: 'Figure Types',    hint: 'e.g. Infantry, Cavalry, Tank, Gun' },
      { key: 'NATIONALITY',  label: 'Nationalities',   hint: 'e.g. Roman, French, German' },
      { key: 'PERIOD',       label: 'Periods',         hint: 'e.g. Ancient, Napoleonic, WWII' },
      { key: 'RULES',        label: 'Rules Sets',      hint: 'e.g. DBM, FOG, Chain of Command' },
      { key: 'BASESIZE',     label: 'Base Sizes',      hint: 'e.g. 40×40mm, 60×30mm' },
      { key: 'BASEMATERIAL', label: 'Base Materials',  hint: 'e.g. Metal, MDF, Plastic' },
    ],
  },
  {
    heading: 'Miniature Rates',
    items: [
      { key: '__FIGURECOST', label: 'Figure Prices',   hint: 'Purchase price per figure — Manufacturer × Scale × Figure Type (with currency)' },
      { key: '__PAINTING',  label: 'Painting Rates',  hint: 'Commercial painting cost per figure (USD) — Scale × Figure Type × Quality' },
      { key: '__BASING',    label: 'Basing Rates',    hint: 'Cost per base (AUD) — Base Material × Base Size' },
      { key: '__EXCHANGE',  label: 'Exchange Rates',  hint: 'Conversion rates to AUD for purchase price display' },
    ],
  },
];

// ─── Main component ──────────────────────────────────────────────────────────

export default function LookupsView() {
  const [activeKey, setActiveKey] = useState('SCALE');

  const isRateTable = activeKey.startsWith('__');
  const sidebarItem = SIDEBAR.flatMap(s => s.items).find(i => i.key === activeKey);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 190, background: 'var(--bg2)', borderRight: '1px solid var(--border)', flexShrink: 0, overflowY: 'auto', paddingBottom: 12 }}>
        {SIDEBAR.map(section => (
          <div key={section.heading}>
            <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
              {section.heading}
            </div>
            {section.items.map(item => (
              <div
                key={item.key}
                style={{
                  padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                  borderLeft: `3px solid ${activeKey === item.key ? 'var(--accent)' : 'transparent'}`,
                  background: activeKey === item.key ? 'rgba(233,69,96,0.08)' : 'transparent',
                  color: activeKey === item.key ? 'var(--text)' : 'var(--text-muted)',
                }}
                onClick={() => setActiveKey(item.key)}
              >
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Content pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!isRateTable && <LookupListPanel type={activeKey} hint={sidebarItem?.hint} label={sidebarItem?.label} />}
        {activeKey === '__FIGURECOST' && <FigureCostPanel />}
        {activeKey === '__PAINTING'  && <PaintingRatesPanel />}
        {activeKey === '__BASING'    && <BasingRatesPanel />}
        {activeKey === '__EXCHANGE'  && <ExchangeRatesPanel />}
      </div>
    </div>
  );
}

// ─── Generic lookup list ─────────────────────────────────────────────────────

function LookupListPanel({ type, label, hint }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  useEffect(() => { load(); }, [type]);

  async function load() {
    setLoading(true);
    try { setItems(await getLookups(type)); }
    catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSave(formData) {
    try {
      if (editTarget) {
        const updated = await updateLookup(type, editTarget.id, formData);
        setItems(is => is.map(i => i.id === editTarget.id ? updated : i));
        toast('Updated', 'success');
      } else {
        const created = await createLookup(type, formData);
        setItems(is => [...is, created]);
        toast('Created', 'success');
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleDelete() {
    try {
      await deleteLookup(type, deleteTarget.id);
      setItems(is => is.filter(i => i.id !== deleteTarget.id));
      toast('Deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setDeleteTarget(null); }
  }

  const singularLabel = label?.replace(/s$/, '') || 'Item';

  return (
    <>
      <div className="panel-header">
        <span className="panel-title">{label}</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>+ Add</button>
      </div>
      <div className="panel-body">
        {hint && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{hint}</p>}
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state"><p>No {label?.toLowerCase()} defined yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                {type === 'SCALE' && <th>Quality Levels</th>}
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  {type === 'SCALE' && (
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {item.qualityNames?.length ? `${item.qualityNames.length}: ${item.qualityNames.join(', ')}` : '—'}
                    </td>
                  )}
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-icon btn-sm" onClick={() => { setEditTarget(item); setShowModal(true); }}>✏️</button>
                      <button className="btn btn-icon btn-sm" onClick={() => setDeleteTarget(item)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <LookupModal initial={editTarget} singularLabel={singularLabel} showAbbreviation={type !== 'SCALE'} showPaintLevels={type === 'SCALE'} onSave={handleSave} onClose={() => { setShowModal(false); setEditTarget(null); }} />
      )}
      {deleteTarget && (
        <ConfirmDialog title={`Delete ${singularLabel}`} message={`Delete "${deleteTarget.label}"?`} danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
}

function LookupModal({ initial, singularLabel, onSave, onClose, showAbbreviation = true, showPaintLevels = false }) {
  const [label, setLabel] = useState(initial?.label || '');
  const [abbreviation, setAbbreviation] = useState(initial?.abbreviation || '');
  const [qualityNames, setQualityNames] = useState(
    initial?.qualityNames?.length ? initial.qualityNames : ['']
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const names = qualityNames.map(n => n.trim()).filter(Boolean);
    await onSave({ label, abbreviation, ...(showPaintLevels && { qualityNames: names }) });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? `Edit ${singularLabel}` : `Add ${singularLabel}`}</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Label *</label>
              <input className="form-control" value={label} onChange={e => setLabel(e.target.value)} required autoFocus />
            </div>
            {showAbbreviation && (
              <div className="form-group">
                <label>Abbreviation</label>
                <input className="form-control" value={abbreviation} onChange={e => setAbbreviation(e.target.value)} placeholder="Optional short form" />
              </div>
            )}
            {showPaintLevels && (
              <div className="form-group">
                <label>Paint Quality Levels</label>
                {qualityNames.map((name, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, width: 18, flexShrink: 0 }}>{i + 1}.</span>
                    <input
                      className="form-control"
                      value={name}
                      onChange={e => setQualityNames(ns => ns.map((n, j) => j === i ? e.target.value : n))}
                      placeholder={`Level ${i + 1} name`}
                    />
                    {qualityNames.length > 1 && (
                      <button type="button" className="btn btn-icon btn-sm" onClick={() => setQualityNames(ns => ns.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </div>
                ))}
                {qualityNames.length < 4 && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setQualityNames(ns => [...ns, ''])}>
                    + Add Level
                  </button>
                )}
              </div>
            )}
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

// ─── Painting rates matrix ───────────────────────────────────────────────────

function PaintingRatesPanel() {
  const [scales, setScales] = useState([]);
  const [figureTypes, setFigureTypes] = useState([]);
  const [links, setLinks] = useState([]);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [addingToScale, setAddingToScale] = useState(null);
  const [addFtId, setAddFtId] = useState('');
  const [quickAddFt, setQuickAddFt] = useState(false);
  const [editingLevels, setEditingLevels] = useState(null);
  const [editLevelNames, setEditLevelNames] = useState([]);
  const toast = useToast();

  function getQualityNames(scale) {
    if (scale?.qualityNames?.length) return scale.qualityNames;
    const count = scale?.paintLevels ?? Object.keys(PAINT_QUALITY_LABELS).length;
    return Object.values(PAINT_QUALITY_LABELS).slice(0, count);
  }

  function openEditLevels(scale) {
    setEditingLevels(scale.id);
    setEditLevelNames([...getQualityNames(scale)]);
    setEditing(null);
    setAddingToScale(null);
  }

  async function handleSaveLevels(scaleId) {
    const names = editLevelNames.map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    try {
      const updated = await updateLookup('SCALE', scaleId, { qualityNames: names });
      setScales(ss => ss.map(s => s.id === scaleId ? { ...s, ...updated } : s));
      toast('Quality levels saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setEditingLevels(null); }
  }

  useEffect(() => {
    Promise.all([getLookups('SCALE'), getLookups('FIGURETYPE'), getScaleFigureTypes(), getPaintCosts()])
      .then(([s, f, l, c]) => { setScales(s); setFigureTypes(f); setLinks(l); setCosts(c); })
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function getFigureTypesForScale(scaleId) {
    const linked = new Set(links.filter(l => l.scaleId === scaleId).map(l => l.figureTypeId));
    return figureTypes.filter(ft => linked.has(ft.id));
  }

  function getUnlinkedFigureTypes(scaleId) {
    const linked = new Set(links.filter(l => l.scaleId === scaleId).map(l => l.figureTypeId));
    return figureTypes.filter(ft => !linked.has(ft.id));
  }

  function getCost(scaleId, figureTypeId, qualityId) {
    return costs.find(c => c.scaleId === scaleId && c.figureTypeId === figureTypeId && c.qualityId === qualityId)?.costUSD ?? '';
  }

  async function handleSave(scaleId, figureTypeId, qualityId, val) {
    try {
      const updated = await upsertPaintCost({ scaleId, figureTypeId, qualityId, costUSD: parseFloat(val) });
      setCosts(cs => {
        const idx = cs.findIndex(c => c.scaleId === scaleId && c.figureTypeId === figureTypeId && c.qualityId === qualityId);
        return idx === -1 ? [...cs, updated] : cs.map((c, i) => i === idx ? updated : c);
      });
      toast('Rate saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setEditing(null); }
  }

  async function handleAddFigureType(scaleId) {
    if (!addFtId) return;
    try {
      const link = await addScaleFigureType({ scaleId, figureTypeId: addFtId });
      setLinks(ls => [...ls, link]);
      toast('Figure type added', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setAddingToScale(null); setAddFtId(''); }
  }

  async function handleRemoveFigureType(scaleId, figureTypeId) {
    try {
      await removeScaleFigureType(scaleId, figureTypeId);
      setLinks(ls => ls.filter(l => !(l.scaleId === scaleId && l.figureTypeId === figureTypeId)));
      toast('Figure type removed', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleQuickCreateFigureType(formData) {
    try {
      const created = await createLookup('FIGURETYPE', formData);
      setFigureTypes(fts => [...fts, created]);
      const link = await addScaleFigureType({ scaleId: addingToScale, figureTypeId: created.id });
      setLinks(ls => [...ls, link]);
      toast('Figure type created and linked', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setQuickAddFt(false); setAddingToScale(null); setAddFtId(''); }
  }

  function openAddForScale(scaleId) {
    setAddingToScale(scaleId);
    const unlinked = getUnlinkedFigureTypes(scaleId);
    setAddFtId(unlinked[0]?.id || '');
    setEditing(null);
  }

  return (
    <>
      <div className="panel-header">
        <span className="panel-title">Painting Rates</span>
      </div>
      <div className="panel-body">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Commercial painting rate in USD per figure. Click any cell to edit. Quality level names are configured per scale — use the Edit Levels button on each scale card.
        </p>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : scales.length === 0 ? (
          <div className="empty-state"><p>Add scales in Scales first.</p></div>
        ) : (
          scales.map(scale => {
            const scaleFts = getFigureTypesForScale(scale.id);
            const unlinked = getUnlinkedFigureTypes(scale.id);
            const isAdding = addingToScale === scale.id;
            const scaleQualityNames = getQualityNames(scale);
            return (
              <div key={scale.id} className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <span className="card-title">{scale.label}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditLevels(scale)}>
                      Edit Levels ({scaleQualityNames.length})
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => openAddForScale(scale.id)}>+ Add Figure Type</button>
                  </div>
                </div>

                {editingLevels === scale.id && (
                  <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paint quality level names for {scale.label}:</div>
                    {editLevelNames.map((name, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, width: 18, flexShrink: 0 }}>{i + 1}.</span>
                        <input
                          className="form-control"
                          value={name}
                          onChange={e => setEditLevelNames(ns => ns.map((n, j) => j === i ? e.target.value : n))}
                          placeholder={`Level ${i + 1}`}
                          style={{ maxWidth: 200 }}
                          autoFocus={i === 0}
                        />
                        {editLevelNames.length > 1 && (
                          <button type="button" className="btn btn-icon btn-sm" onClick={() => setEditLevelNames(ns => ns.filter((_, j) => j !== i))}>✕</button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      {editLevelNames.length < 4 && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditLevelNames(ns => [...ns, ''])}>+ Add Level</button>
                      )}
                      <button className="btn btn-sm btn-primary" onClick={() => handleSaveLevels(scale.id)}>Save</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditingLevels(null)}>Cancel</button>
                    </div>
                  </div>
                )}

                {isAdding && (
                  <div style={{ padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
                    {unlinked.length > 0 ? (
                      <>
                        <select
                          className="form-control"
                          value={addFtId}
                          onChange={e => setAddFtId(e.target.value)}
                          style={{ maxWidth: 220 }}
                          autoFocus
                        >
                          {unlinked.map(ft => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
                        </select>
                        <button className="btn btn-sm btn-primary" onClick={() => handleAddFigureType(scale.id)}>Add</button>
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>All figure types already linked.</span>
                    )}
                    <button
                      className="btn btn-sm btn-ghost"
                      title="Create a new figure type"
                      onClick={() => setQuickAddFt(true)}
                    >+ Create new…</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setAddingToScale(null); setAddFtId(''); }}>Cancel</button>
                  </div>
                )}

                {scaleFts.length === 0 && !isAdding ? (
                  <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                    No figure types linked to this scale yet. Click + Add Figure Type to begin.
                  </div>
                ) : scaleFts.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: 360 }}>
                      <thead>
                        <tr>
                          <th>Figure Type</th>
                          {scaleQualityNames.map((name, i) => <th key={i}>{name}</th>)}
                          <th style={{ width: 32 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {scaleFts.map(ft => (
                          <tr key={ft.id}>
                            <td>{ft.label}</td>
                            {scaleQualityNames.map((name, i) => {
                              const q = String(i + 1);
                              const key = `${scale.id}|${ft.id}|${q}`;
                              const val = getCost(scale.id, ft.id, q);
                              return (
                                <td key={q}>
                                  {editing === key ? (
                                    <InlineCostInput initial={val} onSave={v => handleSave(scale.id, ft.id, q, v)} onCancel={() => setEditing(null)} />
                                  ) : (
                                    <span style={{ cursor: 'pointer', color: val !== '' ? 'var(--text)' : 'var(--text-muted)' }} onClick={() => setEditing(key)}>
                                      {val !== '' ? `$${parseFloat(val).toFixed(2)}` : '—'}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              <button
                                className="btn btn-icon btn-sm"
                                title="Remove from this scale"
                                onClick={() => handleRemoveFigureType(scale.id, ft.id)}
                                style={{ color: 'var(--text-muted)' }}
                              >✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {quickAddFt && (
        <LookupModal
          singularLabel="Figure Type"
          onSave={handleQuickCreateFigureType}
          onClose={() => setQuickAddFt(false)}
        />
      )}
    </>
  );
}

// ─── Basing rates matrix ─────────────────────────────────────────────────────

function BasingRatesPanel() {
  const [materials, setMaterials] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  useEffect(() => {
    Promise.all([getLookups('BASEMATERIAL'), getLookups('BASESIZE'), getBasingCosts()])
      .then(([m, s, c]) => { setMaterials(m); setSizes(s); setCosts(c); })
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function getCost(materialId, sizeId) {
    return costs.find(c => c.materialId === materialId && c.sizeId === sizeId)?.costAUD ?? '';
  }

  async function handleSave(materialId, sizeId, val) {
    try {
      const updated = await upsertBasingCost({ materialId, sizeId, costAUD: parseFloat(val) });
      setCosts(cs => {
        const idx = cs.findIndex(c => c.materialId === materialId && c.sizeId === sizeId);
        return idx === -1 ? [...cs, updated] : cs.map((c, i) => i === idx ? updated : c);
      });
      toast('Rate saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setEditing(null); }
  }

  return (
    <>
      <div className="panel-header">
        <span className="panel-title">Basing Rates</span>
      </div>
      <div className="panel-body">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Cost per base in AUD. Click any cell to edit. Matrix: Base Material × Base Size.
        </p>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : materials.length === 0 ? (
          <div className="empty-state"><p>Add base materials and sizes in the lookup lists first.</p></div>
        ) : (
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 300 }}>
                <thead>
                  <tr>
                    <th>Material</th>
                    {sizes.map(s => <th key={s.id}>{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {materials.map(mat => (
                    <tr key={mat.id}>
                      <td>{mat.label}</td>
                      {sizes.map(sz => {
                        const key = `${mat.id}|${sz.id}`;
                        const val = getCost(mat.id, sz.id);
                        return (
                          <td key={sz.id}>
                            {editing === key ? (
                              <InlineCostInput initial={val} onSave={v => handleSave(mat.id, sz.id, v)} onCancel={() => setEditing(null)} />
                            ) : (
                              <span style={{ cursor: 'pointer', color: val !== '' ? 'var(--text)' : 'var(--text-muted)' }} onClick={() => setEditing(key)}>
                                {val !== '' ? `$${parseFloat(val).toFixed(2)}` : '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Exchange rates ──────────────────────────────────────────────────────────

function ExchangeRatesPanel() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setRates(await getExchangeRates()); }
    catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSave(formData) {
    try {
      const updated = await upsertExchangeRate(formData);
      setRates(rs => {
        const idx = rs.findIndex(r => r.currencyCode === updated.currencyCode);
        return idx === -1 ? [...rs, updated] : rs.map((r, i) => i === idx ? updated : r);
      });
      toast('Rate saved', 'success');
      setShowModal(false);
      setEditTarget(null);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleDelete() {
    try {
      await deleteExchangeRate(deleteTarget.currencyCode);
      setRates(rs => rs.filter(r => r.currencyCode !== deleteTarget.currencyCode));
      toast('Deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setDeleteTarget(null); }
  }

  return (
    <>
      <div className="panel-header">
        <span className="panel-title">Exchange Rates</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>+ Add Currency</button>
      </div>
      <div className="panel-body">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Rates to AUD used to display purchase prices in a common currency. Update periodically to keep valuations current.
        </p>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : rates.length === 0 ? (
          <div className="empty-state"><p>No exchange rates defined yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Currency Name</th>
                <th>1 Unit = AUD</th>
                <th>Last Updated</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {[...rates].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)).map(rate => (
                <tr key={rate.currencyCode}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 15 }}>{rate.currencyCode}</td>
                  <td>{rate.name}</td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{Number(rate.rateToAUD).toFixed(4)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>AUD</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {rate.updatedAt ? new Date(rate.updatedAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-icon btn-sm" onClick={() => { setEditTarget(rate); setShowModal(true); }}>✏️</button>
                      <button className="btn btn-icon btn-sm" onClick={() => setDeleteTarget(rate)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ExchangeRateModal initial={editTarget} onSave={handleSave} onClose={() => { setShowModal(false); setEditTarget(null); }} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Remove Currency"
          message={`Remove ${deleteTarget.currencyCode} (${deleteTarget.name}) from exchange rates?`}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

function ExchangeRateModal({ initial, onSave, onClose }) {
  const [currencyCode, setCurrencyCode] = useState(initial?.currencyCode || '');
  const [name, setName] = useState(initial?.name || '');
  const [rateToAUD, setRateToAUD] = useState(initial?.rateToAUD ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave({ currencyCode: currencyCode.toUpperCase(), name, rateToAUD: parseFloat(rateToAUD) });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Edit Exchange Rate' : 'Add Exchange Rate'}</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Currency Code *</label>
              <input
                className="form-control"
                value={currencyCode}
                onChange={e => setCurrencyCode(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="USD"
                maxLength={3}
                required
                disabled={!!initial}
                autoFocus={!initial}
                style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2 }}
              />
            </div>
            <div className="form-group">
              <label>Currency Name</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="US Dollar" autoFocus={!!initial} />
            </div>
            <div className="form-group">
              <label>Rate to AUD *</label>
              <input
                className="form-control"
                type="number"
                step="0.0001"
                min="0.0001"
                value={rateToAUD}
                onChange={e => setRateToAUD(e.target.value)}
                placeholder="e.g. 1.55 means 1 USD = 1.55 AUD"
                required
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                How many AUD does 1 unit of this currency buy?
              </span>
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

// ─── Figure purchase cost matrix ─────────────────────────────────────────────

function FigureCostPanel() {
  const [manufacturers, setManufacturers] = useState([]);
  const [scales, setScales] = useState([]);
  const [figureTypes, setFigureTypes] = useState([]);
  const [costs, setCosts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [notesMap, setNotesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [addingMfrId, setAddingMfrId] = useState(null);
  const [addForm, setAddForm] = useState({ scaleId: '', figureTypeId: '', cost: '', currency: '' });
  const [quickAdd, setQuickAdd] = useState(null); // 'scale' | 'figureType' | 'currency'
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      getLookups('MANUFACTURER'),
      getLookups('SCALE'),
      getLookups('FIGURETYPE'),
      getFigureCosts(),
      getExchangeRates(),
      getManufacturerNotes(),
    ])
      .then(([m, s, f, c, rates, notes]) => {
        setManufacturers(m);
        setScales(s);
        setFigureTypes(f);
        setCosts(c);
        const sorted = [...rates].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
        setCurrencies(sorted);
        setAddForm(form => ({ ...form, currency: sorted[0]?.currencyCode || '' }));
        const map = {};
        notes.forEach(n => { map[n.manufacturerId] = n.notes || ''; });
        setNotesMap(map);
      })
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function getCostsForMfr(manufacturerId) {
    return costs.filter(c => c.manufacturerId === manufacturerId);
  }

  function getCost(manufacturerId, scaleId, figureTypeId) {
    return costs.find(c => c.manufacturerId === manufacturerId && c.scaleId === scaleId && c.figureTypeId === figureTypeId) || null;
  }

  function openAddForm(manufacturerId) {
    const existing = getCostsForMfr(manufacturerId);
    const last = existing[existing.length - 1];
    setAddingMfrId(manufacturerId);
    setAddForm({
      scaleId: last?.scaleId || '',
      figureTypeId: '',
      cost: '',
      currency: last?.currency || currencies[0]?.currencyCode || '',
    });
    setEditing(null);
  }

  async function handleSave(manufacturerId, scaleId, figureTypeId, cost, currency) {
    try {
      const updated = await upsertFigureCost({ manufacturerId, scaleId, figureTypeId, cost: parseFloat(cost), currency });
      setCosts(cs => {
        const idx = cs.findIndex(c => c.manufacturerId === manufacturerId && c.scaleId === scaleId && c.figureTypeId === figureTypeId);
        return idx === -1 ? [...cs, updated] : cs.map((c, i) => i === idx ? updated : c);
      });
      toast('Price saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setEditing(null); }
  }

  async function handleAddSave(manufacturerId) {
    const { scaleId, figureTypeId, cost, currency } = addForm;
    if (getCost(manufacturerId, scaleId, figureTypeId)) {
      toast('That scale / figure type combination already exists for this manufacturer', 'error');
      return;
    }
    try {
      const updated = await upsertFigureCost({ manufacturerId, scaleId, figureTypeId, cost: parseFloat(cost), currency });
      setCosts(cs => [...cs, updated]);
      setAddingMfrId(null);
      toast('Price added', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleDelete(manufacturerId, scaleId, figureTypeId) {
    try {
      await deleteFigureCost(manufacturerId, scaleId, figureTypeId);
      setCosts(cs => cs.filter(c => !(c.manufacturerId === manufacturerId && c.scaleId === scaleId && c.figureTypeId === figureTypeId)));
      toast('Price removed', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setEditing(null); }
  }

  async function handleNotesSave(manufacturerId) {
    const notes = notesMap[manufacturerId] ?? '';
    try {
      await upsertManufacturerNote({ manufacturerId, notes });
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleQuickAddScale(formData) {
    try {
      const created = await createLookup('SCALE', formData);
      setScales(s => [...s, created]);
      setAddForm(f => ({ ...f, scaleId: created.id }));
      setQuickAdd(null);
      toast('Scale added', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleQuickAddFigureType(formData) {
    try {
      const created = await createLookup('FIGURETYPE', formData);
      setFigureTypes(f => [...f, created]);
      setAddForm(f => ({ ...f, figureTypeId: created.id }));
      setQuickAdd(null);
      toast('Figure type added', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleQuickAddCurrency(formData) {
    try {
      const created = await upsertExchangeRate(formData);
      setCurrencies(cs => [...cs, created].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)));
      setAddForm(f => ({ ...f, currency: created.currencyCode }));
      setQuickAdd(null);
      toast('Currency added', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  const cellStyle = { padding: '3px 6px', fontSize: 13 };

  return (
    <>
      <div className="panel-header">
        <span className="panel-title">Figure Purchase Prices</span>
      </div>
      <div className="panel-body">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Add each scale and figure type that a manufacturer sells, with its purchase price. Currencies are restricted to those defined in Exchange Rates. For those figures that come in packs, work out the per figure price.
        </p>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : manufacturers.length === 0 ? (
          <div className="empty-state"><p>Add manufacturers in the Manufacturers lookup first.</p></div>
        ) : currencies.length === 0 ? (
          <div className="empty-state"><p>Add currencies in Exchange Rates first before entering figure prices.</p></div>
        ) : (
          manufacturers.map(mfr => {
            const mfrCosts = getCostsForMfr(mfr.id);
            const isAdding = addingMfrId === mfr.id;
            const canAdd = !!(addForm.scaleId && addForm.figureTypeId && addForm.cost && addForm.currency);
            return (
              <div key={mfr.id} className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <span className="card-title">{mfr.label}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => openAddForm(mfr.id)}>+ Add Price</button>
                </div>

                {(mfrCosts.length > 0 || isAdding) && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Scale</th>
                        <th>Figure Type</th>
                        <th>Price</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mfrCosts.map(entry => {
                        const key = `${mfr.id}|${entry.scaleId}|${entry.figureTypeId}`;
                        const scaleLbl = scales.find(s => s.id === entry.scaleId)?.label || entry.scaleId;
                        const ftLbl = figureTypes.find(f => f.id === entry.figureTypeId)?.label || entry.figureTypeId;
                        return (
                          <tr key={key}>
                            <td>{scaleLbl}</td>
                            <td>{ftLbl}</td>
                            <td>
                              {editing === key ? (
                                <InlineFigureCostInput
                                  initialCost={entry.cost}
                                  initialCurrency={entry.currency}
                                  currencies={currencies}
                                  onSave={(cost, currency) => handleSave(mfr.id, entry.scaleId, entry.figureTypeId, cost, currency)}
                                  onCancel={() => setEditing(null)}
                                />
                              ) : (
                                <span style={{ cursor: 'pointer' }} onClick={() => { setEditing(key); setAddingMfrId(null); }}>
                                  {entry.currency} {parseFloat(entry.cost).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td>
                              <button className="btn btn-icon btn-sm" onClick={() => handleDelete(mfr.id, entry.scaleId, entry.figureTypeId)}>🗑️</button>
                            </td>
                          </tr>
                        );
                      })}

                      {isAdding && (
                        <tr>
                          <td>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <select className="form-control" value={addForm.scaleId} onChange={e => setAddForm(f => ({ ...f, scaleId: e.target.value }))} style={cellStyle}>
                                <option value="">Scale…</option>
                                {scales.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                              <button type="button" className="btn btn-icon btn-sm" title="Add new scale" onClick={() => setQuickAdd('scale')}>+</button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <select className="form-control" value={addForm.figureTypeId} onChange={e => setAddForm(f => ({ ...f, figureTypeId: e.target.value }))} style={cellStyle}>
                                <option value="">Figure Type…</option>
                                {figureTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
                              </select>
                              <button type="button" className="btn btn-icon btn-sm" title="Add new figure type" onClick={() => setQuickAdd('figureType')}>+</button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input
                                type="text" inputMode="decimal"
                                className="form-control"
                                value={addForm.cost}
                                onChange={e => setAddForm(f => ({ ...f, cost: e.target.value }))}
                                style={{ width: 70, ...cellStyle }}
                                placeholder="0.00"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && canAdd) handleAddSave(mfr.id); if (e.key === 'Escape') setAddingMfrId(null); }}
                              />
                              <select className="form-control" value={addForm.currency} onChange={e => setAddForm(f => ({ ...f, currency: e.target.value }))} style={{ width: 80, ...cellStyle }}>
                                {currencies.map(r => <option key={r.currencyCode} value={r.currencyCode}>{r.currencyCode}</option>)}
                              </select>
                              <button type="button" className="btn btn-icon btn-sm" title="Add new currency" onClick={() => setQuickAdd('currency')}>+</button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-sm btn-primary" disabled={!canAdd} onClick={() => handleAddSave(mfr.id)}>✓</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => setAddingMfrId(null)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {mfrCosts.length === 0 && !isAdding && (
                  <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                    No prices defined yet. Click + Add Price to begin.
                  </div>
                )}

                <div style={{ padding: '6px 12px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Pricing notes</div>
                  <textarea
                    className="form-control"
                    value={notesMap[mfr.id] ?? ''}
                    onChange={e => setNotesMap(m => ({ ...m, [mfr.id]: e.target.value }))}
                    onBlur={() => handleNotesSave(mfr.id)}
                    style={{ width: '100%', minHeight: 60, fontSize: 13, resize: 'vertical' }}
                    placeholder="e.g. Free shipping over £50 · sold in packs of 4 · prices in GBP..."
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {quickAdd === 'scale' && (
        <LookupModal singularLabel="Scale" showAbbreviation={false} onSave={handleQuickAddScale} onClose={() => setQuickAdd(null)} />
      )}
      {quickAdd === 'figureType' && (
        <LookupModal singularLabel="Figure Type" onSave={handleQuickAddFigureType} onClose={() => setQuickAdd(null)} />
      )}
      {quickAdd === 'currency' && (
        <ExchangeRateModal onSave={handleQuickAddCurrency} onClose={() => setQuickAdd(null)} />
      )}
    </>
  );
}

function InlineFigureCostInput({ initialCost, initialCurrency, currencies, onSave, onCancel }) {
  const [cost, setCost] = useState(initialCost !== '' ? String(initialCost) : '');
  const [currency, setCurrency] = useState(initialCurrency || currencies[0]?.currencyCode || '');

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        className="form-control"
        type="text" inputMode="decimal"
        value={cost}
        onChange={e => setCost(e.target.value)}
        style={{ width: 70, padding: '3px 6px', fontSize: 13 }}
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') onSave(cost, currency); if (e.key === 'Escape') onCancel(); }}
      />
      <select
        className="form-control"
        value={currency}
        onChange={e => setCurrency(e.target.value)}
        style={{ width: 80, padding: '3px 6px', fontSize: 13 }}
      >
        {currencies.map(r => (
          <option key={r.currencyCode} value={r.currencyCode}>{r.currencyCode}</option>
        ))}
      </select>
      <button className="btn btn-sm btn-primary" onClick={() => onSave(cost, currency)} disabled={!cost || !currency}>✓</button>
      <button className="btn btn-sm btn-ghost" onClick={onCancel}>✕</button>
    </div>
  );
}

// ─── Shared inline cost input ────────────────────────────────────────────────

function InlineCostInput({ initial, onSave, onCancel }) {
  const [val, setVal] = useState(initial !== '' ? String(initial) : '');
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input
        className="form-control"
        type="number" step="0.01" min="0"
        value={val}
        onChange={e => setVal(e.target.value)}
        style={{ width: 72, padding: '3px 6px', fontSize: 13 }}
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel(); }}
      />
      <button className="btn btn-sm btn-primary" onClick={() => onSave(val)}>✓</button>
    </div>
  );
}
