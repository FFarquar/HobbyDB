import React, { useState, useEffect, useRef } from 'react';
import { getCollections, createCollection, updateCollection, deleteCollection } from '../../api/client.js';
import ImageGallery from '../ImageGallery.jsx';
import { ITEM_CATEGORIES } from '../../config.js';
import { useToast } from '../Toast.jsx';
import { useAuth } from '../../App.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';
import GroupsView from '../groups/GroupsView.jsx';

export default function CollectionsView() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getCollections();
      setCollections(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(formData) {
    try {
      if (editTarget) {
        const updated = await updateCollection(editTarget.id, formData);
        setCollections(cs => cs.map(c => c.id === editTarget.id ? updated : c));
        if (selectedCollection?.id === editTarget.id) setSelectedCollection(updated);
        toast('Collection updated', 'success');
      } else {
        const created = await createCollection(formData);
        setCollections(cs => [...cs, created]);
        toast('Collection created', 'success');
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleDelete() {
    try {
      await deleteCollection(deleteTarget.id);
      setCollections(cs => cs.filter(c => c.id !== deleteTarget.id));
      if (selectedCollection?.id === deleteTarget.id) setSelectedCollection(null);
      toast('Collection deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  if (selectedCollection) {
    return (
      <GroupsView
        collection={selectedCollection}
        onBack={() => setSelectedCollection(null)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span className="panel-title">Collections</span>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
            + New Collection
          </button>
        )}
      </div>

      <div className="panel-body">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : collections.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48 }}>📦</div>
            <p>No collections yet. Create one to get started.</p>
          </div>
        ) : (
          collections.map(col => (
            <div key={col.id} className="list-item" onClick={() => setSelectedCollection(col)}>
              <div className="list-item-content">
                <div className="list-item-title">{col.name}</div>
                <div className="list-item-subtitle" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <span className={`category-chip chip-${col.category}`}>{ITEM_CATEGORIES.find(c => c.value === col.category)?.label || col.category}</span>
                  {col.description && <span>{col.description}</span>}
                </div>
              </div>
              {isAdmin && (
                <div className="list-item-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-icon" title="Edit" onClick={() => { setEditTarget(col); setShowModal(true); }}>✏️</button>
                  <button className="btn btn-icon" title="Delete" onClick={() => setDeleteTarget(col)}>🗑️</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <CollectionModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Collection"
          message={`Delete "${deleteTarget.name}"? This does not automatically delete groups or items within it.`}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function CollectionModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || 'MINIATURE');
  const [description, setDescription] = useState(initial?.description || '');
  const [saving, setSaving] = useState(false);
  const galleryRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (galleryRef.current) await galleryRef.current.flush();
      await onSave({ name, category, description });
    } catch {
      // flush errors are toasted by ImageGallery; save errors by parent
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Edit Collection' : 'New Collection'}</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Name *</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select className="form-control" value={category} onChange={e => setCategory(e.target.value)} disabled={!!initial}>
                {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input className="form-control" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            {initial && (
              <div className="form-group">
                <ImageGallery ref={galleryRef} entityId={initial.id} />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

