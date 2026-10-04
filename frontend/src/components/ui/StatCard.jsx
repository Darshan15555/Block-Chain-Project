import React from 'react';

export default function StatCard({
  title,
  label,
  value,
  subtitle,
  subtext,
  icon,
  trend,
  trendPositive = true,
  tone,
  variant = 'blue',
  onClick,
}) {
  const displayTitle = title || label;
  const displaySubtitle = subtitle || subtext;
  const effectiveTone = (tone || variant || 'blue').toLowerCase();

  const toneMap = {
    blue: {
      accent: '#2563eb',
      glow: 'rgba(37, 99, 235, 0.08)',
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
    },
    indigo: {
      accent: '#4f46e5',
      glow: 'rgba(79, 70, 229, 0.08)',
      iconBg: '#eef2ff',
      iconColor: '#4f46e5',
    },
    emerald: {
      accent: '#10b981',
      glow: 'rgba(16, 185, 129, 0.08)',
      iconBg: '#ecfdf5',
      iconColor: '#059669',
    },
    amber: {
      accent: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.08)',
      iconBg: '#fffbeb',
      iconColor: '#d97706',
    },
    purple: {
      accent: '#7c3aed',
      glow: 'rgba(124, 58, 237, 0.08)',
      iconBg: '#f5f3ff',
      iconColor: '#6d28d9',
    },
    slate: {
      accent: '#64748b',
      glow: 'rgba(100, 116, 139, 0.06)',
      iconBg: '#f1f5f9',
      iconColor: '#475569',
    },
    danger: {
      accent: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.08)',
      iconBg: '#fef2f2',
      iconColor: '#dc2626',
    },
  };

  const currentTone = toneMap[effectiveTone] || toneMap.blue;

  return (
    <div
      className="bf-stat-card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        '--card-accent': currentTone.accent,
        '--card-glow': currentTone.glow,
      }}
    >
      <div className="bf-stat-card-header">
        <span className="bf-stat-card-title">{displayTitle}</span>
        {icon && (
          <div
            className="bf-stat-card-icon"
            style={{
              backgroundColor: currentTone.iconBg,
              color: currentTone.iconColor,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="bf-stat-card-value">{value}</div>

      {(displaySubtitle || trend) && (
        <div className="bf-stat-card-footer">
          {trend && (
            <span
              className={`bf-stat-card-trend ${
                trendPositive ? 'trend-up' : 'trend-down'
              }`}
            >
              {trendPositive ? '↑' : '↓'} {trend}
            </span>
          )}
          {displaySubtitle && (
            <span className="bf-stat-card-subtext">{displaySubtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
