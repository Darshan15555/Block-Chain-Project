import { useState, useEffect } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';

export default function ContractorDashboard({ showToast, currentUser, onNavigate }) {
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

    setProjects(projectsRes.data?.projects || []);
    setRequests(requestsRes.data?.requests || []);
    setStats(statsRes.data?.stats || null);
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
      showToast(response.data?.message || `Request ${action}ed successfully`, 'success');
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
      showToast('Select a project and specify the required milestone amount', 'error');
      return;
    }

    const numAmt = Number(requestForm.amount);
    if (!numAmt || numAmt <= 0) {
      showToast('Amount must be greater than zero', 'error');
      return;
    }

    setRaisingRequest(true);
    try {
      const res = await api.raiseContractorFundRequest({
        projectId: requestForm.projectId,
        amount: numAmt,
        note: requestForm.note,
      });
      showToast(res.data?.message || 'Milestone request submitted to Central Authority', 'success');
      setRequestForm({ projectId: '', amount: '', note: '' });
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to submit milestone request', 'error');
    } finally {
      setRaisingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="bf-page-stack">
        <LoadingSkeleton type="metric" count={4} />
        <LoadingSkeleton type="card" count={2} height={200} />
      </div>
    );
  }

  const totalAssigned = projects.length;
  const totalValue = projects.reduce((acc, p) => acc + Number(p.totalFund || 0), 0);
  const totalReleased = projects.reduce((acc, p) => acc + Number(p.releasedFund || 0), 0);
  const totalSpent = projects.reduce((acc, p) => acc + Number(p.spentFund || 0), 0);
  const availableLiquidity = Math.max(0, totalReleased - totalSpent);

  // Incoming requests from Authority awaiting contractor acceptance
  const authorityPending = requests.filter(
    (r) => r.status === 'pending' && (!r.initiatedBy || r.initiatedBy === 'authority')
  );

  return (
    <div className="bf-page-stack">
      {/* Page Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Contractor Operations Command</h1>
          <p className="bf-page-subtitle">
            Manage assigned civil contracts, review funding authorizations, and log cryptographic milestone proof.
          </p>
        </div>
        <div className="bf-page-header-actions">
          <LastUpdatedLabel date={lastUpdated} />
          {onNavigate && (
            <button
              type="button"
              className="bf-primary-btn"
              onClick={() => onNavigate('update')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Submit Work Proof</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="bf-stats-grid">
        <StatCard
          title="ASSIGNED CIVIL CONTRACTS"
          value={totalAssigned}
          subtitle={`${projects.filter(p => p.status === 'Active').length} Active Construction`}
          tone="blue"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        />

        <StatCard
          title="TOTAL CONTRACT VALUE"
          value={formatINR(totalValue)}
          subtitle="Committed in Smart Contract Escrow"
          tone="purple"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />

        <StatCard
          title="AVAILABLE UNSPENT LIQUIDITY"
          value={formatINR(availableLiquidity)}
          subtitle="Disbursed & Ready for Expenses"
          tone="emerald"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />

        <StatCard
          title="PENDING AUTHORIZATIONS"
          value={authorityPending.length}
          subtitle={authorityPending.length > 0 ? 'Requires your acceptance' : 'All authorizations accepted'}
          tone={authorityPending.length > 0 ? 'amber' : 'slate'}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      </div>

      {/* Actionable Incoming Authorizations Banner */}
      {authorityPending.length > 0 && (
        <div className="bf-card bf-pending-action-card">
          <div className="bf-card-header-bar">
            <div>
              <span className="bf-badge-pulse" style={{ position: 'static', display: 'inline-block' }} />
              <h2 className="bf-card-title" style={{ display: 'inline', marginLeft: 8 }}>
                Incoming Fund Authorizations from Central Authority ({authorityPending.length})
              </h2>
              <p className="bf-card-sub">
                Accept these authorizations to allow the Authority to trigger on-chain smart contract disbursements to your wallet.
              </p>
            </div>
          </div>

          <div className="bf-request-cards-grid">
            {authorityPending.map((r) => (
              <div key={r._id} className="bf-actionable-req-card">
                <div className="bf-req-card-top">
                  <span className="bf-req-project-name">{r.projectName || r.projectId}</span>
                  <span className="bf-req-amount">{formatINR(r.amount)}</span>
                </div>

                {r.note && (
                  <p className="bf-req-note">
                    <strong>Milestone Note:</strong> {r.note}
                  </p>
                )}

                <div className="bf-req-card-actions">
                  <button
                    type="button"
                    className="bf-primary-btn bf-btn-sm"
                    onClick={() => handleRespond(r._id, 'accept')}
                    disabled={!!responding}
                  >
                    <span>{responding === `${r._id}:accept` ? 'Accepting...' : 'Accept Authorization'}</span>
                  </button>
                  <button
                    type="button"
                    className="bf-secondary-btn bf-btn-sm bf-btn-danger"
                    onClick={() => handleRespond(r._id, 'reject')}
                    disabled={!!responding}
                  >
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout: Assigned Projects + Raise Milestone Request */}
      <div className="bf-dashboard-grid">
        {/* Left: Assigned Projects Overview */}
        <div className="bf-card">
          <div className="bf-card-header-bar">
            <div>
              <h2 className="bf-card-title">Assigned Civil Projects</h2>
              <p className="bf-card-sub">Active site allocations and current budget status</p>
            </div>
            {onNavigate && (
              <button
                type="button"
                className="bf-secondary-btn bf-btn-sm"
                onClick={() => onNavigate('myprojects')}
              >
                View Full List
              </button>
            )}
          </div>

          {projects.length > 0 ? (
            <div className="bf-assigned-list">
              {projects.slice(0, 4).map((p) => {
                const pct = getPercent(p.spentFund, p.totalFund);
                return (
                  <div key={p.projectId} className="bf-assigned-item">
                    <div className="bf-assigned-header">
                      <div>
                        <strong className="bf-assigned-name">{p.name}</strong>
                        <div className="bf-assigned-loc">📍 {p.location}</div>
                      </div>
                      <StatusBadge status={p.status || 'Active'} size="sm" />
                    </div>

                    <div className="bf-assigned-metrics">
                      <div>
                        <span className="bf-metric-mini-lbl">Budget Spent</span>
                        <span className="bf-metric-mini-val">{formatINR(p.spentFund)}</span>
                      </div>
                      <div>
                        <span className="bf-metric-mini-lbl">Released</span>
                        <span className="bf-metric-mini-val text-blue">{formatINR(p.releasedFund || 0)}</span>
                      </div>
                      <div>
                        <span className="bf-metric-mini-lbl">Total Budget</span>
                        <span className="bf-metric-mini-val">{formatINR(p.totalFund)}</span>
                      </div>
                    </div>

                    <div className="fund-bar-container">
                      <div className="fund-bar-label">
                        <span>Milestone Progress</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="fund-bar-track">
                        <div className="fund-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No projects assigned"
              description="Your company currently has no active infrastructure contracts assigned."
            />
          )}
        </div>

        {/* Right: Raise Milestone Fund Request to Authority */}
        <div className="bf-card">
          <div className="bf-card-header-bar">
            <div>
              <h2 className="bf-card-title">Request Milestone Advance</h2>
              <p className="bf-card-sub">Submit formal funding claims to Central Authority for upcoming work stages</p>
            </div>
          </div>

          <form onSubmit={handleRaiseRequest} className="bf-form" style={{ marginTop: 14 }}>
            <div className="bf-input-group">
              <label className="bf-label">Project Contract *</label>
              <select
                className="bf-select"
                value={requestForm.projectId}
                onChange={(e) => setRequestForm({ ...requestForm, projectId: e.target.value })}
                required
              >
                <option value="">Select an assigned project...</option>
                {projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.name} (Remaining: {formatINR(Math.max(0, p.totalFund - (p.releasedFund || 0)))})
                  </option>
                ))}
              </select>
            </div>

            <div className="bf-input-group">
              <label className="bf-label">Requested Amount (INR) *</label>
              <input
                type="number"
                className="bf-input"
                placeholder="e.g. 750000"
                value={requestForm.amount}
                onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                required
              />
            </div>

            <div className="bf-input-group">
              <label className="bf-label">Justification & Milestone Stage</label>
              <textarea
                className="bf-textarea"
                rows={3}
                placeholder="Describe the milestone deliverables (e.g. Completing bridge girder installation requiring cement batch #4)..."
                value={requestForm.note}
                onChange={(e) => setRequestForm({ ...requestForm, note: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="bf-primary-btn"
              disabled={raisingRequest}
              style={{ marginTop: 8 }}
            >
              <span>{raisingRequest ? 'Submitting Claim...' : 'Submit Milestone Claim to Authority'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
