# Trading Platform Architecture Playbook (broker-architect-agent)

Este manual consolida os padrões de engenharia e modelagem quantitativa para a arquitetura de sistemas de corretoras de derivativos e opções de alta frequência.

---

## 1. Modelagem Estocástica de Preços OTC (Ornstein-Uhlenbeck)

### 1.1 Fundamentação Matemática
Um processo de Wiener puro (Passeio Aleatório / Browniano Geométrico) sofre de drift acumulativo e variância proporcional ao tempo ($Var(X_t) \propto t$), o que fatalmente levaria as cotações a patamares irreais ou absurdos ao longo de semanas.
Para ativos OTC sintéticos operados continuamente, a equação diferencial estocástica (SDE) obrigatória é o **Processo de Ornstein-Uhlenbeck**:

$$dX_t = \theta (\mu - X_t) dt + \sigma X_t dW_t$$

Onde:
- $\mu$: Preço de ancoragem (base price).
- $\theta > 0$: Velocidade de reversão à média. Retorna a cotação em direção a $\mu$ quando há afastamento excessivo.
- $\sigma$: Volatilidade estocástica instantânea.
- $dW_t = \epsilon \sqrt{dt}$, com $\epsilon \sim \mathcal{N}(0, 1)$.

### 1.2 Geração Criptográfica Box-Muller (CSPRNG)
Para garantir imprevisibilidade completa contra bots estatísticos, $\epsilon$ é obtido via Transformação Box-Muller alimentada por CSPRNG do sistema operacional (`crypto.randomBytes(8)`):

$$u_1, u_2 \in (0, 1]$$
$$Z_0 = \sqrt{-2 \ln u_1} \cos(2\pi u_2)$$

Qualquer tentativa de utilizar `Math.random()` resulta em vulnerabilidade crítica (V8 xoroshiro128+ pode ser predito com menos de 20 amostras).

---

## 2. Engenharia de Solvência Pré-Ordem (Teto de Solvência de 3% Float Cap)

### 2.1 Teoria da Ruína e Controle de Exposição
Uma corretora de opções binárias com payout de 85% possui vantagem matemática teórica de:
$$\text{Edge} = 1 - 0.5 \times (1 + 0.85) = +7.5\%$$

No entanto, no regime de curto prazo (velas de 1 minuto), a correlação de ordens (efeito manada ou traders operando a mesma sala de sinais) cria assimetria extrema. Se 90% do volume for alocado em "CALL" e a vela fechar em alta, a corretora sofrerá um drawdown catastrófico.

### 2.2 O Teto de Solvência (Solvency Gate)
O teto de risco impõe que o pagamento potencial máximo líquido da corretora em uma única vela de expiração não pode ultrapassar **3% do total de float de depósito**:

$$\text{Risco Adicional} = \lfloor \text{Stake}_{\text{minor}} \times 0.85 \rfloor$$
$$\text{Exposição Acumulada}_{\text{vela, dir}} + \text{Risco Adicional} \le \lfloor \text{Float Total}_{\text{minor}} \times 0.03 \rfloor$$

### 2.3 Execução Sub-Milissegundo via Lua Script em Redis
Para evitar a vulnerabilidade clássica de Time-of-Check to Time-of-Use (TOCTOU), a leitura do teto e a reserva do montante são executadas atomicamente em um script Lua no Redis:
- Leitura do float de depósito.
- Cálculo do cap de 3%.
- Leitura da exposição acumulada da chave `risk:candle:{symbol}:{expiry_bucket}:{direction}`.
- Incremento imediato se dentro do teto, ou rejeição com erro `ERR_RISK_CAP_EXCEEDED` sem afetar a chave.

---

## 3. Protocolo TradingView UDF (Universal Data Feed)

### 3.1 Arquitetura de Duplo Canal
O TradingView Lightweight Charts opera de forma desacoplada do motor:
1. **Histórico Retroativo (HTTP REST):**
   - `GET /api/v1/chart/config`: Metadados de resoluções suportadas (`["1S", "1", "5", "15", "60"]`).
   - `GET /api/v1/chart/time`: Sincronização de relógio em segundos UTC.
   - `GET /api/v1/chart/symbols`: Detalhes do ativo (precisão decimal, regime 24x7).
   - `GET /api/v1/chart/history`: Barras passadas formatadas em arrays `{ s: "ok", t, o, h, l, c, v }`.
2. **Atualização em Tempo Real (WebSocket Gateway):**
   - Transmissão de ticks a cada 250ms–500ms via canal Pub/Sub no Redis.
   - O cliente executa `candleSeries.update()` atualizando o pavio e corpo da vela ativa.
   - Descarte estrito no frontend de qualquer tick onde `sequence <= lastSequence`.

---

## 4. Contabilidade de Partidas Dobradas (Blnk Ledger)

### 4.1 Invariante de Saldo Único (I-01)
Proibido manter saldos em colunas `balance` no PostgreSQL ou variáveis no Redis. Todo dinheiro reside e é movimentado exclusivamente no Blnk Finance Core através de diários contábeis de partidas dobradas.

### 4.2 Mapeamento de Transações
1. **Onboarding:**
   - Débito: `@broker_float`
   - Crédito: `@user_{id}:available` (US$ 10.000,00 demo / `1_000_000` centavos).
   - Referência idempotente: `onboarding:{user_id}`.
2. **Abertura de Contrato (Reserva):**
   - Débito: `@user_{id}:available`
   - Crédito: `@user_{id}:reserved` (valor `stake_minor`).
   - Referência idempotente: `reserve:{contract_id}`.
3. **Liquidação - Derrota (LOSS):**
   - Débito: `@user_{id}:reserved`
   - Crédito: `@house_revenue` (valor `stake_minor`).
   - Referência: `settlement:{contract_id}:LOSS`.
4. **Liquidação - Vitória (WIN):**
   - Retorno da Garantia: Débito `@user_{id}:reserved` $\to$ Crédito `@user_{id}:available` (valor `stake_minor`).
   - Crédito do Lucro: Débito `@house_payout` $\to$ Crédito `@user_{id}:available` (valor `profit_minor`).
   - Referências: `settlement:{contract_id}:WIN_STAKE` e `settlement:{contract_id}:WIN_PROFIT`.
5. **Liquidação - Empate (DRAW):**
   - Débito: `@user_{id}:reserved`
   - Crédito: `@user_{id}:available` (valor `stake_minor`).
   - Referência: `settlement:{contract_id}:DRAW`.

---

## 5. Auditoria e Reconciliação Contínua (1 Minuto)

A cada 60 segundos, o Reconciliador Financeiro executa as 7 checagens obrigatórias:
1. **Soma Zero no Blnk:** Total de débitos rigorosamente igual ao total de créditos.
2. **Contratos Abertos vs Garantia:** Soma de `stake_minor` de contratos com status `OPEN` no PostgreSQL bate exatamente com o saldo de todas as contas `user:reserved` no Blnk.
3. **Contratos Settled sem Liquidação:** Busca contratos `SETTLED` sem transação correspondente no Blnk.
4. **Contratos Presos em Expiração:** Alerta caso existam ordens expiradas há mais de 30 segundos que ainda não foram liquidadas.
5. **DLQ Financeira:** Checagem de mensagens na Dead Letter Queue de eventos financeiros.
6. **Sequenciamento de Ticks:** Numeração sequencial contínua sem saltos ou furos.
7. **Integridade da Corrente SHA-256:** Recálculo da cadeia criptográfica dos últimos 500 ticks.
