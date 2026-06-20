import React, { useState, useEffect } from 'react';
import {
  getLookups, createLookup, updateLookup, deleteLookup,
  getPaintCosts, upsertPaintCost,
  getBasingCosts, upsertBasingCost,
  getExchangeRates, upsertExchangeRate, deleteExchangeRate,
} from '../../api/client.js';
import { PAINT_QUALITY_LABELS } from '../../config.js';
import { useToast } from '../Toast.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';

// ─── Sidebar structure ───────────────────────────────────────────────────────

const SIDEBAR = [
  {
    heading: 'Lookup Lists',
    items: [
      { key: 'SCALE',        label: 'Scales',          hint: 'e.g. 6mm, 10mm, 15mm, 25mm' },
      { key: 'MANUFACTURER', label: 'Manufacturers',   hint: 'e.g. AB Miniatures, Essex, Baccus' },
      { key: 'FIGURETYPE',   label: 'Figure Types',    hint: 'e.g. Infantry, Cavalry, Tank, Gun' },
      { key: 'NATIONALITY',  label: 'Nationalities',   hint: 'e.g. Roman, French, German' },
      { key: 'PERIOD',       label: 'Periods',         hint: 'e.g. Ancient, Napoleonic, WWII' },
      { key: 'RULES',        label: 'Rules Sets',      hint: 'e.g. DBM, FOG, Chain of Command' },
      { key: 'BASESIZE',     label: 'Base Sizes',      hint: 'e.g. 40×40mm, 60×30mm' },
      { key: 'BASEMATERIAL', label: 'Base Materials',  hint: 'e.g. Metal, MDF, Plastic' },
      { key: 'PAINTQUALITY', label: 'Paint Quality',   hint: 'Labels for each paint level' },
    ],
  },
  {
    heading: 'Rate Tables',
    items: [
      { key: '__PAINTING',  label: 'Painting Rates',  hint: 'Commercial painting cost per figure (USD) — Scale × Figure Type × Quality' },
      { key: '__BASING',    label: 'Basing Rates',    hint: 'Cost per base (USD) — Base Material × Base Size' },
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
            <thead><tr><th>Label</th><th>Abbr.</th><th>Order</th><th style={{ width: 80 }}></th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.abbreviation || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.sortOrder ?? '—'}</td>
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
        <LookupModal initial={editTarget} singularLabel={singularLabel} onSave={handleSave} onClose={() => { setShowModal(false); setEditTarget(null); }} />
      )}
      {deleteTarget && (
        <ConfirmDialog title={`Delete ${singularLabel}`} message={`Delete "${deleteTarget.label}"?`} danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
}

function LookupModal({ initial, singularLabel, onSave, onClose }) {
  const [label, setLabel] = useState(initial?.label || '');
  const [abbreviation, setAbbreviation] = useState(initial?.abbreviation || '');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave({ label, abbreviation, sortOrder: parseInt(sortOrder) || 0 });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
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
            <div className="form-group">
              <label>Abbreviation</label>
              <input className="form-control" value={abbreviation} onChange={e => setAbbreviation(e.target.value)} placeholder="Optional short form" />
            </div>
            <div className="form-group">
              <label>Sort Order</label>
              <input className="form-control" type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
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

// ─── Painting rates matrix ───────────────────────────────────────────────────

function PaintingRatesPanel() {
  const [scales, setScales] = useState([]);
  const [figureTypes, setFigureTypes] = useState([]);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  useEffect(() => {
    Promise.all([getLookups('SCALE'), getLookups('FIGURETYPE'), getPaintCosts()])
      .then(([s, f, c]) => { setScales(s); setFigureTypes(f); setCosts(c); })
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

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

  const qualityKeys = Object.keys(PAINT_QUALITY_LABELS);

  return (
    <>
      <div className="panel-header">
        <span className="panel-title">Painting Rates</span>
      </div>
      <div className="panel-body">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Commercial painting rate in USD per figure. Click any cell to edit. Matrix: Scale × Figure Type × Paint Level.
        </p>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : scales.length === 0 ? (
          <div className="empty-state"><p>Add scales in Scales first.</p></div>
        ) : (
          scales.map(scale => (
            <div key={scale.id} className="card" style={{ marginBottom: 0 }}>
              <div className="card-header"><span className="card-title">{scale.label}</span></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: 360 }}>
                  <thead>
                    <tr>
                      <th>Figure Type</th>
                      {qualityKeys.map(q => <th key={q}>Level {q}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {figureTypes.map(ft => (
                      <tr key={ft.id}>
                        <td>{ft.label}</td>
                        {qualityKeys.map(q => {
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
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
    return costs.find(c => c.materialId === materialId && c.sizeId === sizeId)?.costUSD ?? '';
  }

  async function handleSave(materialId, sizeId, val) {
    try {
      const updated = await upsertBasingCost({ materialId, sizeId, costUSD: parseFloat(val) });
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
          Cost per base in USD. Click any cell to edit. Matrix: Base Material × Base Size.
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
    <div className="modal-overlay" onClick={onClose}>
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
