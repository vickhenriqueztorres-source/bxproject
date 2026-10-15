# 11 — Capacidade, auditoria, restore e certificação

Agentes: QA, arquiteto, financeiro, segurança, guardião e post-implementation-verifier. Skills 01–10 aplicáveis.
Pré-condição: gates 01–10 VALIDADA, commit/candidato exatos e ambiente efêmero/staging sintético identificado. Verificador não edita código/testes.
Escopo: métricas/runbooks/jobs/CI e ajustes delimitados motivados por medição. Deploy de produção somente após candidato concreto e aprovação final.

## Passo a passo

1. Congelar fingerprint e conjunto de testes, dados/usuários próprios, versões/imagens e thresholds. Registrar falhas de baseline ainda abertas, sem escondê-las.
2. Medir CPU/RAM/iowait/disco, bytes reais por tick/outbox/candle, WAL, crescimento diário, pools e custo de consultas. Extrapolações mostram fórmula e margem.
3. Definir política de capacidade/retention com preservação de ticks referenciados por contratos/auditoria. Particionamento/compressão exigem ADR/migration/teste próprios; nenhuma exclusão automática sem prazo decidido.
4. Instrumentar lag/erros/gaps/failovers, tamanho de backlog, staleness, idade do tick de saída, disco e diferenças de rebuild/reconciliação. Alertas devem disparar no teste, não só existir em YAML.
5. Criar checkpoints de hash com destino independente/apendável. Hash isolado não prova contra reescrita completa por quem controla banco e checkpoints.
6. Executar rebuild diário de candles e recálculo de contratos em janela limitada; diferenças exatas =0. Nunca “recalcular para consertar” hash antigo.
7. Executar backup/restore conjunto e reconciliar Blnk/contratos/ticks, medindo RPO/RTO efetivos. Restore só em ambiente novo.
8. Executar cada degrau carga/caos e suas consultas pós-condição; guardar artefatos CI vinculados ao commit e configuração. Fechar revisão independente antes da promoção.

## Matriz de certificação

| Cenário | Injeção/perfil real | Pós-condição obrigatória |
|---|---|---|
| Carga normal | 300 WS, 50 contratos/min, 36 símbolos ×1 Hz, 30min | Abertura p95<200ms; candles p95<200ms; tick→WS p95<500ms; erro<0,1%; ledger=0 |
| Sobrecarga | Ramp 1×/2×/4× até limite explícito, 10min/degrau | Backpressure/limites previsíveis, memória limitada, nenhum dado financeiro perdido |
| Soak | 24h em staging e observação de capacidade por 7 dias antes de generalizar crescimento | Sem leak/crescimento não explicado; head do log/candles/ledger coerentes |
| Produtor | kill abrupto, pausa >TTL, dois líderes e Redis reset | Fencing, cadeia/seq contínuas, downtime registrado |
| PostgreSQL | Queda 60s, commit incerto, lock e latência | Zero publicação sem commit; recuperação sem bifurcação |
| Redis/relay | Queda, duplicata, ordem invertida, crash pós-XADD | Nenhum tick perdido; replay e dedupe exatos |
| Settlement/Blnk | Kill pós-crédito, timeout/queda de 3min | Um efeito/reference, soma zero e reconciliação sem divergência |
| Disco/relógio | Quota/volume limitado simula 95%; relógio injetado ±5s | Falha explícita sem corrupção, alertas acionados e recovery validado |
| Abuso | JWT/IDOR/mass assignment, queries/payloads grandes, conexões excedentes | Negação correta, isolamento, buffers limitados, nenhum segredo em log |
| Deploy/rollback | Trocar UI/API com ordens abertas e rollback ensaiado | Produtor/log preservados; contratos usam regra/versionamento originais |

Não encher disco do host compartilhado nem alterar relógio do sistema. Falha simulada em função não vale como queda real da dependência; registrar nível e limites de cada prova.

## Gate final

AC-GD-11-1: V-01–V-13 com evidência, sem FAIL/INCONCLUSIVO nos critérios aplicáveis.
AC-GD-11-2: zero diferenças no rebuild de candles, hash, resultado e payout; zero duplicação financeira e filas sem perda.
AC-GD-11-3: restore e rollback demonstrados, alertas disparados, documentação/CI reproduzíveis por outra pessoa.
AC-GD-11-4: ausência de regressão frente ao baseline comprovada; falhas preexistentes que tocam o aceite final continuam impedindo homologação.
Nenhum teste finito permite prometer ausência absoluta de bugs; “VALIDADA” descreve escopo, versão, ambiente e provas executadas.
Rollback final mantém produtor oficial e log; drena ordens antes de qualquer mudança incompatível. Auditorias nunca são apagadas.
