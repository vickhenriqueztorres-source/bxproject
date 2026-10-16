import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const LIVE_MARKET_STORE_PATH = path.join(REPO_ROOT, 'services/tick-engine/live-market-store.mjs');
const DEV_LIVE_FEED_PATH = path.join(REPO_ROOT, 'scripts/dev-live-feed.mjs');
const OUTBOX_RELAY_PATH = path.join(REPO_ROOT, 'services/outbox-relay/src/index.ts');

/**
 * Simulador PostgreSQL para outbox_events suportando:
 * - archiveLegacyPendingOutbox em lotes de 10k com FOR UPDATE SKIP LOCKED
 * - pruneProcessedAndArchivedOutbox (> 7 dias) em lotes com FOR UPDATE SKIP LOCKED
 * - cálculo de outbox_pending_total e outbox_oldest_pending_seconds / alerta > 300s
 */
function createOutboxPgSimulator(initialRows = []) {
  const rows = initialRows.map((r, i) => ({
    id: r.id || `evt-${i + 1}`,
    event_type: r.event_type || 'TICK',
    status: r.status || 'PENDING',
    retry_count: r.retry_count ?? 0,
    payload: r.payload || {},
    created_at: r.created_at ? new Date(r.created_at) : new Date(),
    processed_at: r.processed_at ? new Date(r.processed_at) : null,
  }));

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, ' ').trim();

    // Diagnóstico Passo 1: SELECT event_type, status, count(*), min(created_at), max(created_at) FROM outbox_events GROUP BY 1, 2
    if (/SELECT event_type,\s*status,\s*COUNT\(\*\)/i.test(norm)) {
      const groups = new Map();
      for (const r of rows) {
        const key = `${r.event_type}|${r.status}`;
        const g = groups.get(key) || {
          event_type: r.event_type,
          status: r.status,
          count: 0,
          min_created_at: r.created_at,
          max_created_at: r.created_at,
        };
        g.count += 1;
        if (r.created_at < g.min_created_at) g.min_created_at = r.created_at;
        if (r.created_at > g.max_created_at) g.max_created_at = r.created_at;
        groups.set(key, g);
      }
      return {
        rowCount: groups.size,
        rows: Array.from(groups.values()).map((g) => ({
          event_type: g.event_type,
          status: g.status,
          count: String(g.count),
          min_created_at: g.min_created_at.toISOString(),
          max_created_at: g.max_created_at.toISOString(),
        })),
      };
    }

    // pg_total_relation_size('outbox_events')
    if (/pg_total_relation_size\('outbox_events'\)/i.test(norm)) {
      return {
        rowCount: 1,
        rows: [
          {
            total_bytes: String(rows.length * 512),
            table_bytes: String(rows.length * 384),
            index_bytes: String(rows.length * 128),
          },
        ],
      };
    }

    // Arquivamento em lotes de 10k: UPDATE outbox_events SET status = 'ARCHIVED' ... WHERE status = 'PENDING' AND created_at < $1 ... LIMIT $2 FOR UPDATE SKIP LOCKED
    if (/UPDATE outbox_events/i.test(norm) && /'ARCHIVED'/i.test(norm) && /FOR UPDATE SKIP LOCKED/i.test(norm)) {
      const cutoffMs = Date.parse(params[0]);
      const batchLimit = Number(params[1] || 10_000);
      const candidates = rows
        .filter((r) => r.status === 'PENDING' && r.created_at.getTime() < cutoffMs)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .slice(0, batchLimit);
      for (const c of candidates) {
        c.status = 'ARCHIVED';
        c.processed_at = new Date();
      }
      return { rowCount: candidates.length, rows: candidates.map((c) => ({ id: c.id })) };
    }

    // Retenção de PROCESSED e ARCHIVED > 7 dias em lotes com FOR UPDATE SKIP LOCKED
    if (/DELETE FROM outbox_events/i.test(norm) && /'PROCESSED'/i.test(norm) && /'ARCHIVED'/i.test(norm)) {
      const cutoffMs = Date.parse(params[0]);
      const batchLimit = Number(params[1] || 10_000);
      const doomedIds = new Set(
        rows
          .filter(
            (r) =>
              (r.status === 'PROCESSED' || r.status === 'ARCHIVED') &&
              r.created_at.getTime() < cutoffMs
          )
          .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
          .slice(0, batchLimit)
          .map((r) => r.id)
      );
      let removed = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (doomedIds.has(rows[i].id)) {
          rows.splice(i, 1);
          removed += 1;
        }
      }
      return { rowCount: removed, rows: [] };
    }

    // Métrica de pendentes e idade do mais antigo
    if (/FROM outbox_events WHERE status = 'PENDING'/i.test(norm)) {
      const pending = rows.filter((r) => r.status === 'PENDING');
      if (pending.length === 0) {
        return { rowCount: 1, rows: [{ cnt: 0, oldest_pending_sec: 0 }] };
      }
      const minMs = Math.min(...pending.map((r) => r.created_at.getTime()));
      const oldestSec = Math.max(0, (Date.now() - minMs) / 1000);
      return {
        rowCount: 1,
        rows: [{ cnt: pending.length, oldest_pending_sec: oldestSec }],
      };
    }

    return { rowCount: 0, rows: [] };
  }

  return {
    rows,
    query,
    connect: async () => ({
      query,
      release: () => {},
    }),
  };
}

test('P0-2 Passo 1 & 2: Diagnóstico read-only, desativação de gravação de TICK órfão por padrão no dev-live-feed e arquivamento seguro em lotes de 10k com SKIP LOCKED', async () => {
  const liveMarketStoreMod = await import('../../services/tick-engine/live-market-store.mjs');
  const outboxDiagMod = await import('../../scripts/diag/outbox-diagnostic.mjs');

  assert.equal(
    typeof liveMarketStoreMod.archiveLegacyPendingOutbox,
    'function',
    'live-market-store.mjs deve exportar archiveLegacyPendingOutbox para arquivar pendentes antigos em lotes de 10k'
  );
  assert.equal(
    typeof liveMarketStoreMod.pruneProcessedAndArchivedOutbox,
    'function',
    'live-market-store.mjs deve exportar pruneProcessedAndArchivedOutbox para retenção de 7 dias'
  );
  assert.equal(
    typeof outboxDiagMod.runOutboxDiagnostic,
    'function',
    'scripts/diag/outbox-diagnostic.mjs deve exportar runOutboxDiagnostic (Passo 1)'
  );

  // Verifica que dev-live-feed.mjs desabilita a gravação de TICK na outbox por padrão (enableTickOutbox)
  const devLiveFeedSrc = fs.readFileSync(DEV_LIVE_FEED_PATH, 'utf8');
  assert.equal(
    devLiveFeedSrc.includes('OUTBOX_WRITE_TICK_EVENTS'),
    true,
    'dev-live-feed.mjs deve controlar enableTickOutbox via OUTBOX_WRITE_TICK_EVENTS (default false)'
  );

  // Verifica que outbox-relay processa em lotes de 500 com FOR UPDATE SKIP LOCKED e FAILED após 5 tentativas
  const outboxRelaySrc = fs.readFileSync(OUTBOX_RELAY_PATH, 'utf8');
  assert.equal(
    outboxRelaySrc.includes('LIMIT 500'),
    true,
    'services/outbox-relay/src/index.ts deve usar LIMIT 500 com FOR UPDATE SKIP LOCKED'
  );

  // Simula 25.000 eventos PENDING antigos (anteriores ao cutoff) + 5 eventos PENDING novos (posteriores ao cutoff)
  const nowMs = Date.now();
  const cutoffIso = new Date(nowMs - 60_000).toISOString();
  const initialEvents = [];
  for (let i = 0; i < 25_000; i++) {
    initialEvents.push({
      id: `old-${i}`,
      event_type: 'TICK',
      status: 'PENDING',
      created_at: new Date(nowMs - 3_600_000 - i * 10),
    });
  }
  for (let i = 0; i < 5; i++) {
    initialEvents.push({
      id: `new-${i}`,
      event_type: 'RESERVE_STAKE',
      status: 'PENDING',
      created_at: new Date(nowMs - 10_000 + i * 100),
    });
  }

  const simPool = createOutboxPgSimulator(initialEvents);

  // Passo 1: Diagnóstico antes do arquivamento
  const diagBefore = await outboxDiagMod.runOutboxDiagnostic(simPool);
  assert.equal(diagBefore.read_only, true);
  assert.equal(diagBefore.groups.length, 2);

  // Passo 2: Arquiva os 25.000 antigos em lotes de 10.000 (deve rodar 3 lotes: 10000 + 10000 + 5000 = 25000)
  const archiveRes = await liveMarketStoreMod.archiveLegacyPendingOutbox(simPool, {
    cutoffIso,
    batchLimit: 10_000,
  });
  assert.equal(archiveRes.totalArchived, 25_000, 'Todos os 25.000 eventos antigos devem virar ARCHIVED');
  assert.equal(archiveRes.batchesExecuted, 3, '25.000 eventos em lotes de 10k devem executar 3 lotes');

  const remainingPending = simPool.rows.filter((r) => r.status === 'PENDING');
  assert.equal(remainingPending.length, 5, 'Os 5 eventos novos posteriores ao cutoff devem continuar PENDING');
});

test('P0-2 Passo 3 & 4: Retenção de 7 dias para PROCESSED/ARCHIVED em lotes e métrica outbox_oldest_pending_seconds com alerta > 300s', async () => {
  const liveMarketStoreMod = await import('../../services/tick-engine/live-market-store.mjs');

  const nowMs = Date.now();
  const eightDaysAgo = new Date(nowMs - 8 * 24 * 3_600 * 1000);
  const twoDaysAgo = new Date(nowMs - 2 * 24 * 3_600 * 1000);
  const sixMinutesAgo = new Date(nowMs - 360 * 1000); // 360s > 300s -> alerta!

  const simPool = createOutboxPgSimulator([
    { id: 'proc-old-1', event_type: 'RESERVE_STAKE', status: 'PROCESSED', created_at: eightDaysAgo },
    { id: 'arch-old-2', event_type: 'TICK', status: 'ARCHIVED', created_at: eightDaysAgo },
    { id: 'proc-recent-3', event_type: 'CONTRACT_SETTLED', status: 'PROCESSED', created_at: twoDaysAgo },
    { id: 'fail-old-4', event_type: 'CONTRACT_SETTLED', status: 'FAILED', created_at: eightDaysAgo },
    { id: 'pend-stuck-5', event_type: 'RESERVE_STAKE', status: 'PENDING', created_at: sixMinutesAgo },
  ]);

  // Passo 3: Retenção de 7 dias apaga apenas PROCESSED e ARCHIVED > 7 dias (preserva FAILED, PENDING e recentes < 7d)
  const retentionRes = await liveMarketStoreMod.pruneProcessedAndArchivedOutbox(simPool, {
    retentionDays: 7,
    batchLimit: 10_000,
  });
  assert.equal(retentionRes.deletedCount, 2, 'Apenas proc-old-1 e arch-old-2 (> 7 dias) devem ser removidos');
  assert.equal(simPool.rows.length, 3);
  assert.equal(simPool.rows.some((r) => r.id === 'fail-old-4'), true, 'Eventos FAILED nunca devem ser apagados pelo job de retenção');
  assert.equal(simPool.rows.some((r) => r.id === 'proc-recent-3'), true, 'Eventos PROCESSED com < 7 dias devem ser mantidos');

  // Passo 4: Métrica outbox_oldest_pending_seconds e alerta > 300s
  const outboxStats = await liveMarketStoreMod.queryOutboxPendingMetrics(simPool);
  assert.equal(outboxStats.outbox_pending_total, 1);
  assert.ok(outboxStats.outbox_oldest_pending_seconds >= 350, `Esperado >= 350s, obtido ${outboxStats.outbox_oldest_pending_seconds}`);
  assert.equal(outboxStats.outbox_oldest_pending_alert, 1, 'Deve disparar alerta (1) quando outbox_oldest_pending_seconds > 300s');

  // Confere exposição em scripts/dev-live-feed.mjs (/metrics)
  const devLiveFeedSrc = fs.readFileSync(DEV_LIVE_FEED_PATH, 'utf8');
  assert.equal(
    devLiveFeedSrc.includes('outbox_oldest_pending_seconds'),
    true,
    '/metrics em dev-live-feed.mjs deve expor outbox_oldest_pending_seconds'
  );
});
