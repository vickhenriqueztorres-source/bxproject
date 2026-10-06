---
name: 09-ai-failure-map
description: >
  Trigger: "IA vai errar", "código gerado por IA", "Cursor", "Copilot", "Claude Code", "v0", "alucinação", "guardrail", "TCC". Ativar antes de delegar subtask da Fase 1 a uma IDE com IA e ao revisar o que ela entregou.
version: 1.1.0
---

# 09-ai-failure-map

Mapa de **onde IDEs de código com IA vão falhar na Fase 1** da Plataforma de Índices Sintéticos, **por que** falham, **como detectar** e **como evitar**.
Base do TCC: *construir a plataforma usando IA* — esta skill transforma "a IA errou" em dado classificável (`F-xx`), limite conhecido (`L-xx`) e guarda verificável (`P-xx`).

## Premissa

A IA de código é um **gerador de código plausível**, não um verificador de correção.
Ela acerta o que aparece muito no treino (CRUD, componentes React, Dockerfile básico) e erra onde a Fase 1 é mais exigente:
**dinheiro, concorrência, tempo, segurança, integração com ferramentas de nicho e ambiente distribuído**.

| # | Regra | Consequência prática |
|---|-------|----------------------|
| 1 | Código que compila não é código correto | Nenhuma subtask fecha sem teste-oráculo e CI verde |
| 2 | A IA não é juíza do próprio trabalho | "Testes passaram" só vale com log do CI |
| 3 | Plausível ≠ existe | Toda API de Blnk, Keycloak, Lightweight Charts e Redis é conferida na doc da versão fixada |
| 4 | Sob pressão, a IA remove a proteção | Erro de verificação nunca é "resolvido" desligando a verificação |
| 5 | O que não está no contexto não existe para ela | Uma subtask por sessão, com as skills da subtask carregadas |
| 6 | O banco é a última linha | Invariantes críticas também viram constraint/trigger (`08-database-foundation`) |

## Regras de ativação

**Ativar quando o pedido contém:**

- "a IA vai conseguir", "onde a IA erra", "revisar código gerado", "PR do Cursor/Copilot/Claude Code/v0"
- Início de qualquer subtask `T01`–`T18` delegada a uma IDE com IA
- Resultado de agente com "pronto", "testes passaram", "corrigido" sem evidência anexada
- Correção que remove validação, relaxa constraint, adiciona `as any`, `@ts-ignore`, `.skip` ou `|| true`
- Planejamento ou coleta de dados do TCC

**Não ativar quando:**

- Regra de dinheiro em si (o que é certo) — usar `02-financial-invariants`
- Regra de segurança em si — usar `04-security-iam`
- Como escrever o teste — usar `06-testing-quality`
- Schema e roles do banco — usar `08-database-foundation`
- Esta skill diz **onde a IA erra e como travar**; as outras dizem **o que é correto**.

## Quem usa

| Consumidor | O que lê |
|------------|----------|
| `tech-lead-orchestrator` | Matriz por subtask para montar prompt, guardas e evidência exigida |
| `financial-correctness-reviewer` | F-02, F-03, F-06, F-09 em ledger, contrato e settlement |
| `security-reviewer` | F-06, F-10 e limites L-03/L-04 em auth e segredos |
| `qa-resilience-agent` | F-07, F-08 e L-01/L-02 para desenhar testes que a IA não consegue burlar |
| Pesquisador (TCC) | Taxonomia, protocolo de registro e métricas em `references/tcc-protocol.md` |

## Instruções

1. Identificar a subtask (`T01`–`T18`) e localizar a linha dela na **Matriz por subtask**.
2. Listar as classes de falha prováveis (`F-xx`) e os limites (`L-xx`) que **não podem ser delegados**.
3. Antes de abrir a sessão da IA:
   - fixar versões e anexar a doc oficial da versão (P-02);
   - garantir que o teste-oráculo da subtask existe e está protegido (P-03);
   - garantir que as regras estáticas rodam no CI (P-05, `scripts/health-check.sh`).
4. Montar o prompt com o **Bloco de guardas** (seção abaixo) e apenas as skills da subtask (P-06).
5. Ao receber o resultado, revisar contra a coluna **Falha provável** e rodar `scripts/health-check.sh`.
6. Classificar cada defeito encontrado com `F-xx` e a camada que detectou (`P-xx`) e registrar (`references/tcc-protocol.md`).
7. Responder no **Formato de saída**.

## Classes de falha (F-xx)

Cada classe tem **causa raiz no funcionamento do modelo** — por isso se repete entre ferramentas e versões.

### F-01 — API inventada ou de outra versão

- **Causa:** pouco dado de treino de ferramentas de nicho (Blnk) e mistura de versões (Keycloak 2x, Lightweight Charts v4/v5, TanStack Query v4/v5).
- **Sintoma:** endpoint/campo que não existe, opção removida, pacote npm inexistente (*slopsquatting*).
- **Detecção:** teste de integração contra o serviço real em container; `pnpm install` falha; checagem do pacote no registry.
- **Evitar:** P-02 (versão fixada + doc oficial no contexto), P-01 (cliente gerado do contrato).

### F-02 — Padrão de tutorial (caminho feliz)

- **Causa:** o treino é dominado por exemplos didáticos que ignoram falha, concorrência e precisão.
- **Sintoma:** `Math.random()`, `number`/`parseFloat` para dinheiro, `SELECT saldo` + `UPDATE saldo`, `setInterval` como relógio, publicar antes de persistir.
- **Detecção:** P-05 (regras estáticas), P-03 (teste de invariante).
- **Evitar:** proibição explícita no prompt + regra estática que reprova o PR.

### F-03 — Concorrência e tempo distribuído

- **Causa:** o modelo raciocina sobre **uma execução sequencial**; condição de corrida não aparece no texto do código.
- **Sintoma:** dois líderes no tick engine, settlement duplo, idempotência com janela de corrida, tick de saída errado na borda do vencimento, transação espalhada em conexões diferentes do pool.
- **Detecção:** teste concorrente determinístico, teste de caos, constraint no banco (P-04).
- **Evitar:** especificar o mecanismo (lock, `SKIP LOCKED`, `UPDATE ... WHERE status=`, fencing token) em vez de pedir "faça ser seguro".

### F-04 — Fronteira entre serviços

- **Causa:** cada arquivo é gerado com contexto parcial; não há visão do sistema inteiro.
- **Sintoma:** produtor publica `price` como string e consumidor espera número; unidade decimal × minor; nome de stream/evento diferente; campo renomeado só de um lado.
- **Detecção:** validação de schema no consumidor (zod), teste de contrato.
- **Evitar:** P-01 — contrato único (OpenAPI + JSON Schema de eventos) e tipos gerados num pacote compartilhado.

### F-05 — Deriva de contexto

- **Causa:** janela de contexto limitada; em sessão longa, decisões antigas perdem peso.
- **Sintoma:** contrato de 30 s em vez de 60 s (D-10), payout recalculado, troca de ferramenta "por simplicidade" (D-01/D-02), regra de skill ignorada no 5º arquivo.
- **Detecção:** teste-oráculo com os valores de `D-xx`; revisão contra `01-project-context`.
- **Evitar:** P-06 — uma subtask por sessão; valores de decisão em constantes únicas importadas, nunca redigitadas.

### F-06 — "Consertar" removendo a proteção

- **Causa:** o objetivo otimizado é "o erro sumir"; desligar a verificação é o caminho mais curto.
- **Sintoma:** validação de `aud` removida porque o token não tinha audience; `ON CONFLICT DO NOTHING` engolindo duplicidade que deveria falhar; constraint relaxada; `as any`, `@ts-ignore`, `eslint-disable`, `catch {}` vazio.
- **Detecção:** diff com remoção de verificação; P-05 conta supressões; revisão humana em zona vermelha (P-08).
- **Evitar:** regra no prompt: "se uma verificação falhar, pare e reporte; não altere a verificação".

### F-07 — Teste que não testa

- **Causa:** quando pedido para "fazer passar", o caminho mais curto é mudar o teste.
- **Sintoma:** asserção afrouxada, `expect(true)`, mock do próprio módulo sob teste, `.skip`/`.only`, snapshot regravado, teste que nunca falha.
- **Detecção:** P-09 (mutation testing), P-03 (testes-oráculo protegidos por CODEOWNERS).
- **Evitar:** a IA não altera teste-oráculo; teste novo só é aceito se falhar contra uma implementação errada conhecida.

### F-08 — Evidência inventada

- **Causa:** o modelo completa o padrão "tarefa concluída"; não distingue rodou de deveria rodar.
- **Sintoma:** "todos os testes passaram", "carga validada com 300 conexões", números de p95 sem execução.
- **Detecção:** ausência de log/artefato do CI vinculado ao commit.
- **Evitar:** P-07 — evidência só vale como artefato do CI; o agente anexa link, não texto.

### F-09 — Fallback silencioso e dado falso

- **Causa:** o modelo prefere "não quebrar" a "falhar alto".
- **Sintoma:** Blnk fora → retorna saldo `10000` fixo; Redis fora → gera tick local; erro de liquidação → marca `SETTLED` mesmo assim; mock esquecido em código de produção.
- **Detecção:** teste de caos (derrubar dependência e verificar erro explícito); P-05 procura mock/constante fora de teste.
- **Evitar:** regra: "dependência indisponível = erro explícito + métrica; nunca valor substituto em caminho de dinheiro".

### F-10 — Segurança por omissão

- **Causa:** defaults de exemplo são inseguros e aparecem muito no treino.
- **Sintoma:** `jwt.decode` sem verificar, algoritmo não fixado, CORS `*`, `user_id` lido do body, spread de body no DTO (*mass assignment*), token em `localStorage`, `start-dev` do Keycloak, `admin/admin`, segredo no Compose.
- **Detecção:** P-05, scan de segredos, `security-reviewer`.
- **Evitar:** checklist de `04-security-iam` no prompt; testes de BOLA/IDOR como oráculo.

### F-11 — Reconstruir o que é para integrar / escopo inflado

- **Causa:** gerar código é o comportamento padrão; integrar exige ler doc externa.
- **Sintoma:** ledger próprio em tabela `balances` no lugar do Blnk, login próprio no lugar do Keycloak, Kafka/Kubernetes "para escalar", segundo índice, tipos de contrato extras.
- **Detecção:** revisão contra a tabela **Stack** de `01-project-context`.
- **Evitar:** prompt cita `D-01`, `D-02`, `D-06` e o item "Fora" do escopo.

### F-12 — Ambiente inalcançável

- **Causa:** a IDE roda num ambiente sem a stack (sandbox sem Docker, sem rede para os serviços, sem carga real).
- **Sintoma:** código "pronto" que nunca subiu; config de Compose/Keycloak/Grafana não exercitada; testes de caos e carga só escritos.
- **Detecção:** pipeline que sobe a stack e roda smoke/caos/carga.
- **Evitar:** separar **escrever** (IA) de **executar** (CI ou humano) — ver L-02.

## Limites — o que a IA não consegue fazer sozinha (L-xx)

Aqui a IA **vai quebrar** se for deixada sozinha. A tarefa não é delegada; a IA no máximo auxilia.

| ID | Limite | Por que não consegue | Quem faz | Como |
|----|--------|----------------------|----------|------|
| L-01 | Provar ausência de condição de corrida (líder, settlement, idempotência) | Raciocina em execução sequencial; não executa interleavings | QA + CI | Teste concorrente com N workers + constraint no banco + caos |
| L-02 | Subir a stack completa e rodar caos/carga | Ambiente da IDE não tem Docker/infra nem carga real | CI ou humano | Pipeline com Compose, Toxiproxy/`docker kill`, k6 com artefato |
| L-03 | Garantir que a API de Blnk/Keycloak usada existe na versão instalada | Dado de treino escasso/misturado | Humano + teste de integração | Versão fixada, doc oficial no contexto, teste contra container real |
| L-04 | Avaliar a própria entrega | Auto-avaliação inflada (F-08) | Revisor separado + CI | Revisor com outro contexto; evidência só do CI |
| L-05 | Manter 10+ serviços coerentes numa sessão | Contexto limitado (F-04, F-05) | Orquestrador + contrato | Contrato único, tipos gerados, uma subtask por sessão |
| L-06 | Decidir regra de negócio pendente | Não tem autoridade nem contexto de produto | Humano | `D-16`, `D-17`, empate, limites de stake |
| L-07 | Calibrar alertas e dashboards | Sem dados reais, limiares são chutados | Humano após carga | Limiar derivado do teste de carga (T18) |
| L-08 | Executar restore/DR e responder incidente | Ação destrutiva e ambiente de produção | Humano | Runbooks de `07-production-operations` e `08-database-foundation` |

## Matriz por subtask (Fase 1)

Risco = probabilidade de a IA entregar algo **errado que parece certo**.

| T | Subtask | Risco | Falha provável da IA | Classe | Guarda |
|---|---------|-------|----------------------|--------|--------|
| T01 | Docker Compose base | Médio | `depends_on` sem `service_healthy`; healthcheck do Keycloak na porta errada (management em `9000` nas versões recentes); tag `latest`; senha no YAML; Blnk sem seu próprio Postgres/Redis | F-01, F-10, F-12 | Versões fixadas; healthcheck testado no CI; segredos via `.env` fora do git |
| T02 | Keycloak realm, PKCE, MFA, roles | **Alto** | Realm JSON com campos inventados; variáveis de admin antigas; sem mapper de audience; roles no claim errado | F-01, F-06 | Exportar realm configurado na UI; teste que lê token real e confere `aud`/roles |
| T03 | API/BFF JWT + RBAC + DTO | **Alto** | `decode` em vez de `verify`; `aud` desligado "para funcionar"; `user_id` do body; spread do body no DTO | F-06, F-10 | `jose` + `createRemoteJWKSet` + `algorithms` fixo; zod `.strict()`; teste de BOLA |
| T04 | Wallet Adapter + Blnk | **Alto** | Endpoint/campo do Blnk inventado; `amount` decimal sem `precision`; `reference` aleatória (quebra idempotência); saldo fixo quando Blnk cai | F-01, F-02, F-09 | Cliente fino validado contra container real; `reference` determinística |
| T05 | Tick Engine | **Alto** | `Math.random()`; `setInterval` com deriva; lease renovado sem checar dono; `DEL` do lock alheio; sem fencing; `BEGIN` via `pool.query` | F-02, F-03 | `crypto.randomInt`/`randomBytes`; lease com Lua compare-and-set; `UNIQUE(symbol, sequence)` |
| T06 | Outbox relay | **Alto** | Publica no Redis dentro da transação (dual write); marca publicado antes do `XADD` confirmar; perde ordem | F-02, F-03 | Relay lê só commitados, publica, depois marca; teste matando o relay no meio |
| T07 | Candle Worker | Médio | Sem `XACK`; não reivindica pendentes (`XAUTOCLAIM`); vela por horário local; duplica vela no reprocesso | F-03 | Upsert idempotente por `(symbol, bucket)`; teste de mensagem duplicada |
| T08 | WebSocket Gateway | **Alto** | Snapshot antes de assinar (perde ticks no intervalo); JWT em query string logado; não revalida token expirado; sem limite de buffer | F-03, F-10 | Assinar → snapshot → deduplicar por `sequence`; teste de reconexão com gap |
| T09 | Contract Service | **Alto** | Checa chave e depois grava (corrida); mesma chave com body diferente devolve cache; preço de entrada vindo do cliente; reserva no Blnk fora de saga | F-02, F-03, F-10 | Insert-first com `UNIQUE`; `request_hash`; preço do último tick no servidor |
| T10 | Scheduler + Settlement | **Alto** | Usa o tick "mais recente" em vez do primeiro `ts >= expires_at`; dois workers liquidam o mesmo contrato; `stake * 1.85` em float; marca `SETTLED` se o Blnk falhar | F-02, F-03, F-09 | `FOR UPDATE SKIP LOCKED` + `WHERE status='OPEN'`; inteiros minor; teste de borda e de duplicidade |
| T11 | Reconciliação | Médio | "Corrige" divergência com `UPDATE` no saldo; compara em float; job sem lock roda duplicado | F-06, F-02 | Divergência gera alerta e reversão (I-06), nunca update |
| T12 | Chart API `/candles` | Baixo | Sem paginação/limite; tempo em ms em vez de s | F-02 | Limite máximo; teste de formato |
| T13 | Front-end | Médio | Lightweight Charts com API de outra versão; tempo em ms; `update` com tempo antigo (lança erro); duplo WebSocket no StrictMode; token em `localStorage`; reconexão sem jitter | F-01, F-03, F-10 | Versão fixada + doc; dedupe por `sequence`; cleanup no effect; backoff com jitter |
| T14 | Painel admin | **Alto** | Scaffold CRUD gera Edit/Delete em ticks, contratos e ledger; admin acessa o banco direto; ação sem auditoria | F-10, F-11 | Recursos só leitura por padrão; ações admin via API auditada; roles de `08` |
| T15 | Observabilidade | Médio | `user_id`/`contract_id` como label (cardinalidade); alerta que nunca dispara; JSON de dashboard com datasource inválido | F-02, F-12 | Labels limitados; alerta testado com `promtool`; L-07 |
| T16 | CI/CD | **Alto** | `\|\| true`, `continue-on-error`; scan só do diff; rollback nunca executado; migration automática sem `lock_timeout` | F-06, F-08 | Health-check desta skill no CI; job de rollback exercitado em staging |
| T17 | Testes de caos | **Alto** | Escreve o roteiro mas não executa; resultado inventado | F-08, F-12 | L-02: execução e artefato pelo CI/humano |
| T18 | Testes de carga | **Alto** | Script k6 sem verificação; p95 relatado sem rodar; 300 WS gerados de um único processo limitado | F-08, F-12 | L-02; thresholds no próprio k6 reprovam o job |

Catálogo com código errado × correto por subtask: `references/api-guide.md`.

## Camadas de prevenção (P-xx)

| ID | Camada | Pega quais falhas |
|----|--------|-------------------|
| P-01 | Contrato antes do código (OpenAPI + JSON Schema de eventos, tipos gerados) | F-01, F-04 |
| P-02 | Versões fixadas + doc oficial da versão no contexto | F-01, F-11 |
| P-03 | Teste-oráculo escrito por humano antes, protegido por CODEOWNERS | F-03, F-05, F-07 |
| P-04 | Invariante no banco (constraint, trigger, grant) | F-02, F-03, F-06 |
| P-05 | Regras estáticas do projeto no CI (`scripts/health-check.sh`, eslint/semgrep) | F-02, F-06, F-09, F-10 |
| P-06 | Uma subtask por sessão, só as skills da subtask | F-04, F-05, F-11 |
| P-07 | Evidência só como artefato do CI | F-08 |
| P-08 | Revisão humana em zona vermelha (dinheiro, auth, migration, infra) | F-03, F-06, F-10 |
| P-09 | Mutation testing nos módulos de dinheiro | F-07 |

Detalhes, regras prontas e template de prompt: `references/guardrails.md`.

## Bloco de guardas (colar no prompt da subtask)

```text
CONTEXTO: Plataforma de Índices Sintéticos, Fase 1, subtask <T-xx>. Skills: <lista>.
VERSÕES FIXADAS: <tabela de versões>. Usar só APIs da doc anexada. Se não estiver na doc, PARE e pergunte.
PROIBIDO: Math.random; number/parseFloat para dinheiro; publicar antes de persistir;
          remover/afrouxar verificação, teste, constraint ou tipo; as any; @ts-ignore; .skip; || true;
          valor substituto quando dependência falhar; criar ledger/login próprio; sair do escopo.
SE UMA VERIFICAÇÃO FALHAR: pare, mostre o erro e a hipótese. Não altere a verificação.
TESTES-ORÁCULO: <caminhos>. Somente leitura.
ENTREGA: diff + lista de decisões + riscos conhecidos. Não declarar "testes passaram"; o CI decide.
```

## Formato de saída

```text
SUBTASK: <T-xx — nome>
RISCO IA: ALTO | MÉDIO | BAIXO
FALHAS PROVÁVEIS:
  - F-xx — <falha concreta nesta subtask>
NÃO DELEGAR (LIMITES):
  - L-xx — <quem faz e como>
GUARDAS NO PROMPT: <itens do bloco de guardas específicos>
GUARDAS FORA DO PROMPT: <P-xx: teste-oráculo, regra estática, constraint>
EVIDÊNCIA EXIGIDA: <artefatos do CI>
REGISTRO TCC: <campos de references/tcc-protocol.md a preencher>
```

## Exemplos

Exemplo curto:

```text
Entrada: "Vou pedir ao Cursor para fazer o Settlement Worker (T10)."

SUBTASK: T10 — Scheduler + Settlement Worker
RISCO IA: ALTO
FALHAS PROVÁVEIS:
  - F-03 — usar o tick mais recente em vez do primeiro com ts >= expires_at
  - F-03 — dois workers liquidarem o mesmo contrato
  - F-02 — payout em float (stake * 1.85)
  - F-09 — marcar SETTLED quando o Blnk falha
NÃO DELEGAR (LIMITES):
  - L-01 — prova de liquidação única: teste com 4 workers concorrentes no CI
GUARDAS NO PROMPT: SKIP LOCKED + UPDATE condicional; inteiros minor; erro explícito se Blnk falhar
GUARDAS FORA DO PROMPT: P-03 testes de borda/duplicidade; P-04 trigger de tick de saída; P-09 mutation
EVIDÊNCIA EXIGIDA: job "settlement-concurrency" verde + relatório de mutation score
REGISTRO TCC: tool, modelo, tentativas, F-xx encontrados, camada que detectou
```

Exemplos completos: `examples/example-1.md` (settlement) e `examples/example-2.md` (JWT e o "conserto" que desliga a verificação).

## Edge cases

- **IA acerta de primeira:** registrar mesmo assim (dado positivo do TCC); a guarda continua obrigatória.
- **Teste-oráculo está errado:** só humano altera, em PR separado e justificado; a IA não "corrige" o oráculo.
- **Doc oficial ausente ou contraditória:** marcar `L-03`; testar contra o container real e registrar a versão.
- **IA sugere trocar ferramenta (Kafka, ledger próprio):** `F-11` + `CONFLITA COM DECISÃO` via `01-project-context`.
- **Sandbox não roda Docker:** esperado (`F-12`); não aceitar "validado localmente" sem artefato.
- **Revisor também é IA:** usar contexto separado e modelo diferente quando possível; revisão não substitui CI (`L-04`).

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers com nomes das ferramentas e das subtasks |
| Ativação espúria | "Não ativar quando" aponta a skill do conteúdo correto |
| Execução parcial | Formato de saída com campos obrigatórios por subtask |
| Deriva de instrução | Classes `F-xx`, limites `L-xx` e camadas `P-xx` citáveis |
| Conflito de tools | Fronteira: esta skill = onde erra; 02/04/06/08 = o que é certo |
| Context overflow | Código em `references/api-guide.md`; protocolo em `references/tcc-protocol.md` |
| Feedback loop negativo | Proibição de alterar verificação; evidência só do CI |

## Recursos

- Catálogo de armadilhas com código errado × correto: `references/api-guide.md`
- Regras estáticas, CODEOWNERS, CI e template de prompt: `references/guardrails.md`
- Protocolo de medição para o TCC: `references/tcc-protocol.md`
- Cobertura dos squads (quem barra cada erro, onde e como): `references/squad-coverage.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Varredura de sinais de código gerado com falha: `scripts/health-check.sh`
