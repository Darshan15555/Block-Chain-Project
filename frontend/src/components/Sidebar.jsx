import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import BlockFundLogo from './BlockFundLogo';

const NAV_ICONS = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  create: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  projects: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  myprojects: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  ),
  release: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="16" y1="15" x2="18" y2="15" />
    </svg>
  ),
  contractors: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  update: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  verify: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  blockchain: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="8" height="8" rx="2" />
      <rect x="14" y="7" width="8" height="8" rx="2" />
      <path d="M10 11h4" />
      <path d="M6 15v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  profile: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

const NAV = {
  authority: [
    { id: 'dashboard', label: 'Treasury Dashboard' },
    { id: 'create', label: 'Create Project' },
    { id: 'projects', label: 'All Projects' },
    { id: 'release', label: 'Release Funds' },
    { id: 'contractors', label: 'Contractors' },
    { id: 'blockchain', label: 'Ledger Audit' },
    { id: 'profile', label: 'My Profile' },
  ],
  contractor: [
    { id: 'dashboard', label: 'Contractor Hub' },
    { id: 'myprojects', label: 'Assigned Projects' },
    { id: 'update', label: 'Submit Work Update' },
    { id: 'blockchain', label: 'Ledger Audit' },
    { id: 'profile', label: 'My Profile' },
  ],
  public: [
    { id: 'dashboard', label: 'Transparency Hub' },
    { id: 'projects', label: 'Public Projects' },
    { id: 'verify', label: 'Citizen Verification' },
    { id: 'blockchain', label: 'Ledger Audit' },
    { id: 'profile', label: 'Citizen Profile' },
  ],
};

const ROLE_LABELS = {
  authority: 'Central Authority',
  contractor: 'Verified Contractor',
  public: 'Public Citizen',
};

export default function Sidebar({
  role,
  activePage,
  onNavigate,
  onLogout,
  pendingCount = 0,
  mobileOpen = false,
  onCloseMobile,
}) {
  const [chainStatus, setChainStatus] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const refreshStatus = async () => {
      try {
        const res = await api.getBlockchainStatus();
        setChainStatus(!!res.data?.contractDeployed);
      } catch {
        setChainStatus(false);
      }
    };

    refreshStatus();
    const timer = setInterval(refreshStatus, 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = NAV[role] || [];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="bf-sidebar-backdrop"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`bf-sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="bf-sidebar-header">
          <BlockFundLogo size={32} showText={true} subText="Infrastructure Funding" />
        </div>

        {/* Role Pill */}
        <div className="bf-sidebar-role-wrap">
          <div className={`bf-sidebar-role role-${role}`}>
            <span className="bf-role-dot" />
            <span>{ROLE_LABELS[role] || 'User'}</span>
          </div>

          {role === 'contractor' && pendingCount > 0 && (
            <div className="bf-sidebar-pending-badge" title="Pending requests from authority">
              {pendingCount} Pending
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="bf-sidebar-nav">
          <div className="bf-nav-section-title">NAVIGATION</div>
          {navItems.map((item, index) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`bf-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onNavigate(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                title={`Shortcut: Alt+${index + 1}`}
              >
                <span className="bf-nav-icon">
                  {NAV_ICONS[item.id] || NAV_ICONS.dashboard}
                </span>
                <span className="bf-nav-label">{item.label}</span>
                <span className="bf-nav-shortcut">Alt+{index + 1}</span>
              </button>
            );
          })}
        </nav>

        {/* Building Trust Together Card (from Reference Design) */}
        <div
          style={{
            margin: '10px 14px 14px 14px',
            padding: '14px 16px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
            border: '1px solid #dbeafe',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            👥
          </div>
          <div style={{ fontSize: 13, fontWeight: 750, color: '#1e293b', marginBottom: 3 }}>
            Building Trust Together
          </div>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.45, marginBottom: 8 }}>
            Transparent infrastructure for stronger communities.
          </div>
          <button
            type="button"
            className="bf-ghost-btn"
            style={{ padding: '3px 6px', fontSize: 11.5, color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => {
              onNavigate('blockchain');
              if (onCloseMobile) onCloseMobile();
            }}
          >
            <span>Learn More</span>
            <span>→</span>
          </button>
        </div>

        {/* Footer info & Logout */}
        <div className="bf-sidebar-footer">
          {/* Blockchain Node Status */}
          <div className="bf-chain-status-pill">
            <span className={`bf-chain-indicator ${chainStatus ? 'connected' : 'disconnected'}`} />
            <div className="bf-chain-text">
              <div className="bf-chain-label">GANACHE RPC</div>
              <div className="bf-chain-state">
                {chainStatus ? 'Contract Deployed' : 'Connecting to Node...'}
              </div>
            </div>
          </div>

          <div className="bf-sidebar-clock">
            <span>{now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
            <span>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <button
            type="button"
            className="bf-logout-btn"
            onClick={onLogout}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
