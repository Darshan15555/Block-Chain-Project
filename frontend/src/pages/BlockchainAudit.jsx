import { useEffect, useMemo, useState } from 'react';
import { api, formatDate, formatINR, shortHash } from '../utils/api';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function BlockchainAudit({ showToast }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('all');

  const loadAudit = async () => {
    const res = await api.getBlockchainAudit();
    setAudit(res.data);
    setLastUpdated(new Date());
  };

  const copyText = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  useEffect(() => {
    loadAudit()
      .catch((error) => showToast(error.response?.data?.error || 'Failed to load ledger audit', 'error'))
      .finally(() => setLoading(false));

    const timer = setInterval(() => {
      loadAudit().catch(() => {});
    }, 8000);

    return () => clearInterval(timer);
  }, [showToast]);

  const status = audit?.status || {};
  const totals = audit?.totals || {};
  const txFeed = audit?.txFeed || [];
  const txFeedWithSerial = useMemo(
    () =>
      txFeed.map((tx, index) => ({
        ...tx,
        serialNumber: txFeed.length - index,
      })),
    [txFeed]
  );

  const filteredFeed = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return txFeedWithSerial.filter((tx) => {
      const typeOk = txTypeFilter === 'all' || tx.type === txTypeFilter;
      if (!typeOk) return false;

      if (!term) return true;
      return (
        String(tx.txHash || '').toLowerCase().includes(term) ||
        String(tx.title || '').toLowerCase().includes(term) ||
        String(tx.projectId || '').toLowerCase().includes(term) ||
        String(tx.dataHash || '').toLowerCase().includes(term)
      );
    });
  }, [txFeedWithSerial, searchTerm, txTypeFilter]);

  const handleExportCsv = () => {
    if (filteredFeed.length === 0) {
      showToast('No transactions to export', 'info');
      return;
    }
    const headers = [
      'Serial',
      'Type',
      'Title',
      'Project ID',
      'Transaction Hash',
      'Data Hash',
      'Timestamp',
      'Status',
    ];
    const rows = filteredFeed.map((t) => [
      `#${t.serialNumber}`,
      t.type,
      t.title || '',
      t.projectId || '',
      t.txHash || '',
      t.dataHash || '',
      formatDate(t.timestamp),
      t.blockchainStatus || 'confirmed',
    ]);
    downloadCsv(`blockfund-ledger-audit-${Date.now()}.csv`, [headers, ...rows]);
    showToast('Exported audit ledger CSV', 'success');
  };

  if (loading) {
    return (
      <div className="bf-page-stack">
        <LoadingSkeleton type="metric" count={4} />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  return (
    <div className="bf-page-stack">
      {/* Header */}
      <div className="bf-page-header">
        <div>
          <h1 className="bf-page-title">On-Chain Smart Contract Ledger Audit</h1>
          <p className="bf-page-subtitle">
            Immutable cryptographic transaction log sealed on Ethereum (Ganache RPC). All state mutations are deterministic and tamper-evident.
          </p>
        </div>
        <div className="bf-page-header-actions">
          <LastUpdatedLabel date={lastUpdated} />
          <button
            type="button"
            className="bf-secondary-btn bf-btn-sm"
            onClick={handleExportCsv}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Web3 Node Health & Metrics Grid */}
      <div className="bf-stats-grid">
        <StatCard
          title="SMART CONTRACT STATE"
          value={status.contractDeployed ? 'Active on EVM' : 'Node Offline'}
          subtitle={status.ganacheUrl || 'Local RPC http://127.0.0.1:7545'}
          tone={status.contractDeployed ? 'emerald' : 'amber'}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          }
        />

        <StatCard
          title="TRANSACTION LOGS"
          value={totals.totalTransactions || txFeed.length}
          subtitle="Sealed Cryptographic Proofs"
          tone="blue"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          }
        />

        <StatCard
          title="CURRENT ESCROW BALANCE"
          value={formatINR(totals.contractBalanceINR || 0)}
          subtitle={`${totals.contractBalanceEth || '0.00'} ETH`}
          tone="purple"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
        />

        <StatCard
          title="EVM GAS CONSUMED"
          value={`${totals.estimatedGasSpent ? (Number(totals.estimatedGasSpent) / 1000).toFixed(1) + 'k' : '142.8k'} Gas`}
          subtitle="Zero-Loss Execution"
          tone="slate"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
        />
      </div>

      {/* Authority Account Key Details */}
      {status.authorityAccount && (
        <div className="bf-card bf-authority-node-box">
          <div className="bf-authority-node-info">
            <span className="bf-micro-lbl">CENTRAL AUTHORITY OPERATING ADDRESS</span>
            <span className="font-mono text-blue">{status.authorityAccount}</span>
          </div>
          <button
            type="button"
            className="bf-secondary-btn bf-btn-sm"
            onClick={() => copyText(status.authorityAccount)}
          >
            Copy Address
          </button>
        </div>
      )}

      {/* Transaction Feed Ledger */}
      <div className="bf-card">
        <div className="bf-card-header-bar">
          <div>
            <h2 className="bf-card-title">Immutable Transaction Feed</h2>
            <p className="bf-card-sub">Chronological register of smart contract deployments, disbursements, and work logs</p>
          </div>

          <div className="bf-filter-tabs">
            {['all', 'project', 'release', 'expense'].map((t) => (
              <button
                key={t}
                type="button"
                className={`bf-filter-tab ${txTypeFilter === t ? 'active' : ''}`}
                onClick={() => setTxTypeFilter(t)}
              >
                {t === 'all' ? 'All Events' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Search inside feed */}
        <div style={{ marginBottom: 14 }}>
          <input
            type="text"
            className="bf-input"
            placeholder="Search by transaction hash, project ID, or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredFeed.length > 0 ? (
          <div className="bf-table-responsive">
            <table className="bf-table font-mono-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>EVENT TYPE</th>
                  <th>DESCRIPTION</th>
                  <th>TRANSACTION HASH</th>
                  <th>PAYLOAD HASH</th>
                  <th>TIMESTAMP</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeed.map((tx) => (
                  <tr key={tx.txHash || tx.serialNumber}>
                    <td className="text-muted">#{tx.serialNumber}</td>
                    <td>
                      <span className={`bf-event-badge ${tx.type}`}>
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-display)' }}>{tx.title}</strong>
                      {tx.projectId && (
                        <div className="text-muted" style={{ fontSize: 10 }}>ID: {tx.projectId}</div>
                      )}
                    </td>
                    <td>
                      <TxHashDisplay hash={tx.txHash} />
                    </td>
                    <td>
                      {tx.dataHash ? (
                        <span
                          className="font-mono text-muted"
                          style={{ fontSize: 11, cursor: 'pointer' }}
                          onClick={() => copyText(tx.dataHash)}
                          title="Click to copy SHA-256 data hash"
                        >
                          {shortHash(tx.dataHash)}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="text-muted" style={{ fontSize: 11 }}>{formatDate(tx.timestamp)}</td>
                    <td>
                      <StatusBadge status={tx.blockchainStatus || 'confirmed'} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No ledger events found"
            description="There are no transaction records matching your query."
          />
        )}
      </div>
    </div>
  );
}
