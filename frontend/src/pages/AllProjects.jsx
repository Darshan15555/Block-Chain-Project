import { useState, useEffect, useMemo, useRef } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import ProjectTimelineCard from '../components/ProjectTimelineCard.jsx';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';
import StatusLegend from '../components/StatusLegend.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';

const STATUS_OPTIONS = ['Created', 'Active', 'Completed', 'Suspended'];

function proofLabel(update) {
  const status = update?.smartContractProof?.verification;
  if (status === 'verified') return { text: 'Smart Contract: Verified', color: 'var(--green)' };
  if (status === 'hash_not_found') return { text: 'Smart Contract: Hash mismatch', color: 'var(--red)' };
  if (status === 'chain_unavailable') return { text: 'Smart Contract: Unavailable', color: 'var(--orange)' };
  return { text: 'Smart Contract: Pending proof', color: 'var(--text-secondary)' };
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AllProjects({ showToast }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [statusDraft, setStatusDraft] = useState('Active');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const searchInputRef = useRef(null);

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

  useEffect(() => {
    const onKeyDown = (event) => {
      const targetTag = String(event.target?.tagName || '').toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return;
      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const viewProject = async (project) => {
    setSelected(project);
    setStatusDraft(project.status || 'Active');
    try {
      await loadProjectUpdates(project.projectId);
    } catch {
      setUpdates([]);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selected) return;
    setStatusUpdating(true);
    try {
      const res = await api.updateProjectStatus(selected.projectId, statusDraft);
      const updatedProject = res.data.project;
      setSelected(updatedProject);
      setProjects((prev) => prev.map((project) => (project.projectId === updatedProject.projectId ? updatedProject : project)));
      showToast(res.data.message || 'Status updated', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const matched = projects.filter((project) => {
      const statusOk =
        statusFilter === 'all' ||
        String(project.status || '').toLowerCase() === statusFilter;
      if (!statusOk) return false;
      if (!term) return true;

      const haystack = [
        project.name,
        project.projectId,
        project.location,
        project.type,
        project.contractor?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });

    const sorted = [...matched];
    sorted.sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'highest_fund') return Number(b.totalFund || 0) - Number(a.totalFund || 0);
      if (sortBy === 'highest_spent') return Number(b.spentFund || 0) - Number(a.spentFund || 0);
      if (sortBy === 'highest_progress') {
        const aProgress = getPercent(a.spentFund, a.totalFund);
        const bProgress = getPercent(b.spentFund, b.totalFund);
        return bProgress - aProgress;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return sorted;
  }, [projects, searchTerm, statusFilter, sortBy]);

  const statusCounts = useMemo(
    () => ({
      created: projects.filter((project) => String(project.status || '').toLowerCase() === 'created').length,
      active: projects.filter((project) => String(project.status || '').toLowerCase() === 'active').length,
      completed: projects.filter((project) => String(project.status || '').toLowerCase() === 'completed').length,
      suspended: projects.filter((project) => String(project.status || '').toLowerCase() === 'suspended').length,
    }),
    [projects]
  );

  const handleExportProjects = () => {
    if (filteredProjects.length === 0) {
      showToast('No project rows to export', 'info');
      return;
    }
    const rows = [
      ['Project', 'Project ID', 'Type', 'Location', 'Contractor', 'Total Fund', 'Spent Fund', 'Status', 'Created Date', 'Tx Hash'],
      ...filteredProjects.map((project) => [
        project.name,
        project.projectId,
        project.type,
        project.location,
        project.contractor?.name || '',
        project.totalFund,
        project.spentFund,
        project.status,
        formatDate(project.createdAt),
        project.blockchainTxHash || '',
      ]),
    ];
    downloadCsv(`all-projects-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    showToast('Projects exported as CSV', 'success');
  };

  if (loading) return <div className="spinner" />;

  if (selected) {
    const percent = getPercent(selected.spentFund, selected.totalFund);

    return (
      <div>
        <div className="section-header">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Back</button>
          </div>
          <div className="section-subtitle">
            <LastUpdatedLabel value={lastUpdated} />
          </div>
        </div>

        <div className="explain-grid">
          <ExplainPanel
            title="Project Review Flow"
            subtitle="For authority presentation"
            tone="accent"
            steps={[
              'Open details and explain fund utilization.',
              'Show timeline for complete action history.',
              'Show blockchain hash for proof.',
              'Apply project status update if needed.',
            ]}
          />
          <ExplainPanel
            title="Status Meaning"
            subtitle="Clear labels for non-technical audience"
            tone="green"
            steps={['Created = registered', 'Active = in progress', 'Completed = finished', 'Suspended = paused']}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div className="form-card" style={{ maxWidth: '100%' }}>
            <div className="form-title">{selected.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>{selected.location}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>TOTAL FUND</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{formatINR(selected.totalFund)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>AMOUNT SPENT</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--orange)', fontFamily: 'var(--font-display)' }}>{formatINR(selected.spentFund)}</div>
              </div>
            </div>

            <div className="fund-bar-track" style={{ marginBottom: 8 }}>
              <div className={`fund-bar-fill ${percent > 80 ? 'danger' : ''}`} style={{ width: `${percent}%` }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 16 }}>{percent}% utilized | Remaining: {formatINR(selected.totalFund - selected.spentFund)}</div>

            <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--text-secondary)' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Contractor:</span> {selected.contractor?.name}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Type:</span> {selected.type}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Status:</span> <span className={`status-badge status-${String(selected.status || '').toLowerCase()}`}>{selected.status}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Created:</span> {formatDate(selected.createdAt)}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Verifications:</span> <span style={{ color: 'var(--green)' }}>Done {selected.verificationCount?.workDone || 0}</span> / <span style={{ color: 'var(--red)' }}>Not done {selected.verificationCount?.notDone || 0}</span></div>
            </div>

            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>UPDATE PROJECT STATUS</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-select" value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <button className="btn btn-primary" type="button" disabled={statusUpdating || statusDraft === selected.status} onClick={handleStatusUpdate}>
                  {statusUpdating ? 'Updating...' : 'Apply'}
                </button>
              </div>
            </div>
          </div>

          <div className="form-card" style={{ maxWidth: '100%' }}>
            <div className="form-title" style={{ fontSize: 14, marginBottom: 12 }}>Blockchain Record</div>
            <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--text-secondary)' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Project ID:</span> {selected.projectId}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Chain Status:</span> {selected.blockchainStatus === 'confirmed' ? <span style={{ color: 'var(--green)' }}>Confirmed</span> : <span style={{ color: 'var(--orange)' }}>{selected.blockchainStatus}</span>}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Contractor Address:</span></div>
              <div style={{ fontSize: 10, color: 'var(--accent)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>{selected.contractor?.address}</div>
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>TRANSACTION HASH</div>
              <TxHashDisplay hash={selected.blockchainTxHash} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <ProjectTimelineCard projectId={selected.projectId} showToast={showToast} />
        </div>

        <div className="section-header">
          <div className="section-title" style={{ fontSize: 16 }}>Work Updates ({updates.length})</div>
        </div>

        {updates.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 0' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No updates submitted yet.</div>
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
          <div className="section-title">All Projects</div>
          <div className="section-subtitle">
            Showing {filteredProjects.length}/{projects.length} projects | <LastUpdatedLabel value={lastUpdated} />
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={handleExportProjects}>
          Export CSV
        </button>
      </div>

      <div className="explain-grid">
        <ExplainPanel
          title="How To Use This Page"
          subtitle="Simple explanation for evaluator"
          tone="accent"
          steps={[
            'Each row is one infrastructure project.',
            'Progress shows spent amount versus total budget.',
            'Click View for timeline and blockchain proof.',
          ]}
        />
        <ExplainPanel
          title="Table Status Legend"
          subtitle="Visual meaning"
          tone="orange"
          steps={['Created: project added', 'Active: work ongoing', 'Completed: phase done', 'Suspended: currently paused']}
        />
      </div>
      <div className="filter-row">
        <input
          ref={searchInputRef}
          className="form-input"
          style={{ minWidth: 220, maxWidth: 320 }}
          placeholder="Search by name, ID, location, contractor (/)"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        {[
          { id: 'all', label: `All (${projects.length})` },
          { id: 'created', label: `Created (${statusCounts.created})` },
          { id: 'active', label: `Active (${statusCounts.active})` },
          { id: 'completed', label: `Completed (${statusCounts.completed})` },
          { id: 'suspended', label: `Suspended (${statusCounts.suspended})` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`filter-chip ${statusFilter === item.id ? 'active' : ''}`}
            onClick={() => setStatusFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        <select
          className="form-select"
          style={{ minWidth: 180, maxWidth: 220 }}
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="newest">Sort: Newest</option>
          <option value="name">Sort: Name A-Z</option>
          <option value="highest_fund">Sort: Highest Fund</option>
          <option value="highest_spent">Sort: Highest Spent</option>
          <option value="highest_progress">Sort: Highest Progress</option>
        </select>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSearchTerm('');
            setStatusFilter('all');
            setSortBy('newest');
          }}
        >
          Clear filters
        </button>
      </div>
      <StatusLegend statuses={['created', 'active', 'completed', 'suspended']} />

      {filteredProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">
            {projects.length === 0 ? 'No projects found' : 'No projects match current filters'}
          </div>
          <div className="empty-desc">
            {projects.length === 0
              ? 'Create your first project using the sidebar.'
              : 'Change search/filter to view matching projects.'}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Type</th>
                <th>Location</th>
                <th>Total Fund</th>
                <th>Spent</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const percent = getPercent(project.spentFund, project.totalFund);
                return (
                  <tr key={project.projectId}>
                    <td>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{project.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{project.projectId}</div>
                    </td>
                    <td><span className={`project-type-badge type-${project.type?.toLowerCase().replace(' ', '')}`}>{project.type}</span></td>
                    <td style={{ fontSize: 11 }}>{project.location}</td>
                    <td style={{ color: 'var(--accent)' }}>{formatINR(project.totalFund)}</td>
                    <td style={{ color: 'var(--orange)' }}>{formatINR(project.spentFund)}</td>
                    <td>
                      <div style={{ width: 80 }}>
                        <div className="fund-bar-track" style={{ height: 4 }}>
                          <div className={`fund-bar-fill ${percent > 80 ? 'danger' : ''}`} style={{ width: `${percent}%` }} />
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{percent}%</div>
                      </div>
                    </td>
                    <td><span className={`status-badge status-${String(project.status || '').toLowerCase()}`}>{project.status}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => viewProject(project)}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
