import { addMonths, dueDateForInvoice, fullDate, monthLabel, shortDate } from './date-utils.js';
import { cardInvoice, forecastMonths, money, monthExpensesByCategory, protectedTime, purposeMetrics } from './calculations.js';

const billType = { fixed: 'FIXA', estimated: 'ESTIMADA', budget: 'ORÇAMENTO' };
const billIcon = { Aluguel: '⌂', Academia: '◆', Água: '●', Energia: 'ϟ', Internet: '◉', Mercado: '🛒' };
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function monthTabs(selected) {
  return [-1, 0, 1, 2].map(offset => {
    const key = addMonths(selected, offset);
    return `<button class="month-tab ${offset === 0 ? 'active' : ''}" data-action="select-month" data-month="${key}">${monthLabel(key)}</button>`;
  }).join('');
}

function metricCard(label, value, tone, icon, action = '') {
  return `<article class="metric-card tone-${tone}" ${action ? `data-action="${action}" role="button" tabindex="0"` : ''}>
    <span class="metric-icon">${icon}</span><div><p>${label}</p><strong>${value}</strong></div>${action ? '<span class="chevron">›</span>' : ''}
  </article>`;
}

function commitments(state) {
  return state.purpose.commitments.map(item => `<div class="data-row commitment-row">
    <span class="row-icon">${item.name.includes('Aluguel') ? '⌂' : item.name.includes('carro') ? '▣' : '▤'}</span>
    <span class="row-title">${escapeHtml(item.name)}</span><strong>${money(item.amount)}</strong>
    <button class="date-chip" data-action="edit-commitment" data-id="${item.id}">${shortDate(item.dueDate)}</button>
    <button class="mini-edit" data-action="edit-commitment" data-id="${item.id}" aria-label="Editar ${escapeHtml(item.name)}">✎</button>
  </div>`).join('');
}

function bills(state, expenseTotals, selectedMonth) {
  const overrides = state.monthlyOverrides[selectedMonth] || {};
  return state.recurringBills.filter(item => item.active).map(item => {
    const effectiveAmount = overrides[item.id] ?? item.amount;
    const display = item.type === 'budget' && expenseTotals[item.name]
      ? `${money(expenseTotals[item.name])} gasto`
      : Number(effectiveAmount) > 0 ? money(effectiveAmount) : item.type === 'estimated' ? 'Definir previsão' : 'Definir valor';
    return `<div class="data-row bill-row">
      <span class="row-icon">${billIcon[item.name] || '▤'}</span><span class="row-title">${escapeHtml(item.name)}</span>
      <span class="type-badge type-${item.type}">${billType[item.type]}</span><strong class="row-value">${display}</strong>
      <button class="date-chip" data-action="edit-bill" data-id="${item.id}">${item.dueDay ? `Dia ${item.dueDay}` : item.type === 'budget' ? 'Definir limite' : 'Definir venc.'}</button>
      <button class="mini-edit" data-action="edit-bill" data-id="${item.id}" aria-label="Editar ${escapeHtml(item.name)}">✎</button>
    </div>`;
  }).join('');
}

function cards(state, selectedMonth) {
  if (!state.cards.length) return '<div class="empty-state">Nenhum cartão configurado.</div>';
  return state.cards.map(card => {
    const invoice = cardInvoice(card, addMonths(selectedMonth, 1));
    const nextInvoice = cardInvoice(card, addMonths(selectedMonth, 2));
    return `<article class="credit-card">
      <div class="section-title compact"><div><span class="section-icon">▰</span><div><h3>${escapeHtml(card.name)}</h3><p>Fecha dia ${card.closingDay} · Vence dia ${card.dueDay}</p></div></div><button class="more-button" data-action="edit-card" data-id="${card.id}">•••</button></div>
      <div class="invoice-main">
        <div><small>FATURA ${monthLabel(invoice.key)}</small><strong>${money(invoice.total)}</strong></div>
        <div><small>${invoice.paid ? 'Fatura paga' : `Vence em ${fullDate(dueDateForInvoice(invoice.key, card.dueDay))}`}</small><div class="mini-progress"><span style="width:${invoice.total ? 48 : 0}%"></span></div></div>
      </div>
      <div class="invoice-split"><div><small>CUSTOS DO TRABALHO</small><strong>${money(invoice.work)}</strong><span>Combustível, pedágio e gastos para produzir renda</span></div><div><small>DESPESAS DO DIA A DIA</small><strong>${money(invoice.daily)}</strong><span>Compras pessoais, casa e alimentação</span></div></div>
      <div class="card-actions"><button class="button button-secondary" data-action="view-purchases" data-id="${card.id}" data-invoice="${invoice.key}">☷ Ver ${invoice.purchases.length} compras da fatura</button><button class="button button-success" data-action="toggle-invoice-paid" data-id="${card.id}" data-invoice="${invoice.key}">${invoice.paid ? '↩ Reabrir fatura' : '✓ Marcar fatura paga'}</button></div>
      <button class="future-invoice" data-action="view-purchases" data-id="${card.id}" data-invoice="${nextInvoice.key}"><span>${monthLabel(nextInvoice.key)}</span><strong>${money(nextInvoice.total)}</strong><small>Próxima fatura</small><span>›</span></button>
    </article>`;
  }).join('');
}

function forecast(state, selectedMonth) {
  return forecastMonths(state, selectedMonth).map(item => `<button class="forecast-month" data-action="select-month" data-month="${item.key}">
    <small>${monthLabel(item.key)}</small><strong>${item.complete ? money(item.total) : 'Em cálculo'}</strong><span>${item.cardTotal ? `${money(item.cardTotal)} no cartão` : 'Sem cartão comprometido'}</span>
  </button>`).join('');
}

function recentProduction(state) {
  return state.productions.slice(-4).reverse().map(item => `<div class="data-row simple-row"><span class="row-title">Dia ${item.day}</span><strong class="positive">${money(item.amount)}</strong><span class="row-note">${escapeHtml(item.note || fullDate(item.date))}</span><button class="mini-edit" data-action="edit-production" data-id="${item.id}">✎</button></div>`).join('');
}

function recentExpenses(state) {
  return state.expenses.slice(-4).reverse().map(item => `<div class="data-row simple-row"><span class="row-title">${escapeHtml(item.description)}</span><strong class="negative">${money(item.amount)}</strong><span class="row-note">${escapeHtml(item.category)} · ${escapeHtml(item.paymentMethod)}</span><button class="mini-edit" data-action="edit-expense" data-id="${item.id}">✎</button></div>`).join('');
}

export function renderDashboard(root, state, today) {
  const metrics = purposeMetrics(state, today);
  const protectedMetrics = protectedTime(state, metrics.cash);
  const expensesByCategory = monthExpensesByCategory(state, state.selectedMonth);
  const todayLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${today}T12:00:00`)).replace('.', '').toUpperCase();
  root.innerHTML = `
    <nav class="month-navigation"><button class="month-arrow" data-action="previous-month">‹</button><div class="month-tabs">${monthTabs(state.selectedMonth)}</div><button class="month-arrow" data-action="next-month">›</button><span class="today-label">▣ Hoje, ${todayLabel}</span></nav>
    <section class="hero-grid">
      <article class="panel protected-card"><div class="panel-label">◷ TEMPO PROTEGIDO <span title="Dinheiro disponível dividido pelo custo mensal essencial">ⓘ</span></div>${protectedMetrics.complete ? `<strong class="hero-value">${protectedMetrics.days} dias</strong><p>${protectedMetrics.months.toFixed(1).replace('.', ',')} meses de liberdade financeira</p>` : '<strong class="hero-value">EM CÁLCULO</strong><p>Complete suas contas mensais</p>'}<div class="protected-meta"><span>🐷 <small>CAIXA GUARDADO</small><strong class="positive">${money(metrics.cash)}</strong></span><button data-action="manage-bills">▰ <small>CUSTO MENSAL</small><strong>${protectedMetrics.complete ? money(protectedMetrics.monthlyCost) : 'Configurar ›'}</strong></button></div></article>
      <article class="panel purpose-card"><div class="purpose-heading"><div><p>◎ PROPÓSITO — DIA ${metrics.currentDay} DE ${metrics.totalDays}</p><small>${shortDate(state.purpose.startDate)} → ${shortDate(state.purpose.endDate)}</small></div><button class="more-button" data-action="edit-purpose">•••</button></div><strong class="purpose-value">${money(metrics.goal)}</strong><p>${metrics.remainingDays} dias restantes</p><div class="progress"><span style="width:${metrics.progress}%"></span><strong>${metrics.progress.toFixed(2).replace('.', ',')}%</strong></div><div class="inline-actions"><button class="button button-outline" data-action="edit-purpose">✎ Editar</button><button class="button button-outline" data-action="add-commitment">＋ Compromisso</button></div></article>
    </section>
    <section class="metrics-grid">${metricCard('PRODUZIDO', money(metrics.produced), 'positive', '▥', 'view-production')}${metricCard('DESPESAS REALIZADAS', money(metrics.withdrawn), 'negative', '⇩', 'view-expenses')}${metricCard('CAIXA GUARDADO', money(metrics.cash), 'gold', '🐷')}${metricCard('FALTA PRODUZIR', money(metrics.missing), 'neutral', '◎')}</section>
    <section class="panel"><div class="section-title"><div><span class="section-icon">▤</span><h2>COMPROMISSOS DO PROPÓSITO</h2></div><button class="button button-outline small" data-action="add-commitment">＋ Compromisso</button></div><div class="rows">${commitments(state)}</div></section>
    <section class="panel"><div class="section-title"><div><span class="section-icon">▤</span><h2>CONTAS DE ${monthLabel(state.selectedMonth, true).replace(/ 2026$/, '')}</h2></div><button class="button button-outline small" data-action="add-bill">＋ Conta</button></div><div class="rows">${bills(state, expensesByCategory, state.selectedMonth)}</div><div class="section-summary">▣ Previsto no mês: <strong>${protectedMetrics.complete ? money(protectedMetrics.monthlyCost) : 'em cálculo'}</strong></div></section>
    <section class="panel"><div class="section-title"><div><span class="section-icon">▰</span><h2>CARTÕES</h2></div><button class="button button-outline small" data-action="add-card">＋ Cartão</button></div>${cards(state, state.selectedMonth)}</section>
    <section class="panel"><div class="section-title"><div><span class="section-icon">▥</span><h2>PREVISÃO — PRÓXIMOS 3 MESES</h2></div></div><div class="forecast-grid">${forecast(state, state.selectedMonth)}</div><p class="info-callout">ⓘ Adicione contas recorrentes para calcular quando você poderá parar de vender horas.</p></section>
    <section class="two-column-details"><article class="panel"><div class="section-title"><div><span class="section-icon">▥</span><h2>PRODUÇÃO DIÁRIA</h2></div><button class="mini-edit" data-action="add-production">＋</button></div>${recentProduction(state)}<div class="section-action-stack"><button class="button button-secondary full" data-action="view-production">Ver todos os ${state.productions.length} dias</button><button class="button button-outline full" data-action="add-production">＋ Registrar dia</button></div></article><article class="panel"><div class="section-title"><div><span class="section-icon negative">⇩</span><h2>DESPESAS REALIZADAS</h2></div><button class="mini-edit" data-action="add-expense">＋</button></div>${recentExpenses(state)}<button class="button button-outline full" data-action="view-expenses">Ver todas as ${state.expenses.length} despesas</button></article></section>
    <section class="panel pace-card"><div><p>▥ RITMO DO PROPÓSITO</p><strong>${money(metrics.dailyPace)} <small>por dia</small></strong><span>nos próximos ${metrics.remainingDays} dias</span></div><span class="warning-badge">! ATENÇÃO AO RITMO</span></section>
    <button class="plan-button" data-action="plan-months">▣ Planejar próximos meses ›</button>`;
}

export function field(name, label, type = 'text', value = '', options = '', required = true) {
  const requiredAttribute = required ? 'required' : '';
  if (type === 'select') return `<label class="form-field"><span>${label}</span><select name="${name}" ${requiredAttribute}>${options}</select></label>`;
  return `<label class="form-field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${type === 'number' ? 'min="0" step="0.01" inputmode="decimal"' : ''} ${requiredAttribute}></label>`;
}

export function option(value, label, selected = false) { return `<option value="${value}" ${selected ? 'selected' : ''}>${label}</option>`; }
export { escapeHtml };
