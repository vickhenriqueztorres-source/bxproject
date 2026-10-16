# Brief Geral — Fase 3: Dinheiro Real, Caixa Zero Inicial, Depósito Automático, Saque Manual e Torre de Controle Financeira

## 1. Premissas Reais da Operação

1. **Caixa Inicial = R$ 0,00**: O float da plataforma nasce exclusivamente das primeiras movimentações reais (depósitos líquidos menos saques pagos).
2. **Depósitos 100% Automáticos**: O cliente paga e o saldo entra sozinho em segundos após confirmação criptográfica na API do PSP (Mercado Pago), sem intervenção manual.
3. **Política de Taxas (Regra Única)**:
   - **PIX (Depósito)**: **0% de taxa para o cliente** (deposita R$ 100 → recebe R$ 100 em equivalente `*_minor`). A plataforma absorve o custo de ~0,99% do PSP para maximizar conversão (FTD).
   - **Cartão / Outros Métodos LatAm (SPEI, PSE, etc.)**: **Taxa embutida/descontada do cliente** (taxa do PSP de ~3,99%–4,99% + spread de proteção cambial).
   - **Saques**: **Taxa de saque descontada do cliente** (taxa fixa + percentual ou custo de rede em cripto).
   - **Torneios (Arena)**: **Taxa embutida (Rake da Casa)** cobrada direto do saldo da carteira real.
   - **Trading**: Payout dinâmico calibrado pela casa + trava de exposição.
4. **Saques 100% Manuais (Controlados pelo Operador)**:
   - Nenhum centavo sai da conta do Mercado Pago/banco automaticamente.
   - O cliente solicita no site → o saldo dele é **travado na hora** (`available → pending_withdrawal`) → entra na **Fila de Saques do Painel Admin** para conferência e pagamento manual.

---

## 2. Engenharia de Sobrevivência: Como Não Quebrar com Caixa Inicial Zero

Quando o caixa começa em **zero**, o maior risco nos primeiros dias não é técnico — é de **exposição assimétrica (variância)**: se o primeiro cliente depositar R$ 200 e der 4 entradas seguidas de R$ 200 ganhando 85%, ele teria R$ 1.200 de saldo para sacar, enquanto você só tem R$ 200 no Mercado Pago.

Para que seja **matematicamente impossível** a plataforma ficar no negativo, o motor financeiro precisa de **5 travas automáticas**:

### Trava 1 — Teto Dinâmico de Ordem por Reserva Líquida (`Dynamic Max Stake`)
- O sistema calcula em tempo real a **Reserva Livre da Casa (House Net Float)**:
  $$\text{Reserva Livre} = \text{Caixa Real Recebido (PSP)} - \text{Soma dos Saldos Reais de Todos os Clientes}$$
- **Regra do Motor (`POST /contracts` em modo REAL)**:
  - O lucro máximo de uma única ordem (`stake * payout_pct`) nunca pode ultrapassar uma fração segura da Reserva Livre (ou um teto micro de arranque no Dia 1, ex.: máx. R$ 5 a R$ 10 por clique até o pool acumular gordura).
  - Conforme os depósitos entram e a plataforma retém margem, o teto máximo por ordem sobe automaticamente sem você precisar mexer em código.

### Trava 2 — Bloqueio de Risco de Chargeback (Cartão vs. PIX)
- **Problema clássico de fraude**: Golpista deposita R$ 500 no cartão de crédito clonado, faz 2 cliques pequenos e pede saque via PIX. Você paga o PIX e, 15 dias depois, o banco estorna o cartão (chargeback). Você perde os R$ 500 + multa.
- **Regra no Sistema**:
  1. Depósito via **Cartão** tem **Hold de Saque (Janela Anti-Chargeback)** ou limite estrito, e só libera saque após validação de identidade (KYC + titularidade).
  2. Para começar com caixa zero e risco zero de chargeback, você pode habilitar **100% PIX no Brasil no Dia 1** (PIX não tem chargeback de bandeira de cartão) e liberar cartão apenas para contas com KYC verificado.

### Trava 3 — Rollover Obrigatório de 1x (Anti-Lavagem e Anti-Arrependimento com Custo)
- Se o cliente deposita R$ 100 via PIX (onde você absorveu ~R$ 1,00 de taxa do PSP) e pede saque 1 minuto depois sem operar, você pagaria a taxa de entrada à toa.
- **Regra no Sistema**:
  - `volume_operado_real >= 1.0x * total_depositado` para liberar saque gratuito/padrão.
  - Se o cliente quiser sacar sem atingir 1x de giro de trading, o sistema aplica automaticamente uma **taxa administrativa de retirada sem giro (ex.: 10% a 15%)** para cobrir os custos operacionais.

### Trava 4 — Torneios Auto-Financiados (Arena Risco Zero)
- Com caixa zero, nunca crie torneio com "Prêmio Fixo Garantido" se tiver poucos inscritos.
- **Regra da Arena na Fase 3**:
  - Pool Dinâmico: `Prêmio Total = 70% das inscrições pagas` | `Lucro Imediato da Casa = 30% das inscrições pagas` (ou mínimo de $N$ participantes para ativar o torneio; se não atingir, estorna a inscrição no ledger).
  - Resultado: todo torneio alimenta o seu caixa positivamente, com risco zero de prejuízo.

### Trava 5 — Segregação Física `DEMO` vs `REAL` no Banco e no Blnk
- Carteira `DEMO` e Carteira `REAL` têm IDs de ledger e tabelas/colunas completamente separados (`balance_demo_minor` vs `balance_real_minor`).
- No endpoint `POST /contracts`, o modo da conta (`account_mode: 'DEMO' | 'REAL'`) vem validado pelo servidor e debita exclusivamente da carteira correspondente. Contrato `DEMO` jamais gera saldo sacável.

---

## 3. Fluxo de Depósito 100% Automático e Blindado contra Fraude

Nunca confie apenas no payload que chega no webhook (qualquer pessoa pode mandar um `POST /api/webhooks/mercadopago` falso dizendo que pagou R$ 10.000).

### Fluxo "Double-Check" Inviolável:
1. **Criação da Cobrança (`POST /api/deposits`)**:
   - Cliente escolhe valor (ex.: R$ 100) e método (`PIX` ou `CARD`).
   - Se `PIX`: `gross_minor = 10000`, `fee_minor = 0`, `net_credit_minor = 10000` (R$ 100 creditados ao cliente).
   - Se `CARD` (ou outro método com taxa): `gross_minor = 10000`, `fee_minor = 499` (4,99%), `net_credit_minor = 9501` (R$ 95,01 creditados ao cliente — ou soma a taxa no checkout para o cliente pagar R$ 105,25 e receber R$ 100,00).
   - Salva na tabela `deposits` com status `PENDING`, `idempotency_key` e `external_reference = dep_<uuid>`.
   - Chama a API do Mercado Pago e devolve o QR Code PIX (`qr_code` + `qr_code_base64`) direto na tela da Binmax (sem tirar o cliente da sala de trading!).
2. **Recebimento do Webhook (`POST /api/webhooks/mercadopago`)**:
   - **Camada 1**: Valida assinatura HMAC-SHA256 do header `x-signature` + `x-request-id` com o `MP_WEBHOOK_SECRET`.
   - **Camada 2 (Pull Verification)**: Com o `payment_id` recebido, o seu servidor faz um `GET https://api.mercadopago.com/v1/payments/{id}` usando o seu `MP_ACCESS_TOKEN` privado e confirma que:
     - `status === 'approved'`
     - `transaction_amount` bate centavo por centavo com o registro no banco
     - `external_reference` bate com o `deposit.id`
   - **Camada 3 (Idempotência Ácida)**:
     - `UPDATE deposits SET status = 'COMPLETED', psp_payment_id = $1, paid_at = NOW() WHERE id = $2 AND status = 'PENDING' RETURNING *`.
     - Se retornar 0 linhas (webhook repetido do Mercado Pago), ignora e responde `200 OK`.
   - **Camada 4 (Crédito Imediato + WebSocket)**:
     - Credita `net_credit_minor` na carteira `REAL` do usuário no Blnk Ledger (`@psp:mercadopago → @user:{id}:real_available`).
     - Dispara evento WebSocket `deposit_confirmed` → o saldo real do cliente atualiza na hora no topo da sala!

---

## 4. Fluxo de Saques Manuais e Distribuição de Saques

Como você fará os saques manualmente para proteger o caixa:

1. **Solicitação do Cliente (`POST /api/withdrawals`)**:
   - Verifica:
     - Conta tem KYC aprovado (ou CPF/documento válido do mesmo titular do PIX);
     - Atingiu o rollover mínimo (1x do depósito);
     - Respeita o limite mínimo (ex.: R$ 50) e máximo diário (ex.: R$ 1.000 no nível inicial);
     - Não possui outro saque `PENDING` em aberto (evita spam de fila).
   - **Debita/Trava na hora**: Move `amount_minor` de `real_available` para `real_pending_withdrawal` dentro de uma transação com `SELECT ... FOR UPDATE`.
   - Calcula e registra:
     - `requested_minor` (ex.: R$ 100,00)
     - `platform_fee_minor` (ex.: R$ 5,00 ou 3%)
     - `payout_net_minor` (ex.: R$ 95,00 — **este é o valor exato que você vai transferir no PIX**).
2. **Distribuição e Lotes de Saque (No seu Painel Admin)**:
   - Para não travar sua operação nem esvaziar o caixa em horário de pico, os saques entram em **Janelas de Pagamento (Batches)** configuráveis (ex.: pagamentos processados às 12h e às 18h, ou SLA de até 24h úteis).
   - O sistema mostra um **Teto de Distribuição Segura do Dia**:
     - Ex.: *"Hoje entraram R$ 3.000 em depósitos e há R$ 800 em pedidos de saque. Índice de Liquidez: Saudável (26%)."*
   - Ao fazer o PIX manualmente para a chave do cliente:
     - Você clica em **"Confirmar Pagamento"** no Admin e informa o ID/comprovante.
     - O sistema baixa `real_pending_withdrawal → @external:payout` e notifica o cliente (`withdrawal_paid`).
   - Se identificar fraude/abuso ou dados inválidos:
     - Você clica em **"Recusar e Estornar"** (volta para `real_available`) ou **"Congelar para Auditoria"** (`real_locked`).

---

## 5. Torre de Controle (Painel Admin de Gestão Financeira e Clientes)

O painel `/admin/` será expandido com **4 módulos operacionais** para você comandar tudo sozinho:

### Módulo A — Termômetro de Tesouraria e Solvência (Tempo Real)
- **Caixa Líquido no PSP**: Total real que entrou no Mercado Pago (já descontadas as taxas do MP) menos total de saques já pagos.
- **Passivo Total dos Clientes**: Quanto todos os usuários têm somados em `real_available` + `real_reserved` (ordens abertas) + `real_pending_withdrawal`.
- **Reserva Livre da Casa (Seu Lucro Líquido Real)**: $\text{Caixa Líquido PSP} - \text{Passivo Clientes}$. Mostra exatamente quanto do dinheiro no banco já é **seu** sem comprometer o saque de nenhum cliente.
- **Receita de Taxas Acumulada**: Quanto a plataforma já ganhou só em taxas embutidas (saques, cartões, torneios).

### Módulo B — Fila de Saques Manuais (Com Raio-X Anti-Fraude por Pedido)
Em cada pedido de saque da fila, antes de fazer o PIX, você vê num único card:
- Nome, e-mail, CPF/Documento e Chave PIX;
- **Raio-X do Cliente**:
  - Total Depositado (R$) × Total já Sacado (R$);
  - Volume operado (Rollover cumprido: Sim/Não);
  - Quantidade de trades reais, Winrate (%) e P&L líquido;
  - Alertas automáticos (bandeira vermelha se: winrate > 75% com muitas ordens, mesmo IP/device de outra conta, tentativa de saque sem operar, ou chave PIX de terceiro).
- Botões de ação rápida: **[Copiar Chave PIX + Valor Líquido]**, **[Marcar como Pago]**, **[Estornar para Carteira]**, **[Bloquear Conta]**.

### Módulo C — Gestão de Clientes (CRM Financeiro)
- Busca por e-mail/CPF/ID;
- Visualização de saldo Demo e Saldo Real, extrato completo de entradas/saídas e ordens abertas/liquidadas;
- Controles individuais: ajustar limite de stake máxima daquele usuário, exigir KYC, bloquear/desbloquear saque.

### Módulo D — Configuração Dinâmica de Taxas e Travas
- Controle direto pelo Admin (sem precisar fazer deploy):
  - `% Taxa de Saque` e `Taxa Fixa de Saque`;
  - `% Taxa de Depósito Cartão / Internacional`;
  - `Depósito Mínimo` e `Saque Mínimo / Máximo Diário`;
  - `Stake Máximo Real` (global e % sobre a Reserva da Casa).
