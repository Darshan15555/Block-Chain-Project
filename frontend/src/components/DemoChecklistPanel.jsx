import { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';

const STEP_LABELS = [
  { id: 'createProject', label: 'Create project' },
  { id: 'sendRequest', label: 'Send request' },
  { id: 'acceptRequest', label: 'Accept request' },
  { id: 'submitUpdate', label: 'Submit update' },
  { id: 'verifyWork', label: 'Verify work' },
  { id: 'openBlockchainProof', label: 'Open Blockchain Proof' },
];

const STEP_HINTS = {
  createProject: 'Authority creates a project and assigns contractor wallet.',
  sendRequest: 'Authority sends funding request for project.',
  acceptRequest: 'Contractor accepts authority request.',
  submitUpdate: 'Contractor logs work update with amount spent.',
  verifyWork: 'Public user verifies update as done/not done.',
  openBlockchainProof: 'Open Blockchain Proof page and show tx hashes.',
};

export default function DemoChecklistPanel({ currentUser, activePage, showToast, onDemoReset }) {
  const [collapsed, setCollapsed] = useState(false);
  const [progress, setProgress] = useState({
    createProject: false,
    sendRequest: false,
    acceptRequest: false,
    submitUpdate: false,
    verifyWork: false,
    openBlockchainProof: false,
  });
  const [resetting, setResetting] = useState(false);
  const [resettingChecklist, setResettingChecklist] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [serviceStatus, setServiceStatus] = useState({ unavailable: false, message: '' });

  const canReset = currentUser?.role === 'authority';

  const fetchProgress = async () => {
    const [progressRes, readinessRes] = await Promise.all([
      api.getDemoProgress(),
      canReset ? api.getDemoReadiness() : Promise.resolve(null),
    ]);
    const backendProgress = progressRes.data.progress || {};
    setProgress((prev) => ({
      ...prev,
      ...backendProgress,
      openBlockchainProof: prev.openBlockchainProof || activePage === 'blockchain',
    }));
    if (readinessRes?.data?.readiness) {
      setReadiness(readinessRes.data.readiness);
    }
    setServiceStatus({ unavailable: false, message: '' });
  };

  useEffect(() => {
    if (!canReset) {
      setReadiness(null);
    }
    fetchProgress().catch((error) => {
      const message = error?.response?.data?.error || 'Demo services unavailable';
      setServiceStatus({ unavailable: true, message });
    });
    const timer = setInterval(() => {
      fetchProgress().catch((error) => {
        const message = error?.response?.data?.error || 'Demo services unavailable';
        setServiceStatus({ unavailable: true, message });
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [activePage, canReset]);

  useEffect(() => {
    if (activePage === 'blockchain') {
      setProgress((prev) => ({ ...prev, openBlockchainProof: true }));
    }
  }, [activePage]);

  const completedCount = useMemo(
    () => STEP_LABELS.filter((step) => progress[step.id]).length,
    [progress]
  );
  const progressPercent = useMemo(
    () => Math.round((completedCount / STEP_LABELS.length) * 100),
    [completedCount]
  );
  const remainingCount = STEP_LABELS.length - completedCount;
  const nextStep = useMemo(() => STEP_LABELS.find((step) => !progress[step.id]) || null, [progress]);

  const handleCopySummary = async () => {
    const lines = [
      `Demo progress: ${completedCount}/${STEP_LABELS.length} (${progressPercent}%)`,
      ...STEP_LABELS.map((step) => `${progress[step.id] ? '[x]' : '[ ]'} ${step.label}`),
      nextStep ? `Next step: ${nextStep.label}` : 'All demo steps completed.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('Checklist summary copied', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      const res = await api.resetDemo();
      showToast(res.data.message || 'Demo reset completed', 'success');
      setProgress({
        createProject: false,
        sendRequest: false,
        acceptRequest: false,
        submitUpdate: false,
        verifyWork: false,
        openBlockchainProof: false,
      });
      onDemoReset?.();
    } catch (error) {
      showToast(error.response?.data?.error || 'Demo reset failed', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleResetChecklist = async () => {
    setResettingChecklist(true);
    try {
      const res = await api.resetDemoChecklist();
      showToast(res.data.message || 'Checklist reset completed', 'success');
      setProgress((prev) => ({
        ...prev,
        createProject: false,
        sendRequest: false,
        acceptRequest: false,
        submitUpdate: false,
        verifyWork: false,
        openBlockchainProof: false,
      }));
      await fetchProgress();
    } catch (error) {
      showToast(error.response?.data?.error || 'Checklist reset failed', 'error');
    } finally {
      setResettingChecklist(false);
    }
  };

  return (
    <div className={`demo-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="demo-panel-header">
        <div>
          Demo Checklist ({completedCount}/{STEP_LABELS.length})
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed((prev) => !prev)}>
          {collapsed ? 'Open' : 'Close'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="demo-progress-wrap" aria-label="Demo progress">
            <div className="demo-progress-track">
              <div className="demo-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="demo-progress-text">{progressPercent}% complete</div>
          </div>
          <div className="demo-steps">
            {STEP_LABELS.map((step) => (
              <label key={step.id} className="demo-step">
                <input type="checkbox" checked={!!progress[step.id]} readOnly />
                <span>{step.label}</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
            {nextStep
              ? `Next: ${nextStep.label} - ${STEP_HINTS[nextStep.id]}`
              : 'All checklist steps completed. Demo flow is fully covered.'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
            Remaining steps: {remainingCount}
          </div>
          {serviceStatus.unavailable && (
            <div style={{ fontSize: 10, color: 'var(--orange)', marginBottom: 10, lineHeight: 1.5 }}>
              Service fallback active: {serviceStatus.message}. Checklist sync will resume automatically once API is back.
            </div>
          )}
          {canReset && readiness && (
            <div style={{ fontSize: 11, marginBottom: 10, color: readiness.blockers?.length ? 'var(--orange)' : 'var(--green)' }}>
              Readiness blockers: {readiness.blockers?.length || 0}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: canReset ? 8 : 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleCopySummary}>
              Copy summary
            </button>
          </div>
          {canReset && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={handleResetChecklist} disabled={resettingChecklist || resetting}>
                {resettingChecklist ? 'Resetting...' : 'Reset checklist'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleResetDemo} disabled={resetting}>
                {resetting ? 'Resetting...' : 'Reset demo'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
