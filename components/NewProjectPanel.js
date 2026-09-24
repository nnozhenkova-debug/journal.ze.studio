'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { pluralRu } from '../lib/format';

const COLOR_OPTIONS = [
  { key: 'amber', label: 'Янтарный' },
  { key: 'violet', label: 'Фиолетовый' },
  { key: 'slate', label: 'Серый' },
  { key: 'teal', label: 'Бирюзовый' },
  { key: 'rose', label: 'Розовый' },
];

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

function slugify(name) {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

let stageKeySeq = 0;
function emptyStage() {
  stageKeySeq += 1;
  return { key: `s${stageKeySeq}`, name: '', startDate: '', endDate: '', plannedHours: '', retroDate: '' };
}

export default function NewProjectPanel({ isAdmin, profileId, projectCount }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [shortcode, setShortcode] = useState('');
  const [client, setClient] = useState('');
  const [colorKey, setColorKey] = useState('slate');
  const [stages, setStages] = useState([emptyStage()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  function handleNameChange(v) {
    setName(v);
    if (!idTouched) setProjectId(slugify(v));
  }

  function updateStage(key, patch) {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function addStage() {
    setStages((prev) => [...prev, emptyStage()]);
  }
  function removeStage(key) {
    setStages((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    const id = projectId.trim();
    if (!name.trim()) {
      setError('Введите название проекта.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      setError('Идентификатор — латиница в нижнем регистре, цифры и дефис.');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error: projectError } = await supabase.from('projects').insert({
      id,
      name: name.trim(),
      shortcode: shortcode.trim() || null,
      client: client.trim() || null,
      color_key: colorKey,
    });
    if (projectError) {
      setSaving(false);
      setError(
        projectError.code === '23505'
          ? 'Проект с таким идентификатором уже существует — измените id.'
          : 'Не удалось создать проект. Попробуйте ещё раз.'
      );
      return;
    }

    const validStages = stages.filter((s) => s.name.trim());
    for (let i = 0; i < validStages.length; i += 1) {
      const s = validStages[i];
      const { data: stageRow } = await supabase
        .from('project_stages')
        .insert({
          project_id: id,
          name: s.name.trim(),
          start_date: s.startDate || null,
          end_date: s.endDate || null,
          state: 'upcoming',
          planned_minutes: s.plannedHours ? Math.round(Number(s.plannedHours) * 60) : 0,
          sort_order: i,
        })
        .select()
        .single();
      if (stageRow && s.retroDate) {
        await supabase.from('retros').insert({
          project_id: id,
          stage_id: stageRow.id,
          template: 'start_stop_continue',
          title: `Ретро: ${s.name.trim()}`,
          scheduled_date: s.retroDate,
          status: 'scheduled',
          stage_context: { stage_name: s.name.trim(), stage_state: 'upcoming' },
          created_by: profileId,
        });
      }
    }

    router.push(`/projects/${id}`);
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="h1">Проекты<span style={{ color: 'var(--gold)' }}>.</span></h1>
          <p className="h1-sub">{projectCount} {pluralRu(projectCount, 'активный проект', 'активных проекта', 'активных проектов')}</p>
        </div>
        <div className="page-actions">
          {isAdmin ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
              {open ? 'Отмена' : '+ Новый проект'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" disabled title="Создавать проекты может только админ студии">
              + Новый проект
            </button>
          )}
        </div>
      </div>

      {isAdmin && open && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 16, padding: 20 }}>
          <div className="field-grid">
            <div className="field-box">
              <label>Название</label>
              <input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Например, Аврора" required />
            </div>
            <div className="field-box">
              <label>Идентификатор (id)</label>
              <input
                value={projectId}
                onChange={(e) => { setIdTouched(true); setProjectId(e.target.value.toLowerCase()); }}
                placeholder="avrora"
                required
              />
            </div>
            <div className="field-box">
              <label>Шорткод</label>
              <input value={shortcode} onChange={(e) => setShortcode(e.target.value.toUpperCase())} placeholder="АВР" maxLength={6} />
            </div>
            <div className="field-box">
              <label>Клиент</label>
              <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Внешний клиент" />
            </div>
            <div className="field-box">
              <label>Цвет</label>
              <select value={colorKey} onChange={(e) => setColorKey(e.target.value)}>
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="micro-label" style={{ marginBottom: 12 }}>Этапы проекта</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stages.map((s, i) => (
                <div key={s.key} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, background: '#faf8f4' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 180px' }}>
                      <label className="micro-label" style={{ display: 'block', marginBottom: 4 }}>Название этапа</label>
                      <input value={s.name} onChange={(e) => updateStage(s.key, { name: e.target.value })} placeholder={`Этап ${i + 1}`} />
                    </div>
                    <div>
                      <label className="micro-label" style={{ display: 'block', marginBottom: 4 }}>Начало</label>
                      <input type="date" value={s.startDate} onChange={(e) => updateStage(s.key, { startDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="micro-label" style={{ display: 'block', marginBottom: 4 }}>Конец</label>
                      <input type="date" value={s.endDate} onChange={(e) => updateStage(s.key, { endDate: e.target.value })} />
                    </div>
                    <div style={{ width: 90 }}>
                      <label className="micro-label" style={{ display: 'block', marginBottom: 4 }}>Часы план</label>
                      <input type="number" min="0" value={s.plannedHours} onChange={(e) => updateStage(s.key, { plannedHours: e.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <label className="micro-label" style={{ display: 'block', marginBottom: 4 }}>Дата ретро</label>
                      <input type="date" value={s.retroDate} onChange={(e) => updateStage(s.key, { retroDate: e.target.value })} />
                    </div>
                    <button
                      type="button"
                      className="action-item-remove"
                      style={{ marginBottom: 9 }}
                      onClick={() => removeStage(s.key)}
                      title="Удалить этап"
                      disabled={stages.length === 1}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={addStage}>
              + Добавить этап
            </button>
          </div>

          {error && <div className="err" style={{ marginTop: 16 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Создаём…' : 'Создать проект →'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
