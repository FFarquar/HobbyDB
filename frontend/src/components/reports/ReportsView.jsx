import React, { useState, useEffect } from 'react';
import { getReport } from '../../api/client.js';
import { useToast } from '../Toast.jsx';

const REPORTS = [
  { key: 'inventory-summary',  label: '📋 Inventory Summary',     desc: 'Total counts by hobby category' },
  { key: 'figures-by-scale',   label: '📐 Figures by Scale',       desc: 'How many miniatures per scale' },
  { key: 'figures-by-period',  label: '🗓 Figures by Period',       desc: 'How many miniatures per historical period' },
  { key: 'collection-value',   label: '💵 Collection Value',        desc: 'Estimated USD value by collection (painting + basing)' },
];

export default function ReportsView() {
  const [activeReport, setActiveReport] = useState('inventory-summary');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => { runReport(activeReport); }, [activeReport]);

  async function runReport(key) {
    setLoading(true);
    setData(null);
    try {
      const result = await getReport(key);
      setData(result);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Report selector */}
      <div style={{ width: 200, background: 'var(--bg2)', borderRight: '1px solid var(--border)', flexShrink: 0, padding: '12px 0' }}>
        {REPORTS.map(r => (
          <div
            key={r.key}
            style={{
              padding: '10px 14px', cursor: 'pointer', fontSize: 13,
              borderLeft: `3px solid ${activeReport === r.key ? 'var(--accent)' : 'transparent'}`,
              background: activeReport === r.key ? 'rgba(233,69,96,0.08)' : 'transparent',
              color: activeReport === r.key ? 'var(--text)' : 'var(--text-muted)',
            }}
            onClick={() => setActiveReport(r.key)}
          >
            <div>{r.label}</div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-header">
          <span className="panel-title">{REPORTS.find(r => r.key === activeReport)?.label}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => runReport(activeReport)}>↻ Refresh</button>
        </div>
        <div className="panel-body">
          {loading && <div className="loading-center"><div className="spinner" /></div>}
          {!loading && data && <ReportResult data={data} />}
        </div>
      </div>
    </div>
  );
}

function ReportResult({ data }) {
  if (data.reportType === 'inventory-summary') {
    return (
      <>
        <div className="stats-row" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-value">{data.totalItems}</div><div className="stat-label">Item Lines</div></div>
          <div className="stat-card"><div className="stat-value">{data.totalQuantity}</div><div className="stat-label">Total Qty</div></div>
        </div>
        <table className="data-table">
          <thead><tr><th>Category</th><th>Item Lines</th><th>Total Qty</th></tr></thead>
          <tbody>
            {(data.categories || []).map(c => (
              <tr key={c.category}>
                <td>{c.category}</td>
                <td>{c.itemCount}</td>
                <td>{c.totalQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  if (data.reportType === 'figures-by-scale' || data.reportType === 'figures-by-period') {
    const rowKey = data.reportType === 'figures-by-scale' ? 'scale' : 'period';
    return (
      <>
        <div className="stats-row" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-value">{data.totalFigures}</div><div className="stat-label">Total Figures</div></div>
        </div>
        <table className="data-table">
          <thead><tr><th style={{ textTransform: 'capitalize' }}>{rowKey}</th><th>Count</th></tr></thead>
          <tbody>
            {(data.rows || []).map((r, i) => (
              <tr key={i}><td>{r[rowKey]}</td><td>{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  if (data.reportType === 'collection-value') {
    const total = (data.collections || []).reduce((s, c) => s + (c.totalValueUSD || 0), 0);
    return (
      <>
        <div className="stats-row" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-value">${total.toFixed(0)}</div><div className="stat-label">Total USD Value</div></div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Based on commercial painting rates + basing costs. Requires paint quality and basing to be set on items and cost rates to be configured.
        </p>
        <table className="data-table">
          <thead><tr><th>Collection</th><th>Items</th><th>Est. Value (USD)</th></tr></thead>
          <tbody>
            {(data.collections || []).map(c => (
              <tr key={c.collectionId}>
                <td>{c.collectionId}</td>
                <td>{c.items}</td>
                <td>${(c.totalValueUSD || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return <pre style={{ fontSize: 12, color: 'var(--text-muted)' }}>{JSON.stringify(data, null, 2)}</pre>;
}
