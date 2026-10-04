import { useState, useEffect, useMemo } from 'react';
import { api, formatDate } from '../utils/api';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';

const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

export default function ManageContractors({ showToast }) {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletOptions, setWalletOptions] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState(null);

  const [form, setForm] = useState({
    name: '',
    username: '',
    companyName: '',
    walletAddress: '',
    email: '',
  });

  const loadContractors = async () => {
    const res = await api.getContractors();
    setContractors(res.data.contractors || []);
  };

  useEffect(() => {
    loadContractors()
      .catch(() => showToast('Failed to load registered contractors', 'error'))
      .finally(() => setLoading(false));

    api.getWalletOptions()
      .then((res) => setWalletOptions(res.data.wallets || []))
      .catch(() => setWalletOptions([]));
  }, [showToast]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.username.trim()) {
      showToast('Name and unique username are required', 'error');
      return;
    }
    if (!form.walletAddress || !WALLET_REGEX.test(form.walletAddress.trim())) {
      showToast('A valid 42-character Ethereum wallet address (0x...) is required', 'error');
      return;
    }

    setSubmitting(true);
    setInviteResult(null);
    try {
      const res = await api.inviteContractor({
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        companyName: form.companyName.trim(),
        walletAddress: form.walletAddress.trim(),
        email: form.email?.trim() || null,
      });
      setInviteResult({
        contractor: res.data.contractor,
        tempPassword: res.data.tempPassword,
      });
      showToast(res.data.message || 'Contractor onboarded successfully', 'success');
      setForm({ name: '', username: '', companyName: '', walletAddress: '', email: '' });
      await loadContractors();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to onboard contractor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text, fieldName = 'text') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      showToast('Copied to clipboard', 'success');
      setTimeout(() => setCopiedField(null), 2500);
    } catch {
      showToast('Clipboard access denied', 'error');
    }
  };

  const filteredContractors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contractors;
    return contractors.filter((c) =>
      c.name?.toLowerCase().includes(query) ||
      c.username?.toLowerCase().includes(query) ||
      c.companyName?.toLowerCase().includes(query) ||
      c.address?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query)
    );
  }, [contractors, searchQuery]);

  const activeWalletsCount = useMemo(() => {
    return contractors.filter((c) => c.address && WALLET_REGEX.test(c.address)).length;
  }, [contractors]);

  if (loading) {
    return (
      <div className="bf-page-stack">
        <LoadingSkeleton type="metric" count={3} />
        <LoadingSkeleton type="table" rows={5} />
      </div>
    );
  }

  return (
    <div className="bf-page-stack">
      {/* Page Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">Contractor Registry & Onboarding</h1>
          <p className="bf-page-subtitle">
            Authorize state-approved engineering partners and tie their credentials to verified Ethereum wallet accounts.
          </p>
        </div>
        <div className="bf-page-header-actions">
          <button
            type="button"
            className="bf-primary-btn"
            onClick={() => {
              setInviteResult(null);
              setShowInviteModal(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Onboard Contractor</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="bf-stats-grid">
        <StatCard
          label="Registered Partners"
          value={contractors.length}
          subtext="State-licensed contractors in system"
          variant="indigo"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          label="Verified On-Chain Wallets"
          value={activeWalletsCount}
          subtext="Bound to active smart contract escrow"
          variant="emerald"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
        />
        <StatCard
          label="Ganache Seed Accounts"
          value={walletOptions.length}
          subtext="Local sandbox wallets available"
          variant="blue"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        />
      </div>

      {/* Main Contractors Card & Table */}
      <div className="bf-card">
        <div className="bf-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="bf-card-title">Verified Contractor Directory</h2>
            <p className="bf-card-subtitle">
              {filteredContractors.length} of {contractors.length} contractor accounts visible
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="bf-search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contractor, company, wallet..."
                className="bf-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="bf-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {filteredContractors.length === 0 ? (
          <EmptyState
            title={contractors.length === 0 ? "No Contractors Registered" : "No Matching Contractors"}
            description={contractors.length === 0 ? "Start by onboarding your first infrastructure contractor to assign projects." : "Try adjusting your search criteria."}
            actionLabel={contractors.length === 0 ? "+ Onboard Contractor" : undefined}
            onAction={contractors.length === 0 ? () => setShowInviteModal(true) : undefined}
          />
        ) : (
          <div className="bf-table-container">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Contractor & Entity</th>
                  <th>Username</th>
                  <th>Bound Wallet Address</th>
                  <th>Contact Email</th>
                  <th>Authorization Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredContractors.map((c) => {
                  const hasValidWallet = c.address && WALLET_REGEX.test(c.address);
                  return (
                    <tr key={c.id || c.username}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: 13,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {(c.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {c.companyName || 'Sole Proprietor'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="bf-badge bf-badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                          @{c.username}
                        </span>
                      </td>
                      <td>
                        {hasValidWallet ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              className="bf-mono-badge"
                              title={c.address}
                              style={{ cursor: 'pointer' }}
                              onClick={() => copyToClipboard(c.address, `wallet-${c.username}`)}
                            >
                              {c.address.slice(0, 8)}...{c.address.slice(-6)}
                            </span>
                            <button
                              type="button"
                              className="bf-icon-btn"
                              onClick={() => copyToClipboard(c.address, `wallet-${c.username}`)}
                              title="Copy full wallet address"
                            >
                              {copiedField === `wallet-${c.username}` ? (
                                <span style={{ color: 'var(--green)', fontSize: 11, fontWeight: 700 }}>✓</span>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          <StatusBadge status="UNBOUND" variant="warning" />
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {c.email || '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {c.createdAt ? formatDate(c.createdAt) : '—'}
                      </td>
                      <td>
                        <StatusBadge status="ACTIVE" variant="success" dot />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Onboard Contractor Modal */}
      {showInviteModal && (
        <div className="bf-modal-backdrop" onClick={() => !submitting && setShowInviteModal(false)}>
          <div className="bf-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="bf-modal-header">
              <div>
                <h3 className="bf-modal-title">Onboard New Contractor</h3>
                <p className="bf-modal-subtitle">
                  Generates an authenticated identity and links their cryptographic wallet for state project disbursements.
                </p>
              </div>
              <button
                type="button"
                className="bf-modal-close"
                onClick={() => setShowInviteModal(false)}
                disabled={submitting}
              >
                ✕
              </button>
            </div>

            {inviteResult ? (
              <div className="bf-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: 12,
                    background: 'rgba(22, 163, 74, 0.08)',
                    border: '1px solid rgba(22, 163, 74, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--green)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--green)' }}>Account Successfully Created</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Share these temporary credentials securely with the contractor.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Contractor Name
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {inviteResult.contractor.name} ({inviteResult.contractor.companyName || 'Individual'})
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>USERNAME</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                        {inviteResult.contractor.username}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="bf-secondary-btn bf-btn-sm"
                      onClick={() => copyToClipboard(inviteResult.contractor.username, 'res-user')}
                    >
                      {copiedField === 'res-user' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TEMPORARY PASSWORD</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706', fontFamily: 'var(--font-mono)' }}>
                        {inviteResult.tempPassword}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="bf-secondary-btn bf-btn-sm"
                      onClick={() => copyToClipboard(inviteResult.tempPassword, 'res-pass')}
                    >
                      {copiedField === 'res-pass' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Bound Wallet Address
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      {inviteResult.contractor.address || inviteResult.contractor.walletAddress}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="bf-primary-btn"
                    onClick={() => {
                      setInviteResult(null);
                      setShowInviteModal(false);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite}>
                <div className="bf-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="bf-form-group">
                    <label className="bf-form-label">Full Legal Name *</label>
                    <input
                      type="text"
                      className="bf-form-input"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Ramesh Chandra Verma"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="bf-form-group">
                      <label className="bf-form-label">Username *</label>
                      <input
                        type="text"
                        className="bf-form-input"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        placeholder="e.g. ramesh_infra"
                        required
                      />
                    </div>
                    <div className="bf-form-group">
                      <label className="bf-form-label">Company / Enterprise</label>
                      <input
                        type="text"
                        className="bf-form-input"
                        name="companyName"
                        value={form.companyName}
                        onChange={handleChange}
                        placeholder="e.g. Verma Highways Ltd."
                      />
                    </div>
                  </div>

                  <div className="bf-form-group">
                    <label className="bf-form-label">Ethereum Wallet Address (0x...) *</label>
                    <input
                      type="text"
                      className="bf-form-input"
                      name="walletAddress"
                      value={form.walletAddress}
                      onChange={handleChange}
                      placeholder="0x90F79bf6EB2c4f870365E785982E1f101E93b906"
                      required
                    />
                    {walletOptions.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <select
                          className="bf-form-select"
                          value={walletOptions.includes(form.walletAddress) ? form.walletAddress : ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, walletAddress: e.target.value }))}
                        >
                          <option value="">Quick Fill from Ganache Test Wallets...</option>
                          {walletOptions.map((wallet, idx) => (
                            <option key={wallet} value={wallet}>
                              Wallet {idx + 1}: {wallet}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="bf-form-group">
                    <label className="bf-form-label">Official Email (Optional)</label>
                    <input
                      type="email"
                      className="bf-form-input"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="contractor@infra.gov.in"
                    />
                  </div>
                </div>

                <div className="bf-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className="bf-ghost-btn"
                    onClick={() => setShowInviteModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bf-primary-btn"
                    disabled={submitting}
                  >
                    {submitting ? 'Generating Account...' : 'Complete Onboarding'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
