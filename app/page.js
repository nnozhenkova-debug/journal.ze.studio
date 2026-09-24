import Link from 'next/link';
import Header from '../components/Header';
import Pill from '../components/Pill';
import EmptyState from '../components/EmptyState';
import {
  getCurrentProfile,
  listIssues,
  listEvents,
  listRetros,
} from '../lib/data';
import { RETRO_TEMPLATES, SEVERITY_LABEL, SEVERITY_PILL_CLASS, EVENT_TYPE_DOT } from '../lib/retro-constants';
import { monthLabel, buildMonthGrid, isSameDay, toDateOnly, weekdayShort, relativeTime } from '../lib/format';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const grid = buildMonthGrid(year, month);
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [profile, issues, events, retros] = await Promise.all([
    getCurrentProfile(),
    listIssues({ status: 'open', limit: 4 }),
    listEvents({ limit: 5 }),
    listRetros({ from, to }),
  ]);

  const retrosByDay = new Map();
  for (const r of retros) {
    const key = r.scheduled_date;
    if (!retrosByDay.has(key)) retrosByDay.set(key, []);
    retrosByDay.get(key).push(r);
  }

  return (
    <div>
      <Header profile={profile} />
      <div className="shell">
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div className="micro-label" style={{ marginBottom: 10 }}>Журнал студии</div>
              <h1 className="h1" style={{ whiteSpace: 'pre-line' }}>{monthLabel(now)}</h1>
              <p className="h1-sub">Ретро, проекты и проблемы студии — в одном месте.</p>
            </div>

            <div className="card" style={{ padding: 20, minWidth: 320 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                  <div key={d} style={{ fontSize: 10, color: 'var(--gray-1)', textAlign: 'center', fontWeight: 600 }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {grid.map((d, i) => {
                  const inMonth = d.getMonth() === month;
                  const isToday = isSameDay(d, now);
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const dayRetros = retrosByDay.get(key) || [];
                  return (
                    <div
                      key={i}
                      style={{
                        aspectRatio: '1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                        fontSize: 12,
                        color: inMonth ? 'var(--near)' : 'var(--gray-1)',
                        background: isToday ? 'var(--gold-bg)' : 'transparent',
                        border: isToday ? '1px solid var(--gold-border)' : '1px solid transparent',
                        fontWeight: isToday ? 600 : 400,
                        position: 'relative',
                      }}
                    >
                      {d.getDate()}
                      {dayRetros.length > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 4,
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: dayRetros.some((r) => r.status === 'completed') ? '#2ba647' : 'var(--gold)',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="section" style={{ paddingTop: 0 }}>
          <div className="micro-label" style={{ marginBottom: 14 }}>Начать ретро</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
            {RETRO_TEMPLATES.map((t) => (
              <Link
                key={t.id}
                href={`/retro/prepare?template=${t.id}`}
                className="card"
                style={{ padding: 18, display: 'block' }}
              >
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-2)', lineHeight: 1.4 }}>{t.short}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-1)', marginTop: 10 }}>{t.duration}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="section" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <div className="micro-label">Проблемы</div>
              <Link href="/issues" style={{ fontSize: 12, color: 'var(--gray-2)' }}>Все проблемы →</Link>
            </div>
            {issues.length === 0 ? (
              <EmptyState>Открытых проблем нет — можно выдохнуть.</EmptyState>
            ) : (
              <div className="card">
                {issues.map((issue) => (
                  <Link key={issue.id} href={`/issues#${issue.id}`} className="list-row card-row" style={{ justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div className="row-title">{issue.title}</div>
                      <div className="row-sub">{issue.projects?.name || '—'}</div>
                    </div>
                    <Pill variant={SEVERITY_PILL_CLASS[issue.severity]?.replace('pill-', '') || 'neutral'}>
                      {SEVERITY_LABEL[issue.severity]}
                    </Pill>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <div className="micro-label">Лента</div>
              <Link href="/events" style={{ fontSize: 12, color: 'var(--gray-2)' }}>Вся лента →</Link>
            </div>
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
                      {event.subtitle && <div className="row-sub">{event.subtitle}</div>}
                    </div>
                    <div className="row-time">{relativeTime(event.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
