'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SEVERITY_GROUPS } from '../lib/retro-constants';
import { daysAgoLabel } from '../lib/format';

const PAGE_SIZE = 10;

export default function IssuesBoard({ issues, projects }) {
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState(null);
  const [severities, setSeverities] = useState(new Set());
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [sort, setSort] = useState('urgent'); // 'urgent' | 'new'
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  function toggleSeverity(key) {
    setSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (projectId && issue.project_id !== projectId) return false;
      if (severities.size > 0 && !severities.has(issue.severity)) return false;
      if (unassignedOnly && issue.responsible_id) return false;
      if (q) {
        const haystack = `${issue.title} ${issue.projects?.name || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [issues, projectId, severities, unassignedOnly, query]);

  const grouped = useMemo(() => {
    const bySeverity = new Map(SEVERITY_GROUPS.map((g) => [g.key, []]));
    for (const issue of filtered) {
      if (!bySeverity.has(issue.severity)) bySeverity.set(issue.severity, []);
      bySeverity.get(issue.severity).push(issue);
    }
    for (const list of bySeverity.values()) {
      list.sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return sort === 'urgent' ? ta - tb : tb - ta;
      });
    }
    return SEVERITY_GROUPS.map((g) => ({ group: g, items: bySeverity.get(g.key) || [] })).filter((g) => g.items.length > 0);
  }, [filtered, sort]);

  const ordered = useMemo(() => grouped.flatMap((g) => g.items.map((issue) => ({ issue, groupKey: g.group.key }))), [grouped]);
  const visible = ordered.slice(0, visibleCount);
  const visibleKeys = new Set(visible.map((v) => v.issue.id));
  const remaining = ordered.length - visible.length;

  return (
    <div>
      <div className="filter-bar">
        <button
          type="button"
          className={`filter-chip${projectId === null ? ' is-active' : ''}`}
          onClick={() => setProjectId(null)}
        >
          Все проекты
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`filter-chip${projectId === p.id ? ' is-active' : ''}`}
            onClick={() => setProjectId(projectId === p.id ? null : p.id)}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          className={`filter-chip${severities.has('critical') ? ' is-active' : ''}`}
          onClick={() => toggleSeverity('critical')}
        >
          Критично
        </button>
        <button
          type="button"
          className={`filter-chip${severities.has('important') ? ' is-active' : ''}`}
          onClick={() => toggleSeverity('important')}
        >
          Важно
        </button>
        <button
          type="button"
          className={`filter-chip${unassignedOnly ? ' is-active' : ''}`}
          onClick={() => setUnassignedOnly((v) => !v)}
        >
          Без ответственного
        </button>
        <div className="filter-spacer" />
        <div className="search-input-wrap">
          <span className="search-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" /><line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </span>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="Поиск по проблемам…"
          />
        </div>
        <div className="sort-toggle">
          <button type="button" className={sort === 'urgent' ? 'is-active' : ''} onClick={() => setSort('urgent')}>Сначала срочные</button>
          <button type="button" className={sort === 'new' ? 'is-active' : ''} onClick={() => setSort('new')}>Сначала новые</button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="empty-card" style={{ marginTop: 28 }}>Ничего не нашлось под текущие фильтры.</div>
      ) : (
        grouped.map(({ group, items }) => {
          const itemsVisible = items.filter((i) => visibleKeys.has(i.id));
          if (itemsVisible.length === 0) return null;
          return (
            <div key={group.key} className="issue-group">
              <div className="issue-group-head">
                <span className="issue-group-bar" style={{ background: group.bar }} />
                <span className="micro-label">{group.label}</span>
                <span className="issue-group-count">{items.length}</span>
              </div>
              <div className="card">
                {itemsVisible.map((issue) => (
                  <Link
                    key={issue.id}
                    href={issue.project_id ? `/projects/${issue.project_id}` : '/issues'}
                    className="table-row card-row"
                  >
                    <span className={`pill pill-${group.key === 'critical' ? 'critical' : group.key === 'important' ? 'important' : 'watch'}`}>
                      {group.label}
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
            </div>
          );
        })
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
