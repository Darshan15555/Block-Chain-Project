import { useEffect, useMemo, useState } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import ProjectTimelineCard from '../components/ProjectTimelineCard.jsx';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';

function proofDetails(update) {
  const status = update?.smartContractProof?.verification;
  if (status === 'verified') {
    return { label: 'ON-CHAIN VERIFIED', variant: 'success', text: 'Smart contract verified' };
  }
  if (status === 'hash_not_found') {
    return { label: 'HASH MISMATCH', variant: 'danger', text: 'Hash discrepancy detected' };
  }
  if (status === 'chain_unavailable') {
    return { label: 'OFFLINE', variant: 'warning', text: 'Chain sync unavailable' };
  }
  return { label: 'PENDING PROOF', variant: 'neutral', text: 'Proof verification pending' };
}

export default function MyProjects({ showToast }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadProjects = async () => {
    const res = await api.getProjects();
    setProjects(res.data.projects || []);
    setLastUpdated(new Date());
  };

  const loadProjectUpdates = async (projectId) => {
    const res = await api.getUpdates(projectId);
    setUpdates(res.data.updates || []);
  };

  useEffect(() => {
    loadProjects()
      .catch(() => showToast('Failed to load assigned projects', 'error'))
      .finally(() => setLoading(false));

    const timer = setInterval(() => {
      loadProjects().catch(() => {});
      if (selected?.projectId) {
        loadProjectUpdates(selected.projectId).catch(() => {});
      }
    }, 6000);

    return () => clearInterval(timer);
  }, [showToast, selected?.projectId]);

  useEffect(() => {
    if (!selected?.projectId) return;
    const refreshed = projects.find((p) => p.projectId === selected.projectId);
    if (refreshed) {
      setSelected(refreshed);
    }
  }, [projects, selected?.projectId]);

  const viewProject = async (project) => {
    setSelected(project);
    try {
      await loadProjectUpdates(project.projectId);
    } catch {
      setUpdates([]);
      showToast('Failed to load project updates', 'error');
    }
  };

  const projectStats = useMemo(() => {
    if (!selected) return { total: 0, spent: 0, remaining: 0, percentSpent: 0 };
    const total = Number(selected.totalFund || 0);
    const spent = Number(selected.spentFund || 0);
    return {
      total,
      spent,
      remaining: Math.max(0, total - spent),
      percentSpent: getPercent(spent, total),
    };
  }, [selected]);

  const overviewMetrics = useMemo(() => {
    const totalAllocated = projects.reduce((acc, p) => acc + Number(p.totalFund || 0), 0);
    const totalSpent = projects.reduce((acc, p) => acc + Number(p.spentFund || 0), 0);
    const inProgress = projects.filter((p) => String(p.status).toLowerCase() === 'in progress').length;
    return {
      totalProjects: projects.length,
      totalAllocated,
      totalSpent,
      inProgress,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.projectId?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' ||
        String(p.status).toUpperCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="bf-page-stack">
        <LoadingSkeleton type="metric" count={4} />
        <LoadingSkeleton type="card" count={3} height={140} />
      </div>
    );
  }

  // Drill-down View
  if (selected) {
    return (
      <div className="bf-page-stack">
        {/* Breadcrumb & Navigation */}
        <div className="bf-page-header">
          <div>
            <button
              type="button"
              className="bf-ghost-btn"
              onClick={() => setSelected(null)}
              style={{ paddingLeft: 0, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Assigned Projects</span>
            </button>
            <h1 className="bf-page-title">{selected.name}</h1>
            <p className="bf-page-subtitle">
              Project ID: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selected.projectId}</span> • {selected.location}
            </p>
          </div>
          <div className="bf-page-header-actions">
            <LastUpdatedLabel date={lastUpdated} />
            <StatusBadge status={selected.status} />
          </div>
        </div>

        {/* Financial & Contract Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.1fr) minmax(300px, 1fr)', gap: 20 }}>
          <div className="bf-card">
            <div className="bf-card-header">
              <h2 className="bf-card-title">Fiscal & Escrow Allocation</h2>
              <span className="bf-badge bf-badge-primary">{selected.type || 'Infrastructure'}</span>
            </div>
            <div className="bf-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL BUDGET</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginTop: 2, fontFamily: 'var(--font-display)' }}>
                    {formatINR(projectStats.total)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DISBURSED / SPENT</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#d97706', marginTop: 2, fontFamily: 'var(--font-display)' }}>
                    {formatINR(projectStats.spent)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ESCROW BALANCE</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', marginTop: 2, fontFamily: 'var(--font-display)' }}>
                    {formatINR(projectStats.remaining)}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Budget Utilization</span>
                  <span style={{ color: 'var(--text-primary)' }}>{projectStats.percentSpent}%</span>
                </div>
                <div className="bf-progress-bar">
                  <div
                    className="bf-progress-fill"
                    style={{ width: `${Math.min(100, projectStats.percentSpent)}%` }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Smart Contract Initialization Proof
                </div>
                <TxHashDisplay hash={selected.blockchainTxHash} />
              </div>
            </div>
          </div>

          {/* Timeline Milestones Component */}
          <ProjectTimelineCard projectId={selected.projectId} showToast={showToast} />
        </div>

        {/* Milestone Work Updates Log */}
        <div className="bf-card">
          <div className="bf-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="bf-card-title">Daily Milestone Submissions & Proofs</h2>
              <p className="bf-card-subtitle">{updates.length} immutable field log(s) registered</p>
            </div>
          </div>

          {updates.length === 0 ? (
            <EmptyState
              title="No Daily Updates Submitted Yet"
              description="Record progress, worker logs, material expenses, and photo evidence under 'Submit Work Update'."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px' }}>
              {updates.map((update) => {
                const proof = proofDetails(update);
                return (
                  <div
                    key={update._id || update.blockchainTxHash}
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      boxShadow: 'var(--shadow-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          {formatDate(update.date)}
                        </span>
                        <StatusBadge status={proof.label} variant={proof.variant} dot />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#d97706', fontFamily: 'var(--font-display)' }}>
                        {formatINR(update.amountSpent || 0)}
                      </div>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {update.workDescription}
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span className="bf-badge bf-badge-neutral">
                        Materials: {update.materialsUsed || 'Standard Materials'}
                      </span>
                      <span className="bf-badge bf-badge-neutral">
                        On-Site Workers: {update.workersCount ?? '—'}
                      </span>
                    </div>

                    {update.dataHash && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <span>SHA-256 Digest:</span>
                        <span style={{ color: 'var(--accent)' }}>
                          {String(update.dataHash).slice(0, 16)}...{String(update.dataHash).slice(-8)}
                        </span>
                      </div>
                    )}

                    <div>
                      <TxHashDisplay hash={update.blockchainTxHash} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Overview List View
  return (
    <div className="bf-page-stack">
      {/* Page Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Assigned Infrastructure Projects</h1>
          <p className="bf-page-subtitle">
            Manage your active state contracts, submit cryptographic milestone updates, and track smart escrow releases.
          </p>
        </div>
        <div className="bf-page-header-actions">
          <LastUpdatedLabel date={lastUpdated} />
        </div>
      </div>

      {/* Metrics */}
      <div className="bf-stats-grid">
        <StatCard
          label="Assigned Contracts"
          value={overviewMetrics.totalProjects}
          subtext="Active public civil works"
          variant="indigo"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Total Contract Budget"
          value={formatINR(overviewMetrics.totalAllocated)}
          subtext="Locked in smart contracts"
          variant="blue"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
        />
        <StatCard
          label="Disbursed To Date"
          value={formatINR(overviewMetrics.totalSpent)}
          subtext="Released to your wallet"
          variant="emerald"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />
        <StatCard
          label="In Construction"
          value={overviewMetrics.inProgress}
          subtext="Under active field execution"
          variant="amber"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="bf-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {['ALL', 'PROPOSED', 'IN PROGRESS', 'COMPLETED'].map((status) => (
              <button
                key={status}
                type="button"
                className={`bf-filter-pill ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'ALL' ? 'All Contracts' : status}
              </button>
            ))}
          </div>

          <div className="bf-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="bf-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contracts by name, city..."
            />
            {searchQuery && (
              <button type="button" className="bf-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <EmptyState
            title="No Matching Projects Found"
            description={projects.length === 0 ? "You do not have any state projects assigned to your contractor account yet." : "Try adjusting your search criteria or filter."}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
            {filteredProjects.map((project) => {
              const total = Number(project.totalFund || 0);
              const spent = Number(project.spentFund || 0);
              const pct = getPercent(spent, total);

              return (
                <div
                  key={project.projectId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 1.8fr) minmax(200px, 1.2fr) auto',
                    alignItems: 'center',
                    gap: 20,
                    padding: '18px 20px',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    transition: 'all 0.2s ease',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span className="bf-badge bf-badge-primary">{project.type || 'Infrastructure'}</span>
                      <StatusBadge status={project.status} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 750, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {project.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {project.location} • <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{project.projectId}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Budget Disbursed</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</span>
                    </div>
                    <div className="bf-progress-bar" style={{ marginBottom: 6 }}>
                      <div className="bf-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Budget: </span>
                        <span style={{ fontWeight: 650, color: 'var(--accent)' }}>{formatINR(total)}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Spent: </span>
                        <span style={{ fontWeight: 650, color: '#d97706' }}>{formatINR(spent)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="bf-primary-btn"
                      onClick={() => viewProject(project)}
                    >
                      <span>View Timeline</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
