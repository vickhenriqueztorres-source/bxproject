import { describe, test } from 'node:test';
import assert from 'node:assert';

/**
 * BUG-4: Outbox Exclusiva para Reserva Blnk
 *
 * Testa que a reserva no Blnk é feita EXCLUSIVAMENTE via outbox worker,
 * eliminando chamadas fire-and-forget que eram fora da transação.
 *
 * Correções aplicadas:
 * - Removida chamada blnk.reserveStake() nas linhas 2644 e 2785
 * - Outbox sempre com status='PENDING' (linha 2727)
 * - Worker assíncrono processa eventos com retry
 */

describe('BUG-4: Outbox Exclusiva para Blnk', () => {
  test('[DOC] Correção implementada', () => {
    console.log('\n=== CORREÇÃO DO BUG-4 ===\n');
    console.log('ANTES (PROBLEMA):');
    console.log('  1. blnk.reserveStake() chamado FORA da transação (fire-and-forget)');
    console.log('  2. Se INSERT falhar, reserva fica travada sem contrato');
    console.log('  3. Evento marcado como PROCESSED sem worker processar');
    console.log('  4. Sem retry se Blnk falhar temporariamente');
    console.log('');
    console.log('DEPOIS (CORRIGIDO):');
    console.log('  1. Chamadas blnk.reserveStake() REMOVIDAS (linhas 2644 e 2785)');
    console.log('  2. Evento SEMPRE criado como PENDING na outbox');
    console.log('  3. Worker assíncrono processa evento');
    console.log('  4. Retry automático se Blnk falhar');
    console.log('  5. Contrato + outbox na MESMA transação (ACID)');
    console.log('');
  });

  test('[MANUAL] Contrato criado → evento PENDING na outbox', async () => {
    console.log('\n=== TESTE MANUAL: EVENTO PENDING ===\n');
    console.log('1. Abrir contrato:');
    console.log('   curl -X POST http://localhost:3001/contracts \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer <token>" \\');
    console.log('     -H "Idempotency-Key: bug4-pending-$(date +%s)" \\');
    console.log('     -d \'{"symbol": "VOL_50", "direction": "UP", "stake_minor": 100000, "duration_seconds": 60}\'');
    console.log('');
    console.log('2. Capturar contract_id');
    console.log('');
    console.log('3. Verificar evento na outbox:');
    console.log('   psql -d binmax -c "SELECT event_type, status, payload FROM outbox_events WHERE payload->>\'contract_id\' = \'<contract_id>\';"');
    console.log('');
    console.log('4. Esperado:');
    console.log('   event_type   | RESERVE_STAKE');
    console.log('   status       | PENDING');
    console.log('   payload      | {"contract_id": "<id>", "user_id": "<user>", "stake_minor": 100000, ...}');
    console.log('');
  });

  test('[MANUAL] Blnk down → contrato abre, evento fica pendente', async () => {
    console.log('\n=== TESTE MANUAL: BLNK DOWN ===\n');
    console.log('1. Derrubar Blnk:');
    console.log('   docker compose -f infra/compose.yaml stop blnk');
    console.log('');
    console.log('2. Abrir contrato (deve funcionar):');
    console.log('   curl -X POST http://localhost:3001/contracts \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer <token>" \\');
    console.log('     -H "Idempotency-Key: bug4-blnk-down-$(date +%s)" \\');
    console.log('     -d \'{"symbol": "VOL_50", "direction": "UP", "stake_minor": 100000, "duration_seconds": 60}\'');
    console.log('');
    console.log('3. Esperado: HTTP 201 (ordem aberta normalmente)');
    console.log('');
    console.log('4. Verificar contrato criado:');
    console.log('   psql -d binmax -c "SELECT id, status FROM contracts ORDER BY created_at DESC LIMIT 1;"');
    console.log('   # Esperado: status = OPEN');
    console.log('');
    console.log('5. Verificar evento pendente:');
    console.log('   psql -d binmax -c "SELECT COUNT(*) FROM outbox_events WHERE status = \'PENDING\';"');
    console.log('   # Esperado: > 0');
    console.log('');
    console.log('6. Subir Blnk novamente:');
    console.log('   docker compose -f infra/compose.yaml start blnk');
    console.log('');
  });

  test('[MANUAL] Worker processa eventos quando Blnk volta', async () => {
    console.log('\n=== TESTE MANUAL: WORKER PROCESSING ===\n');
    console.log('1. Criar evento PENDING manualmente:');
    console.log('   psql -d binmax <<EOF');
    console.log('   INSERT INTO contracts (');
    console.log('     id, user_id, symbol, direction, status, stake_minor, entry_price,');
    console.log('     opened_at, expires_at, created_at, payout_pct');
    console.log('   ) VALUES (');
    console.log('     \'test-worker-$(date +%s)\', \'<user_id>\', \'VOL_50\', \'UP\', \'OPEN\', 100000, 500.0,');
    console.log('     NOW(), NOW() + INTERVAL \'1 minute\', NOW(), 85');
    console.log('   );');
    console.log('   INSERT INTO outbox_events (event_type, payload, status, created_at)');
    console.log('   VALUES (\'RESERVE_STAKE\', \'{"contract_id": "test-worker-...", "user_id": "<user_id>", "stake_minor": 100000}\'::jsonb, \'PENDING\', NOW());');
    console.log('   EOF');
    console.log('');
    console.log('2. Aguardar worker processar (ou forçar manualmente)');
    console.log('   # Worker deve consumir eventos PENDING periodicamente');
    console.log('');
    console.log('3. Verificar que evento foi processado:');
    console.log('   psql -d binmax -c "SELECT status, processed_at FROM outbox_events WHERE payload->>\'contract_id\' = \'test-worker-...\';"');
    console.log('');
    console.log('4. Esperado:');
    console.log('   status       | PROCESSED');
    console.log('   processed_at | <timestamp>');
    console.log('');
  });

  test('[DOC] Verificação grep das correções', () => {
    console.log('\n=== VERIFICAÇÃO GREP ===\n');
    console.log('1. Verificar que chamadas blnk.reserveStake foram removidas:');
    console.log('   grep -n "blnk.reserveStake" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   # Esperado: ZERO resultados (removido das linhas 2644 e 2785)');
    console.log('');
    console.log('2. Verificar que outbox sempre usa PENDING:');
    console.log('   grep -n "INSERT INTO outbox_events" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   grep -A 1 "INSERT INTO outbox_events" D:\\brokerproject\\scripts\\dev-live-feed.mjs | grep PENDING');
    console.log('   # Deve mostrar linha ~2727 com status=PENDING');
    console.log('');
    console.log('3. Verificar comentários de correção:');
    console.log('   grep -n "BUG-4" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   # Deve mostrar comentários nas linhas 2642 e 2782');
    console.log('');
  });
});

describe('BUG-4: Vantagens da Outbox Exclusiva', () => {
  test('[DOC] Comparação antes/depois', () => {
    console.log('\n=== ANTES DA CORREÇÃO ===\n');
    console.log('Fluxo:');
    console.log('  1. Cliente envia POST /contracts');
    console.log('  2. Query: SELECT saldo');
    console.log('  3. ✅ blnk.reserveStake() chamado FORA da transação');
    console.log('  4. BEGIN transação');
    console.log('  5. INSERT INTO contracts');
    console.log('  6. INSERT INTO outbox_events com status=PROCESSED');
    console.log('  7. COMMIT');
    console.log('');
    console.log('Problemas:');
    console.log('  ❌ Se INSERT falhar, reserva fica travada (stake não retorna)');
    console.log('  ❌ Se blnk.reserveStake() timeout, ordem aguarda (latência)');
    console.log('  ❌ Worker não processa (evento já PROCESSED)');
    console.log('  ❌ Sem retry se Blnk falhar');
    console.log('');

    console.log('\n=== DEPOIS DA CORREÇÃO ===\n');
    console.log('Fluxo:');
    console.log('  1. Cliente envia POST /contracts');
    console.log('  2. Query: SELECT saldo (verificação rápida)');
    console.log('  3. BEGIN transação');
    console.log('  4. INSERT INTO contracts');
    console.log('  5. INSERT INTO outbox_events com status=PENDING');
    console.log('  6. COMMIT');
    console.log('  7. Ordem retorna 201 imediatamente');
    console.log('  8. Worker assíncrono consome outbox');
    console.log('  9. Worker chama blnk.reserveStake()');
    console.log('  10. Se sucesso: marca evento como PROCESSED');
    console.log('  11. Se falha: retry com backoff exponencial');
    console.log('');
    console.log('Vantagens:');
    console.log('  ✅ Transação ACID (contrato + outbox atômicos)');
    console.log('  ✅ Retry automático se Blnk falhar');
    console.log('  ✅ Ordem retorna rápido (não espera Blnk)');
    console.log('  ✅ Blnk down não impede abertura de ordem');
    console.log('  ✅ Worker processa quando Blnk volta');
    console.log('  ✅ Idempotência via Idempotency-Key headers');
    console.log('');
  });
});

describe('BUG-4: Pré-Requisitos Críticos', () => {
  test('[DOC] Verificar que worker está rodando', () => {
    console.log('\n=== PRÉ-REQUISITO CRÍTICO ===\n');
    console.log('ATENÇÃO: Antes de fazer deploy desta correção, verificar que:');
    console.log('');
    console.log('✅ Worker da outbox está RODANDO e CONSUMINDO eventos RESERVE_STAKE');
    console.log('✅ Worker tem retry configurado (backoff exponencial)');
    console.log('✅ Blnk API tem idempotência (reference único)');
    console.log('✅ Monitoramento de lag da outbox está ativo');
    console.log('');
    console.log('## Verificações:');
    console.log('1. Verificar que worker existe:');
    console.log('   docker compose -f infra/compose.yaml ps | grep outbox');
    console.log('   # OU');
    console.log('   ps aux | grep outbox');
    console.log('');
    console.log('2. Verificar que worker está processando:');
    console.log('   psql -d binmax -c "SELECT COUNT(*) FROM outbox_events WHERE status = \'PROCESSED\' AND processed_at > NOW() - INTERVAL \'1 hour\';"');
    console.log('   # Esperado: > 0 (worker processou eventos na última hora)');
    console.log('');
    console.log('3. Monitorar lag da outbox:');
    console.log('   psql -d binmax -c "SELECT COUNT(*) FROM outbox_events WHERE status = \'PENDING\' AND created_at < NOW() - INTERVAL \'5 minutes\';"');
    console.log('   # Se > 0: worker está atrasado ou parado');
    console.log('');
    console.log('## SE O WORKER NÃO ESTIVER RODANDO:');
    console.log('❌ Esta correção causará:');
    console.log('  - Ordens abertas sem reserva no Blnk');
    console.log('  - Eventos acumulados na outbox indefinidamente');
    console.log('  - Dinheiro fantasma (stake não reservado)');
    console.log('');
    console.log('NÃO FAZER DEPLOY SEM WORKER ATIVO!');
    console.log('');
  });
});
