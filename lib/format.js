const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const MONTHS_RU_PREP = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
];

const MONTHS_RU_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function monthLabel(date) {
  return `${MONTHS_RU_NOM[date.getMonth()]}\n${date.getFullYear()}.`;
}

// Название месяца и год отдельно — год в шапке журнала подсвечивается акцентным цветом.
export function monthYearParts(date) {
  return { month: MONTHS_RU_NOM[date.getMonth()], year: `${date.getFullYear()}.` };
}

// Предложный падеж месяца — «в сентябре» — для текста пустых состояний.
export function monthPrepositional(date) {
  return MONTHS_RU_PREP[date.getMonth()];
}

export function dayMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

// Короткий формат даты — «15 окт», для плотных мест вроде плашки дедлайна.
export function dayMonthShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_RU_SHORT[d.getMonth()]}`;
}

export function weekdayShort(date) {
  const jsDay = date.getDay(); // 0 = Sunday
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return WEEKDAYS_SHORT[idx];
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toDateOnly(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Возвращает сетку из 42 ячеек (6 недель) для календаря месяца, понедельник первым днём.
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

// Возвращает только те недели (массивы по 7 дат), которые реально нужны,
// чтобы показать месяц — 5 строк для большинства месяцев, 6 для длинных.
// Хвостовые дни следующего месяца, не попавшие в последнюю нужную неделю,
// не включаются вовсе (в отличие от buildMonthGrid).
export function buildMonthWeeks(year, month) {
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = firstWeekday + daysInMonth;
  const rowCount = Math.ceil(totalCells / 7);
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const weeks = [];
  for (let w = 0; w < rowCount; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const i = w * 7 + d;
      week.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }
    weeks.push(week);
  }
  return weeks;
}

export function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return few;
  return many;
}

// Возраст записи в днях, в формате списка проблем: «вчера», «3 дня», «1 нед.»
export function daysAgoLabel(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} ${pluralRu(diffDays, 'день', 'дня', 'дней')}`;
  const weeks = Math.round(diffDays / 7);
  return `${weeks} нед.`;
}

// Только время (часы:минуты) — для строк экрана «Лента», где дата уже вынесена в заголовок группы.
export function timeOnly(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Заголовок группы дня на экране «Лента»: «Сегодня», «Вчера», «Пн, 22 сен».
export function eventGroupLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  if (isSameDay(d, now)) return 'Сегодня';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Вчера';
  return `${weekdayShort(d)}, ${d.getDate()} ${MONTHS_RU_SHORT[d.getMonth()]}`;
}

// Группирует события по календарному дню (сохраняя исходный порядок — убывание по времени).
export function groupEventsByDay(events) {
  const groups = [];
  const byKey = new Map();
  for (const event of events) {
    const d = new Date(event.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!byKey.has(key)) {
      const group = { key, date: d, label: eventGroupLabel(event.created_at), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).items.push(event);
  }
  return groups;
}

// «сегодня в 10:24» / «вчера в 10:24» / «пт в 10:24» — для «начато …» в живой ретро-сессии.
export function startedAtLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (isSameDay(d, now)) return `сегодня в ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return `вчера в ${time}`;
  return `${weekdayShort(d).toLowerCase()} в ${time}`;
}

// «24 сентября 2026» — полная дата для итогов ретро.
export function fullDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = toDateOnly(dateStr) || new Date(dateStr);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

// «14 мин 34 сек» / «45 сек» — длительность сессии из duration_seconds.
export function durationLabel(totalSeconds) {
  if (totalSeconds == null) return '—';
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  if (m === 0) return `${s} сек`;
  return `${m} мин ${s} сек`;
}

// Делит заголовок на чёрную и золотую (последнее слово + точка) части — «Спринт» + «15.».
export function splitTitleGold(title) {
  const words = (title || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { rest: '', last: title || '' };
  const last = words.pop();
  return { rest: `${words.join(' ')} `, last };
}

export function relativeTime(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const now = new Date();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'вчера';
  if (diffD < 7) return `${diffD} дн назад`;
  return dayMonth(dateStr);
}

export function minutesToHours(minutes) {
  return Math.round(((minutes || 0) / 60) * 10) / 10;
}

export function formatHours(minutes) {
  const h = minutesToHours(minutes);
  return `${h} ч`;
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

// Краткое имя — «Аня Кузнецова» → «Аня К.» — для компактных списков участников.
export function shortName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts[1][0]}.`;
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

const AVATAR_PALETTE = ['#a8501f', '#1c6b6f', '#6d28d9', '#15803d', '#be185d', '#1d4ed8', '#a16207'];
export function colorForId(id) {
  if (!id) return '#6b6a66';
  let hash = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
