import { formatINR, shortHash, getPercent, formatDate } from '../utils/api';
import StatusBadge from './ui/StatusBadge';

export default function ProjectCard({ project, onVerify, showVerify = false, onViewDetails }) {
  const pct = getPercent(project.spentFund, project.totalFund);
  const releasedFund = Number(project.releasedFund || 0);

  return (
    <div className="bf-card bf-interactive-card">
      <div className="bf-card-header-bar">
        <span className={`project-type-badge type-${project.type?.toLowerCase().replace(/\s+/g, '')}`}>
          {project.type || 'Infrastructure'}
        </span>
        <StatusBadge status={project.status || 'Active'} size="sm" />
      </div>

      <h3 className="bf-project-card-name">{project.name}</h3>
      <div className="bf-project-card-loc">📍 {project.location}</div>

      <div className="bf-card-funds-split">
        <div>
          <span className="bf-mini-lbl">TOTAL ALLOCATED</span>
          <span className="bf-mini-val font-semibold">{formatINR(project.totalFund)}</span>
        </div>
        <div>
          <span className="bf-mini-lbl">RELEASED</span>
          <span className="bf-mini-val text-blue font-semibold">{formatINR(releasedFund)}</span>
        </div>
      </div>

      <div className="fund-bar-container">
        <div className="fund-bar-label">
          <span>Budget Spent: {formatINR(project.spentFund)}</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div className="fund-bar-track">
          <div
            className={`fund-bar-fill ${pct > 85 ? 'danger' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="bf-project-card-meta">
        <div>
          <span className="bf-meta-micro-lbl">Contractor:</span>
          <span className="bf-meta-micro-val">{project.contractor?.name || 'Vetted Firm'}</span>
        </div>
        <div>
          <span className="bf-meta-micro-lbl">Public Audit:</span>
          <span className="bf-meta-micro-val text-emerald">
            ✓ {project.verificationCount?.workDone || 0} Confirmed
          </span>
        </div>
      </div>

      {project.blockchainTxHash ? (
        <div className="bf-chain-proof-pill">
          <span className="bf-chain-dot active" />
          <span>Tx: {shortHash(project.blockchainTxHash)}</span>
        </div>
      ) : (
        <div className="bf-chain-proof-pill pending">
          <span className="bf-chain-dot" />
          <span>Local Ganache Sync Pending</span>
        </div>
      )}

      {showVerify && onVerify && (
        <div className="bf-verify-btn-group">
          <button
            type="button"
            className="bf-verify-btn done"
            onClick={() => onVerify(project.projectId, 'Work Done')}
          >
            ✓ Work Done
          </button>
          <button
            type="button"
            className="bf-verify-btn not-done"
            onClick={() => onVerify(project.projectId, 'Not Done')}
          >
            ✕ Issue Reported
          </button>
        </div>
      )}

      {onViewDetails && (
        <button
          type="button"
          className="bf-secondary-btn bf-btn-sm"
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => onViewDetails(project)}
        >
          Inspect Project Details →
        </button>
      )}
    </div>
  );
}
