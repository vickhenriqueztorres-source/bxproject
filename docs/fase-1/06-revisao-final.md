# Revisão final (você, depois da corrida)

Na corrida, a aprovação humana do ORCHESTRATOR §5 foi **acumulada** para o fim. Ela acontece aqui, em
ordem de risco. Não pule a etapa 2: se a demo não sobe do zero, o resto não importa.

## 1. Situação

```bash
cat .orchestrator/STATUS
cat relatorio-fase-1/RESUMO.md
cat .orchestrator/human-queue.md
git log --oneline main..fase-1/run
```

Para cada subtask `BLOCKED`, decida: resolver agora (e religar a corrida) ou apresentar como limitação conhecida.

## 2. Reproduzir do zero numa pasta limpa

```bash
git clone <repo> /tmp/fase1-limpo && cd /tmp/fase1-limpo && git checkout fase-1/run
cp <seu .env> .env
pnpm install --frozen-lockfile
pnpm run stack:up && pnpm run test:unit all && pnpm run test:int all
pnpm run test:chaos C-01 C-05 C-08          # amostra de caos que você vai mostrar
pnpm run demo:up && pnpm run demo:seed
```

Faça a jornada da demo à mão (07, bloco 3). Anote o que quebrou: cada item vira `DEF-…` para uma nova sessão
do bug-fix-agent ou entra como limitação.

## 3. Definição de Pronto

Abra `relatorio-fase-1/definicao-de-pronto.md`. Para cada um dos 14 itens:

- [ ] Existe arquivo de evidência e ele mostra `PASS`?
- [ ] O teste citado tem o oráculo `[OR-xx]` correspondente (`02-ondas-e-dependencias.md`)?
- [ ] Rodei o comando de novo e passou (pelo menos itens 6, 7, 10, 11)?

## 4. Zona vermelha — ler o diff (P-08)

Leia estes trechos você mesmo. A IA erra aqui de um jeito que parece certo (skill 09, matriz).

| Área | Onde | Responda |
|---|---|---|
| Schema e roles | `migrations/`, grants | `ticks`, `audit_logs` e eventos sem `UPDATE`/`DELETE` para a API? `UNIQUE (symbol, sequence)` existe? |
| JWT | middleware da API e do gateway | Usa `jwtVerify` com `issuer`, `audience` e `algorithms` fixos? `user_id` vem só do token? |
| Abertura de contrato | serviço de contratos | Insere primeiro com `UNIQUE` (não "lê e depois grava")? Preço de entrada vem do servidor? `request_hash` compara o corpo? |
| Settlement | worker de settlement | `FOR UPDATE SKIP LOCKED` + `WHERE status = …`? Tick de saída = primeiro `ts ≥ expires_at`? Payout em inteiro com D-19? Não marca `SETTLED` se o Blnk falhou? |
| Blnk | wallet adapter | `reference` determinística (`reserve:{id}`, `settle:{id}`…)? Endpoints existem na doc anexada? Nenhum saldo guardado no Postgres? |
| Reconciliação | job | Só detecta e alerta; nenhum `UPDATE` de saldo? |
| Admin | endpoints `/admin/*` | Pausar e bloquear exigem `ADMIN` + MFA + motivo e gravam `audit_logs`? Nenhum endpoint edita saldo? |
| Infra | `infra/compose*.yaml`, `.github/workflows/` | Postgres/Redis sem porta pública? Segredos só via `.env`? Nenhum `\|\| true` ou `continue-on-error`? |

Achou problema: registre em `ai-failures.jsonl` com `"escaped_to_human_review": true`. É o dado mais
importante do TCC: o que passou por todas as barreiras.

## 5. Revisores e achados abertos

```bash
grep -l "verdict: REPROVADO" .orchestrator/tasks/*/3*-result.yaml
grep -h -A3 "severity: MÉDIO\|severity: BAIXO" .orchestrator/tasks/*/31-review-*-result.yaml
```

Nenhum CRÍTICO ou ALTO pode estar aberto. MÉDIO e BAIXO entram na lista de "próximos passos" da apresentação.

## 6. Dados do TCC

```bash
jq -r '[.task_id,.class,.detected_by,.severity,.escaped_to_human_review] | @tsv' .orchestrator/ai-failures.jsonl | sort | uniq -c
```

Monte a tabela RQ1/RQ2 de `skills/09-ai-failure-map/references/tcc-protocol.md`: falhas por classe, por subtask
e por camada que detectou.

## 7. Aprovar

- [ ] Etapa 2 passou numa pasta limpa
- [ ] 14 itens da Definição de Pronto com evidência (ou limitação declarada)
- [ ] Zona vermelha lida, nenhum CRÍTICO/ALTO aberto
- [ ] Tabela do TCC montada

Então: marque o PR como pronto, faça o merge em `main` e crie a tag `fase-1-entregue`.
