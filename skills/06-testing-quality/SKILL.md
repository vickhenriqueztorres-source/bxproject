---
name: 06-testing-quality
description: >
  Trigger: "teste", "unit test", "integration test", "chaos", "load test", "k6", "critério de aceite", "flaky". Ativar antes de escrever, revisar ou planejar testes da Plataforma de Índices Sintéticos.
version: 1.1.0
---

# 06-testing-quality

Estratégia de testes e qualidade da **Plataforma de Índices Sintéticos — Fase 1**.
Define **o que** precisa ser provado por teste, **em qual nível** e **como** o teste prova sem mentir.
As regras testadas vêm das outras skills: `I-xx` (`02`), `M-xx` (`03`), `S-xx` (`04`), `R-xx` (`05`).

## Mentalidade

| Regra | Pergunta mental aplicada ao teste |
|-------|-----------------------------------|
| O cliente sempre mente | Existe teste que envia `user_id`, `entry_price` ou o ID de outro usuário e espera rejeição? |
| Falhar é normal | Existe teste que derruba o Blnk, o Redis ou o líder no meio da operação? |
| Toda operação pode repetir | Existe teste que envia a mesma mensagem/request 2× e N× em paralelo e conta o efeito? |
| Dinheiro é estado | Depois de cada cenário, a reconciliação (`I-05`) devolve zero divergência? |
| Se não é observável, não é confiável | Um teste vermelho aponta qual regra quebrou? |

Um teste que passa com o sistema quebrado é pior que nenhum teste: dá falsa confiança.

## Regras de ativação

**Ativar quando o pedido contém:**

- "escrever teste", "teste unitário", "unit test", "property-based", "fast-check"
- "teste de integração", "Testcontainers", "banco real", "mock do banco"
- "chaos", "matar o pod", "derrubar o Blnk", "Toxiproxy", "injeção de falha"
- "load test", "teste de carga", "k6", "stress", "quantos usuários aguenta"
- "critério de aceite", "acceptance criteria", "Definition of Done", "Dado/Quando/Então"
- "teste flaky", "teste instável", "cobertura", "o que falta testar"
- Revisão de qualquer PR que adicione ou altere arquivos de teste

**Não ativar quando:**

- Definir a regra financeira em si (o que é correto no ledger) — usar `02-financial-invariants`
- Definir parâmetros de timeout, retry ou breaker — usar `05-resilience-patterns`
- Configurar alertas e dashboards de produção — usar `07-production-operations`
- Escolher ferramenta fora da stack (`D-xx`) — usar `01-project-context`

## Regras

### Q-01 — Unit tests

- **Definição:** testam lógica de domínio pura (payout, resultado WIN/LOSS/DRAW, máquina de estados, passo do gerador de preço, agregação OHLCV, hash do tick) sem rede, banco ou relógio real.
- **Pergunta mental:** este teste dá o mesmo resultado 1.000 vezes seguidas, em qualquer máquina e fuso?
- **Como verificar:** relógio e fonte aleatória **injetados** (`Clock`, `RandomSource`); valores monetários em decimal/inteiro, nunca `float`; asserção do valor exato; property-based para invariantes (soma do ledger = 0, `low ≤ open,close ≤ high`, transições inválidas sempre rejeitadas).
- **CSPRNG (`M-01`):** o teste injeta uma fonte determinística; um teste separado garante que a montagem de produção usa `crypto`.
- **Violação típica:** `Math.random()` ou `Date.now()` no teste; `expect(x).toBeTruthy()`; `setTimeout` de 61 s esperando o contrato expirar.

### Q-02 — Integration tests

- **Definição:** testam o serviço com PostgreSQL, Redis, Keycloak e Blnk **reais** (containers com a mesma versão do Compose). Banco, ledger e filas nunca são mockados neste nível.
- **Pergunta mental:** se eu remover a constraint `UNIQUE` ou o `FOR UPDATE`, algum teste fica vermelho?
- **Obrigatórios:** idempotência (mesma `Idempotency-Key` 2× sequencial e N× em paralelo → 1 contrato, 1 reserva); BOLA (usuário B lê contrato de A → `404`); mass assignment (body com `user_id`/`entry_price` → `400`); JWT inválido (`alg`, `iss`, `aud`, `exp`) → `401`; outbox (commit sem relay → nada publicado; relay → publicado 1×).
- **Isolamento:** usuário, símbolo e prefixo de stream únicos por teste; nada compartilhado entre workers paralelos.
- **Violação típica:** `vi.mock('../db')` em teste chamado de "integração"; teste que depende da ordem de execução.

### Q-03 — Chaos tests

- **Definição:** injetam falha real (matar processo, cortar rede, adicionar latência) durante a operação e verificam que o estado final continua correto.
- **Pergunta mental:** depois do caos, o dinheiro fecha e a sequência de ticks é contínua?
- **Pós-condições obrigatórias de todo cenário:** reconciliação sem divergência (`I-05`); soma do ledger = 0 (`I-02`); `sequence` sem lacuna nem duplicata (`M-02`); efeito financeiro exatamente 1× (`I-03`); DLQ financeira vazia, salvo quando o cenário espera entrada.
- **Catálogo:** cenários `C-01` a `C-08` em `references/api-guide.md`.
- **Ambiente:** staging ou ambiente efêmero; **nunca** produção na Fase 1.
- **Violação típica:** "chaos" que só verifica que o pod voltou, sem checar o ledger.

### Q-04 — Load tests

- **Definição:** medem latência, erro e correção sob carga com o perfil da Fase 1 (`POST /contracts`, WebSocket, `GET /candles`).
- **Pergunta mental:** sob carga, o tick continua a 1/s (`D-13`) e a reconciliação continua zerada?
- **Como verificar:** thresholds que **reprovam** o teste (não só relatório); cada request com `Idempotency-Key` única; usuários sintéticos próprios; checagem de correção no fim (reconciliação, contagem de contratos).
- **Parâmetros:** SLOs e perfil em `references/api-guide.md` — valores **PROPOSTOS**.
- **Violação típica:** teste de carga que reaproveita um único token/usuário; só mede latência e ignora erros `409`/`5xx`.

### Q-05 — Acceptance criteria

- **Definição:** toda issue tem critérios `Dado / Quando / Então`, mensuráveis, cada um ligado a pelo menos um teste automatizado e às regras que protege.
- **Pergunta mental:** um revisor consegue dizer "passou" ou "não passou" sem interpretar?
- **Mínimo por issue que toca dinheiro, feed ou segurança:** 1 caminho feliz, 1 repetição/duplicata, 1 falha de dependência e 1 abuso (outro usuário / campo proibido), quando aplicáveis.
- **Rastreabilidade:** título do teste começa com o ID da regra ou do critério: `[I-03] ...`, `[AC-42-3] ...`.
- **Proibido:** "funciona", "rápido", "estável" sem número; critério sem teste.
- **Violação típica:** "Então o contrato é criado corretamente".

## Instruções

**Modo implementação** (`qa-resilience-agent`, `backend-implementation-agent`):

1. Listar as regras (`I`, `M`, `S`, `R`) tocadas pela mudança.
2. Para cada regra, escolher o nível pela matriz de `references/api-guide.md`.
3. Escrever critérios de aceite (`Q-05`) antes do código de teste.
4. Escrever os testes com rastreabilidade no título; relógio e aleatoriedade injetados.
5. Informação ausente (ex.: arredondamento do payout) vira `it.todo` com `<não definido no contexto>`, nunca um valor inventado.

**Modo critérios** (`tech-lead-orchestrator`):

1. Gerar `AC-<issue>-<n>` no formato de `references/api-guide.md`, seção "Template de critério".
2. Indicar nível de teste e regras de cada critério.

**Modo revisão** (`qa-resilience-agent`, somente leitura):

1. Para cada regra Q-01 a Q-05, marcar `PASS`, `FAIL` ou `N/A`.
2. Todo `FAIL` cita arquivo e linha e descreve **qual bug passaria despercebido**.
3. Severidade: `CRÍTICO` (teste que passa com bug financeiro ou de segurança), `ALTO` (flaky, regra obrigatória sem teste), `MÉDIO` (asserção fraca, falta rastreabilidade), `BAIXO` (melhoria).
4. Não escrever o teste corrigido; descrever o problema e a regra violada.

## Formato de saída

```text
SKILL: 06-testing-quality
MODO: IMPLEMENTAÇÃO | CRITÉRIOS | REVISÃO
REGRAS COBERTAS: <I-xx, M-xx, S-xx, R-xx>
ESCOPO ANALISADO: <arquivos / issue>

Q-01 Unit tests          : PASS | FAIL | N/A — <evidência>
Q-02 Integration tests   : PASS | FAIL | N/A — <evidência>
Q-03 Chaos tests         : PASS | FAIL | N/A — <evidência>
Q-04 Load tests          : PASS | FAIL | N/A — <evidência>
Q-05 Acceptance criteria : PASS | FAIL | N/A — <evidência>

ACHADOS:
- [CRÍTICO|ALTO|MÉDIO|BAIXO] <arquivo:linha> — <problema> — bug que passaria: <descrição> — viola <Q-xx>

LACUNAS: <regras sem teste>
PENDÊNCIAS: <itens <não definido no contexto> ou "nenhuma">
VEREDITO: APROVADO | REPROVADO | N/A (modo critérios)
```

No modo critérios, a seção de status Q-01 a Q-05 é substituída pela lista `AC-<issue>-<n>`.

## Exemplos

Exemplo curto:

```text
Entrada: "revisar teste de idempotência" — trecho:
  vi.mock('../src/db')
  const a = await openContract(input, 'key-1')
  const b = await openContract(input, 'key-1')
  expect(b).toBeDefined()

Q-02 Integration tests : FAIL — contracts.test.ts:1 banco mockado; constraint UNIQUE nunca exercitada
ACHADOS:
- [CRÍTICO] contracts.test.ts:4 — asserção não compara a.id com b.id nem conta reservas —
  bug que passaria: dois contratos e duas reservas para a mesma chave — viola Q-02
VEREDITO: REPROVADO
```

Exemplos completos: `examples/example-1.md` e `examples/example-2.md`.

## Edge cases

- **Expiração de 60 s (`D-10`):** usar relógio injetado ou `expires_at` no passado no setup; nunca esperar o tempo real.
- **Arredondamento do payout:** `<não definido no contexto>` — teste fica `it.todo`; não fixar regra no teste.
- **Escolha do tick de saída:** regra exata `<não definido no contexto>`; testar só o que está definido (sem tick → NACK, nunca DRAW).
- **Teste flaky:** é bug. Quarentena com issue vinculada; proibido `retry` automático no runner para testes de invariantes.
- **Paralelismo em Redis:** streams e consumer groups com prefixo por teste; `XGROUP DESTROY` no teardown.
- **Chaos que "passa" porque nada aconteceu:** o teste precisa provar que a falha foi injetada (ex.: breaker abriu, processo trocou de PID).
- **Carga em produção:** proibida na Fase 1; usar staging com dados sintéticos.
- **Snapshot de resposta inteira:** frágil e esconde regressão; preferir asserção de campos com significado.

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers de unit, integração, chaos, carga, critério e flaky |
| Ativação espúria | Fronteiras com `02`, `05`, `07` e `01` em "Não ativar quando" |
| Execução parcial | Saída exige status para Q-01 a Q-05 e lista de lacunas |
| Deriva de instrução | Matriz regra → nível e catálogo de chaos fixos em `references/` |
| Conflito de tools | Regra de negócio fica nas skills `02`–`05`; aqui só a prova |
| Context overflow | Matriz, SLOs e templates em `references/`; código em `examples/` |
| Feedback loop negativo | Proibido inventar valor ausente; `it.todo` + pendência |

## Recursos

- Matriz regra → teste, ferramentas, catálogo de chaos, SLOs e template de critério: `references/api-guide.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Varredura dos testes do projeto: `scripts/health-check.sh`
