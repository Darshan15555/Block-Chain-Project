import { useState, useEffect } from 'react';
import { api, formatINR, formatDate } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';

function requestStatusLabel(status) {
  if (status === 'pending') return 'Pending approval';
  if (status === 'accepted') return 'Accepted';
  if (status === 'released') return 'Released';
  if (status === 'rejected') return 'Rejected';
  return status;
}

export default function AuthorityDashboard({ showToast }) {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reconciliationTasks, setReconciliationTasks] = useState([]);
  const [readiness, setReadiness] = useState(null);
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
    const [statsRes, projectsRes, requestsRes, reconciliationRes, readinessRes] = await Promise.all([
      api.getStats(),
      api.getProjects(),
      api.getContractRequests(),
      api.getReconciliationTasks(),
      api.getDemoReadiness(),
    ]);

    setStats(statsRes.data.stats || null);
    setProjects(projectsRes.data.projects || []);
    setRequests(requestsRes.data.requests || []);
    setReconciliationTasks(reconciliationRes.data.tasks || []);
    setReadiness(readinessRes.data.readiness || null);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    loadDashboard()
      .catch(() => showToast('Failed to load dashboard data', 'error'))
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
      showToast('Select project and amount', 'error');
      return;
    }

    setRequesting(true);
    try {
      const response = await api.sendContractRequest({
        projectId: form.projectId,
        amount: Number(form.amount),
        note: form.note,
      });
      const target = response.data?.targetContractor;
      const successMessage =
        response.data?.message ||
        (target ? `Funding request sent to ${target.name} (@${target.username})` : 'Funding request sent');
      showToast(successMessage, 'success');
      setForm({ projectId: '', amount: '', note: '' });
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to send request', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const handleReleaseAcceptedRequest = async (requestId) => {
    setReleasingRequestId(requestId);
    try {
      const res = await api.releaseAcceptedRequest(requestId);
      showToast(res.data.message || 'Funds released', 'success');
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to release request', 'error');
    } finally {
      setReleasingRequestId(null);
    }
  };

  const handleRetryTask = async (taskId) => {
    setRetryingTaskId(taskId);
    try {
      const res = await api.retryReconciliation(taskId);
      showToast(res.data.message || 'Reconciliation synced', 'success');
      await loadDashboard();
    } catch (error) {
      showToast(error.response?.data?.error || 'Reconciliation retry failed', 'error');
    } finally {
      setRetryingTaskId(null);
    }
  };

  if (loading) return <div className="spinner" />;

  const roleStats = stats?.roleStats || {};
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const acceptedCount = requests.filter((request) => request.status === 'accepted').length;
  const releasedCount = requests.filter((request) => request.status === 'released').length;
  const filteredRequests = requests.filter((request) => requestFilter === 'all' || request.status === requestFilter);
  const chartData = projects.slice(0, 6).map((project) => ({
    name: project.name.substring(0, 12),
    Total: project.totalFund,
    Released: project.releasedFund,
  }));

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Authority Overview</div>
          <div className="section-subtitle">
            <LastUpdatedLabel value={lastUpdated} />
          </div>
        </div>
      </div>

      <div className="explain-grid">
        <ExplainPanel
          title="Simple Demo Story"
          subtitle="Use this sequence while presenting"
          tone="accent"
          steps={[
            'Create a project and assign a contractor.',
            'Send funding request for the selected project.',
            'Contractor accepts the request from their dashboard.',
            'Release funds only after request becomes accepted.',
          ]}
        />
        <ExplainPanel
          title="Action Needed Now"
          subtitle={`Pending: ${pendingCount} | Accepted: ${acceptedCount} | Released: ${releasedCount}`}
          tone={acceptedCount > 0 ? 'green' : 'orange'}
          steps={
            acceptedCount > 0
              ? [`${acceptedCount} request(s) are ready. Click Release in table.`]
              : pendingCount > 0
                ? ['Wait for contractor acceptance, then release funds.']
                : ['Send a new funding request to start the flow.']
          }
        />
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Projects Created</div>
          <div className="stat-value">{roleStats.totalProjectsCreated ?? 0}</div>
          <div className="stat-sub">Authority projects</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Funds Allocated</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatINR(roleStats.totalFundsAllocated)}</div>
          <div className="stat-sub">Project budgets locked</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Funds Released</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatINR(roleStats.totalFundsReleased)}</div>
          <div className="stat-sub">Released after acceptance</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Pending Requests</div>
          <div className="stat-value">{stats?.pendingFundingRequests ?? 0}</div>
          <div className="stat-sub">Awaiting acceptance/release</div>
        </div>
      </div>

      {readiness && (
        <div className="form-card" style={{ maxWidth: '100%', marginBottom: 24 }}>
          <div className="form-title" style={{ fontSize: 15 }}>Demo Readiness</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Checklist: {readiness.checklistCompleted}/{readiness.checklistTotal} | Projects: {readiness.summary?.totalProjects || 0}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
            <div className="mini-list-item">
              <span>Chain</span>
              <span style={{ color: readiness.checks.blockchainConnected ? 'var(--green)' : 'var(--red)' }}>
                {readiness.checks.blockchainConnected ? 'OK' : 'Fail'}
              </span>
            </div>
            <div className="mini-list-item">
              <span>Contract</span>
              <span style={{ color: readiness.checks.contractDeployed ? 'var(--green)' : 'var(--red)' }}>
                {readiness.checks.contractDeployed ? 'OK' : 'Fail'}
              </span>
            </div>
            <div className="mini-list-item">
              <span>Reconcile</span>
              <span style={{ color: readiness.checks.reconciliationClear ? 'var(--green)' : 'var(--orange)' }}>
                {readiness.checks.reconciliationClear ? 'Clear' : 'Pending'}
              </span>
            </div>
          </div>
          {readiness.blockers?.length > 0 ? (
            <div style={{ fontSize: 11, color: 'var(--orange)', lineHeight: 1.8 }}>
              {readiness.blockers.map((item) => (
                <div key={item}>- {item}</div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--green)' }}>All core demo checks are healthy.</div>
          )}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="form-card" style={{ maxWidth: '100%', marginBottom: 24 }}>
          <div className="form-title" style={{ marginBottom: 20 }}>Budget vs Released (Demo)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(value) => `INR ${(value / 100000).toFixed(0)}L`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                formatter={(value) => formatINR(value)}
              />
              <Bar dataKey="Total" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.35} />
              <Bar dataKey="Released" fill="var(--green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <div className="form-title" style={{ fontSize: 15 }}>Send Contractor Funding Request</div>
          <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
            Select a project and the request will be delivered only to its assigned contractor account.
          </div>
          <form onSubmit={handleSendRequest}>
            <div className="form-group">
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={form.projectId}
                onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>
                    {project.name} ({project.contractor?.name})
                  </option>
                ))}
              </select>
            </div>
            {selectedProject && (
              <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                Assigned Contractor: <span style={{ color: 'var(--accent)' }}>{selectedProject.contractor?.name || '-'}</span>
                {' '}(@{selectedProject.contractor?.id || 'unknown'})
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Amount (INR)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="Enter amount"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Note (Optional)</label>
              <textarea
                className="form-textarea"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Add instructions for contractor"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={requesting}>
              {requesting ? 'Sending...' : 'Send Request'}
            </button>
          </form>
        </div>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Recent Funding Requests</div>
          <div className="section-subtitle">Release is enabled only after contractor acceptance</div>
        </div>
      </div>
      <div className="filter-row">
        {[
          { id: 'all', label: `All (${requests.length})` },
          { id: 'pending', label: `Pending (${pendingCount})` },
          { id: 'accepted', label: `Accepted (${acceptedCount})` },
          { id: 'released', label: `Released (${releasedCount})` },
        ].map((item) => (
          <button
            key={item.id}
            className={`filter-chip ${requestFilter === item.id ? 'active' : ''}`}
            type="button"
            onClick={() => setRequestFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filteredRequests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No requests for selected filter</div>
          <div className="empty-desc">Change filter or send a new funding request.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Assigned Contractor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Blockchain</th>
                <th>Release</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request._id}>
                  <td>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{request.projectName}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{request.projectId}</div>
                  </td>
                  <td>{request.contractorName}</td>
                  <td style={{ color: 'var(--accent)' }}>{formatINR(request.amount)}</td>
                  <td>
                    <span className={`status-badge status-${
                      request.status === 'pending' ? 'pending' :
                        request.status === 'accepted' ? 'active' :
                          request.status === 'released' ? 'completed' : 'suspended'
                    }`}>
                      {requestStatusLabel(request.status)}
                    </span>
                  </td>
                  <td>{formatDate(request.createdAt)}</td>
                  <td>
                    <TxHashDisplay hash={request.blockchainTxHash} />
                  </td>
                  <td>
                    {request.status === 'accepted' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={releasingRequestId === request._id}
                        onClick={() => handleReleaseAcceptedRequest(request._id)}
                      >
                        {releasingRequestId === request._id ? 'Releasing...' : 'Release'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Waiting acceptance</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-header">
        <div>
          <div className="section-title">Reconciliation Retry</div>
          <div className="section-subtitle">On-chain success but DB sync failure tasks</div>
        </div>
      </div>

      {reconciliationTasks.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="empty-title" style={{ fontSize: 14 }}>No pending reconciliation tasks</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Project</th>
                <th>Tx</th>
                <th>Retries</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reconciliationTasks.map((task) => (
                <tr key={task._id}>
                  <td>{task.operation}</td>
                  <td>{task.projectId || '-'}</td>
                  <td><TxHashDisplay hash={task.txHash} /></td>
                  <td>{task.syncRetryCount}</td>
                  <td>
                    <button
                      className="btn btn-success btn-sm"
                      disabled={retryingTaskId === task._id}
                      onClick={() => handleRetryTask(task._id)}
                    >
                      {retryingTaskId === task._id ? 'Retrying...' : 'Retry Sync'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
