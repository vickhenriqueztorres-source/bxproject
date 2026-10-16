/**
 * P0-2 Passo 1 — Diagnóstico Read-Only da Tabela outbox_events (scripts/diag/outbox-diagnostic.mjs)
 *
 * Executa:
 * 1) SELECT event_type, status, COUNT(*), MIN(created_at), MAX(created_at) FROM outbox_events GROUP BY 1, 2;
 * 2) pg_total_relation_size('outbox_events'), pg_table_size('outbox_events'), pg_indexes_size('outbox_events');
 * 3) Mapeamento estático de produtores e consumidores por event_type no repositório.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const EVENT_TYPE_CONSUMER_MAP = Object.freeze({
  TICK: {
    producers: [
      'services/tick-engine/live-market-store.mjs:229 (produceTick)',
      'services/tick-engine/live-market-store.mjs:398 (produceTicksBatch)',
    ],
    consumers: [],
    verdict:
      'SEM CONSUMIDOR EM PRODUÇÃO (Opção B): dev-live-feed.mjs publica ticks diretamente no WebSocket após o COMMIT; services/outbox-relay buscava TICK_GENERATED. Gravação desativada por padrão em dev-live-feed.mjs (OUTBOX_WRITE_TICK_EVENTS=false).',
  },
  RESERVE_STAKE: {
    producers: ['scripts/lib/settlement-engine.mjs:executeAtomicContractOpen'],
    consumers: ['services/outbox-relay/src/index.ts:94 (processOutboxBatch)'],
    verdict:
      'JÁ GRAVADO COMO PROCESSED na transação de abertura; outbox-relay consome eventuais PENDING legados com lote de 500 (FOR UPDATE SKIP LOCKED).',
  },
  CONTRACT_SETTLED: {
    producers: ['scripts/lib/settlement-engine.mjs:settleOpenContract'],
    consumers: ['services/outbox-relay/src/index.ts:106 (processOutboxBatch)'],
    verdict:
      'JÁ GRAVADO COMO PROCESSED na transação de liquidação; outbox-relay consome eventuais PENDING com lote de 500 (FOR UPDATE SKIP LOCKED).',
  },
});

export async function runOutboxDiagnostic(pgPool) {
  const groupRes = await pgPool.query(`
    SELECT
      event_type,
      status,
      COUNT(*)::bigint AS count,
      MIN(created_at) AS min_created_at,
      MAX(created_at) AS max_created_at
    FROM outbox_events
    GROUP BY 1, 2
    ORDER BY 1 ASC, 2 ASC
  `);

  const sizeRes = await pgPool.query(`
    SELECT
      pg_total_relation_size('outbox_events')::bigint AS total_bytes,
      pg_table_size('outbox_events')::bigint AS table_bytes,
      pg_indexes_size('outbox_events')::bigint AS index_bytes
  `);

  const sizeRow = sizeRes.rows[0] || { total_bytes: 0, table_bytes: 0, index_bytes: 0 };

  return {
    generated_at: new Date().toISOString(),
    read_only: true,
    relation_size: {
      total_bytes: Number(sizeRow.total_bytes || 0),
      table_bytes: Number(sizeRow.table_bytes || 0),
      index_bytes: Number(sizeRow.index_bytes || 0),
    },
    groups: groupRes.rows.map((r) => ({
      event_type: r.event_type,
      status: r.status,
      count: Number(r.count || 0),
      min_created_at: r.min_created_at ? new Date(r.min_created_at).toISOString() : null,
      max_created_at: r.max_created_at ? new Date(r.max_created_at).toISOString() : null,
      consumer_info: EVENT_TYPE_CONSUMER_MAP[r.event_type] || {
        producers: ['unknown'],
        consumers: [],
        verdict: 'Sem consumidor registrado no repositório',
      },
    })),
    consumer_mapping: EVENT_TYPE_CONSUMER_MAP,
  };
}

async function main() {
  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://synth_migrator:dev_secret_pw_123@127.0.0.1:5432/broker_platform';

  let Pool;
  try {
    const pgMod = require('../../node_modules/.pnpm/pg@8.23.1/node_modules/pg');
    Pool = (pgMod.default || pgMod).Pool;
  } catch {
    const pgMod = require('pg');
    Pool = (pgMod.default || pgMod).Pool;
  }

  const pool = new Pool({
    connectionString: dbUrl,
    max: 2,
    connectionTimeoutMillis: 3000,
  });

  try {
    await pool.query('BEGIN TRANSACTION READ ONLY');
    const report = await runOutboxDiagnostic(pool);
    await pool.query('ROLLBACK');
    console.log(JSON.stringify({ status: 'ok', ...report }, null, 2));
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          status: 'db_unreachable_or_offline',
          note: `Banco PostgreSQL não acessível localmente (${err.message}); mapeamento estático de consumidores incluído.`,
          read_only: true,
          consumer_mapping: EVENT_TYPE_CONSUMER_MAP,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
