# Painel Financeiro — Tempo Protegido

PWA pessoal para organizar propósito financeiro, contas recorrentes, produção diária, despesas, cartões, faturas e previsibilidade dos próximos meses.

## Objetivo

O painel responde rapidamente:

- quanto já foi produzido;
- quanto saiu em despesas;
- quanto permanece guardado;
- quanto falta para o propósito;
- qual ritmo diário é necessário;
- quais contas e faturas já estão comprometidas;
- quanto tempo o caixa consegue proteger.

## Publicação

- Produção: `https://felipedom10m.github.io/painel-financeiro`
- Hospedagem: GitHub Pages
- Instalação: PWA pelo navegador
- Nuvem: Supabase

A PWA instalada não é uma APK. Após a publicação, o service worker baixa a nova versão pelo mesmo domínio.

## Estrutura

```text
index.html                 Estrutura principal e inicialização do Supabase
style.css                  Design responsivo mobile-first
manifest.json              Instalação da PWA
service-worker.js          Atualização e funcionamento offline
app/app.js                 Orquestração, eventos e formulários
app/ui.js                  Componentes e renderização
app/calculations.js        Cálculos financeiros puros
app/date-utils.js          Datas, meses e ciclos de fatura
app/default-state.js       Estado inicial com os números reais do propósito
app/repository.js          Persistência local, Supabase e comprovantes
tests/                     Testes de cálculos, cliques e responsividade
```

## Regras principais

### Propósito

- Meta é a soma dos compromissos.
- Dia atual e dias restantes são calculados pelas datas inicial e final.
- Falta produzir = meta − produção acumulada.
- Caixa guardado = produção − despesas cuja origem é o propósito.
- Ritmo diário = falta produzir ÷ dias restantes.

### Contas mensais

- `Fixa`: repete o valor mensal.
- `Variável estimada`: usa uma previsão e aceita um valor real por mês.
- `Orçamento`: acumula despesas da categoria e compara com um limite mensal.

### Cartão

- Cada cartão possui dia de fechamento e vencimento.
- Compra antes do fechamento entra na fatura seguinte.
- Compra no dia do fechamento ou depois entra na fatura posterior.
- Faturas pagas ficam arquivadas e podem ser reabertas.

### Tempo protegido

Só é calculado quando todas as contas recorrentes ativas têm valor previsto. Até isso acontecer, o painel mostra `Em cálculo`, sem inventar números.

## Persistência e substituição da versão antiga

A nova aplicação grava um snapshot próprio no Supabase e no `localStorage`. Na primeira sincronização válida, remove as movimentações e comprovantes da interface antiga, conforme a decisão de substituir definitivamente “Gastos pessoais” e “Marketing”.

Se o Supabase não responder, o painel continua funcionando no aparelho e exibe uma faixa informando que a nuvem ainda não confirmou a sincronização.

## Testes

```bash
npm install
npm run check
npm test
npm run test:e2e
```

Os testes visuais usam as larguras 320, 390, 768 e 1280 px. Também verificam ausência de rolagem horizontal, abertura dos principais formulários e inclusão de compra na fatura correta.

## Desenvolvimento local

```bash
python3 -m http.server 4173
```

Abra `http://127.0.0.1:4173/?demo=1` para usar dados locais sem alterar a nuvem.

## Segurança

A chave pública (`anon`/`publishable`) pode existir no frontend, mas o Supabase deve possuir políticas de acesso adequadas. O painel contém dados financeiros pessoais e não deve depender de tabelas ou arquivos publicamente graváveis sem restrições.
