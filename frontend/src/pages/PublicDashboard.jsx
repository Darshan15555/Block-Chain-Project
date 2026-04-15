import { useState, useEffect } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import ProjectTimelineCard from '../components/ProjectTimelineCard.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';
import StatusLegend from '../components/StatusLegend.jsx';

function proofLabel(update) {
  const status = update?.smartContractProof?.verification;
  if (status === 'verified') return { text: 'Smart Contract: Verified', color: 'var(--green)' };
  if (status === 'hash_not_found') return { text: 'Smart Contract: Hash mismatch', color: 'var(--red)' };
  if (status === 'chain_unavailable') return { text: 'Smart Contract: Unavailable', color: 'var(--orange)' };
  return { text: 'Smart Contract: Pending proof', color: 'var(--text-secondary)' };
}

export default function PublicDashboard({ showToast }) {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [filter, setFilter] = useState('All');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = async () => {
    const [projectsRes, statsRes] = await Promise.all([api.getProjects(), api.getStats()]);
    setProjects(projectsRes.data.projects || []);
    setStats(statsRes.data.stats || null);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    loadDashboard()
      .catch(() => showToast('Failed to load projects', 'error'))
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
      setUpdates(uRes.data.updates || []);
      setVerifications(vRes.data.verifications || []);
    } catch {
      setUpdates([]);
      setVerifications([]);
    }
  };

  const types = ['All', ...new Set(projects.map((p) => p.type).filter(Boolean))];
  const filtered = filter === 'All' ? projects : projects.filter((p) => p.type === filter);

  if (loading) return <div className="spinner" />;

  if (selected) {
    const pct = getPercent(selected.spentFund, selected.totalFund);
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Back</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div className="form-card" style={{ maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span className={`project-type-badge type-${selected.type?.toLowerCase().replace(' ', '')}`}>{selected.type}</span>
              <span className={`status-badge status-${selected.status?.toLowerCase()}`}>{selected.status}</span>
            </div>
            <div className="project-name">{selected.name}</div>
            <div className="project-location" style={{ marginBottom: 14 }}>{selected.location}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>TOTAL FUND</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                  {formatINR(selected.totalFund)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>AMOUNT SPENT</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--orange)', fontFamily: 'var(--font-display)' }}>
                  {formatINR(selected.spentFund)}
                </div>
              </div>
            </div>

            <div className="fund-bar-track">
              <div className={`fund-bar-fill ${pct > 80 ? 'danger' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14 }}>
              {pct}% utilized
            </div>

            <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--text-secondary)' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Contractor: </span>{selected.contractor?.name}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Created: </span>{formatDate(selected.createdAt)}</div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>BLOCKCHAIN TX</div>
              <TxHashDisplay hash={selected.blockchainTxHash} />
            </div>
          </div>

          <ProjectTimelineCard projectId={selected.projectId} showToast={showToast} />
        </div>

        <div className="section-header">
          <div className="section-title" style={{ fontSize: 16 }}>Work Updates ({updates.length})</div>
        </div>

        {updates.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '20px 0' }}>No updates submitted yet.</div>
        ) : (
          <div className="updates-list">
            {updates.map((u) => (
              <div key={u._id} className="update-item">
                <div className="update-header">
                  <div className="update-date">{formatDate(u.date)}</div>
                  <div className="update-amount">INR {u.amountSpent?.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ fontSize: 10, color: proofLabel(u).color, marginBottom: 6 }}>
                  {proofLabel(u).text}
                </div>
                <div className="update-desc">{u.workDescription}</div>
                <div className="update-tags">
                  <span className="update-tag">Materials: {u.materialsUsed}</span>
                  <span className="update-tag">Workers: {u.workersCount}</span>
                </div>
                {u.dataHash && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                    Hash: {String(u.dataHash).slice(0, 14)}...{String(u.dataHash).slice(-8)}
                  </div>
                )}
                <TxHashDisplay hash={u.blockchainTxHash} />
              </div>
            ))}
          </div>
        )}

        <div className="section-header" style={{ marginTop: 24 }}>
          <div className="section-title" style={{ fontSize: 16 }}>Recent Public Verifications</div>
        </div>
        {verifications.slice(0, 5).map((v) => (
          <div key={v._id} className="update-item" style={{ marginBottom: 8 }}>
            <div className="update-header">
              <div className="update-date">{formatDate(v.createdAt)}</div>
              <div className={`status-badge status-${v.status === 'Work Done' ? 'active' : 'suspended'}`}>{v.status}</div>
            </div>
            <div className="update-desc">{v.comment || 'No comment'}</div>
          </div>
        ))}
      </div>
    );
  }

  const roleStats = stats?.roleStats || {};
  const completedProjects = projects.filter((project) => String(project.status || '').toLowerCase() === 'completed').length;

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Public Dashboard</div>
          <div className="section-subtitle">
            <LastUpdatedLabel value={lastUpdated} />
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">Projects Verified</div>
          <div className="stat-value">{roleStats.projectsVerified ?? 0}</div>
          <div className="stat-sub">Your verification actions</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Funds Tracked</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatINR(roleStats.totalFundsTracked)}</div>
          <div className="stat-sub">Total public fund visibility</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Projects Available</div>
          <div className="stat-value">{projects.length}</div>
          <div className="stat-sub">Live demo projects</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Tracked Spend</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatINR(stats?.totalSpent)}</div>
          <div className="stat-sub">Logged with on-chain proof</div>
        </div>
      </div>

      <div className="explain-grid">
        <ExplainPanel
          title="How Public Verification Works"
          subtitle="Use this for non-technical demo explanation"
          tone="green"
          steps={[
            'Open any project card.',
            'Read timeline and check updates + amounts.',
            'Verify as Work Done or Not Done.',
            'Your verification appears in public history.',
          ]}
        />
        <ExplainPanel
          title="What You Can Show"
          subtitle={`Projects: ${projects.length} | Completed: ${completedProjects}`}
          tone="accent"
          steps={[
            'Project timeline reveals who did what and when.',
            'Blockchain hash proves transaction history.',
            'Public dashboard tracks total funds transparently.',
          ]}
        />
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">All Infrastructure Projects</div>
          <div className="section-subtitle">Click any project to inspect timeline and blockchain proof</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {types.map((type) => (
            <button key={type} className={`btn btn-sm ${filter === type ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(type)}>
              {type}
            </button>
          ))}
        </div>
      </div>
      <StatusLegend statuses={['created', 'active', 'completed', 'suspended']} />

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No projects found</div>
          <div className="empty-desc">Try changing filters.</div>
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map((project) => {
            const pct = getPercent(project.spentFund, project.totalFund);
            return (
              <div key={project.projectId} className="project-card" style={{ cursor: 'pointer' }} onClick={() => viewProject(project)}>
                <div className="project-card-header">
                  <span className={`project-type-badge type-${project.type?.toLowerCase().replace(' ', '')}`}>{project.type}</span>
                  <span className={`status-badge status-${project.status?.toLowerCase()}`}>{project.status}</span>
                </div>
                <div className="project-name">{project.name}</div>
                <div className="project-location">{project.location}</div>
                <div className="fund-bar-container">
                  <div className="fund-bar-label">
                    <span>{formatINR(project.spentFund)} spent</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="fund-bar-track">
                    <div className={`fund-bar-fill ${pct > 80 ? 'danger' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="blockchain-badge">{project.blockchainTxHash ? 'On-chain proof available' : 'Pending chain proof'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
