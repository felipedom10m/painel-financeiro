const DAY_MS = 86400000;

export function toIsoDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function parseIsoDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function dateFromMonthKey(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function addMonths(key, amount) {
  const date = dateFromMonthKey(key);
  date.setMonth(date.getMonth() + amount);
  return monthKey(date);
}

export function monthLabel(key, long = false) {
  return new Intl.DateTimeFormat('pt-BR', { month: long ? 'long' : 'short', year: 'numeric' })
    .format(dateFromMonthKey(key)).replace('.', '').toUpperCase();
}

export function shortDate(value) {
  if (!value) return 'Definir data';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(parseIsoDate(value)).replace('.', '').toUpperCase();
}

export function fullDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR').format(parseIsoDate(value));
}

export function daysBetween(start, end) {
  return Math.max(0, Math.round((parseIsoDate(end) - parseIsoDate(start)) / DAY_MS));
}

export function purposeTiming(purpose, todayIso = toIsoDate()) {
  const totalDays = daysBetween(purpose.startDate, purpose.endDate) + 1;
  const elapsed = Math.min(totalDays, Math.max(1, daysBetween(purpose.startDate, todayIso) + 1));
  const remaining = Math.max(0, daysBetween(todayIso, purpose.endDate));
  return { totalDays, currentDay: elapsed, remainingDays: remaining };
}

export function invoiceKeyForPurchase(dateValue, closingDay) {
  const date = parseIsoDate(dateValue);
  const monthsAhead = date.getDate() >= Number(closingDay) ? 2 : 1;
  date.setDate(1);
  date.setMonth(date.getMonth() + monthsAhead);
  return monthKey(date);
}

export function dueDateForInvoice(invoiceKey, dueDay) {
  const date = dateFromMonthKey(invoiceKey);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(Number(dueDay), lastDay));
  return toIsoDate(date);
}

export function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
