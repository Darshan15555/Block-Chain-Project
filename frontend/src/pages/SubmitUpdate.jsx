import { useState, useEffect } from 'react';
import { api, formatINR } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';

export default function SubmitUpdate({ showToast }) {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    workDescription: '',
    materialsUsed: '',
    workersCount: '',
    amountSpent: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.getProjects()
      .then((res) => setProjects(res.data.projects || []))
      .catch(() => showToast('Failed to load projects', 'error'));
  }, []);

  const selected = projects.find((project) => project.projectId === form.projectId);
  const total = selected ? Number(selected.totalFund || 0) : 0;
  const released = selected ? Number(selected.releasedFund || 0) : 0;
  const spent = selected ? Number(selected.spentFund || 0) : 0;
  const budgetRemaining = Math.max(0, total - spent);
  const releasedUnspent = Math.max(0, released - spent);
  const inputAmount = Number(form.amountSpent) || 0;
  const projectedSpent = Math.max(0, spent + inputAmount);
  const projectedBudgetRemaining = Math.max(0, total - projectedSpent);
  const projectedReleasedUnspent = Math.max(0, released - projectedSpent);
  const releaseShortfall = Math.max(0, inputAmount - releasedUnspent);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (submitError) {
      setSubmitError('');
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const publishError = (message) => {
    setSubmitError(message);
    showToast(message, 'error');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.projectId || !form.workDescription || !form.amountSpent) {
      publishError('Please fill all required fields');
      return;
    }

    const numericAmount = Number(form.amountSpent);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      publishError('Amount spent must be greater than zero');
      return;
    }

    setLoading(true);
    setSubmitError('');
    try {
      let effectiveProject = selected;
      try {
        const fresh = await api.getProject(form.projectId);
        if (fresh?.data?.project) {
          effectiveProject = fresh.data.project;
          setProjects((prev) =>
            prev.map((item) => (item.projectId === effectiveProject.projectId ? effectiveProject : item))
          );
        }
      } catch {
        // Non-blocking. If refresh fails, use current loaded project snapshot.
      }

      const effectiveReleased = Number(effectiveProject?.releasedFund || 0);
      const effectiveSpent = Number(effectiveProject?.spentFund || 0);
      const effectiveReleasedUnspent = Math.max(0, effectiveReleased - effectiveSpent);

      if (effectiveReleasedUnspent <= 0) {
        publishError('No released balance available. Ask authority to release funds first.');
        return;
      }

      if (numericAmount > effectiveReleasedUnspent) {
        publishError(`Amount exceeds released but unspent funds (${formatINR(effectiveReleasedUnspent)})`);
        return;
      }

      const payload = {
        projectId: form.projectId,
        date: form.date,
        workDescription: form.workDescription,
        materialsUsed: form.materialsUsed,
        workersCount: Number(form.workersCount) || 0,
        amountSpent: numericAmount,
      };
      const response = await api.submitUpdate({
        ...payload,
      });

      setResult(response.data);
      showToast(response.data.message, 'success');
      setForm((prev) => ({
        ...prev,
        workDescription: '',
        materialsUsed: '',
        workersCount: '',
        amountSpent: '',
      }));

      const refresh = await api.getProjects();
      setProjects(refresh.data.projects || []);
    } catch (error) {
      const serverMessage = error.response?.data?.error || 'Failed to submit update';
      publishError(serverMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Submit Daily Update</div>
          <div className="section-subtitle">Log work progress with blockchain proof</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Select Project *</label>
              <select className="form-select" name="projectId" value={form.projectId} onChange={handleChange}>
                <option value="">- Select your project -</option>
                {projects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>{project.name}</option>
                ))}
              </select>
            </div>

            {selected && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Project Budget:</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatINR(total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Released Fund:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatINR(released)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Already Spent:</span>
                  <span style={{ color: 'var(--orange)' }}>{formatINR(spent)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Usable Now (On-chain):</span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>{formatINR(releasedUnspent)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Remaining Budget:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatINR(budgetRemaining)}</span>
                </div>
                <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                  Work expense can be logged only from released funds for smart-contract transparency.
                </div>
                {total > 0 && released <= 0 && (
                  <div style={{ marginTop: 4, color: 'var(--orange)' }}>
                    Budget is allocated, but spend is blocked until authority releases funds.
                  </div>
                )}
              </div>
            )}
            {selected && releasedUnspent <= 0 && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}
              >
                No usable released balance yet. Go to Contractor Dashboard and raise a fund request.
              </div>
            )}
            {selected && inputAmount > 0 && releasedUnspent > 0 && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(0, 212, 255, 0.35)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 11 }}>
                <div style={{ color: 'var(--accent)', marginBottom: 6, fontWeight: 700 }}>After This Entry</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Spent (Projected):</span>
                  <span style={{ color: 'var(--orange)' }}>{formatINR(projectedSpent)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Released but Unspent (Projected):</span>
                  <span style={{ color: 'var(--green)' }}>{formatINR(projectedReleasedUnspent)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Remaining Fund (Projected):</span>
                  <span style={{ color: 'var(--green)' }}>{formatINR(projectedBudgetRemaining)}</span>
                </div>
              </div>
            )}
            {selected && inputAmount > 0 && releaseShortfall > 0 && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255, 140, 66, 0.35)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: 'var(--orange)' }}>
                Need additional release: {formatINR(releaseShortfall)} before this entry can be submitted.
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" name="date" value={form.date} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Work Description *</label>
              <textarea className="form-textarea" name="workDescription" value={form.workDescription} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Materials Used</label>
              <input className="form-input" name="materialsUsed" value={form.materialsUsed} onChange={handleChange} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Workers Count</label>
                <input className="form-input" type="number" name="workersCount" value={form.workersCount} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount Spent (INR) *</label>
                <input className="form-input" type="number" name="amountSpent" value={form.amountSpent} onChange={handleChange} min="1" max={releasedUnspent || undefined} />
              </div>
            </div>

            {submitError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 77, 109, 0.35)',
                  background: 'rgba(255, 77, 109, 0.08)',
                  fontSize: 11,
                  color: 'var(--red)',
                }}
              >
                {submitError}
              </div>
            )}

            <button
              className="btn btn-success"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? 'Recording update...' : 'Submit Update'}
            </button>
          </form>
        </div>

        <div>
          <div className="form-card" style={{ maxWidth: '100%', marginBottom: 16 }}>
            <div className="form-title" style={{ fontSize: 14, marginBottom: 10 }}>Submission flow</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 2 }}>
              <div>1. Validate contractor, project assignment, and released balance</div>
              <div>2. Hash update payload for smart-contract proof</div>
              <div>3. Submit logExpense transaction on chain (immutable)</div>
              <div>4. Persist update and increment spent fund in MongoDB</div>
            </div>
          </div>

          {result && (
            <div className="form-card" style={{ maxWidth: '100%' }}>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>
                Update recorded on chain and database
              </div>
              {result.blockchain?.txHash && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>TX HASH</div>
                  <TxHashDisplay hash={result.blockchain.txHash} />
                </>
              )}
              {result.blockchain?.dataHash && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                  Smart Contract Hash: {String(result.blockchain.dataHash).slice(0, 18)}...{String(result.blockchain.dataHash).slice(-10)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
