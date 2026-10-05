export function createDefaultState() {
  return {
    version: 2,
    selectedMonth: '2026-10',
    purpose: {
      id: 'purpose_main', name: 'Meu propósito', startDate: '2026-09-23', endDate: '2026-11-01',
      commitments: [
        { id: 'commit_rent', name: 'Aluguel', amount: 4400, dueDate: '', paid: false },
        { id: 'commit_car', name: 'Documento do carro', amount: 3500, dueDate: '', paid: false },
        { id: 'commit_invoice', name: 'Fatura', amount: 1200, dueDate: '2026-10-14', paid: false }
      ]
    },
    productions: [
      [1, 217.5, ''], [2, 32, ''], [3, 263, ''], [4, 331, ''], [5, 305, ''], [6, 361.5, ''],
      [7, 267.5, ''], [8, 427.62, ''], [9, 0, 'Placa'], [10, 380, '389 - 9 combustível'],
      [11, 399, '408 - 9 pedágio'], [12, 0, 'Eleição']
    ].map(([day, amount, note], index) => ({ id: `prod_${day}`, date: `2026-${index < 8 ? '09' : '10'}-${String(index < 8 ? 23 + index : index - 7).padStart(2, '0')}`, day, amount, note })),
    expenses: [
      ['Red Bull', 20, 'Alimentação'], ['Mercado inicial', 14, 'Mercado'], ['Uber', 20, 'Transporte'],
      ['Lavagem', 60, 'Trabalho'], ['Café domingo', 23, 'Alimentação'], ['Tempero', 25, 'Mercado'],
      ['Mercadão', 127.78, 'Mercado'], ['Perfume', 23, 'Cuidados pessoais'], ['Impressão', 14, 'Trabalho'],
      ['Almoço', 28, 'Alimentação'], ['Produtos naturais', 45, 'Saúde'], ['Cuidados pessoais', 148, 'Cuidados pessoais'],
      ['Ashwagandha', 45, 'Saúde'], ['Impressão', 28, 'Trabalho'], ['Pedágio', 9, 'Trabalho'],
      ['Lanche', 40, 'Alimentação'], ['Dipirona', 10, 'Saúde'], ['Coca-Cola', 6, 'Alimentação']
    ].map(([description, amount, category], index) => ({ id: `expense_${index + 1}`, date: '2026-10-04', description, amount, category, paymentMethod: 'Pix', source: 'purpose', receiptUrl: '' })),
    recurringBills: [
      { id: 'bill_rent', name: 'Aluguel', type: 'fixed', amount: 4400, dueDay: null, active: true },
      { id: 'bill_gym', name: 'Academia', type: 'fixed', amount: null, dueDay: null, active: true },
      { id: 'bill_water', name: 'Água', type: 'estimated', amount: null, dueDay: null, active: true },
      { id: 'bill_energy', name: 'Energia', type: 'estimated', amount: null, dueDay: null, active: true },
      { id: 'bill_internet', name: 'Internet', type: 'fixed', amount: null, dueDay: null, active: true },
      { id: 'bill_market', name: 'Mercado', type: 'budget', amount: null, dueDay: null, active: true }
    ],
    cards: [{
      id: 'card_main', name: 'Cartão principal', closingDay: 30, dueDay: 14,
      purchases: [
        ['Combustível dia 10', 111, '2026-09-30', 'work'], ['Combustível dia 11', 50, '2026-10-01', 'work'],
        ['Combustível dia 12', 142, '2026-10-02', 'work'], ['Fixador cabelo', 40, '2026-10-02', 'daily'],
        ['Café', 20, '2026-10-02', 'daily'], ['Mistura', 84, '2026-10-03', 'daily'],
        ['Café da manhã', 34, '2026-10-04', 'daily']
      ].map(([description, amount, date, category], index) => ({ id: `purchase_${index + 1}`, description, amount, date, category, receiptUrl: '' })),
      paidInvoices: []
    }],
    monthlyOverrides: {},
    settings: { legacyPurged: false, updatedAt: null }
  };
}
