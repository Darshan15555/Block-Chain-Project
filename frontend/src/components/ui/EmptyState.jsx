import React from 'react';

export default function EmptyState({
  title = 'No records found',
  description = 'There are currently no items to display in this view.',
  icon,
  actionLabel,
  onAction,
}) {
  return (
    <div className="bf-empty-state">
      <div className="bf-empty-state-icon-wrap">
        {icon || (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        )}
      </div>

      <h3 className="bf-empty-state-title">{title}</h3>
      <p className="bf-empty-state-desc">{description}</p>

      {actionLabel && onAction && (
        <button
          type="button"
          className="bf-primary-btn bf-empty-state-btn"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
