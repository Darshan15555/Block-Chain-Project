import { useState, useEffect } from 'react';
import { api, formatINR } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';

export default function SubmitUpdate({ showToast, onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    workDescription: '',
    materialsUsed: '',
    workersCount: '',
    amountSpent: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.getProjects()
      .then((res) => setProjects(res.data?.projects || []))
      .catch(() => showToast('Failed to load projects', 'error'));
  }, [showToast]);

  const selected = projects.find((p) => p.projectId === form.projectId);
  const total = selected ? Number(selected.totalFund || 0) : 0;
  const released = selected ? Number(selected.releasedFund || 0) : 0;
  const spent = selected ? Number(selected.spentFund || 0) : 0;
  const releasedUnspent = Math.max(0, released - spent);
  const inputAmount = Number(form.amountSpent) || 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (submitError) setSubmitError('');
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be less than 5MB', 'error');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projectId || !form.workDescription.trim() || !form.amountSpent) {
      setSubmitError('Please complete all required milestone fields');
      showToast('Please complete all required milestone fields', 'error');
      return;
    }

    const numericAmount = Number(form.amountSpent);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitError('Amount spent must be greater than zero');
      showToast('Amount spent must be greater than zero', 'error');
      return;
    }

    if (numericAmount > releasedUnspent) {
      const err = `Amount exceeds available released unspent funds (${formatINR(releasedUnspent)}). Request funding authorization first.`;
      setSubmitError(err);
      showToast(err, 'error');
      return;
    }

    setLoading(true);
    setSubmitError('');
    setResult(null);

    try {
      let dataToSend;
      if (photoFile) {
        dataToSend = new FormData();
        dataToSend.append('projectId', form.projectId);
        dataToSend.append('date', form.date);
        dataToSend.append('workDescription', form.workDescription.trim());
        dataToSend.append('materialsUsed', form.materialsUsed.trim());
        dataToSend.append('workersCount', Number(form.workersCount) || 0);
        dataToSend.append('amountSpent', numericAmount);
        dataToSend.append('photo', photoFile);
      } else {
        dataToSend = {
          projectId: form.projectId,
          date: form.date,
          workDescription: form.workDescription.trim(),
          materialsUsed: form.materialsUsed.trim(),
          workersCount: Number(form.workersCount) || 0,
          amountSpent: numericAmount,
        };
      }

      const response = await api.submitUpdate(dataToSend);
      setResult(response.data);
      showToast(response.data?.message || 'Work milestone logged & hashed on blockchain!', 'success');
      setForm((prev) => ({
        ...prev,
        workDescription: '',
        materialsUsed: '',
        workersCount: '',
        amountSpent: '',
      }));
      setPhotoFile(null);
      setPhotoPreview(null);

      const refresh = await api.getProjects();
      setProjects(refresh.data?.projects || []);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit milestone proof';
      setSubmitError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bf-page-stack">
      {/* Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Submit Physical Work & Expenditure Proof</h1>
          <p className="bf-page-subtitle">
            Log milestone completion with photographic evidence. Details and images are hashed on the blockchain ledger.
          </p>
        </div>
      </div>

      <div className="bf-form-layout-split">
        {/* Left: Milestone Logging Form */}
        <div className="bf-card bf-form-main-card">
          <form onSubmit={handleSubmit} className="bf-form">
            <div className="bf-input-group">
              <label className="bf-label">Target Infrastructure Project *</label>
              <select
                name="projectId"
                className="bf-select"
                value={form.projectId}
                onChange={handleChange}
                required
              >
                <option value="">Select your assigned project...</option>
                {projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.name} — Released Balance: {formatINR(Math.max(0, (p.releasedFund || 0) - (p.spentFund || 0)))}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Escrow Balance Warning/Check */}
            {selected && (
              <div className="bf-liquidity-gauge-box">
                <div className="bf-gauge-row">
                  <span>Smart Contract Released Balance:</span>
                  <span className="text-blue font-semibold">{formatINR(released)}</span>
                </div>
                <div className="bf-gauge-row">
                  <span>Available Unspent Balance:</span>
                  <span className={`font-bold ${releasedUnspent > 0 ? 'text-emerald' : 'text-danger'}`}>
                    {formatINR(releasedUnspent)}
                  </span>
                </div>
                {inputAmount > 0 && (
                  <div className="bf-gauge-row" style={{ marginTop: 6, borderTop: '1px dashed #cbd5e1', paddingTop: 6 }}>
                    <span>Projected Remaining After This Claim:</span>
                    <span className={inputAmount > releasedUnspent ? 'text-danger font-bold' : 'font-semibold'}>
                      {formatINR(Math.max(0, releasedUnspent - inputAmount))}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="bf-form-row">
              <div className="bf-input-group">
                <label className="bf-label">Execution Date *</label>
                <input
                  type="date"
                  name="date"
                  className="bf-input"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="bf-input-group">
                <label className="bf-label">Amount Spent (INR) *</label>
                <input
                  type="number"
                  name="amountSpent"
                  className="bf-input"
                  placeholder="e.g. 250000"
                  value={form.amountSpent}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="bf-input-group">
              <label className="bf-label">Work Deliverables Description *</label>
              <textarea
                name="workDescription"
                className="bf-textarea"
                rows={3}
                placeholder="Describe specific milestones completed (e.g. Completed laying 1.2km sub-base road gravel and leveling)..."
                value={form.workDescription}
                onChange={handleChange}
                required
              />
            </div>

            <div className="bf-form-row">
              <div className="bf-input-group">
                <label className="bf-label">Materials & Equipment Consumed</label>
                <input
                  type="text"
                  name="materialsUsed"
                  className="bf-input"
                  placeholder="e.g. 40T Cement (Grade 53), 12T Rebar, 2 Steamrollers"
                  value={form.materialsUsed}
                  onChange={handleChange}
                />
              </div>

              <div className="bf-input-group">
                <label className="bf-label">Labor Headcount on Site</label>
                <input
                  type="number"
                  name="workersCount"
                  className="bf-input"
                  placeholder="e.g. 45"
                  value={form.workersCount}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Photo Evidence Upload */}
            <div className="bf-input-group">
              <label className="bf-label">On-Site Photographic Evidence (Optional)</label>
              <div className="bf-photo-upload-container">
                <input
                  type="file"
                  id="bf-site-photo"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="bf-site-photo" className="bf-photo-upload-dropzone">
                  {photoPreview ? (
                    <div className="bf-preview-wrap">
                      <img src={photoPreview} alt="Site preview" className="bf-preview-img" />
                      <span className="bf-photo-change-lbl">Click to choose another photo</span>
                    </div>
                  ) : (
                    <div className="bf-dropzone-prompt">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>Upload geo-tagged site construction photo (Max 5MB)</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {submitError && (
              <div className="bf-form-error-banner">
                ⚠️ {submitError}
              </div>
            )}

            <button
              type="submit"
              className="bf-primary-btn bf-btn-lg"
              style={{ marginTop: 12 }}
              disabled={loading || releasedUnspent <= 0}
            >
              <span>{loading ? 'Submitting & Hashing on Blockchain...' : 'Commit Milestone Proof On-Chain'}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </form>
        </div>

        {/* Right: Submission Feedback & Cryptographic Confirmation */}
        <div className="bf-form-side-column">
          {result ? (
            <div className="bf-card bf-success-confirmation-card">
              <div className="bf-success-badge">
                <span>✓ HASH COMMITTED ON-CHAIN</span>
              </div>
              <h2 className="bf-success-title">Work Update Successfully Logged</h2>
              <p className="bf-success-desc">
                Your update description and photo were cryptographically hashed and permanently recorded on the blockchain ledger.
              </p>

              {result.update?.dataHash && (
                <div className="bf-result-field">
                  <span className="bf-result-lbl">SHA-256 MILESTONE DATA HASH</span>
                  <TxHashDisplay hash={result.update.dataHash} />
                </div>
              )}

              {result.blockchainTxHash && (
                <div className="bf-result-field">
                  <span className="bf-result-lbl">BLOCKCHAIN LOG TRANSACTION</span>
                  <TxHashDisplay hash={result.blockchainTxHash} />
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                {onNavigate && (
                  <button
                    type="button"
                    className="bf-primary-btn bf-btn-sm"
                    onClick={() => onNavigate('dashboard')}
                  >
                    Return to Contractor Dashboard →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bf-card">
              <h3 className="bf-side-card-title">Milestone Hashing Integrity</h3>
              <p className="bf-side-card-text">
                Every milestone log submitted by a contractor is transformed into a cryptographic SHA-256 fingerprint that includes:
              </p>

              <div className="bf-protocol-points">
                <div className="bf-protocol-point">
                  <span className="bf-point-num">✓</span>
                  <div>
                    <strong>Description & Cost:</strong> Exact INR amount and material breakdown.
                  </div>
                </div>
                <div className="bf-protocol-point">
                  <span className="bf-point-num">✓</span>
                  <div>
                    <strong>Evidence Photo Hash:</strong> Binary photo proof hashed into the on-chain payload.
                  </div>
                </div>
                <div className="bf-protocol-point">
                  <span className="bf-point-num">✓</span>
                  <div>
                    <strong>Civic Accountability:</strong> Enables public citizens to audit and verify authenticity.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
