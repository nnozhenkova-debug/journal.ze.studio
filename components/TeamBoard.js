'use client';

import { useMemo, useState } from 'react';
import Avatar from './Avatar';
import EmptyState from './EmptyState';

export default function TeamBoard({ team }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return team;
    return team.filter((m) => (m.display_name || m.email || '').toLowerCase().includes(q));
  }, [team, query]);

  return (
    <div>
      <div className="team-header">
        <div>
          <h1 className="h1">Команда<span style={{ color: 'var(--gold)' }}>.</span></h1>
          <p className="h1-sub">{team.length} участников студии</p>
        </div>
        <div className="team-actions">
          <input
            className="search-pill"
            placeholder="Поиск по имени…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="btn btn-primary btn-sm" disabled title="Приглашения появятся позже — пока доступ выдаётся вручную">
            + Пригласить
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState>Никого не нашлось по запросу «{query}».</EmptyState>
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="team-row">
              <Avatar id={m.id} name={m.display_name || m.email} size={36} />
              <div style={{ flex: 1 }}>
                <div className="row-title">{m.display_name || m.email}</div>
                <div className="row-sub">
                  {m.role || 'Участник команды'}
                  {m.is_admin && ' · Админ'}
                </div>
              </div>
              <span className="team-row-email">{m.email}</span>
              <span className={`pill ${m.status === 'active' ? 'pill-ok' : 'pill-neutral'}`}>
                {m.status === 'active' ? 'Активен' : 'Приглашён'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
