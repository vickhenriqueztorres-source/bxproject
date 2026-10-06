# Governança de ADRs e Invariantes do Sistema (broker-architect-agent)

Este documento estabelece o registro de decisões arquiteturais fundamentais (ADRs) mantidas e defendidas pelo `broker-architect-agent`.

---

## 1. Registro de ADRs Ativas da Plataforma

### ADR-001: Adoção do Modelo Ornstein-Uhlenbeck com CSPRNG para Mercados Sintéticos
- **Status:** ACCEPTED
- **Contexto:** Geradores puramente aleatórios baseados em passeios brownianos geométricos sofrem de drift infinito e não ancoram a cotação. Motores usando `Math.random()` são previsíveis e suscetíveis a exploração por bots de arbitragem estatística.
- **Decisão:** Implementar a SDE de Ornstein-Uhlenbeck discretizada por Euler-Maruyama, alimentada exclusivamente por CSPRNG criptográfico (`crypto.randomBytes(8)` com Box-Muller). Cada tick é encadeado por SHA-256 com o anterior.
- **Consequências:**
  - *Positivas:* Preço oscila com volatilidade realista, preserva média móvel de longo prazo e é formalmente imprevisível.
  - *Negativas:* Custo computacional ligeiramente superior ao pseudo-aleatório tradicional (desprezível em Node.js moderno, <0.02ms por tick).

### ADR-002: Teto de Solvência Dinâmico Pré-Ordem de 3% do Float em Lua Script
- **Status:** ACCEPTED
- **Contexto:** Ataques coordenados de apostas direcionadas (Flashmob attacks ou salas de sinais) podem expor a corretora a risco de insolvência súbita na mesma vela de 1 minuto.
- **Decisão:** Criar um portão de risco pré-ordem no Redis via script Lua atômico que bloqueia qualquer ordem que ultrapassaria 3% do capital depositado da casa alocado naquela direção e vela de expiração.
- **Consequências:**
  - *Positivas:* Execução sub-milissegundo (<1ms), proteção matemática absoluta contra falência súbita e imunidade a Time-of-Check to Time-of-Use (TOCTOU).
  - *Negativas:* Usuários podem receber `422 RISK_CAP_EXCEEDED` durante picos extremos de volume direcional, exigindo mensagem clara de UX no frontend.

### ADR-003: Adoção do Blnk Finance Core para Contabilidade de Partidas Dobradas
- **Status:** ACCEPTED
- **Contexto:** Manter saldos em tabelas relacionais simples com `UPDATE balance = balance - stake` é fonte clássica de race conditions, saldos negativos e falta de trilha de auditoria contábil.
- **Decisão:** Utilizar o Blnk Finance como fonte única da verdade financeira. Toda movimentação é realizada em partidas dobradas com soma zero, utilizando centavos inteiros (`*_minor`).
- **Consequências:**
  - *Positivas:* Integridade contábil auditável a nível bancário, histórico imutável append-only e reconciliação formal automática.
  - *Negativas:* Exige Wallet Adapter com resiliência, retry e circuit breaker para chamadas à API do Blnk.

### ADR-004: Agregação OHLCV Baseada em Redis Streams e Upsert no PostgreSQL
- **Status:** ACCEPTED
- **Contexto:** Agregação de velas em memória RAM é volátil e sujeita a perda total de histórico em caso de restart do serviço.
- **Decisão:** Ticks são persistidos no PostgreSQL e Outbox antes da transmissão. O agregador consome do Redis Streams (`cg:candles`) e mantém a vela ativa no Redis via script Lua, persistindo a vela selada no PostgreSQL via `UPSERT` idempotente.
- **Consequências:**
  - *Positivas:* Tolerância a falhas completa, capacidade de replay a qualquer momento e zero dependência de estado em memória volátil.

### ADR-005: Lock Pessimista e Tick Oficial de Saída no Settlement Worker
- **Status:** ACCEPTED
- **Contexto:** Múltiplos workers liquidando contratos simultaneamente podem causar liquidações duplicadas. O uso de preços voláteis ou antecipados gera divergência com o gráfico.
- **Decisão:** O worker utiliza `SELECT ... FOR UPDATE SKIP LOCKED` e lê exclusivamente o primeiro tick persistido no banco com $ts \ge \text{expires\_at}$. Se o tick ainda não existir, executa rollback e aguarda o próximo ciclo.
- **Consequências:**
  - *Positivas:* Exactly-Once Semantics, ausência de duplicidade e sincronia perfeita entre cotação oficial e gráfico.
