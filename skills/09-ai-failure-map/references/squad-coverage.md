# Cobertura dos squads — quem barra cada erro da IA, onde e como

Referência da skill `09-ai-failure-map`. Responde, para cada erro previsto da IA na Fase 1:
**qual squad barra**, **em que arquivo ou regra** e **de que forma**. Toda linha cita um ID que existe no repositório.

## As 7 barreiras

A IA que escreve o código é sempre a mesma. Por isso as barreiras não dependem de ela "lembrar":
cada uma é aplicada por **outro agente**, pelo **banco** ou pela **operação**.

| Sigla | Barreira | Quem aplica | Quando | A IA consegue burlar? |
|-------|----------|-------------|--------|------------------------|
| **P** | Prompt: bloco de guardas da skill 09 + regras invioláveis `B-xx` / `F-xx` | `tech-lead-orchestrator` → implementador | Antes de escrever | **Sim.** É instrução; pode ser ignorada |
| **H** | `health-check.sh` do agente e das skills, de novo no CI | Implementador antes do handoff; CI em todo PR | Antes do handoff | **Em parte.** É varredura de texto; indireção escapa |
| **D** | Banco: `PRIMARY KEY`, `UNIQUE`, `CHECK`, trigger, RLS, role por serviço | Migrations da skill `08` | A cada escrita, em runtime | **Não.** O Postgres recusa |
| **T** | Teste escrito por **outro agente**, com dependências reais e caos | `qa-resilience-agent` (não pode tocar `src/`) | Depois do handoff | **Não**, enquanto o implementador não puder editar testes (fronteira + CODEOWNERS) |
| **R** | Revisão somente leitura com veredito | `financial-correctness-reviewer`, `security-reviewer` | Depois do QA | **Sim**, se o revisor tiver o mesmo ponto cego; por isso não é a última |
| **O** | Reconciliador + alertas | T11 + T15 | Em produção, contínuo | **Não.** Mede o estado real |
| **X** | Correção pela causa raiz | `bug-fix-agent` | Quando qualquer barreira acusa | Proibido afrouxar verificação (`FX-04`); reabriu 2× → humano (`FX-11`) |

### Fluxo

```text
orquestrador ── carrega 09: guardas no prompt + oráculos travados + evidência exigida
   │
   ▼
implementador (backend / frontend) ............ P  regras B-01..B-17, F-01..F-14
   │  roda health-check do agente e das skills  H  [FAIL] = não devolve
   ▼
migrations ...................................... D  constraint, trigger, RLS, role
   ▼
qa-resilience-agent ............................. T  integração real (QA-06), caos C-01..C-12
   │  teste vermelho = defect, nunca "ajuste"
   ▼
financial / security reviewer ................... R  CRÍTICO ou ALTO = REPROVADO
   ▼
CI (mesmos health-checks + testes) → merge com CODEOWNERS humano em dinheiro e auth
   ▼
produção: reconciliador + alertas ............... O
falha em qualquer etapa → bug-fix-agent ......... X  regressão vermelho → verde; re-revisão FX-12
```

**Regra de cobertura:** todo erro `CRÍTICO` precisa de pelo menos uma barreira **D**, **T** ou **O**,
as que a IA não consegue burlar. Erro coberto só por **P** e **R** é risco aberto (ver "Risco residual").

---

## Por componente

### Tick Engine (T05)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| `Math.random()` em vez de CSPRNG | P | backend `B-06`; decisão `D-07`, `M-01` | Proíbe e indica `crypto.randomInt` |
| | H | backend `health-check.sh` → `B-06` | `[FAIL]` em qualquer `Math.random(` em `services/` |
| | T | QA `QA-05` | Unit exige `RandomSource` injetado; código com `Math.random` não tem seam e volta como `defect` de testabilidade |
| Esquecer o `sequence` incremental ou repetir | D | `schema.md`: `ticks PRIMARY KEY (symbol, sequence)` + trigger `ticks_chain` | Recusa `sequence` repetido, com salto ou `prev_hash` errado; `ticks_append_only` bloqueia `UPDATE`/`DELETE` |
| | T | QA plano T05; caos `C-01`, `C-09` | `kill -9` no líder: `sequence` contínua; inserir duplicado ou salto: recusado |
| | O | reconciliação (02): último tick do Stream = último do Postgres | Divergência vira alerta |
| Dois líderes gerando ao mesmo tempo | D | `index_state.lease_epoch` (fencing, `08/references/api-guide.md`) | `UPDATE ... WHERE lease_epoch <= época do lease`: o líder antigo atualiza 0 linhas e não grava; a role `app_tick` só altera essas colunas |
| | T | `C-01` + integração de lease com 2 instâncias | Nenhum tick duplicado |
| Publicar antes de persistir | P | backend `B-07` | Tick + outbox na mesma transação; Tick Engine nunca publica |
| | H | `health-check.sh` → `B-07` | `[FAIL]` em `xadd`/`publish` dentro de `services/tick-engine` |
| | T | QA T05 "commit falha → nada no Stream"; `C-06` | Postgres reiniciado: nenhum tick não persistido publicado |

### Contrato UP/DOWN (T09)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Esquecer a idempotência | P | backend `B-05`; front `F-10` | Header obrigatório; front reusa a chave no retry |
| | H | `health-check.sh` → `B-05` | `[FAIL]` se `POST /contracts` não lê `Idempotency-Key` |
| | D | `contracts UNIQUE (user_id, idempotency_key)` + `request_hash` | Segunda inserção falha; corpo diferente com a mesma chave é detectado |
| | T | QA `QA-07`, plano T09 | 2× e 20× em paralelo = 1 contrato; mesma chave + corpo diferente → `422` |
| | R | financeiro `I-03` | Marca `FAIL` com o cenário |
| Usar preço do Redis | P | backend `B-08` | Preço só do Postgres |
| | H | `health-check.sh` → `B-08` | `[FAIL]` em `tick:last:` ou `subscribe` no settlement |
| | D | `FOREIGN KEY (symbol, entry_sequence)` / `exit_sequence → ticks`; trigger confere `exit_price = ticks.price` | Preço que não existe no Postgres não grava |
| Confundir `expires_at` com a criação | D | trigger: `expires_at = ts do tick de entrada + 60 s` | Qualquer outro valor: `RAISE EXCEPTION` |
| Aceitar preço, payout ou `user_id` do corpo | P/H | `B-01` | DTO só com `symbol`, `direction`, `stake_minor`; `[FAIL]` em `req.body.price` etc. |
| | T | `QA-07` mass assignment → `400` | Campo extra rejeitado |
| | D | `CHECK result_matches_prices` | Resultado incompatível com os preços não grava |

### Ledger Blnk (T04, T10)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Inventar endpoint (`/wallets/credit`) | P | backend **`B-15`** (novo); 09 `P-02` versões fixadas | Só a allowlist de `02/references/api-guide.md`; fora dela = `BLOCKED` com link da doc |
| | H | `health-check.sh` → **`B-15`** (novo) | `[FAIL]` em rota do Blnk fora de `/ledgers`, `/balances`, `/balances/{id}`, `/transactions`; `[FAIL]` em `PUT`/`PATCH`/`DELETE` |
| | T | `QA-06`: Blnk real com a mesma tag do Compose | Endpoint inventado responde 404 na integração; não há mock para esconder |
| Esquecer `reference` ou usar valor aleatório | P/H | `B-04` | Chave determinística; `[FAIL]` em `reference: uuid()` |
| | T | `C-02`, `C-04`, `C-10` | Reentrega: "reference já existe" → 1 transação |
| | R | financeiro `FC-06`, `FC-10` | Cada evento conferido contra source, destination e reference |
| Duas transações onde é uma, ou o contrário | R | `FC-06` × tabela **Mapeamento contrato → transações** | WIN tem 2 pernas por desenho (`settlement:` e `credit:`); LOSS e DRAW têm 1. Diferente disso = `FAIL` |
| | T | pós-condição `QA-08` | Soma do ledger = 0 após cada cenário |
| Confundir ledger, balance e identity | P | skill 02 "Conceitos Blnk usados" + `B-15` | Ledger criado 1× no bootstrap; o app cria **balance**, não ledger |
| | T | QA T04 | 1º login cria balances e credita 1×; 2º login não credita |

### Keycloak / JWT (T02, T03)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Validar só a assinatura | P | backend `B-10`; skill 04 `S-02` | `iss`, `aud`, `exp`, `nbf`, `sub`, roles, `alg=RS256` |
| | H | `health-check.sh` → `B-10` | `[FAIL]` em `jwt.decode`, `alg: none` ou `HS256` |
| | T | plano T03 | `alg: none`, `HS256`, `iss`/`aud` errados e expirado → `401` |
| | R | segurança `SR-08` | `jwt.decode` em decisão de acesso = `CRÍTICO` |
| Confiar no token ou na role do front | R | `SR-07`; front `F-14` | Role na UI é só UX; controle só no servidor conta |
| JWKS frágil | T | `C-07` | Keycloak fora: token válido segue aceito (JWKS em cache); `kid` desconhecido força 1 refresh |
| Inventar realm, client ou role | T | QA T02 contra o realm **exportado e versionado** | Client ou role inexistente falha no login real |
| | R | `security-reviewer` lê o realm exportado | Divergência entre realm e código = achado |

### WebSocket (T08, T13)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Esquecer catch-up por `lastSequence` | P | front `F-06`, `F-07` | Descarta `sequence <= lastSequence`; gap → `subscribe` com `lastSequence` |
| | T | plano T08 + `C-05` | Redis reiniciado: cliente reconecta e recupera sem buraco |
| Conexão zumbi sem ping/pong | P | backend **`B-16`** (novo) | `ping` 15 s; fecha após 45 s sem `pong` |
| | H | `health-check.sh` → **`B-16`** (novo) | `[FAIL]` sem `ping`, sem `pong` ou sem prazo de `auth` |
| | T | **`C-11`** (novo) | Cliente mudo fechado em ≤ 45 s |
| Vazar memória com listeners | P | `B-16` (servidor), `F-13` (cliente) | Limpeza no `close` / unmount |
| | H | `B-16` | `[FAIL]` sem `removeListener`/`clearInterval`/`unsubscribe` |
| | T | `C-11`: 1.000 ciclos de conectar e desconectar | Listeners e memória voltam à linha de base |
| Sem limite de 5 conexões por usuário | P/H | `B-16` | `[FAIL]` sem limite por usuário |
| | T | plano T08: 6ª conexão recusada | |
| Token na URL | H | `B-16` (servidor); front `health-check` `F-05` (cliente) | Servidor: `[FAIL]` em `?token=` / `searchParams.get('token')`. Cliente: `[FAIL]` em `new WebSocket(...token...)` |
| | R | `SR-10` | `ALTO` |

### Redis Streams (T06, T07, T10)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Pub/Sub para trabalho crítico | P | backend **`B-17`** (novo), `B-08` | Pub/Sub só no gateway |
| | H | `health-check.sh` → **`B-17`** | `[FAIL]` em `subscribe(` fora de `services/websocket-gateway` |
| Esquecer o consumer group | H | **`B-17`** | `[FAIL]` em `XREAD` sem `GROUP` |
| | R | `FC-10` | `XACK` só após `COMMIT` |
| Mensagem presa no PEL | P | skill 05 `R-06`: loop `XAUTOCLAIM` + DLQ ao exceder entregas | |
| | H | `B-17` + skill 05 `health-check.sh` | `[FAIL]` em `min-idle-time` 0; `[WARN]` sem `XAUTOCLAIM` |
| | T | `C-02`, `C-08` | Worker morto antes do `XACK`: reentregue e processado 1× |
| Mensagem duplicada causando efeito duplo | T | **`C-10`** (novo) | N× a mesma mensagem = 1 efeito |

### Candle Worker (T07)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Fechar a vela antes da hora ou pular tick | D | `candles`: `CHECK (volume = last_seq - first_seq + 1)`, `high/low`, `PRIMARY KEY (symbol, interval, bucket_start)` | Vela com buraco de `sequence` não grava |
| | T | plano T07 + `C-05`, `C-10` | Reprocessar = mesmo candle; candle = recalculado dos ticks |
| Front tratar a vela ao vivo como oficial | P | front `F-08` | Substituída pela mensagem `candle` oficial |

### Settlement Worker (T10)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Liquidar sem tick de saída | P/R | `B-08`, `FC-09` | Sem tick com `ts >= expires_at` → NACK, **nunca** DRAW |
| | D | trigger: `t.ts < NEW.expires_at` → `RAISE` | Tick anterior ao vencimento não grava |
| | T | plano T10 "sem tick → NACK" | |
| Creditar duas vezes | D | `contracts_guard`: `SETTLED` terminal; `outbox.dedupe_key UNIQUE` | Segunda liquidação falha no banco |
| | T | concorrente → 1 liquidação; `C-08`, `C-10` | |
| | R | `FC-09`, `I-03` | |
| Pular o estado `EXPIRING` | D | `contracts_guard`: só `OPEN→EXPIRING→SETTLED`; role `app_settlement` só move para esses estados | `OPEN→SETTLED` = `RAISE EXCEPTION` |
| | R | `FC-07` | Transição fora da tabela = `FAIL` |

### Outbox (T05, T06, T09)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Outbox fora da transação | P | `B-07` | Mesma transação |
| | T | "commit falha → nada no Stream"; `C-06` | |
| | R | `FC-10` (R-01) | |
| Publicar antes do commit | H | `B-07` | Só o relay publica |
| | D | `outbox.dedupe_key UNIQUE` | Republicação idempotente |

### Compensação (T09, T11)

| Erro da IA | Barreira | Onde | Como barra |
|------------|----------|------|------------|
| Esquecer o fluxo quando o Blnk falha após criar o contrato | D | estado terminal `FAILED_COMPENSATION`; transição `PENDING_RESERVE → FAILED_COMPENSATION` | Não existe caminho para `OPEN` sem reserva |
| | H | financeiro `health-check.sh` procura o estado | |
| | T | `C-03` (Blnk fora 3 min); plano T11 (divergência plantada em ≤ 1 min); **`C-12`** (novo) | Contratos não somem nem ficam abertos para sempre |
| | O | reconciliador contrato × ledger | Contrato sem reserva é detectado e cancelado |

---

## Alucinações

| Alucinação | Quem barra | Como |
|------------|-----------|------|
| Endpoint da Blnk | backend `B-15` + `health-check` (H); `QA-06` Blnk real (T) | Allowlist e 404 real na integração |
| Configuração do Keycloak | QA T02 contra o realm versionado (T); `security-reviewer` (R) | Login real falha com client ou role inventada |
| Header de assinatura de webhook (Mercado Pago) | Orquestrador + `01-project-context` | **Fora do escopo da Fase 1.** O implementador devolve `BLOCKED` no passo 2. Quando entrar, a regra é a mesma do Blnk: allowlist + doc fixada |
| Ledger × balance × identity | `B-15` (P); QA T04 (T) | Bootstrap cria o ledger; o app cria só balances |

## Esquecimentos

| Regra esquecida | Quem barra | Como |
|-----------------|-----------|------|
| Idempotência (abertura, settlement, crédito) | D `UNIQUE (user_id, idempotency_key)`, `outbox.dedupe_key`, `reference` do Blnk; T `QA-07`, `C-02`, `C-10` | Os três pontos têm barreira no banco ou no ledger |
| Transição inválida (`SETTLED → OPEN`) | D `contracts_guard`; R `FC-07` | Estado terminal é imutável no banco |
| BOLA / IDOR | P `B-10`; D RLS `contracts_own` (skill 08); T `QA-07` BOLA → `404`; R `SR-09` | Mesmo com o `WHERE` esquecido, a RLS não devolve a linha |
| Rate limit (HTTP e WebSocket) | H `B-13`, `B-16`; T T09 31ª → `429`, `C-11` flood | Teste prova o limite, não só a presença |
| Token ou PII no log | H `B-12`; T plano T15 (log capturado); R `SR-06` | Fluxo completo sem `Bearer `, token, senha ou e-mail |

## Sua lista × o repositório

Pontos onde o repositório já é **mais rígido** que a lista, ou onde a lista precisaria de ajuste:

| Na lista | No repositório | Por quê |
|----------|---------------|---------|
| `UNIQUE(index_id, sequence)` | `PRIMARY KEY (symbol, sequence)` + trigger `ticks_chain` | O `UNIQUE` sozinho aceita salto de `sequence`; o trigger exige `+1` e hash encadeado |
| `UNIQUE(idempotency_key)` | `UNIQUE (user_id, idempotency_key)` + `request_hash` | Global deixaria a chave de um usuário bloquear ou revelar a de outro |
| `UNIQUE(reference)` no settlement | `outbox.dedupe_key UNIQUE` + unicidade de `reference` no Blnk | Tabela de settlement própria duplicaria o ledger (`D-02`) |
| `CHECK` de estado | Trigger `contracts_guard` com pares permitidos e role por serviço | `CHECK` valida o valor, não a transição |
| JWKS com TTL curto | Cache + refresh forçado em `kid` desconhecido, com rate limit | TTL curto sozinho faz o Keycloak fora (`C-07`) derrubar tudo |

## Risco residual

O que **nenhum** squad garante sozinho, e por isso é decisão humana:

1. **Ponto cego compartilhado.** Implementador e revisores são a mesma família de modelo. Mitigação: revisor com
   outro modelo quando possível; CODEOWNERS humano em `services/settlement-worker`, `services/api/**/auth*` e `db/migrations`.
2. **`health-check` é varredura de texto.** `const r = Math; r.random()` escapa. Mitigação: a barreira que conta é a **D/T**;
   o H só reduz o retrabalho.
3. **Teste fraco.** Teste verde não prova a invariante (`FC-13`, `SR-13`). Mitigação: mutation testing (`P-09` da skill 09).
4. **Valor não decidido.** Arredondamento do payout, origem do crédito demo, rate limit do WebSocket (`PROPOSTO`).
   A IA tende a inventar. Mitigação: `pending` / `it.todo('<não definido no contexto>')`, nunca valor fixado (`FC-11`, `QA-11`).

## Buracos fechados nesta revisão

| # | Buraco | Fechado com |
|---|--------|-------------|
| G1 | Allowlist do Blnk só existia como documentação | `B-15` + checagem no `health-check.sh` do backend |
| G2 | Limites do WebSocket no servidor sem regra nem teste | `B-16` + checagem + `C-11` + linha T08 |
| G3 | Pub/Sub em worker, `XREAD` sem grupo e `min-idle 0` sem barreira mecânica | `B-17` + checagem |
| G4 | Caos sem tick fora de ordem, mensagem duplicada nem reconciliador | `C-09`, `C-10`, `C-12` |
| G5 | Token ou PII no log só por grep | Teste de log capturado no plano T15 |
| G6 | Rate limit HTTP só pela presença no código | `429` na 31ª requisição (plano T09) |
| G7 | `ORCHESTRATOR.md` citava `UNIQUE(index_id, sequence)` | Alinhado ao schema: `PRIMARY KEY (symbol, sequence)` + `ticks_chain` |
