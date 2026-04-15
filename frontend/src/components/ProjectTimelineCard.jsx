import { useEffect, useState } from 'react';
import { api, formatDate, formatINR } from '../utils/api';
import TxHashDisplay from './TxHashDisplay.jsx';
import LastUpdatedLabel from './LastUpdatedLabel.jsx';

export default function ProjectTimelineCard({ projectId, showToast }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);

    const loadTimeline = async (showError = true) => {
      try {
        const res = await api.getProjectTimeline(projectId);
        if (!active) return;
        setEvents(res.data.timeline || []);
        setLastUpdated(new Date());
      } catch {
        if (showError) showToast('Failed to load project timeline', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTimeline(true);
    const timer = setInterval(() => {
      loadTimeline(false);
    }, 6000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [projectId, showToast]);

  return (
    <div className="form-card" style={{ maxWidth: '100%' }}>
      <div className="section-header" style={{ marginBottom: 10 }}>
        <div className="form-title" style={{ fontSize: 15, marginBottom: 0 }}>Project Timeline</div>
        <div className="section-subtitle" style={{ fontSize: 10 }}>
          <LastUpdatedLabel value={lastUpdated} />
        </div>
      </div>
      {loading ? (
        <div className="spinner" />
      ) : events.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>No timeline events yet.</div>
      ) : (
        <div className="timeline-list">
          {events.map((event) => (
            <div key={event.key} className="timeline-item">
              <div className="timeline-dot" />
              <div style={{ flex: 1 }}>
                <div className="timeline-title">{event.title}</div>
                <div className="timeline-meta">
                  {event.actorRole} | {event.actorName} | {formatDate(event.timestamp)}
                  {event.amount ? ` | ${formatINR(event.amount)}` : ''}
                </div>
                {event.chainAction && <TxHashDisplay hash={event.txHash} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}