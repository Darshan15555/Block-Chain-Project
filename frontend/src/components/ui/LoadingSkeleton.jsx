import React from 'react';

export default function LoadingSkeleton({ type = 'card', count = 3, height }) {
  if (type === 'metric') {
    return (
      <div className="bf-skeleton-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bf-skeleton bf-skeleton-stat" />
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bf-skeleton-table-wrap">
        <div className="bf-skeleton bf-skeleton-header" />
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bf-skeleton bf-skeleton-row" />
        ))}
      </div>
    );
  }

  return (
    <div className="bf-skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bf-skeleton bf-skeleton-card"
          style={{ height: height || 130 }}
        />
      ))}
    </div>
  );
}
