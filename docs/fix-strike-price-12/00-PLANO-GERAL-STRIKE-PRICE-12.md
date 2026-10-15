# Plano Geral — Relatório #12: `strike_price` Sobrescrito pelo Preço de Saída

**Orquestrador:** `tech-lead-orchestrator`  
**Severidade:** MÉDIO (Invariante de Contrato de API, Rastreabilidade de Liquidação e Consistência de Dados)  
**Ordem Obrigatória de Implantação:** Front (`12.1`) → Servidor & Migração (`12.2`) → Certificação de Contrato, Segurança, Caos e Estresse (`12.3`)

---

## 1. Seleção de Agentes e Skills (`AGENTS.md`)

| Papel | Agente Selecionado | Skills Ativadas | Escopo no Relatório #12 |
|---|---|---|---|
| **Engenharia Gráfica & Front Realtime** | `chart-trading-engineer` + `frontend-realtime-agent` | `01-project-context`, `11-chart-trading-tools`, `17-mudanca-cirurgica` | **Subetapa 12.1**: Leitura de `exit_price` no pino de resultado (`OrderFlagsOverlay.tsx`) e coluna/CSV "Cierre" (`HistoryPage.tsx`); preferência por `entry_price` nas flags/linhas (`PriceChart.tsx`, `client.ts`); confirmação do preço executado e reconciliação no `OrderTicket.tsx`. |
| **Arquitetura & Backend / DB** | `broker-architect-agent` + `backend-implementation-agent` | `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `08-database-foundation` | **Subetapa 12.2**: Função canônica única `serializeContract(row)` em `scripts/lib/settlement-engine.mjs`; invariante `strike_price === entry_price` em todos os 6 pontos do servidor; migração `0063_contracts_entry_tick_sequence` e gravação de `entry_tick_sequence` + `exit_tick_sequence`. |
| **Revisão Financeira, Segurança & QA Caos** | `financial-correctness-reviewer` + `security-reviewer` + `qa-resilience-agent` + `post-implementation-verifier` | `02-financial-invariants`, `04-security-iam`, `06-testing-quality`, `10-post-implementation-verification` | **Subetapa 12.3**: Testes de contrato de API (`strike_price === entry_price` em aberto e liquidado), auditoria de ticks (`entry_tick_sequence` e `exit_tick_sequence`), segurança (Mass Assignment), caos (idempotência concorrente `23505`, cache misto legado) e estresse. |

---

## 2. Contrato Semântico Inviolável (Seção 5.1 do Relatório #12)

| Campo | Significado Único | Quando é Preenchido | Regra de Invariante |
|---|---|---|---|
| `entry_price` | Preço oficial de entrada | Na abertura (`OPEN`) | Nunca muda após a abertura |
| `entry_tick_sequence` | `sequence` do tick oficial de entrada | Na abertura (`OPEN`) | Gravado no banco e retornado em toda serialização |
| `exit_price` | Preço oficial de saída | Só na liquidação (`SETTLED`); `null` enquanto `OPEN` | Nunca igualado a `entry_price` enquanto `OPEN` |
| `exit_tick_sequence` | `sequence` do 1º tick oficial com `ts >= expires_at` | Só na liquidação (`SETTLED`); `null` enquanto `OPEN` | Permite provar matematicamente qual tick liquidou o contrato |
| `strike_price` | Alias legado de `entry_price` (`@deprecated`) | Na abertura (`OPEN`) | **Sempre igual a `entry_price`** (tanto em `OPEN` quanto em `SETTLED`) |

---

## 3. Divisão em Subetapas Sequenciais (Gate 100%)

1. **[01-SUBETAPA-12.1-FRONT-EXIT-PRICE-E-TRANSICAO-SUAVE.md](./01-SUBETAPA-12.1-FRONT-EXIT-PRICE-E-TRANSICAO-SUAVE.md)**
   - **Objetivo:** Preparar 100% dos consumidores do frontend para ler `exit_price` onde o significado é "preço de saída" e `entry_price` onde o significado é "preço de entrada", além de exibir o preço oficial executado no `OrderTicket` e sanear leituras de cache.
2. **[02-SUBETAPA-12.2-SERVIDOR-SERIALIZE-CONTRACT-E-MIGRACAO.md](./02-SUBETAPA-12.2-SERVIDOR-SERIALIZE-CONTRACT-E-MIGRACAO.md)**
   - **Objetivo:** Criar `serializeContract(row)` única usada por todos os endpoints REST (`GET /contracts/:id`, `GET /contracts`, `POST /contracts`, idempotência prévia e `23505`) e WebSocket (`contract_settled`), eliminar `target.strike_price = exitPrice`, e criar/aplicar a migration `0063_contracts_entry_tick_sequence`.
3. **[03-SUBETAPA-12.3-TESTES-CONTRATO-AUDITORIA-SEGURANCA-CAOS.md](./03-SUBETAPA-12.3-TESTES-CONTRATO-AUDITORIA-SEGURANCA-CAOS.md)**
   - **Objetivo:** Certificar com suítes automatizadas (Node Test Runner + Vitest) todos os cenários de contrato de API, auditoria de `entry_tick_sequence`/`exit_tick_sequence`, segurança contra Mass Assignment, caos de idempotência/cache legado e estresse de serialização.
