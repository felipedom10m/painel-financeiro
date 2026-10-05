import { addMonths, invoiceKeyForPurchase, monthKey, purposeTiming } from './date-utils.js';

export const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
export const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);

export function purposeMetrics(state, today) {
  const goal = sum(state.purpose.commitments.map(item => item.amount));
  const produced = sum(state.productions.map(item => item.amount));
  const withdrawn = sum(state.expenses.filter(item => item.source === 'purpose').map(item => item.amount));
  const cash = produced - withdrawn;
  const missing = Math.max(0, goal - produced);
  const timing = purposeTiming(state.purpose, today);
  return {
    goal, produced, withdrawn, cash, missing, ...timing,
    progress: goal > 0 ? Math.min(100, produced / goal * 100) : 0,
    dailyPace: timing.remainingDays > 0 ? missing / timing.remainingDays : missing
  };
}

export function cardInvoice(card, invoiceKey) {
  const purchases = card.purchases.filter(item => invoiceKeyForPurchase(item.date, card.closingDay) === invoiceKey);
  const work = sum(purchases.filter(item => item.category === 'work').map(item => item.amount));
  const daily = sum(purchases.filter(item => item.category !== 'work').map(item => item.amount));
  return { key: invoiceKey, purchases, work, daily, total: work + daily, paid: card.paidInvoices.includes(invoiceKey) };
}

export function monthExpensesByCategory(state, selectedMonth) {
  const rows = state.expenses.filter(item => monthKey(new Date(`${item.date}T12:00:00`)) === selectedMonth);
  return rows.reduce((grouped, item) => {
    grouped[item.category] = (grouped[item.category] || 0) + Number(item.amount);
    return grouped;
  }, {});
}

export function forecastMonth(state, key) {
  const activeBills = state.recurringBills.filter(item => item.active);
  const overrides = state.monthlyOverrides[key] || {};
  const values = activeBills.map(item => overrides[item.id] ?? item.amount);
  const billsComplete = values.every(value => Number.isFinite(Number(value)) && Number(value) > 0);
  const billTotal = sum(values);
  const cardTotal = sum(state.cards.map(card => cardInvoice(card, key).total));
  return { key, billTotal, cardTotal, total: billTotal + cardTotal, complete: billsComplete };
}

export function forecastMonths(state, baseKey) {
  return [0, 1, 2].map(offset => forecastMonth(state, addMonths(baseKey, offset)));
}

export function protectedTime(state, cash) {
  const activeBills = state.recurringBills.filter(item => item.active);
  const complete = activeBills.length > 0 && activeBills.every(item => Number(item.amount) > 0);
  const monthlyCost = sum(activeBills.map(item => item.amount));
  if (!complete || monthlyCost <= 0) return { complete: false, monthlyCost, months: 0, days: 0 };
  const months = cash / monthlyCost;
  return { complete: true, monthlyCost, months, days: Math.floor(months * 30) };
}
