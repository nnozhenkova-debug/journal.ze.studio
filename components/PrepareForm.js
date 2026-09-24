'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { minutesToHours, percent } from '../lib/format';
import { STAGE_STATE_LABEL } from '../lib/retro-constants';

export default function PrepareForm({ templates, projects, initialTemplateId, initialProjectId, profileId }) {
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [stages, setStages] = useState([]);
  const [stageId, setStageId] = useState(null);
  const [loadingStages, setLoadingStages] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const template = useMemo(() => templates.find((t) => t.id === templateId) || templates[0], [templates, templateId]);

  useEffect(() => {
    if (!projectId) {
      setStages([]);
      setStageId(null);
      return;
    }
    let cancelled = false;
    setLoadingStages(true);
    const supabase = createClient();
    supabase
      .from('project_stages')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order')
      .then(({ data }) => {
        if (cancelled) return;
        const list = data || [];
        setStages(list);
        const current = list.find((s) => s.state === 'current');
        const lastPast = [...list].reverse().find((s) => s.state === 'past');
        setStageId((current || lastPast || list[0] || {}).id || null);
        setLoadingStages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const stage = stages.find((s) => s.id === stageId) || null;
  const totalPlanned = stages.reduce((sum, s) => sum + (s.planned_minutes || 0), 0);
  const totalActual = stages.reduce((sum, s) => sum + (s.actual_minutes || 0), 0);
  const stageBudgetShare = stage && totalPlanned ? percent(stage.planned_minutes, totalPlanned) : null;

  async function handleStart() {
    if (!projectId) {
      setError('Выберите проект.');
      return;
    }
    setStarting(true);
    setError('');
    const supabase = createClient();
    const project = projects.find((p) => p.id === projectId);
    const title = stage ? `Ретро: ${stage.name}` : `Ретро «${project?.name || ''}»`;
    const today = new Date().toISOString().slice(0, 10);

    const { data, error: insertError } = await supabase
      .from('retros')
      .insert({
        project_id: projectId,
        stage_id: stageId,
        template: templateId,
        title,
        scheduled_date: today,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        stage_context: stage
          ? {
              stage_name: stage.name,
              stage_state: stage.state,
              planned_minutes: stage.planned_minutes,
              actual_minutes: stage.actual_minutes,
              budget_share_percent: stageBudgetShare,
            }
          : {},
        created_by: profileId,
      })
      .select()
      .single();

    if (insertError || !data) {
      setStarting(false);
      setError('Не удалось начать ретро. Попробуйте ещё раз.');
      return;
    }

    if (profileId) {
      await supabase.from('retro_participants').insert({ retro_id: data.id, user_id: profileId });
    }

    router.push(`/retro/${data.id}`);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24, alignItems: 'start' }}>
      <div>
        <div className="micro-label" style={{ marginBottom: 12 }}>Метод</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className="card"
              style={{
                textAlign: 'left',
                padding: 14,
                cursor: 'pointer',
                background: t.id === templateId ? 'var(--gold-bg)' : 'var(--white)',
                borderColor: t.id === templateId ? 'var(--gold-border)' : 'var(--border)',
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-2)', marginTop: 3 }}>{t.duration}</div>
            </button>
          ))}
        </div>

        <div className="micro-label" style={{ marginBottom: 12 }}>Проект и этап</div>
        <div className="field">
          <label htmlFor="project-select">Проект</label>
          <select id="project-select" value={projectId || ''} onChange={(e) => setProjectId(e.target.value)} style={{ width: '100%' }}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="stage-select">Этап</label>
          <select
            id="stage-select"
            value={stageId || ''}
            onChange={(e) => setStageId(e.target.value)}
            disabled={loadingStages || stages.length === 0}
            style={{ width: '100%' }}
          >
            {stages.length === 0 && <option value="">Этапов нет</option>}
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {STAGE_STATE_LABEL[s.state]}</option>
            ))}
          </select>
        </div>

        {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}

        <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={handleStart} disabled={starting || !projectId}>
          {starting ? 'Открываем сессию…' : 'Начать ретро →'}
        </button>
      </div>

      <div>
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div className="micro-label" style={{ marginBottom: 10 }}>Как проходит {template.name}</div>
          <p style={{ fontSize: 13, color: 'var(--gray-2)', lineHeight: 1.5, marginBottom: 4 }}>{template.short}</p>
          <p style={{ fontSize: 12, color: 'var(--gray-1)', marginBottom: 14 }}>Лучше всего подходит: {template.bestFor}</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {template.columns.map((c) => (
              <span key={c.key} className="pill pill-neutral">{c.label}</span>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 14 }}>
            {template.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--gray-1)', fontWeight: 600, minWidth: 18 }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-2)', marginTop: 2 }}>{s.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="micro-label" style={{ marginBottom: 14 }}>Контекст этапа</div>
          {!stage ? (
            <p style={{ fontSize: 13, color: 'var(--gray-2)' }}>Выберите проект с этапами, чтобы увидеть контекст.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{stage.name}</span>
                <span className="pill pill-neutral">{STAGE_STATE_LABEL[stage.state]}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--gray-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Часы на этап</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                    {minutesToHours(stage.actual_minutes)} / {minutesToHours(stage.planned_minutes)} ч
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--gray-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Доля от бюджета проекта</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                    {stageBudgetShare !== null ? `${stageBudgetShare}%` : '—'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
