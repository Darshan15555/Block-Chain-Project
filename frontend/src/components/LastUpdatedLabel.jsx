import { useEffect, useMemo, useState } from 'react';

function toRelativeTime(value, nowTs) {
  if (!value) return '-';

  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '-';

  const delta = Math.max(0, nowTs - ts);
  if (delta < 5000) return 'just now';
  if (delta < 60000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3600000) return `${Math.floor(delta / 60000)}m ago`;
  if (delta < 86400000) return `${Math.floor(delta / 3600000)}h ago`;
  return `${Math.floor(delta / 86400000)}d ago`;
}

export default function LastUpdatedLabel({ value, prefix = 'Last updated:' }) {
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    if (!value) return undefined;
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [value]);

  const label = useMemo(() => toRelativeTime(value, nowTs), [value, nowTs]);
  const absolute = useMemo(() => {
    if (!value) return '';
    const dt = new Date(value);
    if (!Number.isFinite(dt.getTime())) return '';
    return dt.toLocaleString('en-IN');
  }, [value]);

  return (
    <span title={absolute}>
      {prefix} {label}
    </span>
  );
}
