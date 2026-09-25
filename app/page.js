import Link from 'next/link';
import Header from '../components/Header';
import TemplatePicker from '../components/TemplatePicker';
import EmptyState from '../components/EmptyState';
import {
  getCurrentProfile,
  listIssues,
  listEvents,
  listRetros,
} from '../lib/data';
import { RETRO_TEMPLATES, SEVERITY_LABEL, SEVERITY_PILL_CLASS, PROJECT_PALETTE, EVENT_TYPE_DOT } from '../lib/retro-constants';
import { monthYearParts, monthPrepositional, buildMonthWeeks, isSameDay, daysAgoLabel } from '../lib/format';

export const dynamic = 'force-dynamic';

const WEEKDAYS = [
  { label: 'Пн', weekend: false },
  { label: 'Вт', weekend: false },
  { label: 'Ср', weekend: false },
  { label: 'Чт', weekend: false },
  { label: 'Пт', weekend: false },
  { label: 'Сб', weekend: true },
  { label: 'Вс', weekend: true },
];

function RetroBadge({ retro }) {
  const pal = PROJECT_PALETTE[retro.projects?.color_key] || PROJECT_PALETTE.slate;
  const done = retro.status === 'completed';
  return (
    <span
      className={`retro-badge${done ? ' is-done' : ''}`}
      style={{ background: pal.bg, borderColor: pal.border, color: pal.fg }}
      title={retro.projects?.name || undefined}
    >
      {done ? '✓ ' : ''}{retro.title.replace(/^Ретро:\s*/, '')}
    </span>
  );
}

function eventTimeLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (isSameDay(d, now)) return `Сегодня, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return `Вчера, ${time}`;
  const weekday = d.toLocaleDateString('ru-RU', { weekday: 'short' });
  return `${weekday}, ${time}`;
}

const VISIBLE_RETROS_PER_DAY = 2;

function parseMonthParam(value) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-').map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  return null;
}

function monthParam(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export default async function Page({ searchParams }) {
  const now = new Date();
  const viewed = parseMonthParam(searchParams?.month) || { year: now.getFullYear(), month: now.getMonth() };
  const { year, month } = viewed;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const weeks = buildMonthWeeks(year, month);
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const viewedDate = new Date(year, month, 1);
  const { month: monthName, year: yearLabel } = monthYearParts(viewedDate);
  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);

  const [profile, issues, events, retros] = await Promise.all([
    getCurrentProfile(),
    listIssues({ status: 'open' }),
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
        <div className="section hero-section">
          <div className="micro-label" style={{ marginBottom: 10 }}>Запланированные ретро</div>
          <div className="hero-head">
            <div>
              <div className="calendar-month-nav">
                <Link href={`/?month=${monthParam(prevMonth.getFullYear(), prevMonth.getMonth())}`} className="calendar-nav-btn" aria-label="Предыдущий месяц">
                  ←
                </Link>
                <Link href={`/?month=${monthParam(nextMonth.getFullYear(), nextMonth.getMonth())}`} className="calendar-nav-btn" aria-label="Следующий месяц">
                  →
                </Link>
                {!isCurrentMonth && <Link href="/" className="calendar-nav-today">Сегодня</Link>}
              </div>
              <h1 className="h1">
                {monthName}
                <br />
                <span style={{ color: 'var(--gold)' }}>{yearLabel}</span>
              </h1>
            </div>
          </div>

          <div className="hero-grid">
            <div>
              <div className="retro-calendar">
                <div className="retro-calendar-row">
                  {WEEKDAYS.map((w) => (
                    <div key={w.label} className={`retro-calendar-weekday${w.weekend ? ' is-weekend' : ''}`}>{w.label}</div>
                  ))}
                </div>
                {weeks.map((week, wi) => (
                  <div key={wi} className="retro-calendar-row">
                    {week.map((d, di) => {
                      const inMonth = d.getMonth() === month;
                      const isToday = isSameDay(d, now);
                      const isWeekend = di === 5 || di === 6;
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const dayRetros = retrosByDay.get(key) || [];
                      const classes = ['retro-day'];
                      if (!inMonth) classes.push('is-out');
                      if (isWeekend) classes.push('is-weekend');
                      if (isToday) classes.push('is-today');
                      const hasOverflow = dayRetros.length > VISIBLE_RETROS_PER_DAY;
                      // Показываем максимум VISIBLE_RETROS_PER_DAY строк в ячейке: если ретро
                      // больше, последняя строка — не бейдж, а чип «+N ещё», чтобы ячейка
                      // никогда не росла по высоте и не ломала сетку недели.
                      const shownRetros = hasOverflow
                        ? dayRetros.slice(0, VISIBLE_RETROS_PER_DAY - 1)
                        : dayRetros;
                      return (
                        <div key={di} className={classes.join(' ')}>
                          <div className="retro-day-inner">
                            {isToday ? (
                              <span className="daynum-badge">{d.getDate()}</span>
                            ) : (
                              <span className="daynum">{d.getDate()}</span>
                            )}
                            {inMonth && shownRetros.length > 0 && (
                              <div className="retro-day-badges">
                                {shownRetros.map((r) => (
                                  <RetroBadge key={r.id} retro={r} />
                                ))}
                              </div>
                            )}
                            {inMonth && hasOverflow && (
                              <span className="retro-day-more">
                                +{dayRetros.length - shownRetros.length} ещё
                              </span>
                            )}
                          </div>
                          {inMonth && hasOverflow && (
                            <div className="retro-day-popover">
                              <div className="retro-day-popover-date">{d.getDate()} {monthName.toLowerCase()}</div>
                              {dayRetros.map((r) => (
                                <RetroBadge key={r.id} retro={r} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {retros.length === 0 && (
                <div style={{ marginTop: 20, maxWidth: 330 }}>
                  <EmptyState cta={{ label: 'Запланировать ретро →', href: '/retro/prepare' }}>
                    В {monthPrepositional(viewedDate)} пока нет запланированных ретро
                  </EmptyState>
                </div>
              )}
            </div>

            <div className="side-card">
              <div className="side-card-head">
                <span className="micro-label">Провести ретро</span>
              </div>
              <div className="hero-template-body">
                <div className="template-heading">Выберите шаблон</div>
                <p className="template-sub">Результаты сохраняются автоматически — команда видит итоги сразу.</p>
                <TemplatePicker templates={RETRO_TEMPLATES} />
              </div>
            </div>
          </div>
        </div>

        <div className="section record-section">
          <div className="record-section-header">
            <div className="record-section-title">
              <span className="micro-label">Открытые проблемы</span>
              {issues.length > 0 && <span className="record-count">{issues.length}</span>}
            </div>
            <Link href="/issues" className="record-see-all">Смотреть всё →</Link>
          </div>
          <div className="record-card">
            {issues.length === 0 ? (
              <EmptyState>Открытых проблем нет — можно выдохнуть.</EmptyState>
            ) : (
              <div className="card">
                {issues.slice(0, 3).map((issue) => (
                  <Link key={issue.id} href="/issues" className="table-row card-row">
                    <span className={`pill ${SEVERITY_PILL_CLASS[issue.severity] || 'pill-neutral'}`}>
                      {SEVERITY_LABEL[issue.severity]}
                    </span>
                    <div>
                      <div className="row-title">{issue.title}</div>
                      <div className="row-sub">
                        {issue.projects?.name ? <span className="row-project">{issue.projects.name}</span> : 'Без проекта'}
                        {' · Ответственный: '}
                        {issue.responsible_id ? 'Назначен' : 'Не назначен'}
                      </div>
                    </div>
                    <span className="row-meta">{daysAgoLabel(issue.created_at)} →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section record-section" style={{ paddingTop: 0 }}>
          <div className="record-section-header">
            <span className="micro-label">Лента событий</span>
            <Link href="/events" className="record-see-all">Смотреть всё →</Link>
          </div>
          <div className="record-card">
            {events.length === 0 ? (
              <EmptyState>Пока нет событий — они появятся здесь после первого ретро</EmptyState>
            ) : (
              <div className="card">
                {events.map((event) => (
                  <div key={event.id} className="table-row card-row">
                    <span className="event-dot" style={{ background: EVENT_TYPE_DOT[event.type] || 'var(--gray-1)' }} />
                    <div>
                      <div className="row-title">{event.title}</div>
                      {event.subtitle && <div className="row-sub">{event.subtitle}</div>}
                    </div>
                    <span className="row-meta">{eventTimeLabel(event.created_at)}</span>
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
