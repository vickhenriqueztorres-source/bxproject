# 02 — Consistência atômica do TickRepository

Agentes: QA escreve oráculos; backend implementa; arquiteto e segurança revisam; verificador executa. Skills 01/03/05/06/08/09/10 e mudança cirúrgica.
Pré-condição: etapa 01 concluída quanto ao baseline e ambiente real; RED reproduzido. Não conectar este serviço ao feed.
Arquivos de produto autorizados: somente `services/tick-engine/src/persistence/tick-repository.ts`. Chamador permanece compatível.
Testes novos: `tests/integration/chart-durability-*.mjs` e helpers específicos em `tests/helpers/`.

## Passo a passo

1. Em PostgreSQL 16 descartável, aplicar a migration 0001 real; sem trocar banco por mock.
2. Escrever teste válido e oráculos de predecessor obsoleto, hash adulterado, sequência divergente e concorrência. Executar RED e guardar saídas.
3. Na mesma transação/client, bloquear `index_state` com `FOR UPDATE`. Rejeitar ausência de símbolo e predecessor incompatível.
4. Calcular próxima sequência oficial e recalcular hash canônico com símbolo, timestamp e preço recebidos. Rejeitar incompatibilidade antes de escrever.
5. Inserir tick, atualizar estado e inserir outbox na mesma transação; preservar assinatura pública e serialização existente.
6. Provar rollback por erro real de SQL após cada estágio; validar contagens e conteúdo das três tabelas.
7. Reexecutar concorrência e carga em banco real. Validar cadeia por recálculo independente a partir das linhas retornadas.
8. Executar typecheck, regressão focada, revisão independente e fingerprint. Publicar logs CI antes de fechar gate de promoção.

## Matriz obrigatória

| ID | Dado / Quando / Então | Tipo |
|---|---|---|
| AC-GD-02-1 | Estado sequência N; tick válido; exatamente tick N+1, estado N+1 e um outbox coerente | Integração |
| AC-GD-02-2 | 20 chamadas com mesmo predecessor; apenas 1 commit e 19 rejeições, cadeia sem bifurcação | Stress concorrente |
| AC-GD-02-3 | Hash de outra sequência, preço, tempo ou predecessor; rejeição sem alteração das 3 tabelas | Abuso/integridade |
| AC-GD-02-4 | Trigger real falha em tick/estado/outbox; nenhuma escrita parcial, client liberado | Falha transacional |
| AC-GD-02-5 | Cliente recriado; leitura retoma último estado confirmado e próximo tick válido usa N+1 | Restart de cliente |
| AC-GD-02-6 | Símbolo inexistente/injeção SQL em valor; erro controlado e dados de outro símbolo intactos | Segurança |

Alvo de stress: 20 escritores concorrentes por predecessor; repetir com múltiplos símbolos e conferir ausência de contaminação. Tempo é medido, sem alegar equivalência com VPS.
Falha transacional não equivale a derrubar o PostgreSQL; caos de processo/rede completo é gate das etapas 04/05/11.
Rollback: reverter apenas este patch antes de integração; manter testes/evidência. Não apagar ticks para “corrigir”.

## Limites e gate

Esta unidade protege a coerência do predecessor/hash/sequence; não implementa fencing de lease. Um produtor que relê o estado pode continuar competindo: D-09 permanece aberta até etapa 04.
Não resolve o reset do `dev-live-feed.mjs`, o schema completo, a retenção nem a liquidação. Não declarar o problema global corrigido.
Gate: zero violação nos ACs e zero regressão atribuível, revisão independente e evidência CI. Falha de ambiente/CI = INCONCLUSIVO, sem avançar.
