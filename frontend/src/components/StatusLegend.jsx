const STATUS_MAP = {
  pending: 'Waiting for action',
  accepted: 'Contractor approved request',
  released: 'Funds transferred',
  rejected: 'Request declined',
  active: 'Project in progress',
  completed: 'Work completed',
  suspended: 'Paused or blocked',
};

export default function StatusLegend({ statuses = [] }) {
  return (
    <div className="status-legend">
      {statuses.map((status) => (
        <div key={status} className="status-legend-item">
          <span className={`status-badge status-${status}`}>{status}</span>
          <span className="status-legend-text">{STATUS_MAP[status] || 'Status'}</span>
        </div>
      ))}
    </div>
  );
}
