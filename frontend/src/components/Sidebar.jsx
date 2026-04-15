import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const NAV = {
  authority: [
    { id: 'dashboard', icon: '[D]', label: 'Dashboard' },
    { id: 'create', icon: '[+]', label: 'Create Project' },
    { id: 'projects', icon: '[P]', label: 'All Projects' },
    { id: 'release', icon: '[R]', label: 'Release Funds' },
    { id: 'blockchain', icon: '[B]', label: 'Blockchain Proof' },
    { id: 'profile', icon: '[U]', label: 'Profile' },
  ],
  contractor: [
    { id: 'dashboard', icon: '[D]', label: 'Dashboard' },
    { id: 'myprojects', icon: '[P]', label: 'My Projects' },
    { id: 'update', icon: '[U]', label: 'Submit Update' },
    { id: 'blockchain', icon: '[B]', label: 'Blockchain Proof' },
    { id: 'profile', icon: '[A]', label: 'Profile' },
  ],
  public: [
    { id: 'dashboard', icon: '[D]', label: 'Dashboard' },
    { id: 'projects', icon: '[P]', label: 'All Projects' },
    { id: 'verify', icon: '[V]', label: 'Verify Work' },
    { id: 'blockchain', icon: '[B]', label: 'Blockchain Proof' },
    { id: 'profile', icon: '[A]', label: 'Profile' },
  ],
};

const ROLE_LABELS = {
  authority: 'Central Authority',
  contractor: 'Contractor',
  public: 'Public User',
};

export default function Sidebar({ role, activePage, onNavigate, onLogout, pendingCount = 0 }) {
  const [chainStatus, setChainStatus] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const refreshStatus = async () => {
      try {
        const res = await api.getBlockchainStatus();
        setChainStatus(!!res.data.contractDeployed);
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
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="chain-icon">B</div>
          BlockFund
        </div>
        <div className="logo-sub">Fund Tracker v1.0</div>
      </div>

      <div className={`sidebar-role-badge role-${role}`}>
        <span>{ROLE_LABELS[role] || 'User'}</span>
      </div>
      {role === 'contractor' && (
        <div className={`pending-pill ${pendingCount > 0 ? 'has-pending' : 'is-clear'}`}>
          {pendingCount > 0 ? `Pending Approvals: ${pendingCount}` : 'No Pending Approvals'}
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems.map((item, index) => (
          <div
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={`Alt+${index + 1}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            <span className="nav-shortcut">Alt+{index + 1}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-clock">
          <span>{now.toLocaleDateString('en-IN')}</span>
          <span>{now.toLocaleTimeString('en-IN')}</span>
        </div>
        <div className="chain-status">
          <div className={`chain-dot ${chainStatus ? 'active' : ''}`} />
          <span>{chainStatus ? 'Blockchain: Live' : 'Blockchain: Offline'}</span>
        </div>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}
