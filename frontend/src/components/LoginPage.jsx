import React, { useState } from 'react';
import { login } from '../api/client.js';
import { USE_MOCK } from '../config.js';

export default function LoginPage({ onLogin }) {
  const [loginID, setLoginID] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(loginID, password);
      onLogin({ token: data.token || data.accessToken, role: data.role, loginID });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--accent)' }}>HobbyDB</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Track your collection</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="loginID">Username</label>
              <input
                id="loginID"
                className="form-control"
                type="text"
                value={loginID}
                onChange={e => setLoginID(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="form-control"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '14px', textAlign: 'center' }}>{error}</p>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…</> : 'Sign In'}
            </button>
          </form>
        </div>

        {USE_MOCK && (
          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Mock mode — use <strong>admin / password</strong>
          </p>
        )}
      </div>
    </div>
  );
}
