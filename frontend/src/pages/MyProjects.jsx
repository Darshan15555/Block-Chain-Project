import { useEffect, useMemo, useState } from 'react';
import { api, formatINR, formatDate } from '../utils/api';
import ProjectTimelineCard from '../components/ProjectTimelineCard.jsx';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';

function proofLabel(update) {
  const status = update?.smartContractProof?.verification;
  if (status === 'verified') return { text: 'Smart Contract: Verified', color: 'var(--green)' };
  if (status === 'hash_not_found') return { text: 'Smart Contract: Hash mismatch', color: 'var(--red)' };
  if (status === 'chain_unavailable') return { text: 'Smart Contract: Unavailable', color: 'var(--orange)' };
  return { text: 'Smart Contract: Pending proof', color: 'var(--text-secondary)' };
}

export default function MyProjects({ showToast }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

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
      .catch(() => showToast('Failed to load projects', 'error'))
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
    const refreshed = projects.find((project) => project.projectId === selected.projectId);
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
    if (!selected) {
      return { total: 0, spent: 0, remaining: 0 };
    }

    const total = Number(selected.totalFund || 0);
    const spent = Number(selected.spentFund || 0);
    return {
      total,
      spent,
      remaining: Math.max(0, total - spent),
    };
  }, [selected]);

  if (loading) return <div className="spinner" />;

  if (selected) {
    return (
      <div>
        <div className="section-header">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Back to Projects</button>
          </div>
          <div className="section-subtitle">
            <LastUpdatedLabel value={lastUpdated} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div className="form-card" style={{ maxWidth: '100%' }}>
            <div className="form-title">{selected.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>{selected.location}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>TOTAL FUND</div>
                <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' }}>
                  {formatINR(projectStats.total)}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>SPENT</div>
                <div style={{ color: 'var(--orange)', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' }}>
                  {formatINR(projectStats.spent)}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>REMAINING</div>
                <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' }}>
                  {formatINR(projectStats.remaining)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Status:</span> {selected.status}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Contractor:</span> {selected.contractor?.name}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Project ID:</span> {selected.projectId}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>PROJECT TX HASH</div>
              <TxHashDisplay hash={selected.blockchainTxHash} />
            </div>
          </div>

          <ProjectTimelineCard projectId={selected.projectId} showToast={showToast} />
        </div>

        <div className="section-header">
          <div className="section-title" style={{ fontSize: 16 }}>Work Updates ({updates.length})</div>
        </div>

        {updates.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 0' }}>
            <div className="empty-title" style={{ fontSize: 15 }}>No updates yet</div>
            <div className="empty-desc">Go to "Submit Update" to add your first daily update.</div>
          </div>
        ) : (
          <div className="updates-list">
            {updates.map((update) => (
              <div key={update._id} className="update-item">
                <div className="update-header">
                  <div className="update-date">{formatDate(update.date)}</div>
                  <div className="update-amount">INR {update.amountSpent?.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ fontSize: 10, color: proofLabel(update).color, marginBottom: 6 }}>
                  {proofLabel(update).text}
                </div>
                <div className="update-desc">{update.workDescription}</div>
                <div className="update-tags">
                  <span className="update-tag">Materials: {update.materialsUsed || '-'}</span>
                  <span className="update-tag">Workers: {update.workersCount}</span>
                </div>
                {update.dataHash && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                    Hash: {String(update.dataHash).slice(0, 14)}...{String(update.dataHash).slice(-8)}
                  </div>
                )}
                <TxHashDisplay hash={update.blockchainTxHash} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">My Projects</div>
          <div className="section-subtitle">{projects.length} project(s) assigned to you</div>
        </div>
        <div className="section-subtitle">
          <LastUpdatedLabel value={lastUpdated} />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No projects assigned</div>
          <div className="empty-desc">The authority will assign projects to your account.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map((project) => (
            <div key={project.projectId} className="project-card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                  <span className={`project-type-badge type-${project.type?.toLowerCase().replace(' ', '')}`}>{project.type}</span>
                  <span className={`status-badge status-${project.status?.toLowerCase()}`}>{project.status}</span>
                </div>
                <div className="project-name" style={{ fontSize: 15 }}>{project.name}</div>
                <div className="project-location" style={{ marginBottom: 10 }}>{project.location}</div>
                <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Total: </span><span style={{ color: 'var(--accent)' }}>{formatINR(project.totalFund)}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Spent: </span><span style={{ color: 'var(--orange)' }}>{formatINR(project.spentFund)}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Created: </span><span>{formatDate(project.createdAt)}</span></div>
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => viewProject(project)}>View Timeline</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
