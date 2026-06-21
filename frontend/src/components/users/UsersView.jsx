import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/client.js';
import { useToast } from '../Toast.jsx';
import { useAuth } from '../../App.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();
  const { auth } = useAuth();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setUsers(await getUsers()); }
    catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSave(formData) {
    try {
      if (editTarget) {
        const updated = await updateUser(editTarget.loginID, formData);
        setUsers(us => us.map(u => u.loginID === editTarget.loginID ? { ...u, ...updated } : u));
        toast('User updated', 'success');
      } else {
        const created = await createUser(formData);
        setUsers(us => [...us, created]);
        toast('User created', 'success');
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleDelete() {
    try {
      await deleteUser(deleteTarget.loginID);
      setUsers(us => us.filter(u => u.loginID !== deleteTarget.loginID));
      toast('Deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span className="panel-title">Users</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>+ New User</button>
      </div>
      <div className="panel-body">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Login ID</th><th>Display Name</th><th>Role</th><th>Active</th><th style={{ width: 80 }}></th></tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.loginID}>
                  <td style={{ fontWeight: 500 }}>{user.loginID} {user.loginID === auth?.loginID && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(you)</span>}</td>
                  <td>{user.displayName || '—'}</td>
                  <td><span style={{ fontSize: 12, background: user.role === 'ADMIN' ? 'var(--accent2)' : 'var(--bg3)', padding: '2px 8px', borderRadius: 12 }}>{user.role}</span></td>
                  <td style={{ color: user.active ? 'var(--success)' : 'var(--danger)' }}>{user.active ? '✓ Active' : '✗ Inactive'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-icon btn-sm" onClick={() => { setEditTarget(user); setShowModal(true); }}>✏️</button>
                      {user.loginID !== auth?.loginID && (
                        <button className="btn btn-icon btn-sm" onClick={() => setDeleteTarget(user)}>🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <UserModal initial={editTarget} onSave={handleSave} onClose={() => { setShowModal(false); setEditTarget(null); }} />}
      {deleteTarget && (
        <ConfirmDialog title="Delete User" message={`Delete user "${deleteTarget.loginID}"?`} danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

function UserModal({ initial, onSave, onClose }) {
  const [loginID, setLoginID] = useState(initial?.loginID || '');
  const [displayName, setDisplayName] = useState(initial?.displayName || '');
  const [role, setRole] = useState(initial?.role || 'USER');
  const [active, setActive] = useState(initial?.active ?? true);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const data = { displayName, role, active };
    if (!initial) { data.loginID = loginID; data.password = password; }
    else if (password) { data.password = password; }
    await onSave(data);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Edit User' : 'New User'}</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Login ID *</label>
              <input className="form-control" value={loginID} onChange={e => setLoginID(e.target.value)} required disabled={!!initial} autoFocus={!initial} />
            </div>
            <div className="form-group">
              <label>Display Name</label>
              <input className="form-control" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>{initial ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
              <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)} required={!initial} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Role</label>
                <select className="form-control" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Active</label>
                <select className="form-control" value={active ? 'true' : 'false'} onChange={e => setActive(e.target.value === 'true')}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
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
