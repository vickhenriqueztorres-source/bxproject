---
name: 02-financial-invariants
description: >
  Trigger: "ledger", "saldo", "settlement", "payout", "idempotência", "reconciliação", "estorno", "double-entry". Ativar antes de escrever ou revisar código que mova dinheiro demo na Plataforma de Índices Sintéticos.
version: 1.0.0
---

# 02-financial-invariants

Invariantes financeiras da **Plataforma de Índices Sintéticos — Fase 1**.
Nenhum código que mova saldo (contrato, reserva, settlement, correção) é aceito sem passar por esta skill.
Ledger: **Blnk** (decisão `D-02` em `01-project-context`).

## Mentalidade

Assumir que tudo pode falhar, que todo cliente pode mentir e que todo erro pode custar dinheiro.

| Regra | Pergunta mental aplicada ao dinheiro |
|-------|--------------------------------------|
| O cliente sempre mente | Se o cliente enviar `stake`, `payout`, `result` ou `user_id`, isso chega ao ledger? |
| Falhar é normal | Se o Blnk cair entre o commit do contrato e a reserva, o saldo fica inconsistente? |
| Toda operação pode repetir | Se o settlement rodar 10 vezes, o crédito acontece 10 vezes? |
| Dinheiro é estado, não número solto | Consigo reconstruir o saldo só com as transações do ledger? |
| Regra de negócio vem antes de feature | Os estados e as transações foram modelados antes do endpoint e da UI? |

## Regras de ativação

**Ativar quando o pedido contém:**

- "ledger", "saldo", "balance", "carteira" no contexto de valores
- "settlement", "liquidação", "payout", "WIN/LOSS/DRAW"
- "idempotência", "Idempotency-Key", "duplicado", "clique duplo"
- "reconciliação", "divergência de saldo"
- "estorno", "correção", "reversão"
- Revisão de qualquer PR que toque Contract Service, Wallet Adapter ou Settlement Worker

**Não ativar quando:**

- Gráfico, candles ou UI sem movimento de saldo — usar `01-project-context` / `03-synthetic-market-engine`
- Autenticação e autorização — usar `04-security-iam`
- Retry, DLQ e circuit breaker sem efeito financeiro — usar `05-resilience-patterns`

## Invariantes

### I-01 — Ledger append-only

- **Definição:** transações nunca são alteradas nem apagadas. Saldo é derivado das transações.
- **Pergunta mental:** como eu reconstruo esse saldo se o banco corromper?
- **Como verificar:** ausência de `UPDATE`/`DELETE` em tabelas de transação; ausência de coluna de saldo atualizada diretamente.
- **Violação típica:** `UPDATE wallets SET balance = balance - :stake`.

### I-02 — Double-entry

- **Definição:** toda transação tem `source` e `destination`. A soma de todos os saldos do ledger é constante.
- **Pergunta mental:** de onde saiu e para onde foi cada centavo?
- **Como verificar:** toda chamada ao Blnk informa origem e destino; contas da casa existem (`house_payout`, `house_revenue`).
- **Violação típica:** crédito de payout "do nada", sem conta de origem.

### I-03 — Idempotência

- **Definição:** a mesma operação, executada N vezes, produz o mesmo efeito financeiro de uma execução.
- **Pergunta mental:** se essa ação rodar 10 vezes, o saldo muda 10 vezes?
- **Como verificar:** `Idempotency-Key` em `POST /contracts`; `reference` única em toda transação Blnk.
- **Chaves:**

| Operação | Chave |
|----------|-------|
| Abertura de contrato | `Idempotency-Key` do cliente, escopada por `user_id` |
| Reserva do stake | `reserve:{contract_id}` |
| Settlement | `settlement:{contract_id}` |
| Crédito de payout | `credit:{contract_id}:{result}` |
| Correção | `reversal:{transaction_reference}` |

- **Violação típica:** settlement sem `reference` fixa, gerando UUID novo a cada tentativa.

### I-04 — Transação ACID

- **Definição:** mudança de estado do contrato e evento de outbox são gravados na mesma transação do PostgreSQL.
- **Pergunta mental:** se o processo morrer entre duas linhas, sobra estado pela metade?
- **Como verificar:** contrato + outbox no mesmo `BEGIN/COMMIT`; settlement usa `SELECT ... FOR UPDATE`.
- **Violação típica:** chamar o Blnk dentro da transação do banco e só depois gravar o contrato.

### I-05 — Reconciliação

- **Definição:** job a cada 1 minuto compara contratos × ledger × ticks.
- **Pergunta mental:** se isso divergir às 3h, eu descubro antes do usuário?
- **Checagens:**
  1. Contratos `OPEN` cujo `expires_at` passou?
  2. Contratos `EXPIRING` há mais de 10s?
  3. Cada contrato `OPEN` tem reserva no ledger?
  4. Cada contrato `SETTLED` tem settlement no ledger?
  5. Saldo projetado = soma dos eventos do ledger?
  6. Último tick do Stream = último tick do Postgres?
  7. Candle fecha corretamente a partir dos ticks?
- **Violação típica:** divergência detectada apenas por reclamação de usuário.

### I-06 — Correção por reversão

- **Definição:** erro financeiro é corrigido com transação inversa que referencia a original. Nunca editando.
- **Pergunta mental:** a auditoria mostra o erro **e** a correção?
- **Como verificar:** existe fluxo de reversão com `reference = reversal:{transaction_reference}`; admin não altera saldo diretamente.
- **Violação típica:** painel admin com campo "editar saldo".

## Fluxos do ledger

| Evento | Source | Destination | Valor | Reference |
|--------|--------|-------------|-------|-----------|
| Abrir contrato | `user:available` | `user:reserved` | stake | `reserve:{contract_id}` |
| WIN — devolve stake | `user:reserved` | `user:available` | stake | `settlement:{contract_id}` |
| WIN — paga lucro | `house_payout` | `user:available` | stake × 0,85 | `credit:{contract_id}:WIN` |
| LOSS | `user:reserved` | `house_revenue` | stake | `settlement:{contract_id}` |
| DRAW | `user:reserved` | `user:available` | stake | `settlement:{contract_id}` |

## Máquina de estados do contrato

```text
CREATED  → OPEN → EXPIRING → SETTLED
CREATED  → FAILED_COMPENSATION
OPEN     → CANCELLED
EXPIRING → FAILED_RETRYABLE
```

Transições fora desta tabela são inválidas e devem ser rejeitadas.

## Instruções

**Modo implementação** (`backend-implementation-agent`):

1. Identificar quais eventos da tabela **Fluxos do ledger** a tarefa toca.
2. Para cada evento, usar exatamente a `source`, `destination` e `reference` da tabela.
3. Gravar mudança de estado + outbox na mesma transação (I-04).
4. Chamar o Blnk somente a partir do outbox relay/worker, nunca dentro da transação do banco.
5. Ler `stake` do DTO validado e `user_id` do JWT; preço de entrada e resultado vêm do servidor.

**Modo revisão** (`financial-correctness-reviewer`, somente leitura):

1. Para cada invariante I-01 a I-06, marcar `PASS`, `FAIL` ou `N/A`.
2. Todo `FAIL` cita arquivo e linha como evidência.
3. Classificar severidade: `CRÍTICO` (perda ou duplicação de saldo), `ALTO` (inconsistência recuperável), `MÉDIO` (falta de detecção), `BAIXO` (melhoria).
4. Não sugerir código; descrever o problema e a invariante violada.

## Formato de saída

```text
SKILL: 02-financial-invariants
MODO: IMPLEMENTAÇÃO | REVISÃO
ESCOPO ANALISADO: <arquivos / endpoints>

I-01 Append-only     : PASS | FAIL | N/A — <evidência>
I-02 Double-entry    : PASS | FAIL | N/A — <evidência>
I-03 Idempotência    : PASS | FAIL | N/A — <evidência>
I-04 ACID            : PASS | FAIL | N/A — <evidência>
I-05 Reconciliação   : PASS | FAIL | N/A — <evidência>
I-06 Reversão        : PASS | FAIL | N/A — <evidência>

ACHADOS:
- [CRÍTICO|ALTO|MÉDIO|BAIXO] <arquivo:linha> — <problema> — viola <I-xx>

VEREDITO: APROVADO | REPROVADO
```

## Exemplos

Exemplo curto:

```text
Entrada: "revisar settlement" — trecho:
  await blnk.transactions.create({ amount: payout, reference: uuid() })

I-03 Idempotência : FAIL — settlement-worker/settle.ts:42 usa uuid() como reference
ACHADOS:
- [CRÍTICO] settlement-worker/settle.ts:42 — retry gera novo crédito — viola I-03
VEREDITO: REPROVADO
```

Exemplos completos: `examples/example-1.md` e `examples/example-2.md`.

## Edge cases

- **Sem tick de saída ainda:** settlement faz NACK e retry; nunca liquida como DRAW por falta de tick.
- **Timeout do Blnk com resultado desconhecido:** repetir com a mesma `reference`; o Blnk registra um único efeito.
- **Reserva falha após contrato criado:** contrato fica `CREATED`; outbox reprocessa com backoff; após N tentativas vai para DLQ; reconciliador cancela ou promove para `OPEN`.
- **Mensagem duplicada no Stream:** `SELECT ... FOR UPDATE`; se já `SETTLED`, apenas ACK.
- **DRAW:** preço de saída igual ao preço de entrada.
- **Arredondamento do payout:** regra em `D-19` (skill 01). Enquanto `D-19` estiver `Pendente`: `<não definido no contexto>` — devolver ao orquestrador.

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers financeiros explícitos no `description` |
| Ativação espúria | Lista "Não ativar quando" com skill alternativa |
| Execução parcial | Saída exige status para as 6 invariantes |
| Deriva de instrução | Tabela fixa de `source`/`destination`/`reference` |
| Conflito de tools | Fronteira com `04` e `05` declarada |
| Context overflow | API Blnk em `references/`, casos completos em `examples/` |
| Feedback loop negativo | Revisor somente leitura; achados com evidência obrigatória |

## Recursos

- Mapeamento Blnk: `references/api-guide.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Varredura de invariantes no código: `scripts/health-check.sh`
