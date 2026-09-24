'use client';

import { useMemo, useState } from 'react';
import Avatar from './Avatar';
import EmptyState from './EmptyState';

export default function TeamBoard({ team, isAdmin }) {
  const [query, setQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSent, setInviteSent] = useState('');

  async function sendInvite(e) {
    e.preventDefault();
    setInviteError('');
    setInviteSent('');
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Введите корректный email.');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(body.error || 'Не удалось отправить приглашение.');
        return;
      }
      setInviteSent(email);
      setInviteEmail('');
    } catch {
      setInviteError('Не удалось отправить приглашение. Проверьте соединение.');
    } finally {
      setInviting(false);
    }
  }

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
          {isAdmin ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviteOpen((v) => !v)}>
              + Пригласить
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" disabled title="Приглашать может только админ студии">
              + Пригласить
            </button>
          )}
        </div>
      </div>

      {isAdmin && inviteOpen && (
        <form onSubmit={sendInvite} className="card" style={{ marginTop: 16, padding: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="email"
            required
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{ flex: '1 1 240px' }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={inviting}>
            {inviting ? 'Отправляем…' : 'Отправить приглашение'}
          </button>
          {inviteError && <span className="err" style={{ flexBasis: '100%' }}>{inviteError}</span>}
          {inviteSent && (
            <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--ok-fg)' }}>
              Приглашение отправлено на {inviteSent}.
            </span>
          )}
        </form>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState>Никого не нашлось по запросу «{query}».</EmptyState>
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="team-row">
              <Avatar id={m.id} name={m.display_name || m.email} url={m.avatar_url} size={36} />
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
