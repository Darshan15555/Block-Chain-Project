import { useState, useEffect } from 'react';
import { api, formatINR, getPercent } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';

export default function ReleaseFunds({ showToast }) {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ projectId: '', amount: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';

  useEffect(() => {
    api.getProjects()
      .then((res) => setProjects(res.data.projects))
      .catch(() => showToast('Failed to load projects', 'error'));
  }, []);

  const selectedProject = projects.find((project) => project.projectId === form.projectId);
  const released = selectedProject ? Number(selectedProject.releasedFund || 0) : 0;
  const remaining = selectedProject ? Number(selectedProject.totalFund) - released : 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.projectId || !form.amount) {
      showToast('Fill all fields', 'error');
      return;
    }

    if (Number(form.amount) > remaining) {
      showToast('Amount exceeds remaining funds', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.releaseFunds({ projectId: form.projectId, amount: Number(form.amount) });
      setResult(res.data);
      showToast(res.data.message, 'success');
      setForm((prev) => ({ ...prev, amount: '' }));

      const refresh = await api.getProjects();
      setProjects(refresh.data.projects);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to release funds', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Release Funds</div>
          <div className="section-subtitle">Authority-only smart contract transfer to contractor wallet</div>
        </div>
      </div>

      <div className="explain-grid">
        <ExplainPanel
          title="Important Demo Note"
          subtitle="Recommended flow"
          tone="orange"
          steps={[
            'Do not use direct release in demo mode.',
            'Use Authority Dashboard request table release action.',
            'That ensures Request -> Accept -> Release sequence.',
          ]}
        />
        <ExplainPanel
          title="If You Use This Page"
          subtitle="Fallback for non-demo mode"
          tone="accent"
          steps={[
            'Select project and check remaining budget.',
            'Enter release amount within remaining fund.',
            'Copy transaction hash after success.',
          ]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Select Project *</label>
              <select className="form-select" value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
                <option value="">- Select Project -</option>
                {projects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>{project.name}</option>
                ))}
              </select>
            </div>

            {selectedProject && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>PROJECT FUND STATUS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 11, textAlign: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 2 }}>TOTAL</div>
                    <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatINR(selectedProject.totalFund)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 2 }}>RELEASED</div>
                    <div style={{ color: 'var(--orange)', fontWeight: 700 }}>{formatINR(released)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 2 }}>REMAINING</div>
                    <div style={{ color: 'var(--green)', fontWeight: 700 }}>{formatINR(remaining)}</div>
                  </div>
                </div>
                <div className="fund-bar-track" style={{ marginTop: 10 }}>
                  <div className="fund-bar-fill" style={{ width: `${getPercent(released, selectedProject.totalFund)}%` }} />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Amount to Release (INR) *</label>
              <input
                className="form-input"
                type="number"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="Enter amount"
                min="1"
                max={remaining}
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading || demoMode} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Submitting transfer...' : demoMode ? 'Disabled in Demo Mode' : 'Release Funds'}
            </button>
          </form>
          {demoMode && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--orange)' }}>
              Direct release is disabled in demo mode. Use Request {'->'} Accept {'->'} Release from Authority Dashboard.
            </div>
          )}
        </div>

        <div>
          <div className="form-card" style={{ maxWidth: '100%', marginBottom: 16 }}>
            <div className="form-title" style={{ fontSize: 14, marginBottom: 10 }}>Smart contract flow</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 2 }}>
              <div>1. Authority triggers `releaseFunds(projectId, amount)`</div>
              <div>2. Contract validates remaining project budget</div>
              <div>3. ETH is transferred to contractor wallet</div>
              <div>4. Backend updates MongoDB released amount after receipt</div>
            </div>
          </div>

          {result && (
            <div className="form-card" style={{ maxWidth: '100%' }}>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>
                Funds released and synced
              </div>
              {result.blockchain?.txHash && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>TRANSACTION HASH</div>
                  <TxHashDisplay hash={result.blockchain.txHash} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
