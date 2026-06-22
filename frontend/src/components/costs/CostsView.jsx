import React, { useState, useEffect } from 'react';
import { getLookups, getPaintCosts, upsertPaintCost, getBasingCosts, upsertBasingCost } from '../../api/client.js';
import { PAINT_QUALITY_LABELS } from '../../config.js';
import { useToast } from '../Toast.jsx';

export default function CostsView() {
  const [tab, setTab] = useState('paint');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span className="panel-title">Cost Rates</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${tab === 'paint' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('paint')}>Painting</button>
          <button className={`btn btn-sm ${tab === 'basing' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('basing')}>Basing</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'paint' ? <PaintCostsTab /> : <BasingCostsTab />}
      </div>
    </div>
  );
}

function PaintCostsTab() {
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

  async function handleSave(scaleId, figureTypeId, qualityId, costUSD) {
    try {
      const updated = await upsertPaintCost({ scaleId, figureTypeId, qualityId, costUSD: parseFloat(costUSD) });
      setCosts(cs => {
        const idx = cs.findIndex(c => c.scaleId === scaleId && c.figureTypeId === figureTypeId && c.qualityId === qualityId);
        return idx === -1 ? [...cs, updated] : cs.map((c, i) => i === idx ? updated : c);
      });
      toast('Rate saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setEditing(null);
    }
  }

  const qualityKeys = Object.keys(PAINT_QUALITY_LABELS);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="panel-body">
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
        Commercial painting rates in USD per figure. Matrix: Scale × Figure Type × Paint Quality.
      </p>
      {scales.map(scale => (
        <div key={scale.id} className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <span className="card-title">{scale.label}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 400 }}>
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
                      const isEditing = editing === key;
                      const val = getCost(scale.id, ft.id, q);
                      return (
                        <td key={q}>
                          {isEditing ? (
                            <CostInput
                              initial={val}
                              onSave={v => handleSave(scale.id, ft.id, q, v)}
                              onCancel={() => setEditing(null)}
                            />
                          ) : (
                            <span style={{ cursor: 'pointer', color: val ? 'var(--text)' : 'var(--text-muted)' }} onClick={() => setEditing(key)}>
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
      ))}
      {scales.length === 0 && <div className="empty-state"><p>Add scales in Reference Data first.</p></div>}
    </div>
  );
}

function BasingCostsTab() {
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

  async function handleSave(materialId, sizeId, costAUD) {
    try {
      const updated = await upsertBasingCost({ materialId, sizeId, costAUD: parseFloat(costAUD) });
      setCosts(cs => {
        const idx = cs.findIndex(c => c.materialId === materialId && c.sizeId === sizeId);
        return idx === -1 ? [...cs, updated] : cs.map((c, i) => i === idx ? updated : c);
      });
      toast('Rate saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setEditing(null);
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="panel-body">
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
        Basing cost in AUD per base. Matrix: Base Material × Base Size.
      </p>
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
                    const isEditing = editing === key;
                    const val = getCost(mat.id, sz.id);
                    return (
                      <td key={sz.id}>
                        {isEditing ? (
                          <CostInput initial={val} onSave={v => handleSave(mat.id, sz.id, v)} onCancel={() => setEditing(null)} />
                        ) : (
                          <span style={{ cursor: 'pointer', color: val ? 'var(--text)' : 'var(--text-muted)' }} onClick={() => setEditing(key)}>
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
      {materials.length === 0 && <div className="empty-state"><p>Add base materials and sizes in Reference Data first.</p></div>}
    </div>
  );
}

function CostInput({ initial, onSave, onCancel }) {
  const [val, setVal] = useState(initial !== '' ? String(initial) : '');
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input
        className="form-control"
        type="number" step="0.01" min="0"
        value={val}
        onChange={e => setVal(e.target.value)}
        style={{ width: 70, padding: '3px 6px', fontSize: 13 }}
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel(); }}
      />
      <button className="btn btn-sm btn-primary" onClick={() => onSave(val)}>✓</button>
    </div>
  );
}
