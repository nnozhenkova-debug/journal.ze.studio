const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const MONTHS_RU_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function monthLabel(date) {
  return `${MONTHS_RU_NOM[date.getMonth()]}\n${date.getFullYear()}.`;
}

export function dayMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
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
