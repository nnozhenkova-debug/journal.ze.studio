import Header from '../../components/Header';
import EmptyState from '../../components/EmptyState';
import { getCurrentProfile, listEvents } from '../../lib/data';
import { EVENT_TYPE_DOT } from '../../lib/retro-constants';
import { relativeTime } from '../../lib/format';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const [profile, events] = await Promise.all([
    getCurrentProfile(),
    listEvents({ limit: 100 }),
  ]);

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал', href: '/' }, { label: 'Лента' }]} />
      <div className="shell">
        <div className="section">
          <div className="micro-label" style={{ marginBottom: 10 }}>Лента</div>
          <h1 className="h1" style={{ fontSize: 28, marginBottom: 24 }}>Все события</h1>

          {events.length === 0 ? (
            <EmptyState>Событий пока нет.</EmptyState>
          ) : (
            <div className="card">
              {events.map((event) => (
                <div key={event.id} className="list-row card-row">
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 5, flex: 'none',
                      background: EVENT_TYPE_DOT[event.type] || 'var(--gray-1)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="row-title">{event.title}</div>
                    <div className="row-sub">
                      {event.projects?.name ? `${event.projects.name} · ` : ''}
                      {event.subtitle || ''}
                    </div>
                  </div>
                  <div className="row-time">{relativeTime(event.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
