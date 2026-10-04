import { useState, useEffect } from 'react';
import { api, formatINR, formatDate, getPercent } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';

export default function AuthorityDashboard({ showToast, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reconciliationTasks, setReconciliationTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [releasingRequestId, setReleasingRequestId] = useState(null);
  const [retryingTaskId, setRetryingTaskId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [requestFilter, setRequestFilter] = useState('all');
  const [form, setForm] = useState({
    projectId: '',
    amount: '',
    note: '',
  });

  const loadDashboard = async () => {
    const [statsRes, projectsRes, requestsRes, reconciliationRes] = await Promise.all([
      api.getStats(),
      api.getProjects(),
      api.getContractRequests(),
      api.getReconciliationTasks(),
    ]);

    setStats(statsRes.data?.stats || null);
    setProjects(projectsRes.data?.projects || []);
    setRequests(requestsRes.data?.requests || []);
    setReconciliationTasks(reconciliationRes.data?.tasks || []);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    loadDashboard()
      .catch(() => showToast('Failed to load dashboard metrics', 'error'))
      .finally(() => setLoading(false));

    const timer = setInterval(() => {
      loadDashboard().catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [showToast]);

  const selectedProject = projects.find((project) => project.projectId === form.projectId);

  const handleSendRequest = async (event) => {
    event.preventDefault();
    if (!form.projectId || !form.amount) {
      showToast('Please select a project and specify the funding amount', 'error');
      return;
    }

    const numAmount = Number(form.amount);
    if (!numAmount || numAmount <= 0) {
      showToast('Amount must be greater than zero', 'error');
      return;
    }

    setRequesting(true);
    try {
      const response = await api.sendContractRequest({
        projectId: form.projectId,
        amount: numAmount,
        note: form.note,
      });
      const target = response.data?.targetContractor;
      const successMessage =
        response.data?.message ||
        (target ? `Funding request dispatched to ${target.name}` : 'Funding request sent');
      showToast(successMessage, 'success');
      setForm({ projectId: '', amount: '', note: '' });
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to dispatch request', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const handleReleaseAcceptedRequest = async (requestId) => {
    setReleasingRequestId(requestId);
    try {
      const res = await api.releaseAcceptedRequest(requestId);
      showToast(res.data.message || 'Smart contract funds successfully released!', 'success');
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to release smart contract funds', 'error');
    } finally {
      setReleasingRequestId(null);
    }
  };

  const handleRetryTask = async (taskId) => {
    setRetryingTaskId(taskId);
    try {
      const res = await api.retryReconciliation(taskId);
      showToast(res.data.message || 'Reconciliation synchronized with blockchain', 'success');
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Reconciliation retry failed', 'error');
    } finally {
      setRetryingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="bf-page-stack">
        <LoadingSkeleton type="metric" count={4} />
        <LoadingSkeleton type="card" count={2} height={260} />
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const filteredRequests = requestFilter === 'all'
    ? requests
    : requests.filter((r) => String(r.status).toLowerCase() === requestFilter);

  // Chart data for Budget vs Released
  const chartData = projects.slice(0, 6).map((p) => ({
    name: p.name.length > 15 ? p.name.slice(0, 14) + '…' : p.name,
    Allocated: Number(p.totalFund || 0) / 100000, // In Lakhs for readable scale
    Released: Number(p.releasedFund || 0) / 100000,
    Spent: Number(p.spentFund || 0) / 100000,
  }));

  return (
    <div className="bf-page-stack">
      {/* Page Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Treasury & Infrastructure Oversight</h1>
          <p className="bf-page-subtitle">
            Executive oversight of state civil works, blockchain escrow balances, and contractor disbursements.
          </p>
        </div>
        <div className="bf-page-header-actions">
          <LastUpdatedLabel date={lastUpdated} />
          {onNavigate && (
            <button
              type="button"
              className="bf-primary-btn"
              onClick={() => onNavigate('create')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Reconciliation Alert Banner (if any pending tasks) */}
      {reconciliationTasks.length > 0 && (
        <div className="bf-alert-card warning">
          <div className="bf-alert-content">
            <span className="bf-alert-icon">⚠️</span>
            <div>
              <strong className="bf-alert-title">Blockchain Synchronization Required</strong>
              <p className="bf-alert-text">
                {reconciliationTasks.length} offline or failed transaction(s) pending reconciliation with Ganache node.
              </p>
            </div>
          </div>
          <div className="bf-alert-actions">
            {reconciliationTasks.map((t) => (
              <button
                key={t._id}
                type="button"
                className="bf-secondary-btn bf-btn-sm"
                onClick={() => handleRetryTask(t._id)}
                disabled={retryingTaskId === t._id}
              >
                {retryingTaskId === t._id ? 'Syncing...' : `Retry ${t.actionType}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="bf-stats-grid">
        <StatCard
          title="TOTAL BUDGET ALLOCATED"
          value={formatINR(stats?.totalFund || 0)}
          subtitle="Committed in Smart Contract"
          tone="blue"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
        />

        <StatCard
          title="FUNDS RELEASED TO DATE"
          value={formatINR(stats?.totalReleasedFund || 0)}
          subtitle={`${getPercent(stats?.totalReleasedFund, stats?.totalFund)}% of Total Treasury`}
          tone="emerald"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />

        <StatCard
          title="ACTIVE INFRASTRUCTURE"
          value={stats?.totalProjects || projects.length}
          subtitle={`${projects.filter(p => p.status === 'Active').length} Active Construction`}
          tone="purple"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          }
        />

        <StatCard
          title="PENDING CONTRACTOR ACTIONS"
          value={pendingRequests.length}
          subtitle={`${requests.filter(r => r.status === 'accepted').length} Accepted & Ready for Release`}
          tone={pendingRequests.length > 0 ? 'amber' : 'slate'}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      </div>

      {/* Two-Column Mid Section */}
      <div className="bf-dashboard-grid">
        {/* Left: Funding Allocation vs Released Visualization */}
        <div className="bf-card">
          <div className="bf-card-header-bar">
            <div>
              <h2 className="bf-card-title">Treasury Disbursement Overview</h2>
              <p className="bf-card-sub">Allocated vs Released vs Spent across top active projects (₹ in Lakhs)</p>
            </div>
          </div>

          <div style={{ width: '100%', height: 260, marginTop: 16 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="L" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: 10,
                      border: 'none',
                      color: '#ffffff',
                      fontSize: 12,
                    }}
                    formatter={(val) => [`₹${(val).toLocaleString('en-IN')} L`, '']}
                  />
                  <Bar dataKey="Allocated" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Released" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Spent" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No project data" description="Create a project to generate treasury charts." />
            )}
          </div>
          <div className="bf-chart-legend">
            <span className="bf-legend-item"><span className="bf-legend-dot bg-blue" /> Allocated</span>
            <span className="bf-legend-item"><span className="bf-legend-dot bg-emerald" /> Released</span>
            <span className="bf-legend-item"><span className="bf-legend-dot bg-amber" /> Spent</span>
          </div>
        </div>

        {/* Right: Dispatch Milestone Funding Request */}
        <div className="bf-card">
          <div className="bf-card-header-bar">
            <div>
              <h2 className="bf-card-title">Dispatch Funding Authorization</h2>
              <p className="bf-card-sub">Authorize contractors to claim funds upon verified milestones</p>
            </div>
          </div>

          <form onSubmit={handleSendRequest} className="bf-form" style={{ marginTop: 14 }}>
            <div className="bf-input-group">
              <label className="bf-label">Target Infrastructure Project *</label>
              <select
                className="bf-select"
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                required
              >
                <option value="">Select an active project...</option>
                {projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.name} ({p.location}) — Unreleased: {formatINR(Math.max(0, p.totalFund - (p.releasedFund || 0)))}
                  </option>
                ))}
              </select>
            </div>

            {selectedProject && (
              <div className="bf-project-quick-preview">
                <div>
                  <span className="bf-quick-lbl">Contractor:</span>
                  <span className="bf-quick-val">{selectedProject.contractor?.name || 'Assigned Firm'}</span>
                </div>
                <div>
                  <span className="bf-quick-lbl">Wallet:</span>
                  <span className="bf-quick-val font-mono">
                    {selectedProject.contractor?.walletAddress
                      ? `${selectedProject.contractor.walletAddress.slice(0, 8)}...${selectedProject.contractor.walletAddress.slice(-6)}`
                      : 'No wallet linked'}
                  </span>
                </div>
              </div>
            )}

            <div className="bf-input-group">
              <label className="bf-label">Milestone Amount (INR) *</label>
              <input
                type="number"
                className="bf-input"
                placeholder="e.g. 500000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>

            <div className="bf-input-group">
              <label className="bf-label">Authorization Note / Milestone Details</label>
              <input
                type="text"
                className="bf-input"
                placeholder="e.g. Foundation pile testing completed"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="bf-primary-btn"
              style={{ marginTop: 8 }}
              disabled={requesting}
            >
              <span>{requesting ? 'Dispatching Request...' : 'Authorize Milestone Funding'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Contractor Funding Requests Ledger Table */}
      <div className="bf-card">
        <div className="bf-card-header-bar">
          <div>
            <h2 className="bf-card-title">Milestone Fund Requests</h2>
            <p className="bf-card-sub">Review incoming requests and execute smart contract fund transfers</p>
          </div>

          <div className="bf-filter-tabs">
            {['all', 'pending', 'accepted', 'released', 'rejected'].map((statusKey) => (
              <button
                key={statusKey}
                type="button"
                className={`bf-filter-tab ${requestFilter === statusKey ? 'active' : ''}`}
                onClick={() => setRequestFilter(statusKey)}
              >
                {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredRequests.length > 0 ? (
          <div className="bf-table-responsive">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>REQUEST ID</th>
                  <th>PROJECT</th>
                  <th>CONTRACTOR</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>INITIATED BY</th>
                  <th>DATE</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => {
                  const isAccepted = r.status === 'accepted';
                  return (
                    <tr key={r._id}>
                      <td className="font-mono text-muted">{r._id.slice(-6).toUpperCase()}</td>
                      <td>
                        <strong>{r.projectName || r.projectId}</strong>
                      </td>
                      <td>{r.targetContractor?.name || r.contractorName || 'Contractor'}</td>
                      <td className="font-semibold text-blue">{formatINR(r.amount)}</td>
                      <td>
                        <StatusBadge status={r.status} size="sm" />
                      </td>
                      <td className="text-secondary">{r.initiatedBy === 'contractor' ? 'Contractor Request' : 'Authority Dispatched'}</td>
                      <td className="text-muted">{formatDate(r.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {isAccepted ? (
                          <button
                            type="button"
                            className="bf-primary-btn bf-btn-sm"
                            onClick={() => handleReleaseAcceptedRequest(r._id)}
                            disabled={releasingRequestId === r._id}
                          >
                            <span>{releasingRequestId === r._id ? 'Releasing...' : 'Release Funds'}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                        ) : r.releaseTxHash ? (
                          <TxHashDisplay hash={r.releaseTxHash} label="Tx" />
                        ) : (
                          <span className="text-muted" style={{ fontSize: 11 }}>
                            {r.status === 'pending' ? 'Awaiting acceptance' : 'Archived'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No requests match this filter"
            description="All milestone requests are currently processed or no items exist under this status."
          />
        )}
      </div>
    </div>
  );
}
