import { useEffect, useState } from 'react';
import { api, formatINR } from '../utils/api';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';

function roleDetails(role) {
  switch (role) {
    case 'authority':
      return {
        label: 'Government Authority',
        badgeVariant: 'primary',
        desc: 'Authorized state officer with treasury disbursement and contract creation rights.',
        color: '#4f46e5',
      };
    case 'contractor':
      return {
        label: 'Approved Contractor',
        badgeVariant: 'warning',
        desc: 'Verified engineering contractor with milestone submission and fund claim permissions.',
        color: '#d97706',
      };
    default:
      return {
        label: 'Citizen / Public Auditor',
        badgeVariant: 'success',
        desc: 'Public civic observer with immutable ledger verification and voting rights.',
        color: '#16a34a',
      };
  }
}

export default function ProfilePage({ currentUser, showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedWallet, setCopiedWallet] = useState(false);

  useEffect(() => {
    api.getStats()
      .then((res) => setStats(res.data.stats || null))
      .catch(() => showToast('Failed to load profile metrics', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const copyWallet = async () => {
    if (!currentUser?.walletAddress) return;
    try {
      await navigator.clipboard.writeText(currentUser.walletAddress);
      setCopiedWallet(true);
      showToast('Wallet address copied to clipboard', 'success');
      setTimeout(() => setCopiedWallet(false), 2500);
    } catch {
      showToast('Clipboard access denied', 'error');
    }
  };

  const roleStats = stats?.roleStats || {};
  const isAuthority = currentUser?.role === 'authority';
  const isContractor = currentUser?.role === 'contractor';
  const isPublic = currentUser?.role === 'public';
  const roleInfo = roleDetails(currentUser?.role);

  return (
    <div className="bf-page-stack">
      {/* Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Identity & Role Credentials</h1>
          <p className="bf-page-subtitle">
            Cryptographic identity, role permissions, and active ledger participation overview.
          </p>
        </div>
      </div>

      {/* Top Identity Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 1fr)', gap: 20 }}>
        {/* User Card */}
        <div className="bf-card">
          <div className="bf-card-header">
            <h2 className="bf-card-title">Authenticated Identity</h2>
            <StatusBadge status="VERIFIED" variant="success" dot />
          </div>
          <div className="bf-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #06b6d4 100%)',
                  color: '#ffffff',
                  fontSize: 26,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px rgba(37, 99, 235, 0.25)',
                  flexShrink: 0,
                }}
              >
                {(currentUser?.name || currentUser?.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 750, color: 'var(--text-primary)' }}>
                  {currentUser?.name || 'Authorized Official'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  @{currentUser?.username || 'anonymous'}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className={`bf-badge bf-badge-${roleInfo.badgeVariant}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
              {roleInfo.desc}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Security Protocol</div>
                <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginTop: 2 }}>HMAC-SHA256 JWT</div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Access Control</div>
                <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--accent)', marginTop: 2 }}>Enforced (RBAC)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic Wallet Card */}
        <div className="bf-card">
          <div className="bf-card-header">
            <h2 className="bf-card-title">Cryptographic Wallet & Network</h2>
            <StatusBadge status="GANACHE" variant="primary" />
          </div>
          <div className="bf-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Ethereum Wallet Address
              </div>
              {currentUser?.walletAddress ? (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all', fontWeight: 600 }}>
                    {currentUser.walletAddress}
                  </div>
                  <button
                    type="button"
                    className="bf-secondary-btn bf-btn-sm"
                    onClick={copyWallet}
                    style={{ flexShrink: 0 }}
                  >
                    {copiedWallet ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', fontSize: 12 }}>
                  No Ethereum wallet address bound to this user record.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Consensus Node</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Ganache Local (127.0.0.1:7545)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Smart Contract</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>FundTracking.sol</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                  Synchronized
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role-Specific Metric Overview */}
      <div>
        <div style={{ marginBottom: 14 }}>
          <h2 className="bf-card-title" style={{ fontSize: 16 }}>Operational Activity & Lifetime Metrics</h2>
          <p className="bf-card-subtitle">Aggregated metrics associated with your cryptographic role.</p>
        </div>

        {loading ? (
          <LoadingSkeleton type="metric" count={4} />
        ) : (
          <div className="bf-stats-grid">
            {isAuthority && (
              <>
                <StatCard
                  label="Projects Created"
                  value={roleStats.totalProjectsCreated ?? 0}
                  subtext="Civil infrastructure works deployed"
                  variant="indigo"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  }
                />
                <StatCard
                  label="Funds Allocated"
                  value={formatINR(roleStats.totalFundsAllocated ?? 0)}
                  subtext="Total locked in smart escrow"
                  variant="blue"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  }
                />
                <StatCard
                  label="Funds Released"
                  value={formatINR(roleStats.totalFundsReleased ?? 0)}
                  subtext="Disbursed to engineering partners"
                  variant="emerald"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  }
                />
                <StatCard
                  label="Pending Requests"
                  value={stats?.pendingFundingRequests ?? 0}
                  subtext="Awaiting contractor acceptance"
                  variant="amber"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  }
                />
              </>
            )}

            {isContractor && (
              <>
                <StatCard
                  label="Projects Assigned"
                  value={roleStats.projectsAssigned ?? 0}
                  subtext="Active infrastructure sites"
                  variant="indigo"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  }
                />
                <StatCard
                  label="Funds Requested"
                  value={formatINR(roleStats.totalFundsRequested ?? 0)}
                  subtext="Milestone disbursements claimed"
                  variant="amber"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  }
                />
                <StatCard
                  label="Funds Received"
                  value={formatINR(roleStats.totalFundsReceived ?? 0)}
                  subtext="Released to wallet account"
                  variant="emerald"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  }
                />
                <StatCard
                  label="Pending Requests"
                  value={stats?.pendingFundingRequests ?? 0}
                  subtext="Advance requests in queue"
                  variant="blue"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  }
                />
              </>
            )}

            {isPublic && (
              <>
                <StatCard
                  label="Audits Performed"
                  value={roleStats.projectsVerified ?? 0}
                  subtext="Citizen verification checks submitted"
                  variant="emerald"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  }
                />
                <StatCard
                  label="Public Funds Tracked"
                  value={formatINR(roleStats.totalFundsTracked ?? 0)}
                  subtext="Total civil treasury under oversight"
                  variant="indigo"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  }
                />
                <StatCard
                  label="Total Community Audits"
                  value={stats?.totalVerifications ?? 0}
                  subtext="Across all tracked state projects"
                  variant="blue"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  }
                />
                <StatCard
                  label="Public Projects Live"
                  value={stats?.totalProjects ?? 0}
                  subtext="Active public infrastructure works"
                  variant="amber"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    </svg>
                  }
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
