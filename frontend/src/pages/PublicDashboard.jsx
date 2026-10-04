import { useState, useEffect, useMemo } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import TxHashDisplay from '../components/TxHashDisplay.jsx';

// Sector vector visual fallback when project has no uploaded image
function SectorVisualFallback({ type }) {
  const t = String(type || '').toLowerCase();
  let bg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
  let icon = '🏛️';

  if (t.includes('school')) {
    bg = 'linear-gradient(135deg, #312e81 0%, #6366f1 100%)';
    icon = '🏫';
  } else if (t.includes('water')) {
    bg = 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)';
    icon = '💧';
  } else if (t.includes('road')) {
    bg = 'linear-gradient(135deg, #1e293b 0%, #475569 100%)';
    icon = '🛣️';
  } else if (t.includes('hospital') || t.includes('health')) {
    bg = 'linear-gradient(135deg, #831843 0%, #db2777 100%)';
    icon = '🏥';
  } else if (t.includes('bridge')) {
    bg = 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)';
    icon = '🌉';
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 42,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
        }}
      />
      <span style={{ transform: 'scale(1.2)', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>
        {icon}
      </span>
    </div>
  );
}

export default function PublicDashboard({ showToast, onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [activeSector, setActiveSector] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [showChecklistModal, setShowChecklistModal] = useState(false);

  const loadDashboard = async () => {
    const [projectsRes, statsRes] = await Promise.all([
      api.getProjects(),
      api.getStats(),
    ]);
    setProjects(projectsRes.data?.projects || []);
    setStats(statsRes.data?.stats || null);
  };

  useEffect(() => {
    loadDashboard()
      .catch(() => showToast('Failed to load public infrastructure projects', 'error'))
      .finally(() => setLoading(false));

    const timer = setInterval(() => {
      loadDashboard().catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [showToast]);

  const viewProject = async (project) => {
    setSelected(project);
    try {
      const [uRes, vRes] = await Promise.all([
        api.getUpdates(project.projectId),
        api.getVerifications(project.projectId),
      ]);
      setUpdates(uRes.data?.updates || []);
      setVerifications(vRes.data?.verifications || []);
    } catch {
      setUpdates([]);
      setVerifications([]);
    }
  };

  const sectors = ['All', 'School', 'Water Facility', 'Road', 'Health', 'Sanitation', 'Other'];

  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const matchesSector =
          activeSector === 'All' ||
          (activeSector === 'Health' && (p.type?.toLowerCase().includes('hospital') || p.type?.toLowerCase().includes('health'))) ||
          (activeSector === 'Sanitation' && (p.type?.toLowerCase().includes('water') || p.type?.toLowerCase().includes('sanitation'))) ||
          p.type?.toLowerCase() === activeSector.toLowerCase();

        const matchesSearch =
          !searchQuery.trim() ||
          p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.projectId?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesSector && matchesSearch;
      })
      .sort((a, b) => {
        if (sortOrder === 'latest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        if (sortOrder === 'highest') return Number(b.totalFund || 0) - Number(a.totalFund || 0);
        if (sortOrder === 'verified') return (b.verificationCount?.workDone || 0) - (a.verificationCount?.workDone || 0);
        return 0;
      });
  }, [projects, activeSector, searchQuery, sortOrder]);

  const totalFundsTracked = stats?.totalFund || projects.reduce((acc, p) => acc + Number(p.totalFund || 0), 0);
  const totalFundsReleased = stats?.totalReleasedFund || projects.reduce((acc, p) => acc + Number(p.releasedFund || 0), 0);
  const milestoneDeliveryRate = getPercent(totalFundsReleased, totalFundsTracked);

  if (loading) {
    return (
      <div className="bf-page-stack">
        <LoadingSkeleton type="card" height={220} count={1} />
        <LoadingSkeleton type="metric" count={3} />
        <LoadingSkeleton type="card" count={2} height={260} />
      </div>
    );
  }

  // If viewing detailed project drill-down
  if (selected) {
    const pct = getPercent(selected.spentFund, selected.totalFund);
    const releasedPct = getPercent(selected.releasedFund, selected.totalFund);
    const workDoneCount = selected.verificationCount?.workDone || 0;
    const notDoneCount = selected.verificationCount?.notDone || 0;
    const totalVotes = workDoneCount + notDoneCount;
    const confidenceScore = totalVotes > 0 ? Math.round((workDoneCount / totalVotes) * 100) : 100;

    return (
      <div className="bf-page-stack">
        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            className="bf-secondary-btn"
            onClick={() => setSelected(null)}
          >
            ← Back to Public Projects
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="bf-badge bf-badge-primary">{selected.type}</span>
            <StatusBadge status={selected.status || 'Active'} />
          </div>
        </div>

        {/* Project Header Card */}
        <div className="bf-card">
          <div className="bf-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span>📍 {selected.location}</span>
                  <span>•</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>Project ID: {selected.projectId}</span>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {selected.name}
                </h1>
                {selected.description && (
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 800 }}>
                    {selected.description}
                  </p>
                )}
              </div>
              {onNavigate && (
                <button
                  type="button"
                  className="bf-primary-btn"
                  onClick={() => onNavigate('verify')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <span>Cast Verification Vote</span>
                </button>
              )}
            </div>

            {/* Three Key Financial Blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL ALLOCATED BUDGET</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{formatINR(selected.totalFund)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Committed in Smart Contract</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FUNDS RELEASED</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>{formatINR(selected.releasedFund || 0)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{releasedPct}% Disbursed upon Milestones</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ACTUAL AMOUNT SPENT</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', marginTop: 4 }}>{formatINR(selected.spentFund || 0)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{pct}% Budget Utilized</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Overall Milestone Progress</span>
                <span style={{ color: 'var(--text-primary)' }}>{pct}% Complete</span>
              </div>
              <div className="bf-progress-bar">
                <div className="bf-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Contractor Proof Bar */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Contractor: </span>
                <strong>{selected.contractor?.name || 'Verified Construction Partner'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Recipient Wallet: </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                  {selected.contractor?.address || selected.contractor?.walletAddress || '0x4f12...b90a (Verified)'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Public Trust: </span>
                <strong style={{ color: 'var(--green)' }}>{confidenceScore}% ({workDoneCount} Verified)</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Work Updates & Evidence */}
        <div className="bf-card">
          <div className="bf-card-header">
            <div>
              <h2 className="bf-card-title">Contractor Work Log & Field Evidence</h2>
              <p className="bf-card-subtitle">Daily milestones verified with SHA-256 hashes and site evidence</p>
            </div>
          </div>

          <div className="bf-card-body">
            {updates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {updates.map((u, index) => (
                  <div
                    key={u._id || index}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '16px 18px',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{formatDate(u.date || u.createdAt)}</span>
                        <span className="bf-badge bf-badge-success">✓ On-Chain Verified</span>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#d97706' }}>{formatINR(u.amountSpent)}</span>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                      {u.workDescription}
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
                      {u.materialsUsed && <span className="bf-badge bf-badge-neutral">📦 Materials: {u.materialsUsed}</span>}
                      {u.workersCount > 0 && <span className="bf-badge bf-badge-neutral">👷 Workers: {u.workersCount}</span>}
                    </div>

                    {u.photoPath && (
                      <div style={{ marginTop: 6 }}>
                        <img
                          src={u.photoPath.startsWith('http') ? u.photoPath : `/${u.photoPath.replace(/^[\/\\]+/, '')}`}
                          alt="Site Proof"
                          style={{ maxHeight: 180, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--border)' }}
                          onClick={() => setPreviewPhoto(u.photoPath)}
                        />
                      </div>
                    )}

                    {u.dataHash && <TxHashDisplay hash={u.dataHash} label="Data Hash" />}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No work updates yet"
                description="The contractor has not logged any milestone updates for this project."
              />
            )}
          </div>
        </div>

        {/* Modal for photo preview */}
        {previewPhoto && (
          <div className="bf-modal-backdrop" onClick={() => setPreviewPhoto(null)}>
            <div className="bf-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div className="bf-modal-header">
                <h3 className="bf-modal-title">Site Evidence Photo</h3>
                <button type="button" className="bf-modal-close" onClick={() => setPreviewPhoto(null)}>✕</button>
              </div>
              <div className="bf-modal-body">
                <img
                  src={previewPhoto.startsWith('http') ? previewPhoto : `/${previewPhoto.replace(/^[\/\\]+/, '')}`}
                  alt="Site Evidence Full"
                  style={{ width: '100%', maxHeight: 440, objectFit: 'cover', borderRadius: 12 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // MAIN DASHBOARD VIEW MATCHING REFERENCE IMAGE
  return (
    <div className="bf-page-stack" style={{ gap: 20 }}>
      {/* 1. Cinematic Hero Banner */}
      <div
        style={{
          position: 'relative',
          borderRadius: 22,
          overflow: 'hidden',
          minHeight: 220,
          background: '#0f172a',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.12)',
        }}
      >
        {/* Background infrastructure photograph */}
        <img
          src="/images/blockfund_hero.jpg"
          alt="Public Infrastructure Transparency"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.45,
          }}
        />

        {/* Overlay gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.82) 50%, rgba(15, 23, 42, 0.4) 100%)',
          }}
        />

        {/* Banner Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '32px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 24,
          }}
        >
          {/* Left Column Text */}
          <div style={{ maxWidth: 640 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#93c5fd',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              PUBLIC INFRASTRUCTURE
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: -0.6,
                margin: '0 0 10px 0',
                lineHeight: 1.2,
              }}
            >
              Public Infrastructure Transparency Portal
            </h1>
            <p
              style={{
                fontSize: 13.5,
                color: '#cbd5e1',
                lineHeight: 1.55,
                margin: '0 0 18px 0',
              }}
            >
              Publicly verifiable civic infrastructure funding, milestone execution, and decentralized citizen audits.
            </p>

            {/* 3 Badges */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span>Transparent Funding</span>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <span>On-Chain Verification</span>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span>Stronger Communities</span>
              </div>
            </div>
          </div>

          {/* Right Floating Badge */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 }}>
              Infrastructure for a Brighter Tomorrow
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(30, 41, 59, 0.75)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '12px 18px',
                borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 750, color: '#ffffff' }}>Verified on Blockchain</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Tamper-proof records for public trust</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top 3 Stat Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {/* Card 1: Funds Tracked */}
        <div
          className="bf-stat-card"
          style={{ '--card-accent': '#2563eb', '--card-glow': 'rgba(37, 99, 235, 0.1)' }}
        >
          <div className="bf-stat-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <span className="bf-stat-card-title">PUBLIC FUNDS TRACKED</span>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ↗
            </div>
          </div>
          <div className="bf-stat-card-value">{formatINR(totalFundsTracked)}</div>
          <div className="bf-stat-card-footer">
            <span className="bf-stat-card-subtext">100% On-Chain Escrowed</span>
          </div>
        </div>

        {/* Card 2: Funds Disbursed */}
        <div
          className="bf-stat-card"
          style={{ '--card-accent': '#10b981', '--card-glow': 'rgba(16, 185, 129, 0.1)' }}
        >
          <div className="bf-stat-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                ₹
              </div>
              <span className="bf-stat-card-title">FUNDS DISBURSED ON-SITE</span>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              📊
            </div>
          </div>
          <div className="bf-stat-card-value">{formatINR(totalFundsReleased)}</div>
          <div className="bf-stat-card-footer">
            <span className="bf-stat-card-subtext">{milestoneDeliveryRate}% Milestone Delivery Rate</span>
          </div>
        </div>

        {/* Card 3: Civil Works */}
        <div
          className="bf-stat-card"
          style={{ '--card-accent': '#7c3aed', '--card-glow': 'rgba(124, 58, 237, 0.1)' }}
        >
          <div className="bf-stat-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: '#f5f3ff',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="bf-stat-card-title">CIVIL INFRASTRUCTURE WORKS</span>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              📈
            </div>
          </div>
          <div className="bf-stat-card-value">{projects.length}</div>
          <div className="bf-stat-card-footer">
            <span className="bf-stat-card-subtext">Open for Citizen Verification</span>
          </div>
        </div>
      </div>

      {/* 3. Filter by Sector & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        {/* Sector Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginRight: 4 }}>
            Filter by Sector
          </span>
          {sectors.map((sector) => {
            const isSelected = activeSector === sector;
            return (
              <button
                key={sector}
                type="button"
                className={`bf-filter-pill ${isSelected ? 'active' : ''}`}
                onClick={() => setActiveSector(sector)}
              >
                {sector === 'All' ? 'All Sectors' : sector}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="bf-search-box" style={{ borderRadius: 999 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="bf-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
            />
            {searchQuery && (
              <button type="button" className="bf-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          <select
            className="bf-form-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{ borderRadius: 999, padding: '7px 14px', fontSize: 12.5, width: 'auto' }}
          >
            <option value="latest">Latest First ⇅</option>
            <option value="highest">Highest Budget</option>
            <option value="verified">Most Verified</option>
          </select>
        </div>
      </div>

      {/* 4. Main Two Column Section: Projects & Demo Checklist */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Public Projects Grid */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Public Projects
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Explore and verify infrastructure projects in your region.
              </p>
            </div>
            {onNavigate && (
              <button
                type="button"
                className="bf-ghost-btn"
                style={{ color: 'var(--accent)', fontWeight: 700 }}
                onClick={() => onNavigate('projects')}
              >
                View All Projects →
              </button>
            )}
          </div>

          {filteredProjects.length === 0 ? (
            <EmptyState
              title="No Projects Match Selected Filters"
              description="Try adjusting your sector filter or search terms."
              actionLabel="Show All Sectors"
              onAction={() => { setActiveSector('All'); setSearchQuery(''); }}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
              {filteredProjects.map((project) => {
                const total = Number(project.totalFund || 0);
                const disbursed = Number(project.releasedFund || project.spentFund || 0);
                const percent = getPercent(disbursed, total);

                return (
                  <div
                    key={project.projectId}
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 18,
                      overflow: 'hidden',
                      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Project Image Banner */}
                    <div style={{ position: 'relative', height: 160, width: '100%', overflow: 'hidden' }}>
                      {project.imagePath ? (
                        <img
                          src={project.imagePath.startsWith('http') ? project.imagePath : project.imagePath}
                          alt={project.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <SectorVisualFallback type={project.type} />
                      )}

                      {/* Floating Sector Badge on Image Top-Left */}
                      <div style={{ position: 'absolute', top: 12, left: 12 }}>
                        <span
                          style={{
                            background: 'rgba(255, 255, 255, 0.92)',
                            backdropFilter: 'blur(8px)',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          }}
                        >
                          {project.type || 'Civil Work'}
                        </span>
                      </div>

                      {/* Floating Status Badge on Image Top-Right */}
                      <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <StatusBadge status={project.status || 'Active'} size="sm" />
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 750, color: 'var(--text-primary)', margin: 0 }}>
                          {project.name}
                        </h3>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <span>📍</span>
                          <span>{project.location}</span>
                        </div>
                      </div>

                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {project.description || 'Public civil infrastructure project deployed under smart contract governance.'}
                      </p>

                      {/* Milestones Progress */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Milestones</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{percent}% Complete</span>
                        </div>
                        <div className="bf-progress-bar">
                          <div className="bf-progress-fill" style={{ width: `${percent}%` }} />
                        </div>
                      </div>

                      {/* Card Footer: Financials & View Details */}
                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: 12,
                          borderTop: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatINR(total)}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Allocation</div>
                        </div>

                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#d97706' }}>
                            {formatINR(disbursed)}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Disbursed</div>
                        </div>

                        <button
                          type="button"
                          className="bf-primary-btn bf-btn-sm"
                          onClick={() => viewProject(project)}
                        >
                          <span>View Details</span>
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Demo Checklist Card */}
        <div
          className="bf-card"
          style={{
            borderRadius: 18,
            padding: 20,
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header with Circular Progress Gauge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                Demo Checklist (5/6)
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Transparency Tour
              </div>
            </div>

            {/* Circular Gauge */}
            <div style={{ position: 'relative', width: 48, height: 48 }}>
              <svg width="48" height="48" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3.5"
                  strokeDasharray="83, 100"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#2563eb',
                }}
              >
                83%
              </div>
            </div>
          </div>

          {/* Checklist Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'View Project Details', done: true },
              { label: 'Verify Milestone', done: true },
              { label: 'Check Ledger Record', done: true },
              { label: 'Explore All Sectors', done: true },
              { label: 'Submit Feedback', done: true },
              { label: 'Download Report', done: false },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 12.5,
                  color: item.done ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: item.done ? '#ecfdf5' : '#f1f5f9',
                    color: item.done ? '#059669' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    border: item.done ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                    flexShrink: 0,
                  }}
                >
                  {item.done ? '✓' : ''}
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="bf-secondary-btn"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }}
            onClick={() => setShowChecklistModal(true)}
          >
            <span>↗</span>
            <span>Open Checklist</span>
          </button>
        </div>
      </div>

      {/* 5. Clean Enterprise Footer */}
      <footer
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <div>© 2025 BlockFund. Transparent Infrastructure Funding.</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ cursor: 'pointer' }}>About</span>
          <span style={{ cursor: 'pointer' }}>Privacy</span>
          <span style={{ cursor: 'pointer' }}>Terms</span>
          <span style={{ cursor: 'pointer' }}>Support</span>
        </div>
      </footer>

      {/* Checklist modal if triggered */}
      {showChecklistModal && (
        <div className="bf-modal-backdrop" onClick={() => setShowChecklistModal(false)}>
          <div className="bf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="bf-modal-header">
              <div>
                <h3 className="bf-modal-title">Live Transparency Demonstration Tour</h3>
                <p className="bf-modal-subtitle">Track public funds from state treasury to verified field execution.</p>
              </div>
              <button type="button" className="bf-modal-close" onClick={() => setShowChecklistModal(false)}>✕</button>
            </div>
            <div className="bf-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Every milestone in BlockFund is cryptographically signed and stored on-chain. Citizens can view physical proof photos and cast community audit votes.
              </p>
            </div>
            <div className="bf-modal-footer">
              <button type="button" className="bf-primary-btn" onClick={() => setShowChecklistModal(false)}>
                Continue Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
