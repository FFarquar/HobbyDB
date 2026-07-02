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

// Namespaced by ENVIRONMENT so staging and prod (served from the same
// GitHub Pages origin, different paths) don't clobber each other's auth in localStorage.
const AUTH_TOKEN_KEY = `authToken:${ENVIRONMENT}`;
const USER_ROLE_KEY = `userRole:${ENVIRONMENT}`;
const USER_LOGIN_ID_KEY = `userLoginID:${ENVIRONMENT}`;

function clearStoredAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_LOGIN_ID_KEY);
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const role = localStorage.getItem(USER_ROLE_KEY);
    const loginID = localStorage.getItem(USER_LOGIN_ID_KEY);
    if (token && role && loginID && !isTokenExpired(token)) {
      setAuth({ token, role, loginID });
    } else if (token) {
      clearStoredAuth();
    }
    setLoading(false);
  }, []);

  function handleLogin(authData) {
    localStorage.setItem(AUTH_TOKEN_KEY, authData.token);
    localStorage.setItem(USER_ROLE_KEY, authData.role);
    localStorage.setItem(USER_LOGIN_ID_KEY, authData.loginID);
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
