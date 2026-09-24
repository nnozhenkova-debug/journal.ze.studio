'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Avatar from './Avatar';
import ErrorCard from './ErrorCard';
import { createClient } from '../lib/supabase/client';
import {
  startedAtLabel,
  fullDateLabel,
  durationLabel,
  splitTitleGold,
  shortName,
} from '../lib/format';
import { RETRO_COLUMN_COLORS, ENERGY_LEVELS } from '../lib/retro-constants';

function QuadrantIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'wind') {
    return (
      <svg {...common}>
        <path d="M3 8h11a3 3 0 1 0-3-3" />
        <path d="M3 16h15a3 3 0 1 1-3 3" />
      </svg>
    );
  }
  if (name === 'sun') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    );
  }
  if (name === 'anchor') {
    return (
      <svg {...common}>
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v14M7 13H3a9 9 0 0 0 9 8 9 9 0 0 0 9-8h-4M5 12h4" />
      </svg>
    );
  }
  if (name === 'reef') {
    return (
      <svg {...common}>
        <path d="M12 3 2 20h20L12 3z" />
        <path d="M12 10v4M12 17h.01" />
      </svg>
    );
  }
  return null;
}

function NoteColumnBody({ col, notes, drafts, setDrafts, busyColumn, errorColumn, addNote }) {
  return (
    <>
      {notes.map((n) => (
        <div key={n.id} className="retro-note-card">
          <div className="retro-note-text">{n.text}</div>
          <div className="retro-note-meta">
            <Avatar id={n.author_id} name={n.profiles?.display_name} url={n.profiles?.avatar_url} size={20} style={{ fontSize: 8 }} />
            <span className="retro-note-author">{shortName(n.profiles?.display_name) || 'Участник'}</span>
          </div>
        </div>
      ))}
      <div className="retro-compose">
        <textarea
          rows={2}
          value={drafts[col.key] || ''}
          onChange={(e) => setDrafts((d) => ({ ...d, [col.key]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addNote(col.key);
            }
          }}
          placeholder={col.placeholder || col.hint}
          disabled={busyColumn === col.key}
        />
        <div className="retro-compose-hint">+ Добавить заметку</div>
      </div>
      {errorColumn === col.key && (
        <ErrorCard
          title="Не удалось сохранить карточку"
          hint="Проверьте соединение и повторите"
          onRetry={() => addNote(col.key)}
          retrying={busyColumn === col.key}
        />
      )}
    </>
  );
}

export default function RetroSession({ retro, template, initialNotes, initialActionItems, initialEnergy, participants, profile }) {
  const boardType = template.boardType || 'columns';
  const [notes, setNotes] = useState(initialNotes);
  const [actionItems, setActionItems] = useState(initialActionItems || []);
  const [energy, setEnergy] = useState(initialEnergy || []);
  const [status, setStatus] = useState(retro.status);
  const [published, setPublished] = useState(retro.published);
  const [drafts, setDrafts] = useState({});
  const [busyColumn, setBusyColumn] = useState(null);
  const [errorColumn, setErrorColumn] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const [stepText, setStepText] = useState('');
  const [stepAssignee, setStepAssignee] = useState(profile?.id || '');
  const [stepDue, setStepDue] = useState('');
  const [addingStep, setAddingStep] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`retro-${retro.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'retro_notes', filter: `retro_id=eq.${retro.id}` }, (payload) => {
        setNotes((prev) => (prev.some((n) => n.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'retros', filter: `id=eq.${retro.id}` }, (payload) => {
        setStatus(payload.new.status);
        setPublished(payload.new.published);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retro_energy', filter: `retro_id=eq.${retro.id}` }, (payload) => {
        const row = payload.new;
        if (!row) return;
        setEnergy((prev) => [...prev.filter((e) => e.user_id !== row.user_id), row]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [retro.id]);

  useEffect(() => {
    const isLive = status === 'in_progress';
    if (!isLive) return undefined;
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, [status]);

  const notesByColumn = useMemo(() => {
    const map = {};
    for (const col of template.columns) map[col.key] = [];
    for (const n of notes) {
      if (map[n.column_key]) map[n.column_key].push(n);
    }
    return map;
  }, [notes, template]);

  async function addNote(columnKey) {
    const text = (drafts[columnKey] || '').trim();
    if (!text || !profile) return;
    setBusyColumn(columnKey);
    setErrorColumn(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('retro_notes')
      .insert({ retro_id: retro.id, column_key: columnKey, text, author_id: profile.id })
      .select('*, profiles(id,display_name,avatar_url)')
      .single();
    if (!error && data) {
      setNotes((prev) => (prev.some((n) => n.id === data.id) ? prev : [...prev, data]));
      setDrafts((d) => ({ ...d, [columnKey]: '' }));
    } else if (error) {
      setErrorColumn(columnKey);
    }
    setBusyColumn(null);
  }

  const energyByUser = useMemo(() => {
    const map = {};
    for (const e of energy) map[e.user_id] = e.level;
    return map;
  }, [energy]);

  async function setEnergyLevel(level) {
    if (!profile) return;
    setEnergy((prev) => [...prev.filter((e) => e.user_id !== profile.id), { retro_id: retro.id, user_id: profile.id, level }]);
    const supabase = createClient();
    await supabase.from('retro_energy').upsert({ retro_id: retro.id, user_id: profile.id, level, updated_at: new Date().toISOString() });
  }

  async function addActionItem() {
    const text = stepText.trim();
    if (!text) return;
    setAddingStep(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('retro_action_items')
      .insert({
        retro_id: retro.id,
        text,
        assignee_id: stepAssignee || null,
        due_date: stepDue || null,
        sort_order: actionItems.length,
      })
      .select('*, profiles(id,display_name,avatar_url)')
      .single();
    setAddingStep(false);
    if (!error && data) {
      setActionItems((prev) => [...prev, data]);
      setStepText('');
      setStepDue('');
    }
  }

  async function removeActionItem(id) {
    setActionItems((prev) => prev.filter((a) => a.id !== id));
    const supabase = createClient();
    await supabase.from('retro_action_items').delete().eq('id', id);
  }

  function copyInviteLink() {
    if (typeof window === 'undefined') return;
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  }

  async function finishRetro() {
    setFinishing(true);
    const supabase = createClient();
    const startedAt = retro.started_at ? new Date(retro.started_at) : new Date();
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));
    const { error } = await supabase
      .from('retros')
      .update({ status: 'completed', completed_at: new Date().toISOString(), duration_seconds: durationSeconds })
      .eq('id', retro.id);
    setFinishing(false);
    if (!error) setStatus('completed');
  }

  async function publishRetro() {
    setPublishing(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('retros')
      .update({ published: true, published_at: new Date().toISOString() })
      .eq('id', retro.id);

    if (!error) {
      const participantNames = participants.map((p) => p.profiles?.display_name).filter(Boolean);
      await supabase.from('events').insert({
        project_id: retro.project_id,
        type: 'retro_completed',
        title: `Завершено ретро «${retro.title}»`,
        subtitle: participantNames.length ? `Участники: ${participantNames.join(', ')}` : null,
      });
      setPublished(true);
    }
    setPublishing(false);
  }

  const isLive = status === 'in_progress';
  const isSummary = status === 'completed' && !published;
  const isPublished = status === 'completed' && published;

  const shortTitle = retro.title.replace(/^Ретро:\s*/, '').replace(/^Ретро\s*«([^»]+)»$/, '$1');
  const { rest, last } = splitTitleGold(shortTitle);
  const projectName = retro.projects?.name || '';
  const crumbTitle = projectName ? `${shortTitle} · ${projectName}` : shortTitle;

  return (
    <div>
      <div className="breadcrumb" style={{ margin: '0 calc(var(--space-12) * -1)', padding: '0 var(--space-12)' }}>
        <div className="retro-topbar" style={{ width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/">Журнал студии</Link>
            <span className="crumb-sep">→</span>
            {isLive ? (
              <span>{crumbTitle}</span>
            ) : (
              <Link href={retro.project_id ? `/projects/${retro.project_id}` : '/'}>{crumbTitle}</Link>
            )}
            {!isLive && (
              <>
                <span className="crumb-sep">→</span>
                <span>Итоги</span>
              </>
            )}
          </span>
          {isLive && (
            <div className="retro-rec">
              <span className="retro-rec-time">{now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="retro-rec-badge">
                <span className="retro-rec-dot" />
                Идёт запись
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginTop: 28, marginBottom: isLive ? 0 : 0 }}>
        <div>
          <div className="micro-label">{isLive ? 'Ретро-сессия' : 'Итоги ретро'}</div>
          <h1 className="h1" style={{ marginTop: 14 }}>
            {rest}
            <span style={{ color: 'var(--gold)' }}>{last}.</span>
          </h1>
          <p className="h1-sub" style={{ marginTop: 10 }}>
            {projectName && `${projectName} · `}
            {template.name}
            {isLive && ` · начато ${startedAtLabel(retro.started_at || retro.created_at)}`}
            {!isLive && ` · ${fullDateLabel(retro.completed_at || retro.scheduled_date)}`}
          </p>
        </div>

        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="micro-label">Участники</div>
            <div className="retro-participants">
              {participants.map((p, i) => (
                <Avatar key={p.user_id} id={p.user_id} name={p.profiles?.display_name} url={p.profiles?.avatar_url} size={32} style={{ marginLeft: i === 0 ? 0 : -10, border: '2px solid var(--bg)' }} />
              ))}
              <button
                type="button"
                className="retro-invite-avatar"
                style={{ marginLeft: participants.length ? -10 : 0 }}
                onClick={copyInviteLink}
                title={inviteCopied ? 'Ссылка скопирована' : 'Скопировать ссылку-приглашение'}
              >
                +
              </button>
            </div>
          </div>
        )}

        {isSummary && (
          <button type="button" className="btn btn-primary" onClick={publishRetro} disabled={publishing}>
            {publishing ? 'Публикуем…' : 'Опубликовать итоги →'}
          </button>
        )}
        {isPublished && (
          <span className="published-badge">
            <span className="dot" />
            Итоги опубликованы
          </span>
        )}
      </div>

      {isLive && participants.length === 0 && (
        <div className="empty-card" style={{ maxWidth: 330, marginTop: 24 }}>
          <span className="empty-card-icon">+</span>
          <p className="empty-card-text">Пригласите участников, чтобы начать ретро</p>
          <button type="button" className="empty-card-link" onClick={copyInviteLink}>
            {inviteCopied ? 'Ссылка скопирована' : 'Скопировать ссылку-приглашение'}
          </button>
        </div>
      )}

      {isLive ? (
        <>
          {boardType === 'quadrant' ? (
            <div className="retro-quadrant-grid">
              {template.columns.map((col) => (
                <div key={col.key} className="retro-quadrant-cell">
                  <div className="retro-quadrant-head">
                    <QuadrantIcon name={col.icon} />
                    <span>{col.label}</span>
                  </div>
                  <NoteColumnBody
                    col={col}
                    notes={notesByColumn[col.key] || []}
                    drafts={drafts}
                    setDrafts={setDrafts}
                    busyColumn={busyColumn}
                    errorColumn={errorColumn}
                    addNote={addNote}
                  />
                </div>
              ))}
            </div>
          ) : boardType === 'energy' ? (
            <>
              <div className="energy-board">
                <div className="micro-label">Уровень энергии участников</div>
                <div className="energy-participants">
                  {participants.map((p) => (
                    <div key={p.user_id} className="energy-participant">
                      <Avatar id={p.user_id} name={p.profiles?.display_name} url={p.profiles?.avatar_url} size={40} style={{ fontSize: 12 }} />
                      <span className="energy-participant-name">{(p.profiles?.display_name || '').split(' ')[0]}</span>
                      <div className="energy-levels">
                        {ENERGY_LEVELS.map((lvl) => (
                          <button
                            key={lvl.key}
                            type="button"
                            className="energy-level-btn"
                            disabled={p.user_id !== profile?.id}
                            onClick={() => setEnergyLevel(lvl.key)}
                          >
                            <span className={`energy-level-dot${energyByUser[p.user_id] === lvl.key ? ' is-selected' : ''}`} />
                            <span className="energy-level-label">{lvl.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="energy-summary-hint">Сводка появится, когда все участники отметят свой уровень.</p>
              </div>

              {template.columns.map((col) => (
                <div key={col.key} className="retro-col" style={{ marginTop: 32 }}>
                  <div className="retro-col-head">{col.label}</div>
                  <NoteColumnBody
                    col={col}
                    notes={notesByColumn[col.key] || []}
                    drafts={drafts}
                    setDrafts={setDrafts}
                    busyColumn={busyColumn}
                    errorColumn={errorColumn}
                    addNote={addNote}
                  />
                </div>
              ))}
            </>
          ) : (
            <div className="retro-board" style={{ gridTemplateColumns: `repeat(${Math.min(template.columns.length, 4)}, 1fr)` }}>
              {template.columns.map((col) => (
                <div key={col.key} className="retro-col">
                  <div className="retro-col-head">
                    {col.label}
                    {col.subtitle && <span className="retro-col-subtitle">{col.subtitle}</span>}
                  </div>
                  <NoteColumnBody
                    col={col}
                    notes={notesByColumn[col.key] || []}
                    drafts={drafts}
                    setDrafts={setDrafts}
                    busyColumn={busyColumn}
                    errorColumn={errorColumn}
                    addNote={addNote}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="retro-footer">
            <span className="retro-footer-meta">
              {notes.length} {notes.length === 1 ? 'заметка' : 'заметок'} · {participants.length} {participants.length === 1 ? 'участник' : 'участника'}
            </span>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link href={retro.project_id ? `/projects/${retro.project_id}` : '/'} className="btn btn-secondary">
                Сохранить и выйти
              </Link>
              <button type="button" className="btn btn-primary" onClick={finishRetro} disabled={finishing}>
                {finishing ? 'Завершаем…' : 'Завершить ретро →'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-cell">
              <div className="micro-label">Длительность</div>
              <div className="stat-value-row"><span className="stat-value">{durationLabel(retro.duration_seconds)}</span></div>
            </div>
            <div className="stat-cell">
              <div className="micro-label">Участники</div>
              <div className="stat-value-row"><span className="stat-value">{participants.length} чел.</span></div>
            </div>
            <div className="stat-cell">
              <div className="micro-label">Заметок</div>
              <div className="stat-value-row"><span className="stat-value">{notes.length}</span></div>
            </div>
            <div className="stat-cell">
              <div className="micro-label">Следующих шагов</div>
              <div className="stat-value-row"><span className="stat-value">{actionItems.length}</span></div>
            </div>
          </div>

          <div className="retro-summary-grid">
            <div>
              <div className="micro-label">Заметки сессии</div>
              <div style={{ marginTop: 20 }}>
                {template.columns.map((col, ci) => {
                  const items = notesByColumn[col.key] || [];
                  if (items.length === 0) return null;
                  return (
                    <div key={col.key} className="retro-summary-note-group">
                      <div className="retro-summary-note-head">
                        <span className="retro-summary-note-bar" style={{ background: RETRO_COLUMN_COLORS[ci % RETRO_COLUMN_COLORS.length] }} />
                        <span className="micro-label" style={{ letterSpacing: '1.1px' }}>{col.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--gray-1)' }}>
                          {items.length} {items.length === 1 ? 'заметка' : 'заметки'}
                        </span>
                      </div>
                      {items.map((n) => (
                        <div key={n.id} className="retro-summary-note-row">
                          <span className="retro-note-text">{n.text}</span>
                          <span className="retro-note-meta">
                            <Avatar id={n.author_id} name={n.profiles?.display_name} url={n.profiles?.avatar_url} size={22} style={{ fontSize: 8 }} />
                            <span className="retro-note-author">{shortName(n.profiles?.display_name) || 'Участник'}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="micro-label">Следующие шаги</div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {actionItems.map((item) => (
                  <div key={item.id} className="action-item-card">
                    <div>
                      <div className="action-item-title">{item.text}</div>
                      <div className="action-item-tags">
                        {item.profiles?.display_name && (
                          <span className="action-item-assignee">{shortName(item.profiles.display_name) || item.profiles.display_name}</span>
                        )}
                        {item.due_date && (
                          <span className="action-item-due">до {new Date(item.due_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                        )}
                      </div>
                    </div>
                    <button type="button" className="action-item-remove" onClick={() => removeActionItem(item.id)} title="Удалить">×</button>
                  </div>
                ))}

                <div className="action-compose">
                  <textarea
                    rows={2}
                    value={stepText}
                    onChange={(e) => setStepText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addActionItem();
                      }
                    }}
                    placeholder="Добавить следующий шаг…"
                    disabled={addingStep}
                  />
                  <div className="action-compose-row">
                    <select value={stepAssignee} onChange={(e) => setStepAssignee(e.target.value)}>
                      <option value="">Без исполнителя</option>
                      {participants.map((p) => (
                        <option key={p.user_id} value={p.user_id}>
                          {(p.profiles?.display_name || '').split(' ').map((w) => w[0]).join('')} — {p.profiles?.display_name?.split(' ')[0]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={stepDue}
                      onChange={(e) => setStepDue(e.target.value)}
                      placeholder="Срок"
                    />
                  </div>
                </div>
              </div>

              <div className="side-card" style={{ marginTop: 24 }}>
                <div className="side-card-head">
                  <span className="micro-label">Участники</span>
                </div>
                <div style={{ padding: '14px 18px' }}>
                  {participants.map((p) => (
                    <div key={p.user_id} className="participant-row">
                      <Avatar id={p.user_id} name={p.profiles?.display_name} url={p.profiles?.avatar_url} size={26} style={{ fontSize: 9 }} />
                      <span className="participant-row-name">{p.profiles?.display_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
