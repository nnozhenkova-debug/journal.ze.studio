export const CATEGORIES = [
  ['brief', 'Бриф и цели'],
  ['planning', 'Планирование (сроки/бюджет)'],
  ['scope', 'Управление изменениями'],
  ['comm', 'Коммуникация с клиентом'],
  ['team', 'Команда и ресурсы'],
  ['quality', 'Контроль качества'],
  ['finance', 'Финансовый результат'],
  ['post', 'Постпроектный анализ'],
  ['other', 'Другое / процессное'],
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);

export const CATEGORY_COLORS = {
  brief: { light: { bg: '#ede9fe', fg: '#6d28d9' }, dark: { bg: '#382a5c', fg: '#c4b5fd' } },
  planning: { light: { bg: '#dbeafe', fg: '#1d4ed8' }, dark: { bg: '#1e3a5f', fg: '#93c5fd' } },
  scope: { light: { bg: '#ffedd5', fg: '#c2410c' }, dark: { bg: '#4a2c12', fg: '#fdba74' } },
  comm: { light: { bg: '#fce7f3', fg: '#be185d' }, dark: { bg: '#4a1d34', fg: '#f9a8d4' } },
  team: { light: { bg: '#dcfce7', fg: '#15803d' }, dark: { bg: '#163a24', fg: '#86efac' } },
  quality: { light: { bg: '#ccfbf1', fg: '#0f766e' }, dark: { bg: '#0f3733', fg: '#5eead4' } },
  finance: { light: { bg: '#fef9c3', fg: '#a16207' }, dark: { bg: '#453a10', fg: '#fde047' } },
  post: { light: { bg: '#e2e8f0', fg: '#1e293b' }, dark: { bg: '#2a3341', fg: '#cbd5e1' } },
  other: { light: { bg: '#f1f5f9', fg: '#475569' }, dark: { bg: '#262b33', fg: '#94a3b8' } },
};

export const STATUS_LABEL = {
  new: 'Зафиксировано',
  proposed: 'Решение предложено',
  in_progress: 'Внедряется',
  resolved: 'Решено',
  recurred: 'Вернулось',
};

export const TYPE_LABEL = {
  meeting: 'Встреча',
  note: 'Заметка',
  risk: 'Риск',
  agreement: 'Договорённость',
  decision: 'Решение',
  client_mood: 'Настроение клиента',
  retro_problem: 'Ретро: проблема',
  retro_practice: 'Ретро: практика',
};

export const TYPE_GUIDE = {
  meeting: 'Запись встречи: кто был, что обсудили, что решили. Используйте на синках, брифингах, ретро-встрече.',
  note: 'Свободная заметка — что угодно, что стоит зафиксировать по проекту.',
  risk: 'Риск, который стоит держать в поле зрения — до того, как он стал проблемой.',
  agreement: 'Договорённость с клиентом или внутри команды, которую важно не потерять.',
  decision: 'Принятое решение и его основание.',
  client_mood: 'Как настроен клиент прямо сейчас — сигнал для менеджмента отношений.',
  retro_problem: 'Проблема с ретро: категория, статус и история решения попадут на «Доску ретро».',
  retro_practice: 'Практика, которая сработала — стоит повторить в следующих проектах.',
};

export function catColor(id, isDark) {
  const c = CATEGORY_COLORS[id] || CATEGORY_COLORS.other;
  return isDark ? c.dark : c.light;
}

const AVATAR_PALETTE = ['#a8501f', '#1c6b6f', '#6d28d9', '#15803d', '#be185d', '#1d4ed8', '#a16207'];
export function colorForId(id) {
  if (!id) return '#6b6a66';
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}
