import React, { useState, useEffect } from 'react';
import { getItems, createItem, updateItem, deleteItem, getLookups } from '../../api/client.js';
import { ITEM_CATEGORIES } from '../../config.js';
import { useToast } from '../Toast.jsx';
import { useAuth } from '../../App.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';
import ItemModal from './ItemModal.jsx';

function buildLastItemTemplate(items, category) {
  if (!items.length || category !== 'MINIATURE') return null;
  const last = items[items.length - 1];
  return {
    scaleId: last.scaleId,
    scaleName: last.scaleName,
    manufacturerId: last.manufacturerId,
    manufacturerName: last.manufacturerName,
    nationalityId: last.nationalityId,
    nationalityName: last.nationalityName,
    paintQualityId: last.paintQualityId,
    paintQualityName: last.paintQualityName,
    baseSizeId: last.baseSizeId,
    baseSizeName: last.baseSizeName,
    baseMaterialId: last.baseMaterialId,
    baseMaterialName: last.baseMaterialName,
    quantity: 1,
  };
}

export default function ItemsView({ collection, group, onBack }) {
  const [items, setItems] = useState([]);
  const [scales, setScales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN';

  useEffect(() => { load(); }, [group.id]);

  async function load() {
    setLoading(true);
    try {
      const [data, scaleData] = await Promise.all([
        getItems(group.id),
        collection.category === 'MINIATURE' ? getLookups('SCALE') : Promise.resolve([]),
      ]);
      setItems(data);
      setScales(scaleData);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(formData) {
    try {
      if (editTarget) {
        const updated = await updateItem(group.id, editTarget.id, formData);
        setItems(is => is.map(i => i.id === editTarget.id ? updated : i));
        toast('Item updated', 'success');
      } else {
        const created = await createItem(group.id, { ...formData, collectionId: collection.id });
        setItems(is => [...is, created]);
        toast('Item added', 'success');
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleDelete() {
    try {
      await deleteItem(group.id, deleteTarget.id);
      setItems(is => is.filter(i => i.id !== deleteTarget.id));
      toast('Deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  const totalQty = items.reduce((s, i) => s + (i.quantity || 1), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <button className="btn btn-icon" onClick={onBack} title="Back">←</button>
        <div style={{ flex: 1 }}>
          <div className="panel-title">{group.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {collection.name} · {items.length} item{items.length !== 1 ? 's' : ''} · {totalQty} total
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
            + Add Item
          </button>
        )}
      </div>

      <div className="panel-body">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48 }}>🎲</div>
            <p>No items yet.</p>
          </div>
        ) : (
          items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              scales={scales}
              isAdmin={isAdmin}
              onEdit={() => { setEditTarget(item); setShowModal(true); }}
              onDelete={() => setDeleteTarget(item)}
            />
          ))
        )}
      </div>

      {showModal && (
        <ItemModal
          initial={editTarget}
          template={editTarget ? null : buildLastItemTemplate(items, collection.category)}
          collectionCategory={collection.category}
          groupId={group.id}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Item"
          message={`Delete "${deleteTarget.name}"?`}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function ItemCard({ item, scales, isAdmin, onEdit, onDelete }) {
  const categoryLabel = ITEM_CATEGORIES.find(c => c.value === item.category)?.label || item.category;

  return (
    <div className="card" style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>{item.name}</span>
          <span className={`category-chip chip-${item.category}`}>{categoryLabel}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>× {item.quantity || 1}</span>
        </div>

        {item.category === 'MINIATURE' && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {item.scaleName && <span>Scale: {item.scaleName}</span>}
            {item.manufacturerName && <span>Mfr: {item.manufacturerName}</span>}
            {item.figureTypeName && <span>Type: {item.figureTypeName}</span>}
            {item.paintQualityId && (() => {
              const scale = scales.find(s => s.id === item.scaleId);
              const name = scale?.qualityNames?.[parseInt(item.paintQualityId) - 1] ?? item.paintQualityName;
              return name ? <span>Paint: {name}</span> : null;
            })()}
            {item.numberBases > 0 && <span>Bases: {item.numberBases}</span>}
          </div>
        )}
        {item.category === 'BOARDGAME' && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {item.publisher && <span>Publisher: {item.publisher}</span>}
            {item.minPlayers && <span>Players: {item.minPlayers}{item.maxPlayers !== item.minPlayers ? `–${item.maxPlayers}` : ''}</span>}
            {item.playTimeMinutes && <span>Time: {item.playTimeMinutes} min</span>}
          </div>
        )}
        {item.category === 'BOOK' && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {item.author && <span>Author: {item.author}</span>}
            {item.isbn && <span>ISBN: {item.isbn}</span>}
            {item.publishYear && <span>{item.publishYear}</span>}
          </div>
        )}
        {item.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{item.notes}</div>}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="btn btn-icon" onClick={onEdit}>✏️</button>
          <button className="btn btn-icon" onClick={onDelete}>🗑️</button>
        </div>
      )}
    </div>
  );
}
