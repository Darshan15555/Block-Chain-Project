import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';

export default function CreateProject({ showToast }) {
  const [contractors, setContractors] = useState([]);
  const [chainStatus, setChainStatus] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'Road',
    location: '',
    totalFund: '',
    contractorId: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingContractors, setLoadingContractors] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([api.getContractors(), api.getBlockchainStatus()])
      .then(([contractorsRes, chainRes]) => {
        setContractors(contractorsRes.data.contractors || []);
        setChainStatus(chainRes.data || null);
      })
      .catch((err) => {
        showToast(err.response?.data?.error || 'Failed to load contractors', 'error');
      })
      .finally(() => setLoadingContractors(false));
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const selectedContractor = contractors.find((contractor) => contractor.id === form.contractorId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.location || !form.totalFund || !form.contractorId) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await api.createProject({
        name: form.name,
        type: form.type,
        location: form.location,
        totalFund: Number(form.totalFund),
        contractorId: form.contractorId,
      });

      setResult(response.data);
      showToast(response.data.message || 'Project created', 'success');
      setForm({ name: '', type: 'Road', location: '', totalFund: '', contractorId: '' });
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to create project', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Create New Project</div>
          <div className="section-subtitle">Register a new infrastructure project on blockchain</div>
        </div>
      </div>

      <div className="explain-grid">
        <ExplainPanel
          title="Before You Create"
          subtitle="Quick checklist for authority"
          tone="accent"
          steps={[
            'Pick a contractor with wallet set.',
            'Enter total project fund and location.',
            'Click Create Project on Blockchain.',
            'Share project ID and tx hash in demo.',
          ]}
        />
        <ExplainPanel
          title="Why Wallet Is Important"
          subtitle="Simple explanation"
          tone="green"
          steps={[
            'Funds are released to contractor wallet.',
            'Wallet links blockchain transfer to real contractor.',
            'Without wallet, blockchain transfer cannot happen.',
          ]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div className="form-card" style={{ maxWidth: '100%' }}>
          {chainStatus && (
            <div
              style={{
                marginBottom: 14,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${chainStatus.contractDeployed ? 'rgba(0,255,136,0.25)' : 'rgba(255,77,109,0.25)'}`,
                background: chainStatus.contractDeployed ? 'var(--green-glow)' : 'var(--red-glow)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: chainStatus.contractDeployed ? 'var(--green)' : 'var(--red)' }}>
                {chainStatus.contractDeployed ? 'Blockchain ready' : 'Blockchain not ready'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                {chainStatus.contractDeployed
                  ? `Contract: ${chainStatus.contractAddress}`
                  : 'Start Ganache and deploy contract (npm run compile && npm run deploy in backend).'}
              </div>
              {chainStatus.signerWarning && (
                <div style={{ fontSize: 10, color: 'var(--orange)', marginTop: 6 }}>
                  Signer note: {chainStatus.signerWarning}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. NH-48 Widening Phase 2" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Type *</label>
                <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                  <option>Road</option>
                  <option>School</option>
                  <option>Water Facility</option>
                  <option>Bridge</option>
                  <option>Hospital</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Total Fund (INR) *</label>
                <input className="form-input" name="totalFund" type="number" value={form.totalFund} onChange={handleChange} placeholder="e.g. 5000000" min="1" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Location *</label>
              <input className="form-input" name="location" value={form.location} onChange={handleChange} placeholder="e.g. Mumbai-Pune Expressway, Maharashtra" />
            </div>

            <div className="form-group">
              <label className="form-label">Assign Contractor *</label>
              <select className="form-select" name="contractorId" value={form.contractorId} onChange={handleChange} disabled={loadingContractors}>
                <option value="">{loadingContractors ? 'Loading contractors...' : '- Select Contractor -'}</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>{contractor.name}</option>
                ))}
              </select>
            </div>

            {selectedContractor && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>CONTRACTOR WALLET ADDRESS</div>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                  {selectedContractor.address || '-'}
                </div>
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading || loadingContractors} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Submitting on blockchain...' : 'Create Project on Blockchain'}
            </button>
          </form>
        </div>

        <div>
          <div className="form-card" style={{ maxWidth: '100%', marginBottom: 16 }}>
            <div className="form-title" style={{ fontSize: 14, marginBottom: 8 }}>How it works</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div>1. Authority selects a contractor from the database</div>
              <div>2. Smart contract locks project funds during creation</div>
              <div>3. Contract address + transaction hash are persisted</div>
              <div>4. Database stores metadata for dashboards and reports</div>
            </div>
          </div>

          {chainStatus && !chainStatus.contractDeployed && (
            <div className="form-card" style={{ maxWidth: '100%', marginBottom: 16 }}>
              <div className="form-title" style={{ fontSize: 14, marginBottom: 8, color: 'var(--orange)' }}>Fix Blockchain Offline</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                <div>1. Start Ganache on <code>http://127.0.0.1:7545</code></div>
                <div>2. In backend run: <code>npm run compile</code></div>
                <div>3. Then run: <code>npm run deploy</code></div>
                <div>4. Ensure <code>AUTHORITY_PRIVATE_KEY</code> in <code>backend/.env</code> matches Ganache authority account</div>
              </div>
            </div>
          )}

          {result && (
            <div className="form-card" style={{ maxWidth: '100%' }}>
              <div className="form-title" style={{ fontSize: 14, marginBottom: 12, color: 'var(--green)' }}>Project Created</div>
              <div style={{ fontSize: 11, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Project ID:</span> <span style={{ color: 'var(--accent)' }}>{result.project?.projectId}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Blockchain:</span> Confirmed</div>
                {result.blockchain?.txHash && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>TX HASH</div>
                    <TxHashDisplay hash={result.blockchain.txHash} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
