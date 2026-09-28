import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { parseEstimate, findHourOverruns } from '../../../../../lib/estimate-parser';

// Разбирает загруженный файл сметы и возвращает предпросмотр — ничего не
// пишет в базу. Ничего не пишет в базу.
// Сопоставление этапов сметы с этапами проекта делается тут же (по
// сохранённому ранее project_stages.estimate_roman, а если такого нет —
// по совпадению названия), чтобы админ увидел готовое предложение и мог
// его поправить перед подтверждением.
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
    return NextResponse.json({ error: 'Не удалось прочитать файл.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file.text !== 'function') {
    return NextResponse.json({ error: 'Файл не приложен.' }, { status: 400 });
  }
  if (!/\.csv$/i.test(file.name || '')) {
    return NextResponse.json({ error: 'Пока поддерживается только CSV-экспорт сметы (Файл → Скачать → «Значения, разделённые запятыми»).' }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseEstimate(text);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: stages } = await supabase
    .from('project_stages')
    .select('id,name,estimate_roman,sort_order')
    .eq('project_id', projectId)
    .order('sort_order');

  const norm = (s) => (s || '').toLowerCase().trim();
  const stageMatches = parsed.stages.map((est, i) => {
    let match =
      (stages || []).find((s) => s.estimate_roman === est.roman) ||
      (stages || []).find((s) => norm(s.name) === norm(est.name)) ||
      (stages || [])[i] ||
      null;
    return {
      estimateRoman: est.roman,
      estimateName: est.name,
      plannedHours: est.plannedHours,
      actualHours: est.actualHours,
      plannedCost: est.plannedCost,
      actualCost: est.actualCost,
      suggestedStageId: match ? match.id : null,
      suggestedStageName: match ? match.name : null,
    };
  });

  const overruns = findHourOverruns(parsed, { thresholdHours: 0 });

  return NextResponse.json({
    projectName: parsed.meta?.projectName || project.name,
    project: parsed.project,
    grossProfit: parsed.grossProfit,
    marginPercent: parsed.marginPercent,
    warnings: parsed.warnings,
    stageMatches,
    projectStages: (stages || []).map((s) => ({ id: s.id, name: s.name })),
    overruns,
  });
}
