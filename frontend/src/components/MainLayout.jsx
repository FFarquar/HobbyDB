import React, { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '../App.jsx';
import { ToastProvider } from './Toast.jsx';
import CollectionsView from './collections/CollectionsView.jsx';
import ReportsView from './reports/ReportsView.jsx';
import LookupsView from './lookups/LookupsView.jsx';
import UsersView from './users/UsersView.jsx';
import { ROLES } from '../config.js';

export const NavigationContext = createContext(null);
export function useNavigate() { return useContext(NavigationContext); }

const NAV = [
  { key: 'collections', label: '📦 Collections' },
  { key: 'reports',     label: '📊 Reports' },
  { key: 'lookups',     label: '🔖 Reference Data', adminOnly: true },
  { key: 'users',       label: '👤 Users', adminOnly: true },
];

export default function MainLayout() {
  const { auth, handleLogout } = useAuth();
  const [activeView, setActiveView] = useState('collections');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.history.pushState({ hobbydb: true }, '');
    function handlePopState() {
      window.history.pushState({ hobbydb: true }, '');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const isAdmin = auth?.role === ROLES.ADMIN;

  const navItems = NAV.filter(n => !n.adminOnly || isAdmin);

  function navigate(key) {
    setActiveView(key);
    setMobileOpen(false);
  }

  return (
    <NavigationContext.Provider value={{ navigate }}>
    <ToastProvider>
      <div className="app-layout">
        {/* Sidebar */}
        <nav className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
          <div className="sidebar-logo">HobbyDB</div>
          <div className="sidebar-nav">
            {navItems.map(n => (
              <div
                key={n.key}
                className={`nav-item${activeView === n.key ? ' active' : ''}`}
                onClick={() => navigate(n.key)}
              >
                {n.label}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <div className="sidebar-user">{auth?.loginID} · {auth?.role}</div>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={handleLogout}>Sign Out</button>
          </div>
        </nav>

        {/* Main */}
        <div className="main-content">
          {/* Mobile top bar */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }} className="mobile-topbar">
            <button className="btn btn-icon mobile-nav-toggle" onClick={() => setMobileOpen(o => !o)}>☰</button>
            <span style={{ fontWeight: 600, marginLeft: 8 }}>HobbyDB</span>
          </div>

          {/* View */}
          {activeView === 'collections' && <CollectionsView />}
          {activeView === 'reports'     && <ReportsView />}
          {activeView === 'lookups'     && <LookupsView />}
          {activeView === 'users'       && <UsersView />}
        </div>

        {/* Mobile sidebar backdrop */}
        {mobileOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 499 }} onClick={() => setMobileOpen(false)} />
        )}
      </div>
    </ToastProvider>
    </NavigationContext.Provider>
  );
}
