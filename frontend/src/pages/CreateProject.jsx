import { useEffect, useState } from 'react';
import { api, formatINR } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';

const PROJECT_TYPES = [
  { id: 'Road', name: 'Roads & Highways', icon: '🛣️' },
  { id: 'Bridge', name: 'Bridges & Flyovers', icon: '🌉' },
  { id: 'School', name: 'Schools & Education', icon: '🏫' },
  { id: 'Water Facility', name: 'Water & Sanitation', icon: '💧' },
  { id: 'Hospital', name: 'Healthcare & Hospitals', icon: '🏥' },
  { id: 'Other', name: 'Civic Urban Works', icon: '🏗️' },
];

export default function CreateProject({ showToast, onNavigate }) {
  const [contractors, setContractors] = useState([]);
  const [chainStatus, setChainStatus] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'Road',
    location: '',
    description: '',
    totalFund: '',
    contractorId: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingContractors, setLoadingContractors] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([api.getContractors(), api.getBlockchainStatus()])
      .then(([contractorsRes, chainRes]) => {
        setContractors(contractorsRes.data?.contractors || []);
        setChainStatus(chainRes.data || null);
      })
      .catch((err) => {
        showToast(err.response?.data?.error || 'Failed to load contractors', 'error');
      })
      .finally(() => setLoadingContractors(false));
  }, [showToast]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file must be under 5MB', 'error');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const selectedContractor = contractors.find((c) => c.id === form.contractorId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.location.trim() || !form.totalFund || !form.contractorId) {
      showToast('Please fill all required project parameters', 'error');
      return;
    }

    const numFund = Number(form.totalFund);
    if (!numFund || numFund <= 0) {
      showToast('Total fund must be greater than zero', 'error');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('type', form.type);
      formData.append('location', form.location.trim());
      formData.append('description', form.description.trim());
      formData.append('totalFund', String(numFund));
      formData.append('contractorId', form.contractorId);
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const response = await api.createProject(formData);

      setResult(response.data);
      showToast(response.data?.message || 'Infrastructure project registered on blockchain!', 'success');
      setForm({ name: '', type: 'Road', location: '', description: '', totalFund: '', contractorId: '' });
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to register project', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bf-page-stack">
      {/* Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Register Civil Infrastructure Project</h1>
          <p className="bf-page-subtitle">
            Commit capital into smart contract escrow and bind execution to a verified contractor wallet.
          </p>
        </div>
      </div>

      <div className="bf-form-layout-split">
        {/* Left Column: Project Registration Form */}
        <div className="bf-card bf-form-main-card">
          <form onSubmit={handleSubmit} className="bf-form">
            <div className="bf-input-group">
              <label className="bf-label">Project Title *</label>
              <input
                type="text"
                name="name"
                className="bf-input"
                placeholder="e.g. NH-48 Express Corridor Expansion"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            {/* Sector / Category Picker */}
            <div className="bf-input-group">
              <label className="bf-label">Infrastructure Category *</label>
              <div className="bf-category-grid">
                {PROJECT_TYPES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`bf-cat-chip ${form.type === cat.id ? 'active' : ''}`}
                    onClick={() => setForm((prev) => ({ ...prev, type: cat.id }))}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bf-form-row">
              <div className="bf-input-group">
                <label className="bf-label">Location / Civic District *</label>
                <input
                  type="text"
                  name="location"
                  className="bf-input"
                  placeholder="e.g. Pune Urban District"
                  value={form.location}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="bf-input-group">
                <label className="bf-label">Total Allocated Fund (INR) *</label>
                <input
                  type="number"
                  name="totalFund"
                  className="bf-input"
                  placeholder="e.g. 5000000"
                  value={form.totalFund}
                  onChange={handleChange}
                  required
                />
                {form.totalFund && Number(form.totalFund) > 0 && (
                  <div className="bf-help-text text-blue">
                    Formatted: {formatINR(Number(form.totalFund))}
                  </div>
                )}
              </div>
            </div>

            {/* Contractor Selection */}
            <div className="bf-input-group">
              <label className="bf-label">Assign Verified Contractor *</label>
              <select
                name="contractorId"
                className="bf-select"
                value={form.contractorId}
                onChange={handleChange}
                disabled={loadingContractors}
                required
              >
                <option value="">
                  {loadingContractors ? 'Loading verified contractors...' : 'Select a verified contractor...'}
                </option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName ? `${c.companyName} (${c.name})` : c.name} — Wallet: {c.walletAddress ? `${c.walletAddress.slice(0, 10)}...` : 'None'}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Description */}
            <div className="bf-input-group">
              <label className="bf-label">Project Scope & Description (Optional)</label>
              <textarea
                name="description"
                className="bf-form-textarea"
                rows="3"
                placeholder="e.g. Renovation, pipeline networks, digital classrooms, and civil construction milestones..."
                value={form.description}
                onChange={handleChange}
              />
            </div>

            {/* Project Image / Photo Upload */}
            <div className="bf-input-group">
              <label className="bf-label">Project Site Photo / Architectural Blueprint (Optional)</label>
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  style={{
                    opacity: 0,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                  }}
                />
                {photoPreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <img
                      src={photoPreview}
                      alt="Project Preview"
                      style={{ maxHeight: 160, borderRadius: 8, objectFit: 'cover', width: '100%' }}
                    />
                    <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                      ✓ {photoFile?.name} (Click to change photo)
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-primary)' }}>
                      Click to upload site photo or blueprint
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Supports JPEG, PNG, or WebP up to 5MB
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contractor Wallet Pre-check Card */}
            {selectedContractor && (
              <div className="bf-wallet-precheck-box">
                <div className="bf-precheck-row">
                  <span>Contractor Firm:</span>
                  <strong>{selectedContractor.companyName || selectedContractor.name}</strong>
                </div>
                <div className="bf-precheck-row">
                  <span>Ethereum Wallet:</span>
                  <span className="font-mono text-blue">
                    {selectedContractor.walletAddress || '⚠️ No wallet set! Contractor cannot receive funds.'}
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="bf-primary-btn bf-btn-lg"
              style={{ marginTop: 16 }}
              disabled={loading || !selectedContractor?.walletAddress}
            >
              <span>{loading ? 'Deploying on Blockchain...' : 'Commit Project to Blockchain'}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>
        </div>

        {/* Right Column: Deployment Confirmation & Blockchain Proof */}
        <div className="bf-form-side-column">
          {result ? (
            <div className="bf-card bf-success-confirmation-card">
              <div className="bf-success-badge">
                <span>✓ ON-CHAIN COMMITTED</span>
              </div>
              <h2 className="bf-success-title">Project Successfully Registered</h2>
              <p className="bf-success-desc">
                The smart contract escrow has locked the allocated budget and generated immutable credentials.
              </p>

              <div className="bf-result-field">
                <span className="bf-result-lbl">PROJECT ID</span>
                <span className="bf-result-val font-mono">{result.project?.projectId || result.projectId}</span>
              </div>

              {result.blockchainTxHash && (
                <div className="bf-result-field">
                  <span className="bf-result-lbl">DEPLOYMENT TRANSACTION HASH</span>
                  <TxHashDisplay hash={result.blockchainTxHash} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                {onNavigate && (
                  <button
                    type="button"
                    className="bf-primary-btn bf-btn-sm"
                    onClick={() => onNavigate('projects')}
                  >
                    View in Projects Repository →
                  </button>
                )}
                <button
                  type="button"
                  className="bf-secondary-btn bf-btn-sm"
                  onClick={() => setResult(null)}
                >
                  Create Another
                </button>
              </div>
            </div>
          ) : (
            <div className="bf-card">
              <h3 className="bf-side-card-title">Blockchain Escrow Protocol</h3>
              <p className="bf-side-card-text">
                When you create a project on BlockFund, the allocated budget is immediately recorded on the Ethereum blockchain via the FundTracking smart contract.
              </p>

              <div className="bf-protocol-points">
                <div className="bf-protocol-point">
                  <span className="bf-point-num">1</span>
                  <div>
                    <strong>Immutable Identity:</strong> A deterministic, tamper-proof Project ID is issued.
                  </div>
                </div>
                <div className="bf-protocol-point">
                  <span className="bf-point-num">2</span>
                  <div>
                    <strong>Escrow Protection:</strong> Funds cannot be diverted to unauthorized bank accounts or contractors.
                  </div>
                </div>
                <div className="bf-protocol-point">
                  <span className="bf-point-num">3</span>
                  <div>
                    <strong>Public Auditability:</strong> Immediately visible in the public transparency portal.
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
