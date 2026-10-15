# 07 — Continuidade do feed e separação de processos

Agentes: backend/bug-fix, QA, arquiteto, financeiro e segurança. Skills 01/02/03/05/06/07/08/09/10.
Pré-condição: gate 06 VALIDADA; backup+restore comprovados. Transição de produção exige entrega concreta revisada antes da aprovação final de deploy.
Escopo: boot/adapter do feed, exportador/importador novos e configuração de processos. Preservar alterações preexistentes em `scripts/dev-live-feed.mjs`.

## Passo a passo

1. Escrever teste RED iniciando processo, observando preço/velas, terminando e iniciando novamente; comparar prefixo histórico e estado confirmado.
2. Exportar candles legados e último estado com checksum, cutoff e proveniência; importar uma única vez em área distinta de ticks oficiais. Não reconstruir auditoria de contratos antigos a partir de velas fictícias.
3. Preparar adapter atrás de configuração explícita, desligada por padrão. Não gerar histórico sintético silenciosamente quando banco estiver vazio ou indisponível.
4. Pré-carregar candles confirmados e estado oficial. Primeiro tick novo parte do predecessor persistido; nada de nova gênese em cada boot.
5. Fazer ensaio de transição: bloquear novas ordens, drenar contratos legados até zero e confirmar ledger, parar gerador antigo, gravar âncora de origem e promover produtor novo.
6. Separar gerador/API/gateway/worker. Deploy da UI/API não reinicia produtor. SIGTERM termina lote, confirma estado e libera lease corretamente.
7. Validar indisponibilidade do banco: nenhum preço novo sem commit; estado de indisponibilidade explícito e novas ordens bloqueadas conforme política testada.
8. Só promover com contagem de produtores =1, sequência/cadeia válidas e plano de rollback que mantenha o log oficial.

## Testes de aceite

- AC-GD-07-1: três restarts de processo preservam exatamente OHLCV dos buckets fechados e último estado confirmado; novas sequências continuam N+1.
- AC-GD-07-2: downtime de 60s deixa lacuna temporal visível, sem ticks/candles retroativos inventados.
- AC-GD-07-3: falha no meio da importação não duplica backfill; checksum e cutoff garantem repetição idempotente.
- AC-GD-07-4: tentativa de dois produtores durante handover é recusada; PG/Redis fora não cria preço substituto.
- AC-GD-07-5: deploy simulado de API/front mantém PID do produtor e cadeia; contratos legados drenados permanecem conciliados.

Stress: reinícios sob 300 WebSockets/50 contratos por minuto em ambiente descartável, com ordens somente no caminho financeiro homologado. Caos: kill abrupto e SIGTERM durante gravação/handover.
Segurança: export não inclui PII/token, import só aceita símbolos/formatos/limites validados. Nunca criar endpoint público para trocar preço-base ou estado oficial.
Rollback: suspender ordens e consumidores novos preservando produtor/log; não reativar monólito com basePrice após novos contratos. Testar rollback, não só documentar flag.
Gate: continuidade/restart e V-02/V-04/V-05/V-06/V-09/V-13; a migração não pode ser declarada segura enquanto recuperação de contratos novos depender de timer RAM. Antes da etapa 08 usar ordens bloqueadas no caminho novo.
