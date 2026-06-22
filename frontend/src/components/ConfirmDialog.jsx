import React from 'react';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger = false }) {
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title || 'Confirm'}</span>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
