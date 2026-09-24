'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { minutesToHours, percent } from '../lib/format';
import { STAGE_STATE_LABEL } from '../lib/retro-constants';

export default function PrepareForm({ templates, projects, initialTemplateId, initialProjectId, profileId }) {
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || null);
  const [stages, setStages] = useState([]);
  const [stageId, setStageId] = useState(null);
  const [comment, setComment] = useState('');
  const [loadingStages, setLoadingStages] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const router = useRouter();

  const template = useMemo(() => templates.find((t) => t.id === templateId) || templates[0], [templates, templateId]);
  const project = projects.find((p) => p.id === projectId) || null;

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
  const stageBudgetShare = stage && totalPlanned ? percent(stage.planned_minutes, totalPlanned) : null;
  const hoursShare = stage && stage.planned_minutes ? Math.min(100, percent(stage.actual_minutes, stage.planned_minutes)) : 0;

  const crumbLabel = stage?.name || project?.name || '';

  async function handleStart() {
    if (!projectId) {
      setError('Выберите проект.');
      return;
    }
    setStarting(true);
    setError('');
    const supabase = createClient();
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
              comment: comment.trim() || null,
            }
          : { comment: comment.trim() || null },
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
    <div>
      <div className="breadcrumb" style={{ margin: '0 calc(var(--space-12) * -1)', padding: '0 var(--space-12)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/">Журнал студии</Link>
          {crumbLabel && (
            <>
              <span className="crumb-sep">→</span>
              <span>{crumbLabel}</span>
            </>
          )}
          <span className="crumb-sep">→</span>
          <span>{template.name}</span>
        </span>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="micro-label">Подготовка к ретро</div>
        <h1 className="h1" style={{ marginTop: 14 }}>
          Перед началом<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p className="h1-sub" style={{ marginTop: 10 }}>
          {[crumbLabel, project?.name && crumbLabel !== project.name ? project.name : null].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="prepare-grid">
        <div className="prepare-card">
          <div className="prepare-card-head">
            <div className="prepare-card-head-row">
              <span className="prepare-card-title">{template.name}</span>
              <button type="button" className="prepare-change-template" onClick={() => setPickerOpen((v) => !v)}>
                Сменить шаблон ↺
              </button>
            </div>
            {!pickerOpen && <p className="prepare-card-desc">{template.short}</p>}
          </div>

          {pickerOpen ? (
            <div className="prepare-card-body">
              <div className="micro-label">Метод</div>
              <div className="template-picker">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`template-picker-item${t.id === templateId ? ' is-selected' : ''}`}
                    onClick={() => {
                      setTemplateId(t.id);
                      setPickerOpen(false);
                    }}
                  >
                    <div className="template-picker-item-name">{t.name}</div>
                    <div className="template-picker-item-duration">{t.duration}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="prepare-card-body">
              <div className="micro-label">Как проводить</div>
              <div className="prepare-steps">
                {template.steps.map((s, i) => (
                  <div key={i} className="prepare-step">
                    <span className="prepare-step-num">{i + 1}.</span>
                    <div>
                      <span className="prepare-step-title">{s.title.replace(/\s*\(\d+\s*мин\)\s*$/, '')} </span>
                      <span className="prepare-step-text">{s.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="prepare-side">
          <div className="micro-label">Контекст перед ретро</div>

          {!initialProjectId && (
            <div className="context-card">
              <div className="context-card-label">Проект</div>
              <select className="context-dropdown" value={projectId || ''} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="context-card">
            <div className="context-card-label">Этап</div>
            <select
              className="context-dropdown"
              value={stageId || ''}
              onChange={(e) => setStageId(e.target.value)}
              disabled={loadingStages || stages.length === 0}
            >
              {stages.length === 0 && <option value="">Этапов нет</option>}
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {STAGE_STATE_LABEL[s.state]}</option>
              ))}
            </select>
          </div>

          {stage && (
            <>
              <div className="context-card">
                <div className="context-card-label">Часы на этапе</div>
                <div>
                  <span className="context-stat-value">{minutesToHours(stage.actual_minutes)} ч</span>
                  <span className="context-stat-unit">из {minutesToHours(stage.planned_minutes)} ч по плану</span>
                </div>
                <div className="stat-bar" style={{ marginTop: 10 }}>
                  <div className="stat-bar-fill" style={{ width: `${hoursShare}%` }} />
                </div>
              </div>

              <div className="context-card">
                <div className="context-card-label">% от бюджета проекта</div>
                <div>
                  <span className="context-stat-value">{stageBudgetShare !== null ? `${stageBudgetShare}%` : '—'}</span>
                </div>
                <div className="stat-bar" style={{ marginTop: 10 }}>
                  <div className="stat-bar-fill" style={{ width: `${stageBudgetShare || 0}%` }} />
                </div>
              </div>
            </>
          )}

          <div className="context-card">
            <div className="context-card-label">Комментарий к этапу</div>
            <textarea
              className="context-textarea"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Коротко, что стоит держать в голове на этом ретро…"
            />
          </div>

          {error && <div className="err" style={{ marginTop: 4 }}>{error}</div>}
        </div>
      </div>

      <div className="prepare-footer">
        <Link href={projectId ? `/projects/${projectId}` : '/'} className="btn btn-secondary">
          ← Назад к выбору шаблона
        </Link>
        <button type="button" className="btn btn-primary" onClick={handleStart} disabled={starting || !projectId}>
          {starting ? 'Открываем сессию…' : 'Начать ретро →'}
        </button>
      </div>
    </div>
  );
}
