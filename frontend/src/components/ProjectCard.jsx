import { formatINR, shortHash, getPercent, formatDate } from '../utils/api';

const TYPE_CLASS = {
  'Road': 'type-road',
  'School': 'type-school',
  'Water Facility': 'type-water',
  'Bridge': 'type-bridge',
  'Hospital': 'type-road',
  'Other': 'type-other',
};

const STATUS_CLASS = {
  Active: 'status-active',
  Pending: 'status-pending',
  Completed: 'status-completed',
  Suspended: 'status-suspended',
};

export default function ProjectCard({ project, onVerify, showVerify = false, onViewDetails }) {
  const pct = getPercent(project.spentFund, project.totalFund);
  const isDanger = pct > 80;

  return (
    <div className="project-card">
      <div className="project-card-header">
        <span className={`project-type-badge ${TYPE_CLASS[project.type] || 'type-other'}`}>
          {project.type || 'Project'}
        </span>
        <span className={`status-badge ${STATUS_CLASS[project.status] || 'status-active'}`}>
          {project.status}
        </span>
      </div>

      <div className="project-name">{project.name}</div>
      <div className="project-location">📍 {project.location}</div>

      <div className="fund-bar-container">
        <div className="fund-bar-label">
          <span>Spent: {formatINR(project.spentFund)}</span>
          <span>{pct}%</span>
        </div>
        <div className="fund-bar-track">
          <div
            className={`fund-bar-fill ${isDanger ? 'danger' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="fund-bar-label" style={{ marginTop: 4 }}>
          <span>Total: {formatINR(project.totalFund)}</span>
          <span>Remaining: {formatINR(project.totalFund - project.spentFund)}</span>
        </div>
      </div>

      <div className="project-meta">
        <div className="meta-item">
          <div className="meta-label">Contractor</div>
          <div className="meta-value" style={{ fontSize: 11 }}>{project.contractor?.name || '—'}</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Project ID</div>
          <div className="meta-value" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{project.projectId}</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Created</div>
          <div className="meta-value">{formatDate(project.createdAt)}</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Verifications</div>
          <div className="meta-value">
            <span style={{ color: 'var(--green)' }}>✓ {project.verificationCount?.workDone || 0}</span>
            {' / '}
            <span style={{ color: 'var(--red)' }}>✗ {project.verificationCount?.notDone || 0}</span>
          </div>
        </div>
      </div>

      {project.blockchainTxHash && (
        <div className="blockchain-badge">
          ⛓ On-chain: {shortHash(project.blockchainTxHash)}
        </div>
      )}

      {!project.blockchainTxHash && (
        <div className="blockchain-badge pending">
          ⚠ Blockchain pending (configure Ganache)
        </div>
      )}

      {showVerify && (
        <div className="verify-btns">
          <button className="verify-btn verify-done" onClick={() => onVerify(project.projectId, 'Work Done')}>
            ✓ Work Done
          </button>
          <button className="verify-btn verify-notdone" onClick={() => onVerify(project.projectId, 'Not Done')}>
            ✗ Not Done
          </button>
        </div>
      )}

      {onViewDetails && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
          onClick={() => onViewDetails(project)}
        >
          View Details →
        </button>
      )}
    </div>
  );
}
