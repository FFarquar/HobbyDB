import React, { useState, useEffect, useRef } from 'react';
import { getGroups, createGroup, updateGroup, deleteGroup, uploadImage, getLookups, createLookup, getExchangeRates } from '../../api/client.js';
import { useToast } from '../Toast.jsx';
import { useAuth } from '../../App.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';
import ItemsView from '../items/ItemsView.jsx';
import ImageGallery from '../ImageGallery.jsx';

export default function GroupsView({ collection, onBack }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN';

  useEffect(() => { load(); }, [collection.id]);

  async function load() {
    setLoading(true);
    try {
      const data = await getGroups(collection.id);
      setGroups(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(formData, pendingFiles = []) {
    try {
      if (editTarget) {
        const updated = await updateGroup(collection.id, editTarget.id, formData);
        setGroups(gs => gs.map(g => g.id === editTarget.id ? updated : g));
        if (selectedGroup?.id === editTarget.id) setSelectedGroup(updated);
        toast('Updated', 'success');
      } else {
        const created = await createGroup(collection.id, formData);
        for (const { file } of pendingFiles) {
          await uploadImage(file, created.id);
        }
        setGroups(gs => [...gs, created]);
        toast('Created', 'success');
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleDelete() {
    try {
      await deleteGroup(collection.id, deleteTarget.id);
      setGroups(gs => gs.filter(g => g.id !== deleteTarget.id));
      if (selectedGroup?.id === deleteTarget.id) setSelectedGroup(null);
      toast('Deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  if (selectedGroup) {
    return (
      <ItemsView
        collection={collection}
        group={selectedGroup}
        onBack={() => setSelectedGroup(null)}
      />
    );
  }

  const groupLabel = collection.category === 'MINIATURE' ? 'Army' :
    collection.category === 'BOARDGAME' ? 'Game' :
    collection.category === 'BOOK' ? 'Series' : 'Group';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <button className="btn btn-icon" onClick={onBack} title="Back">←</button>
        <div style={{ flex: 1 }}>
          <div className="panel-title">{collection.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{groupLabel}s ({groups.length})</div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
            + New {groupLabel}
          </button>
        )}
      </div>

      <div className="panel-body">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48 }}>🗂️</div>
            <p>No {groupLabel.toLowerCase()}s yet.</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="list-item" onClick={() => setSelectedGroup(group)}>
              <div className="list-item-content">
                <div className="list-item-title">{group.name}</div>
                {(group.scaleName || group.periodName || group.nationalityName) && (
                  <div className="list-item-subtitle">
                    {[group.scaleName, group.periodName, group.nationalityName].filter(Boolean).join(' · ')}
                  </div>
                )}
                {group.description && <div className="list-item-subtitle">{group.description}</div>}
                {group.notes && <div className="list-item-subtitle" style={{ fontStyle: 'italic' }}>{group.notes}</div>}
              </div>
              {isAdmin && (
                <div className="list-item-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-icon" onClick={() => { setEditTarget(group); setShowModal(true); }}>✏️</button>
                  <button className="btn btn-icon" onClick={() => setDeleteTarget(group)}>🗑️</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <GroupModal
          initial={editTarget}
          groupLabel={groupLabel}
          category={collection.category}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${groupLabel}`}
          message={`Delete "${deleteTarget.name}"?`}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

const deleteBtnStyle = {
  position: 'absolute', top: 3, right: 3,
  background: 'rgba(0,0,0,0.65)', color: '#fff',
  border: 'none', borderRadius: '50%',
  width: 20, height: 20, padding: 0,
  cursor: 'pointer', fontSize: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function GroupModal({ initial, groupLabel, category, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [scaleId, setScaleId] = useState(initial?.scaleId || '');
  const [periodId, setPeriodId] = useState(initial?.periodId || '');
  const [nationalityId, setNationalityId] = useState(initial?.nationalityId || '');
  const [postageInboundAmt, setPostageInboundAmt] = useState(initial?.postageInboundAmt ?? '');
  const [postageInboundCurrency, setPostageInboundCurrency] = useState(initial?.postageInboundCurrency || 'AUD');
  const [postageReturnAmt, setPostageReturnAmt] = useState(initial?.postageReturnAmt ?? '');
  const [postageReturnCurrency, setPostageReturnCurrency] = useState(initial?.postageReturnCurrency || 'AUD');
  const [scales, setScales] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [showAddScale, setShowAddScale] = useState(false);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [showAddNationality, setShowAddNationality] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const galleryRef = useRef(null);
  const fileRef = useRef(null);

  const isMiniature = category === 'MINIATURE';

  const autoName = isMiniature
    ? [
        scales.find(s => s.id === scaleId)?.label,
        periods.find(p => p.id === periodId)?.label,
        nationalities.find(n => n.id === nationalityId)?.label,
      ].filter(Boolean).join(' - ')
    : name;

  useEffect(() => {
    if (!isMiniature) return;
    getLookups('SCALE').then(setScales).catch(() => {});
    getLookups('PERIOD').then(setPeriods).catch(() => {});
    getLookups('NATIONALITY').then(setNationalities).catch(() => {});
    getExchangeRates().then(setExchangeRates).catch(() => {});
  }, [isMiniature]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (galleryRef.current) await galleryRef.current.flush();
      const selectedScale = scales.find(s => s.id === scaleId);
      const selectedPeriod = periods.find(p => p.id === periodId);
      const selectedNationality = nationalities.find(n => n.id === nationalityId);
      await onSave({
        name: autoName, description, notes,
        scaleId: scaleId || null,
        scaleName: selectedScale?.label || '',
        periodId: periodId || null,
        periodName: selectedPeriod?.label || '',
        nationalityId: nationalityId || null,
        nationalityName: selectedNationality?.label || '',
        postageInboundAmt: postageInboundAmt !== '' ? parseFloat(postageInboundAmt) : null,
        postageInboundCurrency,
        postageReturnAmt: postageReturnAmt !== '' ? parseFloat(postageReturnAmt) : null,
        postageReturnCurrency,
      }, pendingFiles);
    } catch {
      // flush errors are toasted by ImageGallery; save errors by parent
    } finally {
      setSaving(false);
    }
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setPendingFiles(prev => [...prev, ...files.map(file => ({ file, previewUrl: URL.createObjectURL(file) }))]);
    e.target.value = '';
  }

  function removePending(index) {
    setPendingFiles(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? `Edit ${groupLabel}` : `New ${groupLabel}`}</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {isMiniature && (
              <>
                <div className="form-group">
                  <label>Scale</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select className="form-control" value={scaleId} onChange={e => setScaleId(e.target.value)}>
                      <option value="">— select —</option>
                      {scales.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button type="button" className="btn btn-icon" title="Add new Scale"
                      style={{ flexShrink: 0, fontSize: 18, lineHeight: 1 }}
                      onClick={() => setShowAddScale(true)}>+</button>
                  </div>
                  {showAddScale && (
                    <QuickAddModal
                      type="SCALE"
                      label="Scale"
                      onSave={newItem => { setScales(prev => [...prev, newItem].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))); setScaleId(newItem.id); setShowAddScale(false); }}
                      onClose={() => setShowAddScale(false)}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>Historical Period</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select className="form-control" value={periodId} onChange={e => setPeriodId(e.target.value)}>
                      <option value="">— select —</option>
                      {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <button type="button" className="btn btn-icon" title="Add new Period"
                      style={{ flexShrink: 0, fontSize: 18, lineHeight: 1 }}
                      onClick={() => setShowAddPeriod(true)}>+</button>
                  </div>
                  {showAddPeriod && (
                    <QuickAddModal
                      type="PERIOD"
                      label="Historical Period"
                      onSave={newItem => { setPeriods(prev => [...prev, newItem].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))); setPeriodId(newItem.id); setShowAddPeriod(false); }}
                      onClose={() => setShowAddPeriod(false)}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select className="form-control" value={nationalityId} onChange={e => setNationalityId(e.target.value)}>
                      <option value="">— select —</option>
                      {nationalities.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </select>
                    <button type="button" className="btn btn-icon" title="Add new Country"
                      style={{ flexShrink: 0, fontSize: 18, lineHeight: 1 }}
                      onClick={() => setShowAddNationality(true)}>+</button>
                  </div>
                  {showAddNationality && (
                    <QuickAddModal
                      type="NATIONALITY"
                      label="Country"
                      onSave={newItem => { setNationalities(prev => [...prev, newItem].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))); setNationalityId(newItem.id); setShowAddNationality(false); }}
                      onClose={() => setShowAddNationality(false)}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>Postage — Manufacturer to Australia</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={postageInboundAmt}
                      onChange={e => setPostageInboundAmt(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <select
                      className="form-control"
                      style={{ width: 80 }}
                      value={postageInboundCurrency}
                      onChange={e => setPostageInboundCurrency(e.target.value)}
                    >
                      <option value="AUD">AUD</option>
                      {exchangeRates.filter(r => r.currencyCode !== 'AUD').map(r => (
                        <option key={r.currencyCode} value={r.currencyCode}>{r.currencyCode}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Return Postage &amp; Handling — Sri Lanka</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={postageReturnAmt}
                      onChange={e => setPostageReturnAmt(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <select
                      className="form-control"
                      style={{ width: 80 }}
                      value={postageReturnCurrency}
                      onChange={e => setPostageReturnCurrency(e.target.value)}
                    >
                      <option value="AUD">AUD</option>
                      {exchangeRates.filter(r => r.currencyCode !== 'AUD').map(r => (
                        <option key={r.currencyCode} value={r.currencyCode}>{r.currencyCode}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            <div className="form-group">
              <label>Name *</label>
              <input
                className="form-control"
                value={isMiniature ? autoName : name}
                onChange={isMiniature ? undefined : e => setName(e.target.value)}
                disabled={isMiniature}
                required={!isMiniature}
                autoFocus={!isMiniature}
                placeholder={isMiniature ? 'Auto-generated from Scale, Period and Country' : ''}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input className="form-control" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            {initial ? (
              <div className="form-group">
                <ImageGallery ref={galleryRef} entityId={initial.id} />
              </div>
            ) : (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontWeight: 500, margin: 0 }}>Photos</label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                    + Add Photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
                </div>
                {pendingFiles.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No photos yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {pendingFiles.map((p, i) => (
                      <div key={i} style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
                        <img src={p.previewUrl} alt={p.file.name} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                        <button type="button" onClick={() => removePending(i)} style={deleteBtnStyle} title="Remove">✕</button>
                      </div>
                    ))}
                  </div>
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

function QuickAddModal({ type, label, onSave, onClose }) {
  const [itemLabel, setItemLabel] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
