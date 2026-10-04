import { useEffect, useMemo, useState } from 'react';
import { api, formatINR, getPercent, shortHash } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';

const TX_PHASE_ORDER = ['wallet', 'pending', 'confirming', 'success'];

function stepStatus(phase, step) {
  if (!phase || phase === 'idle') return 'idle';
  if (phase === 'error') {
    return TX_PHASE_ORDER.includes(step) ? 'error' : 'idle';
  }

  const activeIndex = TX_PHASE_ORDER.indexOf(phase);
  const stepIndex = TX_PHASE_ORDER.indexOf(step);
  if (stepIndex < 0) return 'idle';
  if (stepIndex < activeIndex) return 'done';
  if (stepIndex === activeIndex) return 'active';
  return 'idle';
}

export default function ReleaseFunds({ showToast, onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ projectId: '', amount: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [txPhase, setTxPhase] = useState('idle'); // 'idle' | 'wallet' | 'pending' | 'confirming' | 'success' | 'error'
  const [txHash, setTxHash] = useState('');
  const [txError, setTxError] = useState('');

  const loadData = async () => {
    try {
      const [projectsRes, requestsRes] = await Promise.all([
        api.getProjects(),
        api.getContractRequests(),
      ]);
      setProjects(projectsRes.data?.projects || []);
      setRequests(requestsRes.data?.requests || []);
    } catch {
      showToast('Failed to load projects for fund release', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedProject = projects.find((p) => p.projectId === form.projectId);
  const totalFund = selectedProject ? Number(selectedProject.totalFund || 0) : 0;
  const releasedFund = selectedProject ? Number(selectedProject.releasedFund || 0) : 0;
  const remainingEscrow = Math.max(0, totalFund - releasedFund);

  // Check if there is an accepted request matching this project
  const acceptedRequestsForProject = requests.filter(
    (r) => r.projectId === form.projectId && r.status === 'accepted'
  );

  const handleRelease = async (e) => {
    e.preventDefault();
    if (!form.projectId || !form.amount) {
      showToast('Please specify project and release amount', 'error');
      return;
    }

    const numAmount = Number(form.amount);
    if (!numAmount || numAmount <= 0) {
      showToast('Release amount must be greater than zero', 'error');
      return;
    }

    if (numAmount > remainingEscrow) {
      showToast(`Amount exceeds remaining escrow (${formatINR(remainingEscrow)})`, 'error');
      return;
    }

    setLoading(true);
    setTxError('');
    setTxPhase('wallet');

    try {
      // Simulate real block pipeline
      await new Promise((r) => setTimeout(r, 600));
      setTxPhase('pending');

      const response = await api.releaseFunds({
        projectId: form.projectId,
        amount: numAmount,
      });

      setTxPhase('confirming');
      await new Promise((r) => setTimeout(r, 700));

      setTxPhase('success');
      setResult(response.data);
      setTxHash(response.data?.blockchainTxHash || '');
      showToast('Smart contract funds successfully disbursed to contractor wallet!', 'success');
      await loadData();
    } catch (err) {
      setTxPhase('error');
      const msg = err.response?.data?.error || 'Transaction reverted on blockchain';
      setTxError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bf-page-stack">
      {/* Page Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Disburse Escrow Funds On-Chain</h1>
          <p className="bf-page-subtitle">
            Trigger irreversible cryptographic transfers from smart contract treasury directly to verified contractor addresses.
          </p>
        </div>
      </div>

      <div className="bf-form-layout-split">
        {/* Left: Release Execution Form */}
        <div className="bf-card bf-form-main-card">
          <form onSubmit={handleRelease} className="bf-form">
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
                    {p.name} — Remaining Escrow: {formatINR(Math.max(0, p.totalFund - (p.releasedFund || 0)))}
                  </option>
                ))}
              </select>
            </div>

            {selectedProject && (
              <div className="bf-escrow-summary-box">
                <div className="bf-escrow-row">
                  <span>Total Escrow Allocation:</span>
                  <strong>{formatINR(totalFund)}</strong>
                </div>
                <div className="bf-escrow-row">
                  <span>Previously Disbursed:</span>
                  <span className="text-blue font-semibold">{formatINR(releasedFund)}</span>
                </div>
                <div className="bf-escrow-row">
                  <span>Remaining Available Escrow:</span>
                  <span className="text-emerald font-semibold">{formatINR(remainingEscrow)}</span>
                </div>
                <div className="bf-escrow-row">
                  <span>Recipient Contractor:</span>
                  <strong>{selectedProject.contractor?.name || 'Assigned Firm'}</strong>
                </div>
                <div className="bf-escrow-row">
                  <span>Recipient Wallet:</span>
                  <span className="font-mono text-blue" style={{ fontSize: 11 }}>
                    {selectedProject.contractor?.walletAddress || 'No wallet linked'}
                  </span>
                </div>
              </div>
            )}

            {/* Quick Fill from Accepted Requests */}
            {acceptedRequestsForProject.length > 0 && (
              <div className="bf-quick-fill-accepted-box">
                <span className="bf-quick-accepted-lbl">Accepted Request Matches:</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {acceptedRequestsForProject.map((req) => (
                    <button
                      key={req._id}
                      type="button"
                      className="bf-secondary-btn bf-btn-sm"
                      onClick={() => setForm({ ...form, amount: String(req.amount) })}
                    >
                      Fill {formatINR(req.amount)} ({req.note || 'Milestone'})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bf-input-group" style={{ marginTop: 14 }}>
              <label className="bf-label">Disbursement Amount (INR) *</label>
              <input
                type="number"
                className="bf-input"
                placeholder="e.g. 1000000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
              {form.amount && Number(form.amount) > 0 && (
                <div className="bf-help-text text-blue">
                  Formatted: {formatINR(Number(form.amount))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bf-primary-btn bf-btn-lg"
              style={{ marginTop: 16 }}
              disabled={loading || !selectedProject?.contractor?.walletAddress}
            >
              <span>{loading ? 'Processing Blockchain Transfer...' : 'Execute On-Chain Fund Release'}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </button>
          </form>
        </div>

        {/* Right: Real-Time Transaction Pipeline Visualizer */}
        <div className="bf-form-side-column">
          <div className="bf-card">
            <h3 className="bf-side-card-title">Transaction Pipeline Visualizer</h3>
            <p className="bf-side-card-text">
              Real-time monitoring of Ethereum virtual machine state transitions during fund disbursement.
            </p>

            <div className="bf-tx-pipeline">
              <div className={`bf-pipeline-step ${stepStatus(txPhase, 'wallet')}`}>
                <div className="bf-step-bubble">1</div>
                <div>
                  <strong>Awaiting Wallet Signature</strong>
                  <div className="bf-step-sub">Validating authority private key on Ganache</div>
                </div>
              </div>

              <div className={`bf-pipeline-step ${stepStatus(txPhase, 'pending')}`}>
                <div className="bf-step-bubble">2</div>
                <div>
                  <strong>Mempool Broadcast</strong>
                  <div className="bf-step-sub">Transaction pending in local miner pool</div>
                </div>
              </div>

              <div className={`bf-pipeline-step ${stepStatus(txPhase, 'confirming')}`}>
                <div className="bf-step-bubble">3</div>
                <div>
                  <strong>Block Confirmation</strong>
                  <div className="bf-step-sub">Executing releaseFunds() opcode in smart contract</div>
                </div>
              </div>

              <div className={`bf-pipeline-step ${stepStatus(txPhase, 'success')}`}>
                <div className="bf-step-bubble">4</div>
                <div>
                  <strong>Funds Committed On-Chain</strong>
                  <div className="bf-step-sub">Contractor balance updated & receipt sealed</div>
                </div>
              </div>
            </div>

            {txHash && (
              <div className="bf-pipeline-result-box">
                <span className="text-emerald font-semibold">✓ Transfer Confirmed</span>
                <div style={{ marginTop: 8 }}>
                  <TxHashDisplay hash={txHash} label="Receipt Tx Hash" />
                </div>
              </div>
            )}

            {txError && (
              <div className="bf-pipeline-error-box">
                <strong>Transaction Reverted:</strong>
                <p style={{ fontSize: 12, marginTop: 4 }}>{txError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
