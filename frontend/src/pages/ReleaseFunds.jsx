import { useEffect, useMemo, useState } from 'react';
import { api, formatINR, getPercent, shortHash } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';

const TX_PHASE_ORDER = ['wallet', 'pending', 'confirming', 'success'];
const DEMO_TX_ERROR =
  'Preflight failed: no accepted funding request matched this project and amount.';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPhaseLabel(phase) {
  if (phase === 'wallet') return 'Awaiting wallet signature...';
  if (phase === 'pending') return 'Transaction broadcast to demo mempool...';
  if (phase === 'confirming') return 'Waiting for block confirmation...';
  if (phase === 'success') return 'Transaction confirmed and state committed.';
  if (phase === 'error') return 'Transaction failed.';
  return 'Ready to submit simulated release transaction.';
}

function createDemoTxHash(projectId, amount) {
  const seed = `${projectId || ''}-${amount || ''}-${Date.now()}-${Math.random()}`;
  let hex = '';
  for (let i = 0; i < seed.length; i += 1) {
    hex += seed.charCodeAt(i).toString(16);
  }
  return `0x${hex.padEnd(64, '0').slice(0, 64)}`;
}

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

function txButtonLabel(demoMode, loading, phase, precheckReady) {
  if (!loading) {
    if (demoMode && !precheckReady) return 'Await Accepted Request Match';
    return demoMode ? 'Simulate Release Transaction' : 'Release Funds';
  }
  if (!demoMode) return 'Submitting transfer...';
  if (phase === 'wallet') return 'Waiting for wallet signature...';
  if (phase === 'pending') return 'Broadcasting transaction...';
  if (phase === 'confirming') return 'Confirming transaction...';
  return 'Processing transaction...';
}

function isReleasableAcceptedRequest(requestItem, projectId) {
  return (
    requestItem.projectId === projectId &&
    requestItem.status === 'accepted'
  );
}

export default function ReleaseFunds({ showToast }) {
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ projectId: '', amount: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [demoTx, setDemoTx] = useState({
    phase: 'idle',
    message: getPhaseLabel('idle'),
    txHash: '',
    explorerUrl: '',
    error: '',
  });
  const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';

  const selectedProject = useMemo(
    () => projects.find((project) => project.projectId === form.projectId),
    [projects, form.projectId]
  );
  const released = selectedProject ? Number(selectedProject.releasedFund || 0) : 0;
  const remaining = selectedProject ? Number(selectedProject.totalFund) - released : 0;

  const acceptedRequests = useMemo(() => {
    if (!form.projectId) return [];
    return requests.filter((requestItem) =>
      isReleasableAcceptedRequest(requestItem, form.projectId)
    );
  }, [requests, form.projectId]);

  const numericAmount = Number(form.amount);
  const matchingAcceptedRequest = useMemo(() => {
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null;
    return (
      acceptedRequests.find(
        (requestItem) => Number(requestItem.amount) === numericAmount
      ) || null
    );
  }, [acceptedRequests, numericAmount]);

  const demoPrecheckMessage = useMemo(() => {
    if (!demoMode || !form.projectId) return '';
    if (acceptedRequests.length === 0) {
      return 'No accepted funding request exists for this project. Send/raise request first.';
    }
    if (!form.amount) {
      return 'Enter an amount that matches one accepted request below.';
    }
    if (!matchingAcceptedRequest) {
      const acceptedAmounts = acceptedRequests
        .map((requestItem) => formatINR(Number(requestItem.amount)))
        .join(', ');
      return `Amount must match an accepted request (${acceptedAmounts}).`;
    }
    return 'Preflight passed: accepted request matched. You can submit simulation.';
  }, [demoMode, form.projectId, form.amount, acceptedRequests, matchingAcceptedRequest]);

  const demoPrecheckReady = !demoMode || !!matchingAcceptedRequest;
  const submitDisabled = loading || (demoMode && !demoPrecheckReady);

  const loadProjects = async () => {
    const res = await api.getProjects();
    setProjects(res.data.projects || []);
  };

  const loadRequests = async () => {
    if (!demoMode) return;
    const res = await api.getContractRequests();
    setRequests(res.data?.requests || []);
  };

  useEffect(() => {
    Promise.all([loadProjects(), loadRequests()])
      .then(() => setApiUnavailable(false))
      .catch(() => {
        setApiUnavailable(true);
        showToast('API unavailable. Start backend and refresh.', 'error');
      });
  }, [showToast, demoMode]);

  const updateDemoPhase = (phase, txHash = '', error = '') => {
    const explorerUrl = txHash ? `demo://explorer/tx/${txHash}` : '';
    setDemoTx({
      phase,
      message: getPhaseLabel(phase),
      txHash,
      explorerUrl,
      error,
    });
  };

  const refreshSnapshots = async () => {
    await Promise.all([loadProjects(), loadRequests()]);
  };

  const releaseInLiveMode = async (releaseAmount) => {
    const res = await api.releaseFunds({ projectId: form.projectId, amount: releaseAmount });
    setResult(res.data);
    showToast(res.data.message || 'Funds released', 'success');
  };

  const releaseInDemoMode = async (acceptedRequestId, releaseAmount) => {
    const provisionalTxHash = createDemoTxHash(form.projectId, releaseAmount);
    updateDemoPhase('wallet');
    showToast('Demo wallet opened. Review and sign the transaction.', 'info');
    await wait(700);

    updateDemoPhase('pending', provisionalTxHash);
    showToast(`Tx submitted: ${shortHash(provisionalTxHash)}`, 'info');
    await wait(1100);

    updateDemoPhase('confirming', provisionalTxHash);
    await wait(900);

    const releaseRes = await api.releaseAcceptedRequest(acceptedRequestId);
    const confirmedHash = releaseRes.data?.blockchain?.txHash || provisionalTxHash;

    updateDemoPhase('success', confirmedHash);
    setResult({
      ...releaseRes.data,
      blockchain: {
        ...(releaseRes.data?.blockchain || {}),
        txHash: confirmedHash,
      },
      demoSimulation: true,
    });
    showToast(
      releaseRes.data?.message || 'Demo transaction confirmed and funds released.',
      'success'
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setResult(null);

    if (!form.projectId || !form.amount) {
      showToast('Fill all fields', 'error');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    if (numericAmount > remaining) {
      showToast('Amount exceeds remaining funds', 'error');
      return;
    }

    if (demoMode && !matchingAcceptedRequest) {
      const preflightError = demoPrecheckMessage || DEMO_TX_ERROR;
      setDemoTx({
        phase: 'idle',
        message: 'Preflight checks failed. Transaction not submitted.',
        txHash: '',
        explorerUrl: '',
        error: preflightError,
      });
      showToast(preflightError, 'error');
      return;
    }

    setLoading(true);
    try {
      if (demoMode) {
        await releaseInDemoMode(matchingAcceptedRequest._id, numericAmount);
      } else {
        await releaseInLiveMode(numericAmount);
      }

      setForm((prev) => ({ ...prev, amount: '' }));
      await refreshSnapshots();
      setApiUnavailable(false);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to release funds';
      const isNetworkFailure =
        !error.response && !String(errorMessage).toLowerCase().includes('preflight');
      if (isNetworkFailure) {
        setApiUnavailable(true);
      }
      if (demoMode) {
        setDemoTx((prev) => ({
          ...prev,
          phase: 'error',
          message: getPhaseLabel('error'),
          error: errorMessage,
        }));
      }
      showToast(errorMessage, 'error');
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
          title="Demo Wallet Simulation"
          subtitle="Blockchain-like training flow"
          tone="accent"
          steps={[
            'Sign a simulated release transaction from this page.',
            'System shows wallet -> pending -> confirming -> success lifecycle.',
            'UI preflight checks accepted request + amount before transaction broadcast.',
          ]}
        />
        <ExplainPanel
          title="Validation Rules"
          subtitle="Same guardrails as real contract flow"
          tone="orange"
          steps={[
            'Project and amount are validated before state update.',
            'Release is blocked until there is an accepted funding request.',
            'On success, release is synced to timeline/checklist and tx proof card.',
          ]}
        />
      </div>

      <div className="release-grid">
        <div className="form-card" style={{ maxWidth: '100%' }}>
          {apiUnavailable && (
            <div className="release-api-warning">
              API / blockchain service is unreachable. Start backend, MongoDB, and Ganache, then retry.
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Select Project *</label>
              <select
                className="form-select"
                value={form.projectId}
                onChange={(event) => {
                  setResult(null);
                  setDemoTx((prev) => ({ ...prev, error: '' }));
                  setForm((prev) => ({ ...prev, projectId: event.target.value }));
                }}
              >
                <option value="">- Select Project -</option>
                {projects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProject && (
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>
                  PROJECT FUND STATUS
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 10,
                    fontSize: 11,
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 2 }}>TOTAL</div>
                    <div style={{ color: 'var(--accent)', fontWeight: 700 }}>
                      {formatINR(selectedProject.totalFund)}
                    </div>
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
                  <div
                    className="fund-bar-fill"
                    style={{ width: `${getPercent(released, selectedProject.totalFund)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Amount to Release (INR) *</label>
              <input
                className="form-input"
                type="number"
                value={form.amount}
                onChange={(event) => {
                  setDemoTx((prev) => ({ ...prev, error: '' }));
                  setForm((prev) => ({ ...prev, amount: event.target.value }));
                }}
                placeholder="Enter amount"
                min="1"
                max={remaining > 0 ? remaining : undefined}
              />
            </div>

            {demoMode && selectedProject && (
              <div className="release-precheck-card">
                <div className="release-precheck-title">Release Preflight</div>
                <div
                  className={`release-precheck-status ${matchingAcceptedRequest ? 'ok' : 'warn'}`}
                >
                  {demoPrecheckMessage}
                </div>
                {acceptedRequests.length > 0 && (
                  <div className="release-precheck-actions">
                    {acceptedRequests.map((requestItem) => (
                      <button
                        key={requestItem._id}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            amount: String(Number(requestItem.amount)),
                          }));
                          setDemoTx((prev) => ({ ...prev, error: '' }));
                        }}
                      >
                        Use {formatINR(Number(requestItem.amount))}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitDisabled}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {txButtonLabel(demoMode, loading, demoTx.phase, demoPrecheckReady)}
            </button>
          </form>
          {demoMode && (
            <div className="release-demo-note">
              Demo mode keeps blockchain semantics: transaction UI is simulated, while release state mutation stays real.
            </div>
          )}

          {demoMode && (
            <div className="tx-sim-card">
              <div className="tx-sim-title">Demo Transaction Lifecycle</div>
              <div className="tx-sim-subtitle">{demoTx.message}</div>
              <div className="tx-sim-steps">
                <div className={`tx-sim-step ${stepStatus(demoTx.phase, 'wallet')}`}>1. Wallet Signature</div>
                <div className={`tx-sim-step ${stepStatus(demoTx.phase, 'pending')}`}>2. Pending in Mempool</div>
                <div className={`tx-sim-step ${stepStatus(demoTx.phase, 'confirming')}`}>3. Block Confirmation</div>
                <div className={`tx-sim-step ${stepStatus(demoTx.phase, 'success')}`}>4. State Commit</div>
              </div>
              {demoTx.txHash && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>TRANSACTION HASH</div>
                  <TxHashDisplay hash={demoTx.txHash} />
                </>
              )}
              {demoTx.explorerUrl && (
                <div className="tx-sim-link-wrap">
                  <div className="tx-sim-link">{demoTx.explorerUrl}</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(demoTx.explorerUrl);
                        showToast('Simulated explorer link copied', 'success');
                      } catch {
                        showToast('Copy failed', 'error');
                      }
                    }}
                  >
                    Copy explorer link
                  </button>
                </div>
              )}
              {demoTx.error && <div className="tx-sim-error">{demoTx.error}</div>}
            </div>
          )}
        </div>

        <div>
          <div className="form-card" style={{ maxWidth: '100%', marginBottom: 16 }}>
            <div className="form-title" style={{ fontSize: 14, marginBottom: 10 }}>
              Smart contract flow
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 2 }}>
              <div>1. Authority submits signed release intent</div>
              <div>2. API verifies accepted request + project balance before contract call</div>
              <div>3. Transfer is mined and receipt hash is produced</div>
              <div>4. Backend syncs MongoDB after confirmation receipt</div>
            </div>
          </div>

          {result && (
            <div className="form-card" style={{ maxWidth: '100%' }}>
              <div
                style={{
                  fontSize: 14,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--green)',
                  marginBottom: 6,
                }}
              >
                {demoMode ? 'Demo transaction finalized' : 'Funds released and synced'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                {result.message || 'Release transaction completed successfully.'}
              </div>
              {result.blockchain?.txHash && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                    TRANSACTION HASH
                  </div>
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
