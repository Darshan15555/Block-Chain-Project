import { useState, useEffect, useMemo, useRef } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import ProjectCard from '../components/ProjectCard.jsx';
import ProjectTimelineCard from '../components/ProjectTimelineCard.jsx';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';

const STATUS_OPTIONS = ['Created', 'Active', 'Completed', 'Suspended'];

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

export default function AllProjects({ showToast, onNavigate }) {
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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const searchInputRef = useRef(null);

  const loadProjects = async () => {
    const res = await api.getProjects();
    setProjects(res.data?.projects || []);
    setLastUpdated(new Date());
  };

  const loadProjectUpdates = async (projectId) => {
    const res = await api.getUpdates(projectId);
    setUpdates(res.data?.updates || []);
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
    const refreshed = projects.find((p) => p.projectId === selected.projectId);
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

  const handleUpdateStatus = async () => {
    if (!selected?.projectId) return;
    setStatusUpdating(true);
    try {
      await api.updateProjectStatus(selected.projectId, statusDraft);
      showToast(`Status updated to ${statusDraft}`, 'success');
      await loadProjects();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = projects.filter((project) => {
      const statusOk =
        statusFilter === 'all' ||
        String(project.status || '').toLowerCase() === statusFilter;
      if (!statusOk) return false;

      if (!term) return true;
      return (
        String(project.name || '').toLowerCase().includes(term) ||
        String(project.location || '').toLowerCase().includes(term) ||
        String(project.projectId || '').toLowerCase().includes(term) ||
        String(project.contractor?.name || '').toLowerCase().includes(term)
      );
    });

    return rows.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'budget_high') return (b.totalFund || 0) - (a.totalFund || 0);
      if (sortBy === 'budget_low') return (a.totalFund || 0) - (b.totalFund || 0);
      if (sortBy === 'progress') {
        const pctA = getPercent(a.spentFund, a.totalFund);
        const pctB = getPercent(b.spentFund, b.totalFund);
        return pctB - pctA;
      }
      return 0;
    });
  }, [projects, searchTerm, statusFilter, sortBy]);

  const handleExportCsv = () => {
    if (filteredProjects.length === 0) {
      showToast('No projects to export', 'info');
      return;
    }
    const headers = [
      'Project ID',
      'Name',
      'Sector',
      'Location',
      'Total Fund (INR)',
      'Released Fund (INR)',
      'Spent Fund (INR)',
      'Progress (%)',
      'Contractor',
      'Status',
      'Created Date',
    ];
    const rows = filteredProjects.map((p) => [
      p.projectId,
      p.name,
      p.type,
      p.location,
      p.totalFund,
      p.releasedFund || 0,
      p.spentFund || 0,
      getPercent(p.spentFund, p.totalFund),
      p.contractor?.name || '',
      p.status || 'Active',
      formatDate(p.createdAt),
    ]);
    downloadCsv(`blockfund-projects-${Date.now()}.csv`, [headers, ...rows]);
    showToast('Exported projects CSV', 'success');
  };

  if (loading) {
    return (
      <div className="bf-page-stack">
        <LoadingSkeleton type="metric" count={3} />
        <LoadingSkeleton type="card" count={3} height={200} />
      </div>
    );
  }

  return (
    <div className="bf-page-stack">
      {/* Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Infrastructure Project Repository</h1>
          <p className="bf-page-subtitle">
            Comprehensive ledger of government-sanctioned civic infrastructure, budget milestones, and physical construction logs.
          </p>
        </div>
        <div className="bf-page-header-actions">
          <LastUpdatedLabel date={lastUpdated} />
          <button
            type="button"
            className="bf-secondary-btn bf-btn-sm"
            onClick={handleExportCsv}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
          {onNavigate && (
            <button
              type="button"
              className="bf-primary-btn"
              onClick={() => onNavigate('create')}
            >
              <span>+ New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bf-card bf-search-filter-card">
        <div className="bf-filter-controls-row">
          {/* Search Box */}
          <div className="bf-search-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              className="bf-search-input"
              placeholder="Search projects by name, location, or contractor... (Press / to focus)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="bf-clear-btn"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            className="bf-select bf-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="budget_high">Budget: Highest First</option>
            <option value="budget_low">Budget: Lowest First</option>
            <option value="progress">Milestone Progress</option>
          </select>

          {/* View Toggle */}
          <div className="bf-view-toggle">
            <button
              type="button"
              className={`bf-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              className={`bf-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="bf-status-chips-row">
          <span className="bf-chips-label">STATUS:</span>
          {['all', 'active', 'completed', 'suspended', 'created'].map((st) => (
            <button
              key={st}
              type="button"
              className={`bf-filter-pill ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
          <span className="bf-results-count">{filteredProjects.length} projects found</span>
        </div>
      </div>

      {/* Projects Display: Grid or Table */}
      {filteredProjects.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="bf-projects-catalog-grid">
            {filteredProjects.map((p) => (
              <ProjectCard
                key={p.projectId}
                project={p}
                onViewDetails={viewProject}
              />
            ))}
          </div>
        ) : (
          <div className="bf-card">
            <div className="bf-table-responsive">
              <table className="bf-table">
                <thead>
                  <tr>
                    <th>PROJECT NAME</th>
                    <th>SECTOR</th>
                    <th>LOCATION</th>
                    <th>BUDGET</th>
                    <th>RELEASED</th>
                    <th>PROGRESS</th>
                    <th>CONTRACTOR</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => {
                    const pct = getPercent(p.spentFund, p.totalFund);
                    return (
                      <tr key={p.projectId} onClick={() => viewProject(p)} style={{ cursor: 'pointer' }}>
                        <td>
                          <strong>{p.name}</strong>
                          <div className="font-mono text-muted" style={{ fontSize: 10 }}>{p.projectId}</div>
                        </td>
                        <td>
                          <span className={`project-type-badge type-${p.type?.toLowerCase().replace(/\s+/g, '')}`}>
                            {p.type}
                          </span>
                        </td>
                        <td>{p.location}</td>
                        <td className="font-semibold">{formatINR(p.totalFund)}</td>
                        <td className="text-blue">{formatINR(p.releasedFund || 0)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="fund-bar-track" style={{ width: 60, height: 6 }}>
                              <div className="fund-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: 11 }}>{pct}%</span>
                          </div>
                        </td>
                        <td>{p.contractor?.name || 'Vetted Firm'}</td>
                        <td><StatusBadge status={p.status || 'Active'} size="sm" /></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="bf-secondary-btn bf-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewProject(p);
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <EmptyState
          title="No matching projects"
          description="Try clearing your search query or switching status filters."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setStatusFilter('all');
          }}
        />
      )}

      {/* Project Detail Modal / Drawer */}
      {selected && (
        <div className="bf-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="bf-modal-card bf-project-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bf-modal-header">
              <div>
                <span className={`project-type-badge type-${selected.type?.toLowerCase().replace(/\s+/g, '')}`}>
                  {selected.type}
                </span>
                <h2 className="bf-modal-title">{selected.name}</h2>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  📍 {selected.location} • ID: <span className="font-mono">{selected.projectId}</span>
                </div>
              </div>
              <button
                type="button"
                className="bf-btn-ghost"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            <div className="bf-modal-body">
              {/* Financial Breakdown Card */}
              <div className="bf-project-metrics-row">
                <div className="bf-proj-metric-box">
                  <span className="bf-metric-box-lbl">TOTAL BUDGET</span>
                  <span className="bf-metric-box-val">{formatINR(selected.totalFund)}</span>
                </div>
                <div className="bf-proj-metric-box">
                  <span className="bf-metric-box-lbl">FUNDS RELEASED</span>
                  <span className="bf-metric-box-val text-blue">{formatINR(selected.releasedFund || 0)}</span>
                </div>
                <div className="bf-proj-metric-box">
                  <span className="bf-metric-box-lbl">AMOUNT SPENT</span>
                  <span className="bf-metric-box-val text-amber">{formatINR(selected.spentFund || 0)}</span>
                </div>
              </div>

              {/* Status Update Control */}
              <div className="bf-status-update-row">
                <label className="bf-label">Update Project Status:</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="bf-select"
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    style={{ maxWidth: 200 }}
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="bf-primary-btn bf-btn-sm"
                    onClick={handleUpdateStatus}
                    disabled={statusUpdating || statusDraft === selected.status}
                  >
                    {statusUpdating ? 'Updating...' : 'Commit Status'}
                  </button>
                </div>
              </div>

              {/* Blockchain Proof Info */}
              {selected.blockchainTxHash && (
                <div style={{ margin: '14px 0' }}>
                  <TxHashDisplay hash={selected.blockchainTxHash} label="On-Chain Deployment Hash" />
                </div>
              )}

              {/* Timeline of Updates */}
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '20px 0 10px' }}>
                Milestone Progress History ({updates.length})
              </h3>
              {updates.length > 0 ? (
                <div className="bf-timeline-feed">
                  {updates.map((u, i) => (
                    <ProjectTimelineCard key={u._id || i} update={u} />
                  ))}
                </div>
              ) : (
                <p className="text-muted" style={{ fontSize: 13 }}>No updates logged yet for this project.</p>
              )}
            </div>

            <div className="bf-modal-footer">
              <button
                type="button"
                className="bf-secondary-btn"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
