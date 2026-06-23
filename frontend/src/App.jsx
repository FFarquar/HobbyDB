import React, { useState, useEffect, createContext, useContext } from 'react';
import { ENVIRONMENT } from './config.js';
import { setUnauthorizedHandler } from './api/client.js';
import LoginPage from './components/LoginPage.jsx';
import MainLayout from './components/MainLayout.jsx';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function isTokenExpired(token) {
  try {
    const parts = token.split('.');
    // Real JWT has 3 parts; mock token is plain base64 JSON
    const raw = parts.length === 3
      ? parts[1].replace(/-/g, '+').replace(/_/g, '/')
      : token;
    const payload = JSON.parse(atob(raw));
    if (!payload.exp) return false;
    // Real JWT exp is in seconds; mock exp is in milliseconds
    const expMs = payload.exp > 1e10 ? payload.exp : payload.exp * 1000;
    return expMs <= Date.now();
  } catch {
    return true;
  }
}

function clearStoredAuth() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userLoginID');
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    const loginID = localStorage.getItem('userLoginID');
    if (token && role && loginID && !isTokenExpired(token)) {
      setAuth({ token, role, loginID });
    } else if (token) {
      clearStoredAuth();
    }
    setLoading(false);
  }, []);

  function handleLogin(authData) {
    localStorage.setItem('authToken', authData.token);
    localStorage.setItem('userRole', authData.role);
    localStorage.setItem('userLoginID', authData.loginID);
    setAuth(authData);
  }

  function handleLogout() {
    clearStoredAuth();
    setAuth(null);
  }

  useEffect(() => {
    setUnauthorizedHandler(handleLogout);
  }, []);

  if (loading) return <div className="app-loading">Loading…</div>;

  return (
    <AuthContext.Provider value={{ auth, handleLogout }}>
      {ENVIRONMENT !== 'prod' && (
        <div className="env-badge">{ENVIRONMENT.toUpperCase()}</div>
      )}
      {auth ? <MainLayout /> : <LoginPage onLogin={handleLogin} />}
    </AuthContext.Provider>
  );
}
