'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EVENT_CATEGORIES, EVENT_TYPE_CATEGORY, EVENT_TYPE_DOT } from '../lib/retro-constants';
import { groupEventsByDay, timeOnly } from '../lib/format';
import EmptyState from './EmptyState';

const PAGE_SIZE = 10;

function isDoneDot(type) {
  return type === 'retro_completed' || type === 'issue_resolved';
}

export default function EventsBoard({ events, projects }) {
  const [category, setCategory] = useState(null); // null | 'retro' | 'issues' | 'project'
  const [projectId, setProjectId] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (category && EVENT_TYPE_CATEGORY[event.type] !== category) return false;
      if (projectId && event.project_id !== projectId) return false;
      return true;
    });
  }, [events, category, projectId]);

  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;
  const groups = useMemo(() => groupEventsByDay(visible), [visible]);

  return (
    <div>
      <div className="filter-bar">
        <button
          type="button"
          className={`filter-chip${category === null ? ' is-active' : ''}`}
          onClick={() => { setCategory(null); setVisibleCount(PAGE_SIZE); }}
        >
          Все
        </button>
        {EVENT_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`filter-chip${category === c.key ? ' is-active' : ''}`}
            onClick={() => { setCategory(category === c.key ? null : c.key); setVisibleCount(PAGE_SIZE); }}
          >
            {c.label}
          </button>
        ))}
        <div className="filter-spacer" />
        <div className={`filter-dropdown${projectId ? ' is-active' : ''}`}>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setVisibleCount(PAGE_SIZE); }}
          >
            <option value="">Все проекты</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className="chevron">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ marginTop: 28, maxWidth: 330 }}>
          {events.length === 0 ? (
            <EmptyState>Пока нет событий — они появятся здесь после первого ретро</EmptyState>
          ) : (
            <EmptyState>Ничего не нашлось под текущие фильтры</EmptyState>
          )}
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="event-group">
            <div className="event-group-head">
              <span className="micro-label">{group.label}</span>
              <span className="event-group-line" />
            </div>
            <div className="card">
              {group.items.map((event) => {
                const eventCategory = EVENT_TYPE_CATEGORY[event.type];
                const categoryLabel = EVENT_CATEGORIES.find((c) => c.key === eventCategory)?.label;
                const href = event.project_id ? `/projects/${event.project_id}` : '/events';
                return (
                  <Link key={event.id} href={href} className="table-row card-row">
                    <span className="event-dot" style={{ background: EVENT_TYPE_DOT[event.type] || 'var(--gray-1)' }} />
                    <div>
                      <div className="row-title">{event.title}</div>
                      <div className="row-sub">
                        {event.subtitle && <>{event.subtitle}{' '}</>}
                        {event.projects?.name && <>· <span className="row-project">{event.projects.name}</span>{' '}</>}
                        {categoryLabel && <span className="row-tag">· {categoryLabel}</span>}
                      </div>
                    </div>
                    <span className="row-meta">{timeOnly(event.created_at)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}

      {remaining > 0 && (
        <div className="load-more-row">
          <button type="button" className="btn btn-secondary" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
            Показать ещё ({remaining})
          </button>
        </div>
      )}
    </div>
  );
}
