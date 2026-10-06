# bug-fix-agent — Guia de referência

Referência operacional do `bug-fix-agent`: como classificar, de onde vêm os defeitos, quais correções
são proibidas e quem revisa depois. As regras FX-xx estão no `AGENT.md`; as invariantes estão nas skills.

## Triagem — classes de erro

| Classe | Sinal | Primeira ação | Destino |
|--------|-------|---------------|---------|
| `E1` Build, tipo ou lint | `tsc`, `eslint`, bundler falham | Reproduzir local com o mesmo comando do CI | Este agente |
| `E2` Defeito de produto | `defects[]` do QA; teste vermelho que reflete a spec | Rodar o teste exato do `defect.test` | Este agente |
| `E3` Achado de revisor | `findings[]` com `verdict: REPROVADO` | Ler `location` + `scenario`; escrever teste que reproduz o cenário | Este agente |
| `E4` Pipeline | Estágio do CI falha (scan, build, smoke) sem falha de teste | Ler o log do estágio; reproduzir o passo isolado | Este agente (`.github/workflows/**`, `infra/**`) |
| `E5` Incidente / alerta | Alerta da skill 07 em staging | Correlacionar alerta, logs (Loki) e métricas; achar o primeiro evento anômalo | Este agente; produção → rollback primeiro |
| `E6` Health-check | `[FAIL]` em `health-check.sh` de skill ou agente | Rodar o script e ler a linha apontada | Este agente |
| `E7` Flaky | Mesmo commit passa e falha | Rodar 20×, medir taxa; achar a corrida | Produto → este agente; teste → `E8` |
| `E8` Teste errado | Teste contradiz a spec ou a regra da skill | Provar com §9 do orquestrador ou regra da skill | `qa-resilience-agent` |
| `E9` Spec ou decisão | Correção exige escolher regra não decidida ou mudar `D-xx` | Citar o item `<não definido no contexto>` ou a decisão | Orquestrador → humano |
| `E10` Ambiente | Serviço não sobe, porta ocupada, credencial ausente, runner sem recurso | Diagnosticar e registrar; sem mudança de código | Orquestrador (operações) |

Um mesmo relatório pode ter várias classes. Cada item vira um bloco em `fixes[]` (FX-10).

## Fontes de defeito — como ler cada uma

| Fonte | Campos usados | Reprodução |
|-------|---------------|-----------|
| `qa-resilience-agent` | `defects[].id`, `test`, `reproduction`, `route_to` (= domínio dono) | Rodar `test` exatamente como o QA rodou (mesmo nível, mesmas imagens do Compose) |
| `financial-correctness-reviewer` | `findings[].location`, `scenario`, `violates` | Transformar o `scenario` em teste (unit se for lógica pura; senão pedir ao QA) |
| `security-reviewer` | `findings[].location`, vetor do atacante, controle violado | Reproduzir o vetor em teste; **nunca** copiar valor de segredo |
| CI | Estágio, comando, log, commit | Mesmo comando, mesma versão de runtime e de imagem |
| Alerta (skill 07) | Nome do alerta, labels, janela | Consulta Prometheus/Loki da janela; replay do cenário em ambiente efêmero |

## Correções proibidas × corretas

Se a correção pretendida está na coluna da esquerda, ela não é a correção (FX-04, FX-05, FX-15).

### Dinheiro e ledger (skill 02)

| Sintoma | Correção proibida | Correção correta |
|---------|-------------------|------------------|
| Saldo divergente | `UPDATE` no saldo; transação manual no Blnk sem `reference` | Corrigir o código que gerou a divergência; dado por `reversal:{reference}` com aprovação humana (FX-06) |
| Crédito duplicado | Checar "já existe crédito?" antes de chamar o Blnk | `reference` determinística da tabela de fluxos (`credit:{id}:{result}`); o Blnk rejeita a duplicata (I-03) |
| Contrato duplicado | Mutex em memória; `SELECT` antes do `INSERT` | `UNIQUE (user_id, idempotency_key)` + `INSERT ... ON CONFLICT` (B-05) |
| Payout com centavo fracionado | `Math.round(stake * 0.85)` | `BLOCKED` — regra de arredondamento é `<não definido no contexto>` (`E9`) |
| Stake preso em `user:reserved` | Liberar o stake por job "de limpeza" | Implementar o fluxo da tabela que faltou (`settlement:{id}`) e reconciliar |

### Mercado sintético (skill 03)

| Sintoma | Correção proibida | Correção correta |
|---------|-------------------|------------------|
| Settlement sem tick de saída | Ler `tick:last:*` do Redis; usar o último tick antes da expiração; marcar `DRAW` | Primeiro tick com `ts >= expires_at` **do Postgres**; sem tick → `NACK` e retry (B-08) |
| `sequence` duplicada | Ignorar o erro de `UNIQUE` | Leader lease + fencing token (M-02); o `UNIQUE` é a proteção, não o bug |
| Tick no Stream sem estar no banco | Publicar de novo "por garantia" | Tick + outbox no mesmo `COMMIT`; só o relay publica (M-03, B-07) |
| Candle diferente após reprocessar | Corrigir o candle à mão | Agregação determinística a partir dos ticks gravados (M-05) |

### Segurança (skill 04)

| Sintoma | Correção proibida | Correção correta |
|---------|-------------------|------------------|
| `401` intermitente | Aceitar token expirado com "tolerância" grande; `jwt.decode` | Ajustar `clockTolerance` dentro do decidido; validar `iss`, `aud`, `exp`, `nbf` (S-02) |
| Usuário vê contrato de outro | Esconder o botão no front | `WHERE user_id = :sub` na query; `404` para recurso de outro dono (S-04) |
| Campo inesperado aceito | Remover o campo depois de salvar | DTO estrito que rejeita campo extra com `400` (S-05) |
| CORS bloqueando | `Access-Control-Allow-Origin: *` com credenciais | Lista explícita de origens do ambiente |
| Segredo no repositório | Apagar o arquivo e seguir | Ler do ambiente + **rotação obrigatória** (humano) (S-06) |

### Resiliência (skill 05)

| Sintoma | Correção proibida | Correção correta |
|---------|-------------------|------------------|
| Timeout chamando Blnk | Aumentar o timeout até passar | Timeout decidido + retry com backoff e jitter + circuit breaker (R-02, R-03, R-04) |
| Mensagem perdida | `XACK` logo ao ler | `XACK` só depois do `COMMIT`; `XAUTOCLAIM` para pendentes (R-06) |
| DLQ financeira cheia | Esvaziar a DLQ | Corrigir a causa; reprocessar (redrive) idempotente com aprovação humana (R-05) |
| Erro intermitente | `try { ... } catch {}` | Classificar o erro: transitório → retry; permanente → DLQ + alerta |

### Front-end e operação (agente front, skill 07)

| Sintoma | Correção proibida | Correção correta |
|---------|-------------------|------------------|
| Saldo atrasado na tela | Subtrair o stake localmente | Revalidar `GET /wallet` após a resposta (F-03) |
| Resultado demora a aparecer | Calcular WIN/LOSS no cliente | Mostrar só com `status: SETTLED` vindo da API (F-09) |
| Feed duplica velas | Deduplicar por timestamp | Descartar `sequence <= lastSequence` (F-06) |
| Alerta "barulhento" | Aumentar o `for:` ou o limite | Corrigir a causa; mudança de threshold é decisão, não correção |
| Container reinicia em loop | Remover o healthcheck | Corrigir o que o healthcheck detecta (O-01) |

## Re-revisão obrigatória

Calculada pelos arquivos do diff. Vários matches = vários revisores.

| Caminho tocado | Re-revisa |
|----------------|-----------|
| `services/settlement-worker/**`, `services/*/wallet*/**`, `services/*/contracts/**`, `services/*/reconciliation/**`, migrations de `contracts`, `outbox`, `idempotency*` | `financial-correctness-reviewer` |
| `services/api/src/auth/**`, `**/middleware/**`, `infra/keycloak/**`, `services/websocket-gateway/**`, `apps/**/auth/**`, DTOs, `.github/workflows/**` (scans) | `security-reviewer` |
| Qualquer arquivo | `qa-resilience-agent` reexecuta o teste original e a suíte do nível que acusou o defeito |

## Limites e políticas

| Item | Valor | Estado |
|------|-------|--------|
| Linhas alteradas por correção | 150 | `PROPOSTO` |
| Arquivos alterados por correção | 5 | `PROPOSTO` |
| Hipóteses por defeito | 3 | Adotado (FX-11) |
| Reaberturas antes de escalar | 2 | Adotado (FX-11), confirmar no §1.10 |
| Execuções para medir flaky | 20 | Adotado (FX-08) |
| Aprovador de reparo de dados | `<não definido no contexto>` | Pendente |

Acima do limite de diff, a correção provavelmente é uma funcionalidade ou refatoração: `BLOCKED` com
justificativa e proposta de nova subtask para o orquestrador.

## Convenções

- Branch: `fix/<task_id>-<defect_ref>` — ex.: `fix/T09-DEF-T09-1`.
- Commit: `fix(T09): <causa raiz em uma linha> [DEF-T09-1]`.
- Título do teste de regressão: `[DEF-T09-1] <comportamento esperado>`.
- Migration nova: próximo número livre, com `.down.sql`; nunca renumerar.

## Health-check

```bash
bash scripts/health-check.sh --base origin/main --defect DEF-T09-1 [raiz-do-repo]
```

Varre o diff entre `--base` e o worktree (incluindo arquivos novos) e reprova:

| Checagem | Regra |
|----------|-------|
| Arquivos fora da fronteira (QA, skills, agentes, orquestrador) | Fronteiras, FX-04 |
| `.skip`, `.only`, `it.todo` adicionados; asserções removidas; timeout/retry em teste | FX-04 |
| `@ts-ignore`, `@ts-expect-error`, `as any`, `eslint-disable` adicionados | FX-04 |
| `catch {}` vazio, `.catch(() => {})`, `?? 0` / `\|\| 0` em campo `_minor` | FX-05 |
| `UPDATE`/`DELETE` em tabela financeira; saldo em coluna | FX-06, B-03 |
| Nenhum teste adicionado com `[<defect>]` no título | FX-07 |
| Migration existente modificada; migration nova sem `.down.sql` | FX-13 |
| Diff acima do limite `PROPOSTO`; dependência nova em `package.json` | FX-03 (aviso) |
| `Math.random` em `services/`, `* 0.85`/`parseFloat` em dinheiro, `tick:last:` no settlement, `jwt.decode`, SQL interpolado | FX-15 |
