import { useState, useEffect } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';

function requestStatusLabel(status) {
  if (status === 'pending') return 'Pending';
  if (status === 'accepted') return 'Accepted';
  if (status === 'released') return 'Released';
  if (status === 'rejected') return 'Rejected';
  return status;
}

export default function ContractorDashboard({ showToast, currentUser }) {
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [raisingRequest, setRaisingRequest] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [requestForm, setRequestForm] = useState({
    projectId: '',
    amount: '',
    note: '',
  });

  const loadDashboard = async () => {
    const [projectsRes, requestsRes, statsRes] = await Promise.all([
      api.getProjects(),
      api.getContractRequests(),
      api.getStats(),
    ]);

    setProjects(projectsRes.data.projects || []);
    setRequests(requestsRes.data.requests || []);
    setStats(statsRes.data.stats || null);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    loadDashboard()
      .catch(() => showToast('Failed to load contractor data', 'error'))
      .finally(() => setLoading(false));

    const timer = setInterval(() => {
      loadDashboard().catch(() => {});
    }, 6000);

    return () => clearInterval(timer);
  }, [showToast]);

  const handleRespond = async (requestId, action) => {
    setResponding(`${requestId}:${action}`);
    try {
      const response = await api.respondContractRequest(requestId, { action });
      showToast(response.data.message || `Request ${action}ed`, 'success');
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to process request', 'error');
    } finally {
      setResponding(null);
    }
  };

  const handleRaiseRequest = async (event) => {
    event.preventDefault();
    if (!requestForm.projectId || !requestForm.amount) {
      showToast('Select project and amount to request', 'error');
      return;
    }

    setRaisingRequest(true);
    try {
      const res = await api.raiseContractorFundRequest({
        projectId: requestForm.projectId,
        amount: Number(requestForm.amount),
        note: requestForm.note,
      });
      showToast(res.data.message || 'Request raised to authority', 'success');
      setRequestForm({ projectId: '', amount: '', note: '' });
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to raise request', 'error');
    } finally {
      setRaisingRequest(false);
    }
  };

  if (loading) return <div className="spinner" />;

  const roleStats = stats?.roleStats || {};
  const totalAssigned = projects.length;
  const totalValue = projects.reduce((acc, project) => acc + Number(project.totalFund || 0), 0);
  const totalSpent = projects.reduce((acc, project) => acc + Number(project.spentFund || 0), 0);
  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const authorityRequests = requests.filter(
    (request) => !request.initiatedBy || request.initiatedBy === 'authority'
  );
  const authorityPending = authorityRequests.filter((request) => request.status === 'pending');
  const recentAuthorityRequests = authorityRequests.slice(0, 8);

  const selectedProject = projects.find((project) => project.projectId === requestForm.projectId);

  return (
    <div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: 'var(--orange-glow)', border: '1px solid var(--orange)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>C</div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{currentUser?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Contractor account | <LastUpdatedLabel value={lastUpdated} />
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card orange">
          <div className="stat-label">Projects Assigned</div>
          <div className="stat-value">{roleStats.projectsAssigned ?? totalAssigned}</div>
          <div className="stat-sub">Active contracts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Funds Requested</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatINR(roleStats.totalFundsRequested)}</div>
          <div className="stat-sub">Requests raised/received</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Funds Received</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatINR(roleStats.totalFundsReceived)}</div>
          <div className="stat-sub">Released on-chain</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Pending Requests</div>
          <div className="stat-value">{stats?.pendingFundingRequests ?? pendingRequests.length}</div>
          <div className="stat-sub">Awaiting your action</div>
        </div>
      </div>

      <div
        className="form-card"
        style={{ maxWidth: '100%', marginBottom: 20, borderColor: 'rgba(0, 212, 255, 0.25)' }}
      >
        <div className="form-title" style={{ fontSize: 15 }}>Request Inbox</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          Logged in as <span style={{ color: 'var(--accent)' }}>{currentUser?.name}</span> (@{currentUser?.username}).
          {' '}Pending requests from authority for this account: <span style={{ color: 'var(--orange)' }}>{authorityPending.length}</span>.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <div className="form-title" style={{ fontSize: 15 }}>Request Funds (Contractor)</div>
          <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
            Assigned Contractor: <span style={{ color: 'var(--accent)' }}>{currentUser?.name || '-'}</span>
          </div>
          <form onSubmit={handleRaiseRequest}>
            <div className="form-group">
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={requestForm.projectId}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, projectId: event.target.value }))}
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedProject && (
              <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                Assigned Contractor: <span style={{ color: 'var(--accent)' }}>{selectedProject.contractor?.name}</span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Amount (INR)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={requestForm.amount}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="Enter amount"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea
                className="form-textarea"
                value={requestForm.note}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Purpose of request"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={raisingRequest}>
              {raisingRequest ? 'Submitting...' : 'Request Funds'}
            </button>
          </form>
        </div>

        <div className="form-card" style={{ maxWidth: '100%' }}>
          <div className="form-title" style={{ fontSize: 15, marginBottom: 8 }}>Funding Request Notifications</div>
          {recentAuthorityRequests.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.7 }}>
              No authority request found for this account.
              <br />
              If authority sent request to another contractor, login with that contractor username.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentAuthorityRequests.map((request) => (
                <div key={request._id} className="project-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className={`status-badge status-${
                      request.status === 'pending' ? 'pending' :
                        request.status === 'accepted' ? 'active' :
                          request.status === 'released' ? 'completed' : 'suspended'
                    }`}>
                      {requestStatusLabel(request.status)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(request.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>{request.projectName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Amount: {formatINR(request.amount)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Requested by: {request.authorityName || 'Authority'}
                  </div>
                  {request.note && (
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Note: {request.note}
                    </div>
                  )}
                  <TxHashDisplay hash={request.blockchainTxHash} />
                  {request.status === 'pending' && (!request.initiatedBy || request.initiatedBy === 'authority') && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={responding === `${request._id}:accept`}
                        onClick={() => handleRespond(request._id, 'accept')}
                      >
                        {responding === `${request._id}:accept` ? 'Accepting...' : 'Accept'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={responding === `${request._id}:reject`}
                        onClick={() => handleRespond(request._id, 'reject')}
                      >
                        {responding === `${request._id}:reject` ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">My Projects</div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No projects assigned</div>
          <div className="empty-desc">Contact the authority to get projects assigned.</div>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => {
            const percent = getPercent(project.spentFund, project.totalFund);
            return (
              <div key={project.projectId} className="project-card">
                <div className="project-card-header">
                  <span className={`project-type-badge type-${project.type?.toLowerCase().replace(' ', '')}`}>{project.type}</span>
                  <span className={`status-badge status-${project.status?.toLowerCase()}`}>{project.status}</span>
                </div>
                <div className="project-name">{project.name}</div>
                <div className="project-location">{project.location}</div>
                <div className="fund-bar-container">
                  <div className="fund-bar-label">
                    <span>Spent: {formatINR(project.spentFund)}</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="fund-bar-track">
                    <div className={`fund-bar-fill ${percent > 80 ? 'danger' : ''}`} style={{ width: `${percent}%` }} />
                  </div>
                  <div className="fund-bar-label" style={{ marginTop: 4 }}>
                    <span>Total: {formatINR(project.totalFund)}</span>
                    <span>Remaining: {formatINR(project.totalFund - project.spentFund)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                  Contract value: {formatINR(totalValue)} | Utilized: {formatINR(totalSpent)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
