import React, { useState, useEffect, createContext, useContext } from 'react';
import { ENVIRONMENT } from './config.js';
import LoginPage from './components/LoginPage.jsx';
import MainLayout from './components/MainLayout.jsx';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    const loginID = localStorage.getItem('userLoginID');
    if (token && role && loginID) setAuth({ token, role, loginID });
    setLoading(false);
  }, []);

  function handleLogin(authData) {
    localStorage.setItem('authToken', authData.token);
    localStorage.setItem('userRole', authData.role);
    localStorage.setItem('userLoginID', authData.loginID);
    setAuth(authData);
  }

  function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLoginID');
    setAuth(null);
  }

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
