import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../app/default-state.js';
import { cardInvoice, purposeMetrics, protectedTime } from '../app/calculations.js';
import { invoiceKeyForPurchase, purposeTiming } from '../app/date-utils.js';

test('propósito usa os valores reais definidos', () => {
  const metrics = purposeMetrics(createDefaultState(), '2026-10-05');
  assert.equal(metrics.goal, 9100);
  assert.equal(metrics.produced, 2984.12);
  assert.equal(metrics.withdrawn, 685.78);
  assert.equal(metrics.cash, 2298.34);
  assert.equal(metrics.missing, 6115.88);
  assert.equal(metrics.currentDay, 13);
  assert.equal(metrics.totalDays, 40);
  assert.equal(metrics.remainingDays, 27);
});

test('compra é encaminhada conforme o fechamento do cartão', () => {
  assert.equal(invoiceKeyForPurchase('2026-10-29', 30), '2026-11');
  assert.equal(invoiceKeyForPurchase('2026-10-30', 30), '2026-12');
});

test('fatura real de novembro soma trabalho e dia a dia', () => {
  const card = createDefaultState().cards[0];
  const invoice = cardInvoice(card, '2026-11');
  assert.equal(invoice.work, 303);
  assert.equal(invoice.daily, 178);
  assert.equal(invoice.total, 481);
});

test('tempo protegido fica em cálculo enquanto contas não têm previsão', () => {
  const state = createDefaultState();
  assert.equal(protectedTime(state, 2298.34).complete, false);
  state.recurringBills.forEach(item => { item.amount = item.amount || 100; });
  assert.equal(protectedTime(state, 2298.34).complete, true);
});

test('datas do propósito respeitam início e fim', () => {
  const timing = purposeTiming({ startDate: '2026-09-23', endDate: '2026-11-01' }, '2026-10-05');
  assert.deepEqual(timing, { totalDays: 40, currentDay: 13, remainingDays: 27 });
});
