import React, { useState, useEffect } from 'react';
import { getGroups, createGroup, updateGroup, deleteGroup } from '../../api/client.js';
import { useToast } from '../Toast.jsx';
import { useAuth } from '../../App.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';
import ItemsView from '../items/ItemsView.jsx';

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

  async function handleSave(formData) {
    try {
      if (editTarget) {
        const updated = await updateGroup(collection.id, editTarget.id, formData);
        setGroups(gs => gs.map(g => g.id === editTarget.id ? updated : g));
        if (selectedGroup?.id === editTarget.id) setSelectedGroup(updated);
        toast('Updated', 'success');
      } else {
        const created = await createGroup(collection.id, formData);
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

function GroupModal({ initial, groupLabel, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, description, notes });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? `Edit ${groupLabel}` : `New ${groupLabel}`}</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Name *</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input className="form-control" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} />
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
