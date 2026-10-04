import { useState, useEffect, useMemo } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
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
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const loadData = async () => {
    const projectsRes = await api.getProjects();
    const fetchedProjects = projectsRes.data?.projects || [];
    setProjects(fetchedProjects);

    const updatesEntries = await Promise.all(
      fetchedProjects.map(async (project) => {
        try {
          const updatesRes = await api.getUpdates(project.projectId);
          const latest = updatesRes.data?.updates?.[0] || null;
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
      .catch(() => showToast('Failed to load projects for verification', 'error'))
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

      showToast(`Verification registered as "${status}" on public ledger`, 'success');
      setDone((prev) => ({ ...prev, [doneKey]: status }));
      setActiveComment(null);
      setCommentDrafts((prev) => ({ ...prev, [projectId]: '' }));

      setProjects((prev) =>
        prev.map((project) => {
          if (project.projectId !== projectId) return project;
          const counts = { ...project.verificationCount };
          if (status === 'Work Done') counts.workDone = (counts.workDone || 0) + 1;
          else counts.notDone = (counts.notDone || 0) + 1;
          return { ...project, verificationCount: counts };
        })
      );
    } catch (error) {
      showToast(error.response?.data?.error || 'Verification failed', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return projects.filter((project) => {
      const statusOk =
        statusFilter === 'all' ||
        String(project.status || '').toLowerCase() === statusFilter;
      if (!statusOk) return false;

      if (!term) return true;
      return (
        String(project.name || '').toLowerCase().includes(term) ||
        String(project.location || '').toLowerCase().includes(term) ||
        String(project.projectId || '').toLowerCase().includes(term)
      );
    });
  }, [projects, searchTerm, statusFilter]);

  if (loading) {
    return (
      <div className="bf-page-stack">
        <LoadingSkeleton type="card" count={3} height={220} />
      </div>
    );
  }

  return (
    <div className="bf-page-stack">
      {/* Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Citizen Work Verification & Public Audit</h1>
          <p className="bf-page-subtitle">
            Inspect photographic evidence and material claims submitted by contractors. Cast your public verification vote.
          </p>
        </div>
        <LastUpdatedLabel date={lastUpdated} />
      </div>

      {/* Filter Bar */}
      <div className="bf-card bf-search-filter-card">
        <div className="bf-filter-controls-row">
          <div className="bf-search-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="bf-search-input"
              placeholder="Search projects to audit by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bf-status-chips-row" style={{ margin: 0 }}>
            {['all', 'active', 'completed', 'suspended'].map((st) => (
              <button
                key={st}
                type="button"
                className={`bf-filter-pill ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Verification Cards Grid */}
      {filteredProjects.length > 0 ? (
        <div className="bf-verify-feed">
          {filteredProjects.map((p) => {
            const latest = latestUpdates[p.projectId];
            const doneKey = latest ? `${p.projectId}:${latest._id}` : '';
            const userVoted = done[doneKey];
            const workDone = p.verificationCount?.workDone || 0;
            const notDone = p.verificationCount?.notDone || 0;

            return (
              <div key={p.projectId} className="bf-card bf-verify-card">
                <div className="bf-verify-card-header">
                  <div>
                    <div className="bf-verify-card-meta">
                      <span className={`project-type-badge type-${p.type?.toLowerCase().replace(/\s+/g, '')}`}>
                        {p.type}
                      </span>
                      <span>📍 {p.location}</span>
                      <span className="font-mono text-muted">ID: {p.projectId}</span>
                    </div>
                    <h2 className="bf-verify-project-title">{p.name}</h2>
                  </div>
                  <StatusBadge status={p.status || 'Active'} />
                </div>

                {/* Latest Milestone Update Inspection */}
                {latest ? (
                  <div className="bf-verify-evidence-box">
                    <div className="bf-evidence-header">
                      <span className="bf-evidence-tag">LATEST MILESTONE LOG</span>
                      <span className="bf-evidence-date">{formatDate(latest.date || latest.createdAt)}</span>
                    </div>

                    <p className="bf-evidence-desc">
                      "{latest.workDescription}"
                    </p>

                    <div className="bf-evidence-details-row">
                      <div>
                        <span className="bf-micro-lbl">Expenditure Claimed</span>
                        <strong className="text-blue">{formatINR(latest.amountSpent)}</strong>
                      </div>
                      {latest.materialsUsed && (
                        <div>
                          <span className="bf-micro-lbl">Materials Consumed</span>
                          <span>{latest.materialsUsed}</span>
                        </div>
                      )}
                      {latest.workersCount > 0 && (
                        <div>
                          <span className="bf-micro-lbl">On-Site Labor</span>
                          <span>{latest.workersCount} Workers</span>
                        </div>
                      )}
                    </div>

                    {/* Evidence Photo */}
                    {latest.photoPath && (
                      <div className="bf-evidence-photo-strip">
                        <img
                          src={latest.photoPath.startsWith('http') ? latest.photoPath : `/${latest.photoPath.replace(/^[\/\\]+/, '')}`}
                          alt="Site verification evidence"
                          className="bf-evidence-preview-img"
                          onClick={() => setPreviewPhoto(latest.photoPath)}
                        />
                        <span className="bf-evidence-zoom-hint">🔍 Click photo to inspect high-resolution site proof</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bf-no-update-banner">
                    <span>ℹ️ No physical work updates have been logged yet for this project.</span>
                  </div>
                )}

                {/* Verification Action Bar */}
                <div className="bf-verify-actions-bar">
                  <div className="bf-tally-pill">
                    <span className="text-emerald font-semibold">✓ {workDone} Verified</span>
                    <span className="text-muted">|</span>
                    <span className="text-danger font-semibold">✕ {notDone} Issues</span>
                  </div>

                  {userVoted ? (
                    <div className="bf-voted-badge">
                      ✓ You voted: <strong>{userVoted}</strong>
                    </div>
                  ) : (
                    <div className="bf-vote-buttons-row">
                      <button
                        type="button"
                        className="bf-primary-btn bf-btn-sm bf-vote-btn done"
                        onClick={() => handleVerify(p.projectId, 'Work Done')}
                        disabled={!latest || submitting === `${doneKey}Work Done`}
                      >
                        <span>{submitting === `${doneKey}Work Done` ? 'Voting...' : '✓ Confirm Work Done'}</span>
                      </button>

                      <button
                        type="button"
                        className="bf-secondary-btn bf-btn-sm bf-vote-btn not-done"
                        onClick={() => handleVerify(p.projectId, 'Not Done')}
                        disabled={!latest || submitting === `${doneKey}Not Done`}
                      >
                        <span>✕ Report Discrepancy</span>
                      </button>

                      <button
                        type="button"
                        className="bf-btn-ghost bf-btn-sm"
                        onClick={() => setActiveComment(activeComment === p.projectId ? null : p.projectId)}
                      >
                        💬 {activeComment === p.projectId ? 'Hide Comment' : 'Add Comment'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Optional Comment Input Drawer */}
                {activeComment === p.projectId && !userVoted && (
                  <div className="bf-comment-drawer">
                    <input
                      type="text"
                      className="bf-input"
                      placeholder="Add an optional comment regarding on-ground site verification..."
                      value={commentDrafts[p.projectId] || ''}
                      onChange={(e) => setCommentDrafts({ ...commentDrafts, [p.projectId]: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No projects available for verification"
          description="There are currently no projects matching your query."
        />
      )}

      {/* Photo Modal Preview if clicked */}
      {previewPhoto && (
        <div className="bf-modal-backdrop" onClick={() => setPreviewPhoto(null)}>
          <div className="bf-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="bf-modal-header">
              <h3>Site Milestone Photo Evidence</h3>
              <button type="button" className="bf-btn-ghost" onClick={() => setPreviewPhoto(null)}>✕</button>
            </div>
            <img
              src={previewPhoto.startsWith('http') ? previewPhoto : `/${previewPhoto.replace(/^[\/\\]+/, '')}`}
              alt="Evidence Inspection"
              style={{ width: '100%', maxHeight: 460, objectFit: 'cover', borderRadius: 12 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
