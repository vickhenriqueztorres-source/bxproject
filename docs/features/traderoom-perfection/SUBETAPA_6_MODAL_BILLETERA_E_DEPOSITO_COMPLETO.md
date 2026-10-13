# SUBETAPA 6: BILLETERA INSTITUCIONAL, DEPÓSITO E HISTÓRICO DE TRANSAÇÕES

> **Orquestrador:** `tech-lead-orchestrator`  
> **Agentes Envolvidos:** `iq-fidelity-reviewer`, `compliance-risk-reviewer`, `financial-correctness-reviewer`, `surgical-frontend-agent`  
> **Skills Aplicadas:** `01-project-context`, `02-financial-invariants`, `12-tokens-binmax`, `13-textos-es`, `14-teste-de-sobreposicao`

---

## 1. Objetivo Visual e Funcional
Construir a experiência completa de gestão financeira (**Billetera**) em estrita conformidade com a **Imagem 3**:

1. **Visão Geral da Billetera:**
   - Título: `Billetera` com subtítulo *"Gestiona tus fondos, deposita y consulta tu historial de transacciones."*
   - Cards de resumo de saldo no topo direito:
     - `Saldo disponible: $9,603.75` (em verde neon e tipografia grande).
     - `Saldo en operaciones: $0.00` (com ícone de informação `ⓘ`).
2. **Abas Superiores:**
   - `Depositar` (ativa, com linha indicadora verde).
   - `Métodos de pago` (gerenciamento de cartões e contas salvas).
   - `Historial` (extrato completo de transações).
3. **Fluxo de Depósito em 3 Passos (Coluna Esquerda):**
   - **Passo 1: Selecionar Método de Pagamento:**
     - Cartão de crédito / débito (Visa, Mastercard, Maestro).
     - Transferência bancária (Local ou internacional).
     - Criptomoedas (Bitcoin, USDT, Ethereum e mais).
     - Billeteras digitais (Skrill, Neteller, AdvCash).
   - **Passo 2: Ingressar o Monto:**
     - Botões rápidos com valores predefinidos: `$50`, `$100` (selecionado por padrão com borda verde), `$250`, `$500`, `$1,000`, `$5,000`.
     - Campo de valor personalizado com validação de piso e teto (Mínimo $10 | Máximo $10,000).
   - **Passo 3: Dados do Pagamento:**
     - Inputs para Número do Cartão, Validade (`MM/AA`) e CVV com máscara e proteção contra cópia inadvertida.
   - **Botão de Ação Primária:**
     - Botão verde largo `Depositar $100` com ícone de cadeado.
     - Legenda de segurança: *"Pago seguro y cifrado"* com ícone de escudo.
4. **Historial de Transacciones (Coluna Direita):**
   - Dropdown de filtro: `Todos ▾`.
   - Tabela com colunas: `Fecha y hora`, `Tipo` (Depósito com seta verde para baixo, Retiro com seta vermelha para cima), `Método` (ícones Visa, Banco, USDT, Skrill, BTC), `Monto` e `Estado` (Pill verde com texto `Completado`).
   - Paginação inferior limpa (`< 1 2 3 >`).

---

## 2. Escopo Cirúrgico da Subetapa

### 2.1 Lista Fechada de Arquivos Impactados
- `apps/web/src/wallet/BilleteraModal.tsx` (Componente principal da tela de Billetera/Carteira).
- `apps/web/src/wallet/DepositForm.tsx` (Formulário dos 3 passos de depósito com presets).
- `apps/web/src/wallet/TransactionHistoryTable.tsx` (Tabela de extrato e paginação).
- `apps/web/src/styles.css` (Regras de estilo escopadas dentro de `.theme-binmax .billetera-view`).
- `apps/web/src/trade/billetera.unit.test.ts` (Testes da carteira e depósito).

### 2.2 O que Muda
- O modal simplificado de depósito é substituído pela tela rica e profissional da Imagem 3.
- Integração da recarga demo instantânea (+US$ 10.000) e simulação de métodos de pagamento sem fricção.

### 2.3 O que NÃO Muda
- Em ambiente de produção, todo depósito integra com o Blnk Ledger (`POST /deposits`).
- Os saldos reais continuam auditados e sem criação de dinheiro no frontend.

---

## 3. Matriz de Testes Rigorosos

### 3.1 Testes Unitários
- Seleção de métodos de pagamento altera os campos exigidos dinamicamente.
- Clique nos presets de valor ($50 a $5,000) atualiza o texto do botão primário (`Depositar $500`).
- Formatação dos valores de transação (+$500.00 em verde para depósitos e -$250.00 em vermelho para saques).

### 3.2 Testes de Estresse
- Renderização de histórico com 100 transações com paginação instantânea sem travamento de render.

### 3.3 Testes de Caos
- Tentativa de submeter valor abaixo de $10 ou acima de $10,000: o formulário bloqueia com mensagem em espanhol neutro.
- Perda de conexão durante o clique em Depositar: o botão desabilita e exibe erro amigável sem duplicar a transação.

### 3.4 Testes de Segurança
- Sanitização rigorosa de dados de cartão (CVV nunca é persistido em `localStorage`).

### 3.5 Testes de Regressão
- O fechamento do modal restaura o foco da tela principal sem alterar o estado do gráfico ou dos contratos abertos.

---

## 4. Critérios de Aceite (Gate de Saída)
1. Billetera idêntica à Imagem 3 em layout, espaçamentos e hierarquia visual.
2. Presets e formulário de depósito funcionando com recarga de saldo demo e integração com o ledger.
3. Tabela de transações com histórico real renderizado perfeitamente.
4. `billetera.unit.test.ts` 100% verde.
