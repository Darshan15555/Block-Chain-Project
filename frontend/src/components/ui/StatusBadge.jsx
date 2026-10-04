import React from 'react';

export default function StatusBadge({ status, size = 'md' }) {
  if (!status) return null;

  const raw = String(status).toLowerCase().trim();

  // Mapping status to colors
  let config = {
    label: status,
    bg: '#eff6ff',
    color: '#2563eb',
    border: '#bfdbfe',
    dot: '#3b82f6',
  };

  if (raw === 'active' || raw === 'confirmed' || raw === 'accepted' || raw === 'verified' || raw === 'work done') {
    config = {
      label: status === 'Work Done' ? 'Work Done' : status.charAt(0).toUpperCase() + status.slice(1),
      bg: '#ecfdf5',
      color: '#047857',
      border: '#a7f3d0',
      dot: '#10b981',
    };
  } else if (raw === 'pending' || raw === 'pending proof' || raw === 'in progress') {
    config = {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      bg: '#fffbeb',
      color: '#b45309',
      border: '#fde68a',
      dot: '#f59e0b',
    };
  } else if (raw === 'completed' || raw === 'released') {
    config = {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      bg: '#f0fdf4',
      color: '#15803d',
      border: '#bbf7d0',
      dot: '#22c55e',
    };
  } else if (raw === 'suspended' || raw === 'rejected' || raw === 'failed' || raw === 'hash_not_found' || raw === 'not done') {
    config = {
      label: status === 'not done' ? 'Not Done' : status.charAt(0).toUpperCase() + status.slice(1),
      bg: '#fef2f2',
      color: '#b91c1c',
      border: '#fecaca',
      dot: '#ef4444',
    };
  } else if (raw === 'created') {
    config = {
      label: 'Created',
      bg: '#f5f3ff',
      color: '#6d28d9',
      border: '#ddd6fe',
      dot: '#8b5cf6',
    };
  }

  const paddingStyle = size === 'sm' ? '3px 8px' : '5px 11px';
  const fontStyle = size === 'sm' ? '11px' : '12px';

  return (
    <span
      className="bf-status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: paddingStyle,
        fontSize: fontStyle,
        fontWeight: 700,
        borderRadius: 999,
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: config.dot,
        }}
      />
      {config.label}
    </span>
  );
}
