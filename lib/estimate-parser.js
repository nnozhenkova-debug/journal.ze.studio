// Разбор экспорта сметы проекта (Google Sheets → CSV) в структурированные
// данные: общие суммы по проекту, суммы и часы по этапам ("Итого по
// разделу") и, где размечено, по отдельным задачам.
//
// Формат сметы негибкий и вручную собран в Google Sheets (объединённые
// ячейки шапки, разный набор ролей у разных проектов), поэтому парсер не
// полагается на фиксированные номера столбцов — он ищет опорные подписи
// ("этап", "Итого по разделу:", "Общая стоимость реализации", названия
// столбцов "План"/"факт") и строит структуру вокруг них. Так один и тот же
// код переживает то, что в одной смете есть роль "frontend-разработка", а
// в другой её нет.

// ---------------------------------------------------------------------
// CSV → массив строк (без внешних зависимостей — экспорт из Google Sheets
// содержит перенос строки внутри "кавычек" у заголовков, обычный split('\n')
// это ломает).
// ---------------------------------------------------------------------
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // игнорируем — перевод строки обработает '\n'
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const cell = (row, i) => (row && row[i] != null ? String(row[i]) : '');
const trimCell = (row, i) => cell(row, i).replace(/ /g, ' ').trim();

export function parseMoney(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/ /g, ' ').trim();
  if (!s || s === '-') return null;
  const cleaned = s.replace(/^[рp₽]\.?\s*/i, '').replace(/\s+/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseNum(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/ /g, ' ').trim();
  if (!s) return null;
  const cleaned = s.replace(/\s+/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parsePercent(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/ /g, ' ').replace('%', '').trim();
  if (!s) return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const norm = (s) => s.toLowerCase().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

const FIXED_COLUMNS = {
  этап: 'stage',
  наименование: 'stageName',
  сроки: 'dates',
  'проектные задачи': 'task',
  'готовность задачи': 'progress',
  'плановая стоимость реализации': 'plannedCost',
  'фактическая стоимость реализации': 'actualCost',
  'прогноз стоимости': 'forecastCost',
};

// Ищет строку-шапку таблицы (та, где в столбце есть текст "этап") и
// разбирает её на: карту фиксированных столбцов + список групп ролей
// (каждая — {name, startCol, width}).
function findHeader(rows) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const idx = row.findIndex((v) => norm(String(v || '')) === 'этап');
    if (idx === -1) continue;
    const fixed = {};
    const groupStarts = [];
    for (let c = idx; c < row.length; c++) {
      const label = norm(trimCell(row, c));
      if (!label) continue;
      if (FIXED_COLUMNS[label]) {
        fixed[FIXED_COLUMNS[label]] = c;
      } else if (c > idx) {
        groupStarts.push({ col: c, name: trimCell(row, c) });
      }
    }
    const groups = groupStarts.map((g, i) => {
      const end = i + 1 < groupStarts.length ? groupStarts[i + 1].col : row.length;
      return { name: g.name, startCol: g.col, width: end - g.col };
    });
    return { headerRow: r, fixed, groups };
  }
  return null;
}

// Классифицирует группу роли по подписям в двух следующих строках шапки и
// возвращает смещения нужных столбцов относительно начала группы.
function classifyGroup(rows, headerRow, group) {
  const row1 = rows[headerRow + 1] || []; // числа/подписи "часы" / "дни"
  const row2 = rows[headerRow + 2] || []; // "План" / "факт"
  const l = (r, off) => norm(trimCell(r, group.startCol + off));

  if (group.width >= 5 && l(row2, 0) === 'план' && l(row2, 2) === 'факт') {
    return {
      kind: 'detailed',
      planCost: 0,
      planHours: 1,
      factCost: 2,
      factHours: 3,
      forecastHours: 4,
    };
  }
  // "простая" группа (например, frontend/backend в этом примере):
  // разметки План/факт нет, обычно просто ставка + часы (+ дни).
  let hoursOffset = null;
  for (let off = 0; off < group.width; off++) {
    if (norm(trimCell(row1, off)).includes('час')) hoursOffset = off;
  }
  return { kind: 'simple', cost: 0, hours: hoursOffset };
}

function sumGroupOffset(rows, r, groups, offsetKey) {
  let total = 0;
  let any = false;
  for (const g of groups) {
    if (g.classified.kind !== 'detailed') continue;
    const off = g.classified[offsetKey];
    if (off == null) continue;
    const v = parseNum(cell(rows[r], g.startCol + off));
    if (v != null) {
      total += v;
      any = true;
    }
  }
  return any ? total : 0;
}

function roleBreakdownForRow(rows, r, groups) {
  const out = [];
  for (const g of groups) {
    const c = g.classified;
    if (c.kind === 'detailed') {
      out.push({
        role: g.name,
        planCost: parseMoney(cell(rows[r], g.startCol + c.planCost)),
        planHours: parseNum(cell(rows[r], g.startCol + c.planHours)),
        factCost: parseMoney(cell(rows[r], g.startCol + c.factCost)),
        factHours: parseNum(cell(rows[r], g.startCol + c.factHours)),
        forecastHours: parseNum(cell(rows[r], g.startCol + c.forecastHours)),
      });
    } else {
      out.push({
        role: g.name,
        cost: parseMoney(cell(rows[r], g.startCol + (c.cost ?? 0))),
        hours: c.hours != null ? parseNum(cell(rows[r], g.startCol + c.hours)) : null,
      });
    }
  }
  return out;
}

function findProjectName(rows) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    const idx = row.findIndex((v) => norm(String(v || '')).startsWith('смета на реализацию проекта'));
    if (idx === -1) continue;
    for (let c = idx + 1; c < row.length; c++) {
      const v = trimCell(row, c);
      if (v) return v;
    }
  }
  return null;
}

/**
 * Разбирает текст CSV-экспорта сметы в структуру:
 * { meta, project, stages: [{roman,name,plannedCost,actualCost,forecastCost,
 *   plannedHours,actualHours,tasks:[...]}], warnings }
 */
export function parseEstimate(csvText) {
  const rows = parseCsv(csvText);
  const warnings = [];
  const header = findHeader(rows);
  if (!header) {
    return { ok: false, error: 'Не нашёл в файле строку с шапкой таблицы (столбец «этап»). Проверьте, что это экспорт сметы.' };
  }
  const { headerRow, fixed, groups } = header;
  if (fixed.plannedCost == null || fixed.actualCost == null || fixed.task == null) {
    return { ok: false, error: 'В шапке не нашлись обязательные столбцы (Проектные задачи / Плановая или Фактическая стоимость реализации).' };
  }
  const classifiedGroups = groups.map((g) => ({ ...g, classified: classifyGroup(rows, headerRow, g) }));
  if (classifiedGroups.length === 0) {
    warnings.push('Не нашёл ни одной группы ролей (аналитика/дизайн/…) — часы не будут посчитаны.');
  }

  const dataStart = headerRow + 3; // строка шапки + 2 строки подписей (числа/часы, План/факт)
  const stages = [];
  let currentStage = null;
  let project = null;

  const buildTotalsFromRow = (r) => ({
    plannedCost: parseMoney(cell(rows[r], fixed.plannedCost)),
    actualCost: parseMoney(cell(rows[r], fixed.actualCost)),
    forecastCost: fixed.forecastCost != null ? parseMoney(cell(rows[r], fixed.forecastCost)) : null,
    plannedHours: sumGroupOffset(rows, r, classifiedGroups, 'planHours'),
    actualHours: sumGroupOffset(rows, r, classifiedGroups, 'factHours'),
  });

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((v) => !String(v || '').trim())) continue;

    const c1 = trimCell(row, fixed.stage != null ? fixed.stage : 1);
    const c4 = trimCell(row, fixed.task);

    if (c1 && /общая стоимость/i.test(c1)) {
      project = buildTotalsFromRow(r);
      break;
    }

    if (c1) {
      // новая строка этапа (даже если в ней же сразу и первая задача)
      currentStage = {
        roman: c1,
        name: fixed.stageName != null ? trimCell(row, fixed.stageName) : '',
        plannedCost: null,
        actualCost: null,
        forecastCost: null,
        plannedHours: 0,
        actualHours: 0,
        tasks: [],
      };
      stages.push(currentStage);
    }

    if (!c4) continue;
    if (!currentStage) {
      warnings.push(`Строка ${r + 1}: есть задача «${c4}», но не нашёл, к какому этапу она относится — пропустил.`);
      continue;
    }

    if (/итого\s*по\s*разделу/i.test(c4)) {
      const totals = buildTotalsFromRow(r);
      currentStage.plannedCost = totals.plannedCost;
      currentStage.actualCost = totals.actualCost;
      currentStage.forecastCost = totals.forecastCost;
      currentStage.plannedHours = totals.plannedHours;
      currentStage.actualHours = totals.actualHours;
      continue;
    }

    const plannedCost = parseMoney(cell(row, fixed.plannedCost));
    const actualCost = parseMoney(cell(row, fixed.actualCost));
    const plannedHours = sumGroupOffset(rows, r, classifiedGroups, 'planHours');
    const actualHours = sumGroupOffset(rows, r, classifiedGroups, 'factHours');
    currentStage.tasks.push({
      name: c4,
      progress: fixed.progress != null ? parsePercent(cell(row, fixed.progress)) : null,
      plannedCost,
      actualCost,
      forecastCost: fixed.forecastCost != null ? parseMoney(cell(row, fixed.forecastCost)) : null,
      plannedHours,
      actualHours,
      hasOwnPlan: (plannedCost != null && plannedCost > 0) || plannedHours > 0,
      roles: roleBreakdownForRow(rows, r, classifiedGroups),
    });
  }

  // Валовая прибыль / маржинальность — по подписи в первом столбце, необязательно.
  let grossProfit = null;
  let marginPercent = null;
  let forecastMarginPercent = null;
  for (const row of rows) {
    const c1 = norm(trimCell(row, fixed.stage != null ? fixed.stage : 1));
    if (c1.startsWith('валовая прибыль') && fixed.plannedCost != null) {
      grossProfit = parseMoney(cell(row, fixed.plannedCost));
    }
    // Опечатка «марижинальность» вместо «маржинальность» встречается в
    // части смет — ориентируемся на общий суффикс, а не на точное слово.
    if (c1.includes('жинальность') && fixed.plannedCost != null) {
      marginPercent = parsePercent(cell(row, fixed.plannedCost));
      forecastMarginPercent = fixed.forecastCost != null ? parsePercent(cell(row, fixed.forecastCost)) : null;
    }
  }

  if (!project) {
    warnings.push('Не нашёл строку «Общая стоимость реализации» — итоги по проекту не посчитаны.');
  }
  if (stages.length === 0) {
    warnings.push('Не нашёл ни одного этапа (строки со значением в столбце «этап»).');
  }

  return {
    ok: true,
    meta: { projectName: findProjectName(rows) },
    project,
    grossProfit,
    marginPercent,
    forecastMarginPercent,
    stages,
    warnings,
  };
}

/**
 * Сравнивает факт/план часов и возвращает список превышений — по этапам
 * (всегда, это базовый уровень) и дополнительно по задачам, где в самой
 * смете указан собственный план (часы или стоимость).
 * threshold — на сколько часов факт должен превышать план, чтобы считать
 * это превышением (0 = любое превышение).
 */
export function findHourOverruns(parsed, { thresholdHours = 0 } = {}) {
  if (!parsed?.ok) return [];
  const overruns = [];
  for (const stage of parsed.stages) {
    if (stage.plannedHours > 0 && stage.actualHours - stage.plannedHours > thresholdHours) {
      overruns.push({
        level: 'stage',
        stageRoman: stage.roman,
        stageName: stage.name,
        plannedHours: stage.plannedHours,
        actualHours: stage.actualHours,
        overHours: +(stage.actualHours - stage.plannedHours).toFixed(1),
      });
    }
    for (const task of stage.tasks) {
      if (task.hasOwnPlan && task.plannedHours > 0 && task.actualHours - task.plannedHours > thresholdHours) {
        overruns.push({
          level: 'task',
          stageRoman: stage.roman,
          stageName: stage.name,
          taskName: task.name,
          plannedHours: task.plannedHours,
          actualHours: task.actualHours,
          overHours: +(task.actualHours - task.plannedHours).toFixed(1),
        });
      }
    }
  }
  return overruns;
}
