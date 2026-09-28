'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const money = (n) =>
  n == null ? '—' : `${new Intl.NumberFormat('ru-RU').format(Math.round(n))} ₽`;

const OVERRUN_LABEL = {
  stage: (o) => `Этап «${o.stageName}»`,
  task: (o) => `«${o.taskName}» (этап «${o.stageName}»)`,
};

export default function EstimateSync({ projectId, syncedAt }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({}); // estimateRoman -> projectStageId ('' = пропустить)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);
  const router = useRouter();

  function reset() {
    setFile(null);
    setPreview(null);
    setMapping({});
    setError('');
    setResult(null);
  }

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`/api/projects/${projectId}/estimate-preview`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось разобрать файл.');
      setPreview(data);
      const initialMapping = {};
      for (const m of data.stageMatches) initialMapping[m.estimateRoman] = m.suggestedStageId || '';
      setMapping(initialMapping);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append(
        'stageMapping',
        JSON.stringify(Object.entries(mapping).map(([estimateRoman, projectStageId]) => ({ estimateRoman, projectStageId: projectStageId || null })))
      );
      const res = await fetch(`/api/projects/${projectId}/estimate-commit`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось применить синхронизацию.');
      setResult(data);
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="side-card">
        <div className="side-card-head">
          <span className="micro-label">Смета</span>
          <button type="button" className="prepare-change-template" onClick={() => setOpen(true)}>
            Обновить из сметы
          </button>
        </div>
        <div style={{ padding: '14px 22px', fontSize: 13, color: 'var(--gray-1)' }}>
          {syncedAt
            ? `Последняя синхронизация: ${new Date(syncedAt).toLocaleString('ru-RU')}`
            : 'Ещё не синхронизировано с таблицей сметы.'}
        </div>
      </div>
    );
  }

  return (
    <div className="side-card">
      <div className="side-card-head">
        <span className="micro-label">Обновление из сметы</span>
        <button
          type="button"
          className="prepare-change-template"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          Закрыть
        </button>
      </div>

      <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!preview && !result && (
          <>
            <p style={{ fontSize: 13, color: 'var(--gray-1)', margin: 0 }}>
              Загрузите CSV-экспорт сметы этого проекта (Файл → Скачать → «Значения, разделённые запятыми») —
              покажу, что изменится, прежде чем что-то сохранять.
            </p>
            <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={handleFile} disabled={loading} />
          </>
        )}

        {loading && <div style={{ fontSize: 13, color: 'var(--gray-1)' }}>Обрабатываю…</div>}
        {error && <div className="err">{error}</div>}

        {preview && !loading && (
          <>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{preview.projectName}</div>
              <div>План: {money(preview.project?.plannedCost)} · Факт: {money(preview.project?.actualCost)}</div>
              {preview.marginPercent != null && <div>Маржинальность: {preview.marginPercent}%</div>}
            </div>

            {preview.warnings?.length > 0 && (
              <div className="err" style={{ background: 'var(--warn-bg)', color: 'var(--warn-fg)' }}>
                {preview.warnings.join(' ')}
              </div>
            )}

            <div>
              <div className="micro-label" style={{ marginBottom: 6 }}>
                Сопоставление этапов
              </div>
              {preview.stageMatches.map((m) => (
                <div key={m.estimateRoman} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ minWidth: 170 }}>
                    {m.estimateRoman}. {m.estimateName} <span style={{ color: 'var(--gray-1)' }}>({m.actualHours}ч факт / {m.plannedHours}ч план)</span>
                  </span>
                  <select
                    className="context-dropdown"
                    value={mapping[m.estimateRoman] || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [m.estimateRoman]: e.target.value }))}
                  >
                    <option value="">Не сопоставлять</option>
                    {preview.projectStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {preview.overruns?.length > 0 && (
              <div>
                <div className="micro-label" style={{ marginBottom: 6, color: 'var(--crit-fg)' }}>
                  Будет создано/обновлено проблем: {preview.overruns.length}
                </div>
                {preview.overruns.map((o, i) => (
                  <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                    {OVERRUN_LABEL[o.level](o)} — факт {o.actualHours}ч вместо плана {o.plannedHours}ч (+{o.overHours}ч)
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={reset} disabled={loading}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleApply} disabled={loading}>
                Подтвердить и применить
              </button>
            </div>
          </>
        )}

        {result && (
          <div style={{ fontSize: 13 }}>
            Готово: этапов обновлено — {result.stagesUpdated}
            {result.issuesCreated ? `, новых проблем — ${result.issuesCreated}` : ''}
            {result.issuesUpdated ? `, обновлено проблем — ${result.issuesUpdated}` : ''}
            {result.budgetUsedPercent != null ? `. Бюджет освоен на ${result.budgetUsedPercent}%.` : '.'}
          </div>
        )}
      </div>
    </div>
  );
}
