import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { parseEstimate, findHourOverruns } from '../../../../../lib/estimate-parser';

const SEVERITY = { high: 'critical', mid: 'important', low: 'watch' };

function severityFor(overHours, plannedHours) {
  const ratio = plannedHours > 0 ? overHours / plannedHours : 1;
  if (ratio > 0.5) return SEVERITY.high;
  if (ratio > 0.15) return SEVERITY.mid;
  return SEVERITY.low;
}

function slug(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Применяет синхронизацию: перезаписывает деньги проекта из сметы,
// часы — только у явно сопоставленных этапов, заводит/обновляет
// проблемы по превышению часов. Файл разбирается заново на сервере
// (не доверяем цифрам, которые мог прислать браузер) — от клиента
// нужно только сопоставление «этап сметы → этап проекта».
export async function POST(request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 });
  }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Обновлять смету может только админ.' }, { status: 403 });
  }

  const projectId = params.id;
  const { data: project } = await supabase.from('projects').select('id,name').eq('id', projectId).maybeSingle();
  if (!project) {
    return NextResponse.json({ error: 'Проект не найден.' }, { status: 404 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать запрос.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file.text !== 'function') {
    return NextResponse.json({ error: 'Файл не приложен.' }, { status: 400 });
  }
  let stageMapping = [];
  try {
    stageMapping = JSON.parse(form.get('stageMapping') || '[]');
  } catch {
    return NextResponse.json({ error: 'Некорректное сопоставление этапов.' }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseEstimate(text);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // 1. Деньги и % бюджета — на уровне проекта, из строки «Общая стоимость реализации».
  const plannedCost = parsed.project?.plannedCost ?? null;
  const actualCost = parsed.project?.actualCost ?? null;
  const budgetUsedPercent =
    plannedCost && plannedCost > 0 ? Math.max(0, Math.min(100, Math.round((actualCost / plannedCost) * 100))) : null;

  await supabase
    .from('projects')
    .update({
      estimate_planned_cost: plannedCost,
      estimate_actual_cost: actualCost,
      estimate_forecast_cost: parsed.project?.forecastCost ?? null,
      estimate_margin_percent: parsed.marginPercent ?? null,
      estimate_synced_at: new Date().toISOString(),
      ...(budgetUsedPercent != null ? { budget_used_percent: budgetUsedPercent } : {}),
    })
    .eq('id', projectId);

  // 2. Часы — только у этапов, которые админ явно сопоставил (или которые
  // уже были сопоставлены при прошлой синхронизации).
  const mapByRoman = new Map(stageMapping.filter((m) => m.projectStageId).map((m) => [m.estimateRoman, m.projectStageId]));
  let stagesUpdated = 0;
  for (const est of parsed.stages) {
    const stageId = mapByRoman.get(est.roman);
    if (!stageId) continue;
    await supabase
      .from('project_stages')
      .update({
        planned_minutes: Math.round((est.plannedHours || 0) * 60),
        actual_minutes: Math.round((est.actualHours || 0) * 60),
        estimate_roman: est.roman,
      })
      .eq('id', stageId)
      .eq('project_id', projectId);
    stagesUpdated++;
  }

  // 3. Превышения часов → проблемы (создаём или обновляем по стабильному ключу,
  // чтобы повторная синхронизация не плодила дубликаты).
  const overruns = findHourOverruns(parsed, { thresholdHours: 0 });
  let issuesCreated = 0;
  let issuesUpdated = 0;
  for (const o of overruns) {
    const key =
      o.level === 'stage'
        ? `estimate:${projectId}:stage:${o.stageRoman}`
        : `estimate:${projectId}:stage:${o.stageRoman}:task:${slug(o.taskName)}`;
    const title =
      o.level === 'stage'
        ? `Перерасход часов на этапе «${o.stageName}»: факт ${o.actualHours} ч вместо плана ${o.plannedHours} ч (+${o.overHours} ч)`
        : `Перерасход часов по задаче «${o.taskName}» (этап «${o.stageName}»): факт ${o.actualHours} ч вместо плана ${o.plannedHours} ч (+${o.overHours} ч)`;
    const description = `Обнаружено автоматически при синхронизации со сметой. План: ${o.plannedHours} ч, факт: ${o.actualHours} ч, превышение: ${o.overHours} ч.`;
    const severity = severityFor(o.overHours, o.plannedHours);
    const meta = { key, level: o.level, stageRoman: o.stageRoman, taskName: o.taskName || null, plannedHours: o.plannedHours, actualHours: o.actualHours, overHours: o.overHours };

    const { data: existing } = await supabase
      .from('issues')
      .select('id')
      .eq('project_id', projectId)
      .eq('status', 'open')
      .filter('meta->>key', 'eq', key)
      .maybeSingle();

    if (existing) {
      await supabase.from('issues').update({ title, description, severity, meta }).eq('id', existing.id);
      issuesUpdated++;
    } else {
      const { error: insertError } = await supabase
        .from('issues')
        .insert({ project_id: projectId, title, description, severity, source: 'estimate_sync', meta });
      if (!insertError) issuesCreated++;
    }
  }

  if (issuesCreated > 0 || stagesUpdated > 0) {
    await supabase.from('events').insert({
      project_id: projectId,
      type: 'project_updated',
      title: 'Обновлены данные из сметы',
      subtitle: `Этапов: ${stagesUpdated}${issuesCreated ? `, новых проблем: ${issuesCreated}` : ''}${issuesUpdated ? `, обновлено проблем: ${issuesUpdated}` : ''}`,
      actor_id: user.id,
    });
  }

  return NextResponse.json({
    ok: true,
    budgetUsedPercent,
    stagesUpdated,
    issuesCreated,
    issuesUpdated,
    overruns,
  });
}
