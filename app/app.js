import { FinanceRepository } from './repository.js';
import { renderDashboard, field, option, escapeHtml } from './ui.js';
import { addMonths, invoiceKeyForPurchase, toIsoDate, uid } from './date-utils.js';

const previewMode = new URLSearchParams(window.location.search).has('demo');
const repository = new FinanceRepository(previewMode ? null : undefined);
const root = document.getElementById('app');
const dialog = document.getElementById('app-dialog');
const form = document.getElementById('dialog-form');
const dialogBody = document.getElementById('dialog-body');
const dialogTitle = document.getElementById('dialog-title');
const dialogKicker = document.getElementById('dialog-kicker');
const dialogError = document.getElementById('dialog-error');
const submitButton = document.getElementById('dialog-submit');
const newRecordButton = document.getElementById('new-record-button');
const syncButton = document.getElementById('sync-button');
let state;
let submitHandler = null;
let saving = false;

function render() {
  renderDashboard(root, state, toIsoDate());
  root.setAttribute('aria-busy', 'false');
  newRecordButton.classList.remove('hidden');
}

function toast(message, type = 'success') {
  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  element.textContent = message;
  document.getElementById('toast-region').appendChild(element);
  setTimeout(() => element.remove(), 3600);
}

function status(message = '', type = 'info') {
  const element = document.getElementById('app-status');
  element.textContent = message;
  element.className = message ? `app-status status-${type}` : 'app-status hidden';
}

function openDialog({ title, kicker = '', body, submitLabel = 'Salvar', onSubmit }) {
  dialogTitle.textContent = title;
  dialogKicker.textContent = kicker;
  dialogBody.innerHTML = body;
  submitButton.textContent = submitLabel;
  dialogError.classList.add('hidden');
  submitHandler = onSubmit;
  dialog.showModal();
  requestAnimationFrame(() => dialog.querySelector('input, select, button')?.focus());
}

function closeDialog() { if (dialog.open && !saving) dialog.close(); }

function transitionDialog(callback) {
  if (!dialog.open) return callback();
  dialog.close();
  setTimeout(callback, 0);
}

async function persist(message = 'Alteração salva.') {
  const result = await repository.save(state);
  state = result.state;
  render();
  toast(result.synced ? message : `${message} Será sincronizada quando houver internet.`, result.synced ? 'success' : 'info');
}

function showFormError(message) {
  dialogError.textContent = message;
  dialogError.classList.remove('hidden');
}

function valuesOf(formElement) { return Object.fromEntries(new FormData(formElement).entries()); }
function numberOrNull(value) { return value === '' ? null : Number(value); }
function findById(collection, id) { return collection.find(item => item.id === id); }

function purposeDialog() {
  openDialog({ title: 'Editar propósito', kicker: 'PLANO E PERÍODO', body:
    `${field('name', 'Nome do propósito', 'text', state.purpose.name)}<div class="form-grid">${field('startDate', 'Data inicial', 'date', state.purpose.startDate)}${field('endDate', 'Data final', 'date', state.purpose.endDate)}</div><p class="form-help">O dia atual, os dias restantes e o ritmo necessário são recalculados automaticamente.</p>`,
    onSubmit: async data => {
      if (data.endDate < data.startDate) throw new Error('A data final precisa ser posterior à data inicial.');
      Object.assign(state.purpose, data); await persist('Propósito atualizado.');
    }
  });
}

function commitmentDialog(id = '') {
  const item = id ? findById(state.purpose.commitments, id) : { name: '', amount: '', dueDate: '', paid: false };
  openDialog({ title: id ? 'Editar compromisso' : 'Novo compromisso', kicker: 'PROPÓSITO', body:
    `${field('name', 'Compromisso', 'text', item.name)}<div class="form-grid">${field('amount', 'Valor', 'number', item.amount)}${field('dueDate', 'Vencimento', 'date', item.dueDate)}</div><label class="check-field"><input name="paid" type="checkbox" ${item.paid ? 'checked' : ''}> Compromisso já pago</label>${id ? '<button class="danger-link" type="button" data-action="delete-current-commitment">Excluir compromisso</button>' : ''}`,
    onSubmit: async (data, formData) => {
      const payload = { ...item, id: item.id || uid('commit'), name: data.name, amount: Number(data.amount), dueDate: data.dueDate, paid: formData.has('paid') };
      if (id) Object.assign(item, payload); else state.purpose.commitments.push(payload);
      await persist(id ? 'Compromisso atualizado.' : 'Compromisso adicionado.');
    }
  });
  dialog.dataset.currentId = id;
}

function billDialog(id = '') {
  const item = id ? findById(state.recurringBills, id) : { name: '', type: 'fixed', amount: null, dueDay: null, active: true };
  const monthOverride = id ? state.monthlyOverrides[state.selectedMonth]?.[id] ?? '' : '';
  const types = option('fixed', 'Fixa', item.type === 'fixed') + option('estimated', 'Variável estimada', item.type === 'estimated') + option('budget', 'Orçamento mensal', item.type === 'budget');
  openDialog({ title: id ? 'Editar conta mensal' : 'Nova conta mensal', kicker: 'PREVISIBILIDADE', body:
    `${field('name', 'Nome da conta', 'text', item.name)}${field('type', 'Tipo', 'select', '', types)}<div class="form-grid">${field('amount', item.type === 'budget' ? 'Limite mensal padrão' : 'Previsão mensal padrão', 'number', item.amount ?? '')}${field('dueDay', 'Dia do vencimento', 'number', item.dueDay ?? '')}</div>${id ? field('monthAmount', `Valor real somente em ${state.selectedMonth}`, 'number', monthOverride) : ''}<p class="form-help">A previsão padrão se repete. Quando a conta chegar, informe o valor real apenas para o mês selecionado.</p>${id ? '<button class="danger-link" type="button" data-action="delete-current-bill">Excluir conta</button>' : ''}`,
    onSubmit: async data => {
      const payload = { ...item, id: item.id || uid('bill'), name: data.name, type: data.type, amount: numberOrNull(data.amount), dueDay: numberOrNull(data.dueDay), active: true };
      if (payload.dueDay && (payload.dueDay < 1 || payload.dueDay > 31)) throw new Error('Informe um vencimento entre os dias 1 e 31.');
      if (id) {
        Object.assign(item, payload);
        state.monthlyOverrides[state.selectedMonth] ||= {};
        if (data.monthAmount === '') delete state.monthlyOverrides[state.selectedMonth][id];
        else state.monthlyOverrides[state.selectedMonth][id] = Number(data.monthAmount);
      } else state.recurringBills.push(payload);
      await persist(id ? 'Conta atualizada.' : 'Conta adicionada.');
    }
  });
  dialog.dataset.currentId = id;
}

function cardDialog(id = '') {
  const card = id ? findById(state.cards, id) : { name: '', closingDay: 30, dueDay: 14, purchases: [], paidInvoices: [] };
  openDialog({ title: id ? 'Editar cartão' : 'Novo cartão', kicker: 'CICLO DE FATURA', body:
    `${field('name', 'Nome do cartão', 'text', card.name)}<div class="form-grid">${field('closingDay', 'Dia do fechamento', 'number', card.closingDay)}${field('dueDay', 'Dia do vencimento', 'number', card.dueDay)}</div><p class="form-help">A data de cada compra define automaticamente em qual fatura ela entrará.</p>${id ? '<button class="danger-link" type="button" data-action="delete-current-card">Excluir cartão</button>' : ''}`,
    onSubmit: async data => {
      const payload = { ...card, id: card.id || uid('card'), name: data.name, closingDay: Number(data.closingDay), dueDay: Number(data.dueDay) };
      if ([payload.closingDay, payload.dueDay].some(day => day < 1 || day > 31)) throw new Error('Fechamento e vencimento precisam estar entre os dias 1 e 31.');
      if (id) Object.assign(card, payload); else state.cards.push(payload);
      await persist(id ? 'Cartão atualizado.' : 'Cartão adicionado.');
    }
  });
  dialog.dataset.currentId = id;
}

function productionDialog(id = '') {
  const item = id ? findById(state.productions, id) : { date: toIsoDate(), day: state.productions.length + 1, amount: '', note: '' };
  openDialog({ title: id ? 'Editar produção' : 'Registrar produção', kicker: 'RESULTADO DO DIA', body:
    `<div class="form-grid">${field('date', 'Data', 'date', item.date)}${field('day', 'Dia do propósito', 'number', item.day)}</div>${field('amount', 'Valor líquido construído', 'number', item.amount)}${field('note', 'Observação', 'text', item.note || '')}${id ? '<button class="danger-link" type="button" data-action="delete-current-production">Excluir registro</button>' : ''}`,
    onSubmit: async data => {
      const payload = { ...item, id: item.id || uid('prod'), date: data.date, day: Number(data.day), amount: Number(data.amount), note: data.note };
      if (id) Object.assign(item, payload); else state.productions.push(payload);
      state.productions.sort((a, b) => a.date.localeCompare(b.date)); await persist(id ? 'Produção atualizada.' : 'Produção registrada.');
    }
  });
  dialog.dataset.currentId = id;
}

function expenseDialog(id = '') {
  const item = id ? findById(state.expenses, id) : { date: toIsoDate(), description: '', amount: '', category: 'Mercado', paymentMethod: 'Pix', source: 'purpose', receiptUrl: '' };
  const categories = ['Mercado', 'Alimentação', 'Casa', 'Saúde', 'Cuidados pessoais', 'Transporte', 'Trabalho', 'Assinaturas', 'Lazer', 'Outros'].map(value => option(value, value, item.category === value)).join('');
  const payments = ['Pix', 'Dinheiro', 'Débito'].map(value => option(value, value, item.paymentMethod === value)).join('');
  const sources = option('purpose', 'Caixa do propósito', item.source === 'purpose') + option('checking', 'Conta corrente', item.source === 'checking');
  openDialog({ title: id ? 'Editar despesa' : 'Nova despesa', kicker: 'DINHEIRO QUE SAIU', body:
    `<div class="form-grid">${field('date', 'Data', 'date', item.date)}${field('amount', 'Valor', 'number', item.amount)}</div>${field('description', 'Descrição', 'text', item.description)}<div class="form-grid">${field('category', 'Categoria', 'select', '', categories)}${field('paymentMethod', 'Pagamento', 'select', '', payments)}</div>${field('source', 'Saiu de onde?', 'select', '', sources)}<label class="form-field"><span>Comprovante (opcional)</span><input name="receipt" type="file" accept="image/*,.pdf"></label>${id ? '<button class="danger-link" type="button" data-action="delete-current-expense">Excluir despesa</button>' : ''}`,
    onSubmit: async (data, formData) => {
      const recordId = item.id || uid('expense');
      const file = formData.get('receipt');
      let receiptUrl = item.receiptUrl || '';
      if (file?.size) receiptUrl = await repository.uploadReceipt(file, recordId);
      const payload = { ...item, id: recordId, date: data.date, description: data.description, amount: Number(data.amount), category: data.category, paymentMethod: data.paymentMethod, source: data.source, receiptUrl };
      if (id) Object.assign(item, payload); else state.expenses.push(payload);
      await persist(id ? 'Despesa atualizada.' : 'Despesa registrada.');
    }
  });
  dialog.dataset.currentId = id;
}

function purchaseDialog(cardId = '', purchaseId = '') {
  const card = findById(state.cards, cardId || state.cards[0]?.id);
  if (!card) return cardDialog();
  const item = purchaseId ? findById(card.purchases, purchaseId) : { date: toIsoDate(), description: '', amount: '', category: 'work', receiptUrl: '' };
  const cards = state.cards.map(value => option(value.id, value.name, value.id === card.id)).join('');
  const categories = option('work', 'Custos do trabalho', item.category === 'work') + option('daily', 'Despesas do dia a dia', item.category === 'daily');
  openDialog({ title: purchaseId ? 'Editar compra' : 'Compra no cartão', kicker: 'FATURA AUTOMÁTICA', body:
    `${field('cardId', 'Cartão', 'select', '', cards)}<div class="form-grid">${field('date', 'Data da compra', 'date', item.date)}${field('amount', 'Valor', 'number', item.amount)}</div>${field('description', 'Descrição', 'text', item.description)}${field('category', 'Classificação', 'select', '', categories)}<p class="form-help">O fechamento do cartão define automaticamente a fatura.</p><label class="form-field"><span>Comprovante (opcional)</span><input name="receipt" type="file" accept="image/*,.pdf"></label>${purchaseId ? '<button class="danger-link" type="button" data-action="delete-current-purchase">Excluir compra</button>' : ''}`,
    onSubmit: async (data, formData) => {
      const targetCard = findById(state.cards, data.cardId);
      const recordId = item.id || uid('purchase');
      const file = formData.get('receipt');
      let receiptUrl = item.receiptUrl || '';
      if (file?.size) receiptUrl = await repository.uploadReceipt(file, recordId);
      const payload = { ...item, id: recordId, date: data.date, amount: Number(data.amount), description: data.description, category: data.category, receiptUrl };
      if (purchaseId && targetCard.id === card.id) Object.assign(item, payload);
      else { if (purchaseId) card.purchases = card.purchases.filter(value => value.id !== purchaseId); targetCard.purchases.push(payload); }
      await persist(purchaseId ? 'Compra atualizada.' : `Compra adicionada à fatura de ${invoiceKeyForPurchase(payload.date, targetCard.closingDay)}.`);
    }
  });
  dialog.dataset.currentId = purchaseId;
  dialog.dataset.cardId = card.id;
}

function newRecordDialog() {
  openDialog({ title: 'Novo registro', kicker: 'O QUE ACONTECEU?', submitLabel: 'Continuar', body:
    `<div class="record-type-grid"><button type="button" data-action="choose-record" data-type="production"><span>▥</span><strong>Produção</strong><small>Dinheiro construído trabalhando</small></button><button type="button" data-action="choose-record" data-type="expense"><span>⇩</span><strong>Despesa</strong><small>Dinheiro que saiu no Pix, débito ou espécie</small></button><button type="button" data-action="choose-record" data-type="purchase"><span>▰</span><strong>Compra no cartão</strong><small>Entra automaticamente na fatura correta</small></button></div>`, onSubmit: null
  });
  submitButton.classList.add('hidden');
}

function listDialog(kind, cardId = '', invoiceKey = '') {
  let title, rows;
  if (kind === 'production') { title = 'Produção diária'; rows = state.productions.slice().reverse().map(item => `<button class="list-action" data-action="edit-production" data-id="${item.id}"><span>Dia ${item.day}<small>${escapeHtml(item.note || item.date)}</small></span><strong>${item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></button>`).join(''); }
  else if (kind === 'expenses') { title = 'Despesas realizadas'; rows = state.expenses.slice().reverse().map(item => `<button class="list-action" data-action="edit-expense" data-id="${item.id}"><span>${escapeHtml(item.description)}<small>${escapeHtml(item.category)} · ${escapeHtml(item.paymentMethod)}</small></span><strong>${item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></button>`).join(''); }
  else { const card = findById(state.cards, cardId); title = `Compras — ${invoiceKey}`; rows = card.purchases.filter(item => invoiceKeyForPurchase(item.date, card.closingDay) === invoiceKey).map(item => `<button class="list-action" data-action="edit-purchase" data-id="${item.id}" data-card-id="${card.id}"><span>${escapeHtml(item.description)}<small>${item.date} · ${item.category === 'work' ? 'Trabalho' : 'Dia a dia'}</small></span><strong>${item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></button>`).join(''); }
  openDialog({ title, kicker: 'HISTÓRICO EDITÁVEL', body: `<div class="dialog-list">${rows || '<p class="empty-state">Nenhum registro nesta seleção.</p>'}</div>`, submitLabel: 'Fechar', onSubmit: async () => {} });
}

async function deleteCurrent(type) {
  const id = dialog.dataset.currentId;
  if (!confirm('Excluir definitivamente este registro?')) return;
  if (type === 'commitment') state.purpose.commitments = state.purpose.commitments.filter(item => item.id !== id);
  if (type === 'bill') state.recurringBills = state.recurringBills.filter(item => item.id !== id);
  if (type === 'card') state.cards = state.cards.filter(item => item.id !== id);
  if (type === 'production') state.productions = state.productions.filter(item => item.id !== id);
  if (type === 'expense') state.expenses = state.expenses.filter(item => item.id !== id);
  if (type === 'purchase') { const card = findById(state.cards, dialog.dataset.cardId); card.purchases = card.purchases.filter(item => item.id !== id); }
  closeDialog(); await persist('Registro excluído.');
}

async function handleAction(action, target) {
  const id = target.dataset.id || '';
  if (action === 'close-dialog') return closeDialog();
  if (action === 'edit-purpose') return purposeDialog();
  if (action === 'add-commitment') return commitmentDialog();
  if (action === 'edit-commitment') return commitmentDialog(id);
  if (action === 'add-bill' || action === 'manage-bills') return billDialog();
  if (action === 'edit-bill') return billDialog(id);
  if (action === 'add-card') return cardDialog();
  if (action === 'edit-card') return cardDialog(id);
  if (action === 'add-production') return productionDialog();
  if (action === 'edit-production') return transitionDialog(() => productionDialog(id));
  if (action === 'add-expense') return expenseDialog();
  if (action === 'edit-expense') return transitionDialog(() => expenseDialog(id));
  if (action === 'edit-purchase') return transitionDialog(() => purchaseDialog(target.dataset.cardId, id));
  if (action === 'view-production') return listDialog('production');
  if (action === 'view-expenses') return listDialog('expenses');
  if (action === 'view-purchases') return listDialog('purchases', id, target.dataset.invoice);
  if (action === 'select-month') { state.selectedMonth = target.dataset.month; render(); return; }
  if (action === 'previous-month') { state.selectedMonth = addMonths(state.selectedMonth, -1); render(); return; }
  if (action === 'next-month') { state.selectedMonth = addMonths(state.selectedMonth, 1); render(); return; }
  if (action === 'plan-months') { root.querySelector('.forecast-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (action === 'toggle-invoice-paid') { const card = findById(state.cards, id); const key = target.dataset.invoice; card.paidInvoices = card.paidInvoices.includes(key) ? card.paidInvoices.filter(value => value !== key) : [...card.paidInvoices, key]; await persist(card.paidInvoices.includes(key) ? 'Fatura marcada como paga.' : 'Fatura reaberta.'); return; }
  if (action === 'choose-record') {
    const type = target.dataset.type;
    transitionDialog(() => {
      if (type === 'production') productionDialog();
      if (type === 'expense') expenseDialog();
      if (type === 'purchase') purchaseDialog();
    });
    return;
  }
  if (action?.startsWith('delete-current-')) return deleteCurrent(action.replace('delete-current-', ''));
}

document.addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target) handleAction(target.dataset.action, target).catch(error => toast(error.message, 'error')); });
newRecordButton.addEventListener('click', newRecordDialog);
syncButton.addEventListener('click', async () => { syncButton.classList.add('spinning'); status('Sincronizando com a nuvem…'); try { state = await repository.load(); render(); toast('Dados sincronizados.'); } catch (error) { toast(error.message, 'error'); } finally { syncButton.classList.remove('spinning'); status(); } });

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!submitHandler) return;
  saving = true; submitButton.disabled = true; submitButton.textContent = 'Salvando…'; dialogError.classList.add('hidden');
  try { const formData = new FormData(form); await submitHandler(Object.fromEntries(formData.entries()), formData); dialog.close(); }
  catch (error) { showFormError(error.message); }
  finally { saving = false; submitButton.disabled = false; submitButton.textContent = 'Salvar'; submitButton.classList.remove('hidden'); }
});

dialog.addEventListener('close', () => { submitHandler = null; dialog.dataset.currentId = ''; dialog.dataset.cardId = ''; submitButton.classList.remove('hidden'); });
window.addEventListener('offline', () => status('Sem internet. As alterações ficam salvas neste aparelho.', 'warning'));
window.addEventListener('online', () => { status('Internet restaurada. Toque em sincronizar para atualizar a nuvem.', 'success'); setTimeout(() => status(), 5000); });

async function start() {
  try {
    state = await repository.load();
    render();
    if (repository.lastWarning) status(repository.lastWarning, 'warning');
  }
  catch (error) { root.innerHTML = `<section class="fatal-state"><h2>Não foi possível abrir o painel</h2><p>${escapeHtml(error.message)}</p><button class="button button-primary" onclick="location.reload()">Tentar novamente</button></section>`; }
}

start();
