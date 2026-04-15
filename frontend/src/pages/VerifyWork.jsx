import { useState, useEffect, useMemo } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import ExplainPanel from '../components/ExplainPanel.jsx';
import StatusLegend from '../components/StatusLegend.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';

export default function VerifyWork({ showToast }) {
  const [projects, setProjects] = useState([]);
  const [latestUpdates, setLatestUpdates] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);
  const [activeComment, setActiveComment] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [done, setDone] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyWithUpdates, setOnlyWithUpdates] = useState(false);
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [sortBy, setSortBy] = useState('latest_update');

  const loadData = async () => {
    const projectsRes = await api.getProjects();
    const fetchedProjects = projectsRes.data.projects || [];
    setProjects(fetchedProjects);

    const updatesEntries = await Promise.all(
      fetchedProjects.map(async (project) => {
        try {
          const updatesRes = await api.getUpdates(project.projectId);
          const latest = updatesRes.data.updates?.[0] || null;
          return [project.projectId, latest];
        } catch {
          return [project.projectId, null];
        }
      })
    );

    setLatestUpdates(Object.fromEntries(updatesEntries));
    setLastUpdated(new Date());
  };

  useEffect(() => {
    loadData()
      .catch(() => showToast('Failed to load projects', 'error'))
      .finally(() => setLoading(false));

    const timer = setInterval(() => {
      loadData().catch(() => {});
    }, 7000);

    return () => clearInterval(timer);
  }, [showToast]);

  const handleVerify = async (projectId, status) => {
    const latestUpdate = latestUpdates[projectId];
    if (!latestUpdate?._id) {
      showToast('No update available to verify for this project', 'error');
      return;
    }

    const doneKey = `${projectId}:${latestUpdate._id}`;
    setSubmitting(doneKey + status);

    try {
      await api.verifyWork({
        projectId,
        updateId: latestUpdate._id,
        status,
        comment: commentDrafts[projectId] || '',
      });

      showToast(`Verified as "${status}"`, 'success');
      setDone((prev) => ({ ...prev, [doneKey]: status }));
      setActiveComment(null);
      setCommentDrafts((prev) => ({ ...prev, [projectId]: '' }));

      setProjects((prev) => prev.map((project) => {
        if (project.projectId !== projectId) return project;
        const counts = { ...project.verificationCount };
        if (status === 'Work Done') counts.workDone = (counts.workDone || 0) + 1;
        else counts.notDone = (counts.notDone || 0) + 1;
        return { ...project, verificationCount: counts };
      }));
    } catch (error) {
      showToast(error.response?.data?.error || 'Verification failed', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = projects.filter((project) => {
      const statusOk =
        statusFilter === 'all' ||
        String(project.status || '').toLowerCase() === statusFilter;
      if (!statusOk) return false;

      const latestUpdate = latestUpdates[project.projectId];
      if (onlyWithUpdates && !latestUpdate) return false;

      if (!term) return true;
      const haystack = [
        project.name,
        project.projectId,
        project.location,
        project.contractor?.name,
        project.type,
        latestUpdate?.workDescription,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
    const withUnverified = rows.filter((project) => {
      if (!onlyUnverified) return true;
      const latestUpdate = latestUpdates[project.projectId];
      if (!latestUpdate?._id) return false;
      const doneKey = `${project.projectId}:${latestUpdate._id}`;
      return !done[doneKey];
    });

    return withUnverified.sort((a, b) => {
      if (sortBy === 'highest_spent') return Number(b.spentFund || 0) - Number(a.spentFund || 0);
      if (sortBy === 'highest_progress') return getPercent(b.spentFund, b.totalFund) - getPercent(a.spentFund, a.totalFund);
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      const aTs = new Date(latestUpdates[a.projectId]?.date || a.createdAt || 0).getTime();
      const bTs = new Date(latestUpdates[b.projectId]?.date || b.createdAt || 0).getTime();
      return bTs - aTs;
    });
  }, [projects, latestUpdates, searchTerm, statusFilter, onlyWithUpdates, onlyUnverified, done, sortBy]);

  const handleExportVerificationRows = () => {
    if (filteredProjects.length === 0) {
      showToast('No verification rows to export', 'info');
      return;
    }
    const rows = [
      ['Project', 'Project ID', 'Contractor', 'Status', 'Spent', 'Total', 'Latest Update Date', 'Latest Update Summary'],
      ...filteredProjects.map((project) => {
        const latest = latestUpdates[project.projectId];
        return [
          project.name,
          project.projectId,
          project.contractor?.name || '',
          project.status,
          project.spentFund,
          project.totalFund,
          formatDate(latest?.date),
          latest?.workDescription || '',
        ];
      }),
    ];
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
    link.setAttribute('download', `verify-work-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Verification list exported', 'success');
  };

  const statusCounts = useMemo(
    () => ({
      created: projects.filter((project) => String(project.status || '').toLowerCase() === 'created').length,
      active: projects.filter((project) => String(project.status || '').toLowerCase() === 'active').length,
      completed: projects.filter((project) => String(project.status || '').toLowerCase() === 'completed').length,
      suspended: projects.filter((project) => String(project.status || '').toLowerCase() === 'suspended').length,
    }),
    [projects]
  );

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Verify Work</div>
          <div className="section-subtitle">
            One user can verify each update only once | <LastUpdatedLabel value={lastUpdated} />
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={handleExportVerificationRows}>
          Export CSV
        </button>
      </div>

      <div className="explain-grid">
        <ExplainPanel
          title="Verification In 4 Steps"
          subtitle="Public role flow"
          tone="green"
          steps={[
            'Open project and check latest update summary.',
            'Compare work details with your observation.',
            'Select Work Done or Not Done once.',
            'Optional comment helps audit clarity.',
          ]}
        />
        <ExplainPanel
          title="What This Proves"
          subtitle="For non-technical audience"
          tone="accent"
          steps={[
            'Community can validate project progress.',
            'Verification counts are transparent on dashboard.',
            'Latest update trace links to blockchain timeline.',
          ]}
        />
      </div>

      <StatusLegend statuses={['created', 'active', 'completed', 'suspended']} />

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 24, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        Verify based on the latest submitted update for each project. Duplicate votes for the same update are blocked server-side.
      </div>
      <div className="filter-row">
        <input
          className="form-input"
          style={{ minWidth: 220, maxWidth: 320 }}
          placeholder="Search project, ID, contractor, latest update"
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
        <button
          type="button"
          className={`filter-chip ${onlyWithUpdates ? 'active' : ''}`}
          onClick={() => setOnlyWithUpdates((prev) => !prev)}
        >
          Only with updates
        </button>
        <button
          type="button"
          className={`filter-chip ${onlyUnverified ? 'active' : ''}`}
          onClick={() => setOnlyUnverified((prev) => !prev)}
        >
          Only unverified
        </button>
        <select
          className="form-select"
          style={{ minWidth: 170, maxWidth: 210 }}
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="latest_update">Sort: Latest Update</option>
          <option value="highest_spent">Sort: Highest Spent</option>
          <option value="highest_progress">Sort: Highest Progress</option>
          <option value="name">Sort: Name A-Z</option>
        </select>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSearchTerm('');
            setStatusFilter('all');
            setOnlyWithUpdates(false);
            setOnlyUnverified(false);
            setSortBy('latest_update');
          }}
        >
          Clear filters
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">
            {projects.length === 0 ? 'No projects to verify' : 'No projects match current filters'}
          </div>
          <div className="empty-desc">
            {projects.length === 0
              ? 'Projects will appear here after authority creates them.'
              : 'Adjust search/filter options to continue verification.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredProjects.map((project) => {
            const percent = getPercent(project.spentFund, project.totalFund);
            const latestUpdate = latestUpdates[project.projectId];
            const doneKey = latestUpdate?._id ? `${project.projectId}:${latestUpdate._id}` : null;
            const alreadyVerified = doneKey ? done[doneKey] : null;

            return (
              <div key={project.projectId} className="project-card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span className={`project-type-badge type-${project.type?.toLowerCase().replace(' ', '')}`}>{project.type}</span>
                      <span className={`status-badge status-${String(project.status || '').toLowerCase()}`}>{project.status}</span>
                    </div>
                    <div className="project-name" style={{ fontSize: 15 }}>{project.name}</div>
                    <div className="project-location">{project.location}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, marginBottom: 10 }}>
                      Contractor: {project.contractor?.name}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>FUND UTILIZATION</div>
                        <div className="fund-bar-track">
                          <div className={`fund-bar-fill ${percent > 80 ? 'danger' : ''}`} style={{ width: `${percent}%` }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          {formatINR(project.spentFund)} / {formatINR(project.totalFund)} ({percent}%)
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        <span style={{ color: 'var(--green)' }}>Done: {project.verificationCount?.workDone || 0}</span>
                        <span style={{ color: 'var(--red)' }}>Not Done: {project.verificationCount?.notDone || 0}</span>
                      </div>
                    </div>

                    {latestUpdate ? (
                      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                        Latest update: {formatDate(latestUpdate.date)} - {latestUpdate.workDescription}
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--orange)' }}>
                        No submitted updates yet for verification.
                      </div>
                    )}
                  </div>

                  <div style={{ minWidth: 220 }}>
                    {!latestUpdate ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verification available once contractor submits an update.</div>
                    ) : alreadyVerified ? (
                      <div style={{
                        padding: '12px 16px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700,
                        background: alreadyVerified === 'Work Done' ? 'var(--green-glow)' : 'var(--red-glow)',
                        color: alreadyVerified === 'Work Done' ? 'var(--green)' : 'var(--red)',
                        border: `1px solid ${alreadyVerified === 'Work Done' ? 'rgba(0,255,136,0.3)' : 'rgba(255,77,109,0.3)'}`,
                      }}>
                        You marked: {alreadyVerified}
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button
                            className="verify-btn verify-done"
                            disabled={submitting === doneKey + 'Work Done'}
                            onClick={() => handleVerify(project.projectId, 'Work Done')}
                          >
                            {submitting === doneKey + 'Work Done' ? 'Submitting...' : 'Work Done'}
                          </button>
                          <button
                            className="verify-btn verify-notdone"
                            disabled={submitting === doneKey + 'Not Done'}
                            onClick={() => handleVerify(project.projectId, 'Not Done')}
                          >
                            {submitting === doneKey + 'Not Done' ? 'Submitting...' : 'Not Done'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 10 }}
                            onClick={() => setActiveComment(activeComment === project.projectId ? null : project.projectId)}
                          >
                            Add comment
                          </button>
                        </div>

                        {activeComment === project.projectId && (
                          <div style={{ marginTop: 8 }}>
                            <textarea
                              className="form-textarea"
                              style={{ minHeight: 60, fontSize: 11 }}
                              placeholder="Optional: describe what you observed..."
                              value={commentDrafts[project.projectId] || ''}
                              onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [project.projectId]: event.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
