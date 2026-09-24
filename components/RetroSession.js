'use client';

import { useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar';
import Pill from './Pill';
import { createClient } from '../lib/supabase/client';
import { minutesToHours } from '../lib/format';

export default function RetroSession({ retro, template, initialNotes, participants, profile }) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState(retro.status);
  const [published, setPublished] = useState(retro.published);
  const [drafts, setDrafts] = useState({});
  const [busyColumn, setBusyColumn] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [retro.id]);

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
    const supabase = createClient();
    const { data, error } = await supabase
      .from('retro_notes')
      .insert({ retro_id: retro.id, column_key: columnKey, text, author_id: profile.id })
      .select()
      .single();
    if (!error && data) {
      setNotes((prev) => (prev.some((n) => n.id === data.id) ? prev : [...prev, data]));
      setDrafts((d) => ({ ...d, [columnKey]: '' }));
    }
    setBusyColumn(null);
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

  const ctx = retro.stage_context || {};
  const isLive = status === 'in_progress';
  const isSummary = status === 'completed' && !published;
  const isPublished = status === 'completed' && published;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div className="micro-label" style={{ marginBottom: 8 }}>{template.name}</div>
          <h1 className="h1" style={{ fontSize: 30 }}>{retro.title}</h1>
          {ctx.stage_name && (
            <p className="h1-sub" style={{ marginTop: 6 }}>
              {ctx.stage_name}
              {ctx.planned_minutes != null && ` · ${minutesToHours(ctx.actual_minutes)} / ${minutesToHours(ctx.planned_minutes)} ч`}
              {ctx.budget_share_percent != null && ` · ${ctx.budget_share_percent}% бюджета проекта`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isLive && <Pill variant="important">В процессе</Pill>}
          {isSummary && <Pill variant="neutral">Итоги · не опубликовано</Pill>}
          {isPublished && <Pill variant="ok">Опубликовано</Pill>}
          <div style={{ display: 'flex', gap: -6 }}>
            {participants.map((p) => (
              <Avatar key={p.user_id} id={p.user_id} name={p.profiles?.display_name} size={28} style={{ marginLeft: -6, border: '2px solid var(--bg)' }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(template.columns.length, 4)}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {template.columns.map((col) => (
          <div key={col.key} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', minHeight: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{col.label}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-2)', marginBottom: 10 }}>{col.hint}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {(notesByColumn[col.key] || []).map((n) => (
                <div key={n.id} style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5 }}>
                  {n.text}
                  {n.profiles?.display_name && (
                    <div style={{ fontSize: 10, color: 'var(--gray-2)', marginTop: 4 }}>{n.profiles.display_name}</div>
                  )}
                </div>
              ))}
              {(notesByColumn[col.key] || []).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--gray-1)' }}>Пока пусто.</div>
              )}
            </div>
            {isLive && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <input
                  value={drafts[col.key] || ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [col.key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addNote(col.key);
                  }}
                  placeholder="Добавить карточку…"
                  style={{ flex: 1, fontSize: 12.5, padding: '7px 10px' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => addNote(col.key)}
                  disabled={busyColumn === col.key || !(drafts[col.key] || '').trim()}
                >
                  +
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {isLive && (
          <button type="button" className="btn btn-primary" onClick={finishRetro} disabled={finishing}>
            {finishing ? 'Завершаем…' : 'Завершить ретро →'}
          </button>
        )}
        {isSummary && (
          <button type="button" className="btn btn-primary" onClick={publishRetro} disabled={publishing}>
            {publishing ? 'Публикуем…' : 'Опубликовать в ленту →'}
          </button>
        )}
        {isPublished && retro.project_id && (
          <a href={`/projects/${retro.project_id}`} className="btn btn-secondary">К проекту</a>
        )}
      </div>
    </div>
  );
}
