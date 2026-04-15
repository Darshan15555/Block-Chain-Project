import { useEffect, useMemo, useState } from 'react';
import { api, formatDate, formatINR, shortHash } from '../utils/api';
import TxHashDisplay from '../components/TxHashDisplay.jsx';
import LastUpdatedLabel from '../components/LastUpdatedLabel.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';

function typeLabel(type) {
  if (type === 'project') return 'Project';
  if (type === 'expense') return 'Expense';
  if (type === 'release') return 'Release';
  if (type === 'status') return 'Status';
  if (type === 'deposit') return 'Deposit';
  return 'Other';
}

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
  const [txStatusFilter, setTxStatusFilter] = useState('all');

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
      .catch((error) => showToast(error.response?.data?.error || 'Failed to load blockchain audit', 'error'))
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
        // Oldest row gets S-1, newest gets highest serial.
        serialNumber: txFeed.length - index,
      })),
    [txFeed]
  );
  const chainUsage = audit?.chainUsage || [];
  const auditNotes = audit?.auditNotes || [];

  const txTypeCounts = useMemo(
    () => ({
      project: txFeed.filter((tx) => tx.type === 'project').length,
      expense: txFeed.filter((tx) => tx.type === 'expense').length,
      release: txFeed.filter((tx) => tx.type === 'release').length,
      status: txFeed.filter((tx) => tx.type === 'status').length,
      deposit: txFeed.filter((tx) => tx.type === 'deposit').length,
      other: txFeed.filter((tx) => tx.type === 'other').length,
    }),
    [txFeed]
  );

  const txStatusCounts = useMemo(
    () => ({
      confirmed: txFeed.filter((tx) => tx.blockchainStatus === 'confirmed').length,
      pending: txFeed.filter((tx) => tx.blockchainStatus === 'pending').length,
      failed: txFeed.filter((tx) => tx.blockchainStatus === 'failed').length,
    }),
    [txFeed]
  );

  const filteredTxFeed = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return txFeedWithSerial.filter((tx) => {
      const typeOk = txTypeFilter === 'all' || tx.type === txTypeFilter;
      const statusOk = txStatusFilter === 'all' || tx.blockchainStatus === txStatusFilter;
      if (!typeOk || !statusOk) return false;
      if (!term) return true;

      const haystack = [
        tx.actionLabel,
        tx.type,
        tx.projectId,
        tx.projectName,
        tx.details,
        tx.contractorName,
        tx.contractorAddress,
        tx.actorName,
        tx.actorAddress,
        tx.txHash,
        tx.dataHash,
        tx.blockNumber,
        tx.serialNumber,
        tx.source,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [txFeedWithSerial, searchTerm, txTypeFilter, txStatusFilter]);

  const sourceMeta = (source) => {
    if (source === 'chain') return { label: 'On-chain', statusClass: 'active' };
    if (source === 'chain_receipt') return { label: 'Receipt-verified', statusClass: 'active' };
    return { label: 'DB fallback', statusClass: 'pending' };
  };

  const handleCopyVisibleHashes = async () => {
    const hashes = filteredTxFeed.map((tx) => tx.txHash).filter(Boolean);
    if (hashes.length === 0) {
      showToast('No transaction hashes to copy', 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(hashes.join('\n'));
      showToast(`Copied ${hashes.length} hashes`, 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  const handleExportVisibleTransactions = () => {
    if (filteredTxFeed.length === 0) {
      showToast('No transaction rows to export', 'info');
      return;
    }
    const rows = [
      ['Action', 'Type', 'Project ID', 'Project Name', 'Amount', 'Status', 'Source', 'Block', 'Tx Hash', 'Data Hash', 'Actor', 'Contractor', 'Details', 'Time'],
      ...filteredTxFeed.map((tx) => [
        tx.actionLabel || typeLabel(tx.type),
        tx.type || '',
        tx.projectId || '',
        tx.projectName || '',
        tx.amount ?? '',
        tx.blockchainStatus || '',
        tx.source || '',
        tx.blockNumber ?? `S-${tx.serialNumber ?? ''}`,
        tx.txHash || '',
        tx.dataHash || '',
        tx.actorName || tx.actorAddress || '',
        tx.contractorName || tx.contractorAddress || '',
        tx.details || '',
        formatDate(tx.timestamp),
      ]),
    ];
    downloadCsv(`blockchain-audit-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    showToast('Blockchain audit exported', 'success');
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Blockchain Proof</div>
          <div className="section-subtitle">
            Smart-contract event ledger for all on-chain actions | <LastUpdatedLabel value={lastUpdated} />
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Node Connection</div>
          <div className="stat-value" style={{ fontSize: 18, color: status.connected ? 'var(--green)' : 'var(--red)' }}>
            {status.connected ? 'Connected' : 'Offline'}
          </div>
          <div className="stat-sub">{status.ganacheUrl || '-'}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Contract Deployment</div>
          <div className="stat-value" style={{ fontSize: 18, color: status.contractDeployed ? 'var(--green)' : 'var(--red)' }}>
            {status.contractDeployed ? 'Deployed' : 'Missing'}
          </div>
          <div className="stat-sub">{status.contractAddress ? shortHash(status.contractAddress) : 'No contract address'}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">On-Chain Events</div>
          <div className="stat-value">{totals.allTransactions ?? 0}</div>
          <div className="stat-sub">Pulled from contract event logs</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Reconciliation Queue</div>
          <div className="stat-value">{totals.pendingReconciliation ?? 0}</div>
          <div className="stat-sub">{(totals.dbOnlyTransactions ?? 0) > 0 ? `${totals.dbOnlyTransactions} DB-only row(s)` : 'No DB-only fallback rows'}</div>
        </div>
      </div>

      <div className="explain-grid">
        <ExplainPanel
          title="What Is On Chain"
          subtitle="Immutable proof events"
          tone="accent"
          steps={[
            'Project creation locks project budget on smart contract.',
            'Expense logs store amount + proof hash on-chain.',
            'Fund release transfers value to contractor wallet.',
            'Project status changes are also recorded on-chain.',
          ]}
        />
        <ExplainPanel
          title="How To Verify Fast"
          subtitle="Evaluator-friendly sequence"
          tone="green"
          steps={[
            'Open recent row and copy tx hash.',
            'Show block number and timestamp for that tx.',
            'For expense rows, also show proof data hash.',
          ]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <div className="form-title" style={{ fontSize: 14, marginBottom: 10 }}>Where Blockchain Is Used</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {chainUsage.map((line) => (
              <div key={line}>- {line}</div>
            ))}
          </div>
          {auditNotes.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--accent)' }}>
              {auditNotes.map((line) => (
                <div key={line}>- {line}</div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card" style={{ maxWidth: '100%' }}>
          <div className="form-title" style={{ fontSize: 14, marginBottom: 10 }}>Contract and Signer</div>
          <div style={{ fontSize: 11, lineHeight: 2 }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Authority Address: </span>
              <span style={{ color: 'var(--accent)' }}>{status.authorityAccount || '-'}</span>
              {status.authorityAccount && (
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => copyText(status.authorityAccount)}>
                  Copy
                </button>
              )}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Signer Address: </span>
              <span style={{ color: 'var(--accent)' }}>{status.signerAddress || '-'}</span>
              {status.signerAddress && (
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => copyText(status.signerAddress)}>
                  Copy
                </button>
              )}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Contract Address: </span>
              <span style={{ color: 'var(--accent)' }}>{status.contractAddress || '-'}</span>
              {status.contractAddress && (
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => copyText(status.contractAddress)}>
                  Copy
                </button>
              )}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Signer Mode: </span>
              <span>{status.signerMode || '-'}</span>
            </div>
            {!!status.signerWarning && (
              <div style={{ color: 'var(--orange)' }}>
                {status.signerWarning}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Contract Event Ledger</div>
          <div className="section-subtitle">
            Showing {filteredTxFeed.length}/{txFeed.length} rows from on-chain + fallback evidence
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" type="button" onClick={handleCopyVisibleHashes}>
            Copy visible hashes
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={handleExportVisibleTransactions}>
            Export CSV
          </button>
        </div>
      </div>
      {(!status.connected || !status.contractDeployed) && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255, 140, 66, 0.35)',
            background: 'rgba(255, 140, 66, 0.08)',
            color: 'var(--orange)',
            fontSize: 11,
          }}
        >
          Blockchain node/contract is offline. Block numbers appear only for rows that already have on-chain proof or stored block data.
        </div>
      )}

      <div className="filter-row">
        <input
          className="form-input"
          style={{ minWidth: 220, maxWidth: 380 }}
          placeholder="Search action, project, hash, wallet, data hash, block..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        {[
          { id: 'all', label: `All (${txFeed.length})` },
          { id: 'project', label: `Project (${txTypeCounts.project})` },
          { id: 'expense', label: `Expense (${txTypeCounts.expense})` },
          { id: 'release', label: `Release (${txTypeCounts.release})` },
          { id: 'status', label: `Status (${txTypeCounts.status})` },
          { id: 'deposit', label: `Deposit (${txTypeCounts.deposit})` },
          { id: 'other', label: `Other (${txTypeCounts.other})` },
        ].map((item) => (
          <button
            key={item.id}
            className={`filter-chip ${txTypeFilter === item.id ? 'active' : ''}`}
            type="button"
            onClick={() => setTxTypeFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        {[
          { id: 'all', label: 'Any Status' },
          { id: 'confirmed', label: `Confirmed (${txStatusCounts.confirmed})` },
          { id: 'pending', label: `Pending (${txStatusCounts.pending})` },
          { id: 'failed', label: `Failed (${txStatusCounts.failed})` },
        ].map((item) => (
          <button
            key={item.id}
            className={`filter-chip ${txStatusFilter === item.id ? 'active' : ''}`}
            type="button"
            onClick={() => setTxStatusFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSearchTerm('');
            setTxTypeFilter('all');
            setTxStatusFilter('all');
          }}
        >
          Clear filters
        </button>
      </div>

      {filteredTxFeed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">
            {txFeed.length === 0 ? 'No blockchain events yet' : 'No transactions match current filters'}
          </div>
          <div className="empty-desc">
            {txFeed.length === 0
              ? 'Run create project, release funds, or submit update to generate smart-contract events.'
              : 'Adjust filter/search to view more transaction records.'}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Project</th>
                <th>Amount</th>
                <th>Proof Details</th>
                <th>TX / Block (or Serial)</th>
                <th>Source</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxFeed.map((tx, index) => (
                <tr key={`${tx.txHash || 'row'}-${index}`}>
                  <td>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{tx.actionLabel || typeLabel(tx.type)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{typeLabel(tx.type)}</div>
                  </td>
                  <td>
                    <div style={{ color: 'var(--text-primary)' }}>{tx.projectName || tx.projectId || 'N/A'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{tx.projectId || '-'}</div>
                  </td>
                  <td>{tx.amount !== null && tx.amount !== undefined ? formatINR(tx.amount) : '-'}</td>
                  <td>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                      {tx.details || '-'}
                    </div>
                    {tx.dataHash && (
                      <div style={{ color: 'var(--accent)', fontSize: 10, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                        Hash: {shortHash(tx.dataHash)}
                      </div>
                    )}
                    {(tx.contractorName || tx.contractorAddress) && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
                        Contractor: {tx.contractorName || shortHash(tx.contractorAddress)}
                      </div>
                    )}
                  </td>
                  <td>
                    <TxHashDisplay hash={tx.txHash} />
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
                      Block: {tx.blockNumber ?? `S-${tx.serialNumber}`}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${sourceMeta(tx.source).statusClass}`}>
                      {sourceMeta(tx.source).label}
                    </span>
                  </td>
                  <td>{formatDate(tx.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
