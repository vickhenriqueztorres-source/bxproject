/**
 * tests/test-subetapa-5-dev-feed-admin.mjs
 * Validação rigorosa da Subetapa 05: Dev Live Feed & Dual-Alias
 */
import assert from 'node:assert';
const WebSocket = globalThis.WebSocket;

const BASE_URL = 'http://127.0.0.1:3001';
const WS_URL = 'ws://127.0.0.1:3001/ticks';

async function run() {
  console.log('🧪 Iniciando Testes da Subetapa 05 (Dev Live Feed & Dual-Alias)...');

  // 1. Teste /candles com canonical e legacy
  console.log('1️⃣ Testando /candles com VOL_50 e SYNTH_VOL_50...');
  const resCandlesCanon = await fetch(`${BASE_URL}/candles?symbol=VOL_50&timeframe=60&limit=5`);
  assert.strictEqual(resCandlesCanon.status, 200, '/candles VOL_50 deve retornar 200');
  const candlesCanon = await resCandlesCanon.json();
  assert(Array.isArray(candlesCanon) && candlesCanon.length > 0, 'Deve retornar array de velas');

  const resCandlesLegacy = await fetch(`${BASE_URL}/candles?symbol=SYNTH_VOL_50&timeframe=60&limit=5`);
  assert.strictEqual(resCandlesLegacy.status, 200, '/candles SYNTH_VOL_50 deve retornar 200 via fallback');
  const candlesLegacy = await resCandlesLegacy.json();
  assert(Array.isArray(candlesLegacy) && candlesLegacy.length > 0, 'Deve retornar array de velas no fallback');
  console.log('   ✅ /candles dual-alias validado com sucesso.');

  // 2. Teste /api/v1/chart/history
  console.log('2️⃣ Testando /api/v1/chart/history com VOL_10 e SYNTH_VOL_10...');
  const resHistoryCanon = await fetch(`${BASE_URL}/api/v1/chart/history?symbol=VOL_10&limit=5`);
  assert.strictEqual(resHistoryCanon.status, 200, '/api/v1/chart/history VOL_10 deve retornar 200');
  const histCanon = await resHistoryCanon.json();
  assert.strictEqual(histCanon.s, 'ok', 'Status deve ser ok');
  assert(Array.isArray(histCanon.c) && histCanon.c.length > 0, 'Deve conter array de close');

  const resHistoryLegacy = await fetch(`${BASE_URL}/api/v1/chart/history?symbol=SYNTH_VOL_10&limit=5`);
  assert.strictEqual(resHistoryLegacy.status, 200, '/api/v1/chart/history SYNTH_VOL_10 deve retornar 200');
  const histLegacy = await resHistoryLegacy.json();
  assert.strictEqual(histLegacy.s, 'ok', 'Deve resolver alias para canonical e retornar ok');
  assert(Array.isArray(histLegacy.c) && histLegacy.c.length > 0, 'Deve conter array de close');
  console.log('   ✅ /api/v1/chart/history dual-alias validado com sucesso.');

  // 3. Teste /api/v1/snapshot
  console.log('3️⃣ Testando /api/v1/snapshot com CRASH_BOOM_100 e SYNTH_CRASH_BOOM_100...');
  const resSnapCanon = await fetch(`${BASE_URL}/api/v1/snapshot?symbol=CRASH_BOOM_100`);
  assert.strictEqual(resSnapCanon.status, 200, 'Snapshot canonical deve retornar 200');
  const snapCanon = await resSnapCanon.json();
  assert.strictEqual(snapCanon.symbol, 'CRASH_BOOM_100', 'Snapshot symbol deve ser CRASH_BOOM_100');

  const resSnapLegacy = await fetch(`${BASE_URL}/api/v1/snapshot?symbol=SYNTH_CRASH_BOOM_100`);
  assert.strictEqual(resSnapLegacy.status, 200, 'Snapshot legacy deve retornar 200');
  const snapLegacy = await resSnapLegacy.json();
  assert.strictEqual(snapLegacy.symbol, 'CRASH_BOOM_100', 'Snapshot legacy deve resolver para CRASH_BOOM_100');
  console.log('   ✅ /api/v1/snapshot dual-alias validado com sucesso.');

  // 4. Teste /api/contracts POST (abertura com canonical e legacy)
  console.log('4️⃣ Testando POST /api/contracts com canonical VOL_50 e legacy SYNTH_VOL_75...');
  const resOrder1 = await fetch(`${BASE_URL}/api/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'VOL_50', direction: 'UP', stake_minor: 1000, duration_seconds: 30 })
  });
  assert.strictEqual(resOrder1.status, 201, 'Ordem canonical deve retornar 201');
  const order1 = await resOrder1.json();
  assert.strictEqual(order1.contract.symbol, 'VOL_50', 'Ordem gravada deve ter canonical symbol');

  const resOrder2 = await fetch(`${BASE_URL}/api/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'SYNTH_VOL_75', direction: 'DOWN', stake_minor: 1000, duration_seconds: 30 })
  });
  assert.strictEqual(resOrder2.status, 201, 'Ordem legacy deve retornar 201');
  const order2 = await resOrder2.json();
  assert.strictEqual(order2.contract.symbol, 'VOL_75', 'Ordem gravada deve ter resolvido para canonical VOL_75');
  console.log('   ✅ POST /api/contracts dual-alias validado com sucesso.');

  // 5. Teste WebSocket feed em tempo real com subscribe canonical e legacy
  console.log('5️⃣ Testando WebSocket ws://127.0.0.1:3001/ticks com dual-alias...');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout aguardando ticks do WebSocket'));
    }, 8000);

    let receivedCanonTick = false;
    let receivedLegacyTick = false;

    ws.addEventListener('open', () => {
      // Inscreve no canonical e legacy
      ws.send(JSON.stringify({ type: 'subscribe', symbol: 'VOL_25' }));
      ws.send(JSON.stringify({ type: 'subscribe', symbol: 'SYNTH_VOL_100' }));
    });

    ws.addEventListener('message', (event) => {
      const data = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      if (data.type === 'tick') {
        if (data.symbol === 'VOL_25') {
          receivedCanonTick = true;
        }
        if (data.symbol === 'VOL_100') {
          receivedLegacyTick = true;
        }
        if (receivedCanonTick && receivedLegacyTick) {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      }
    });

    ws.addEventListener('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  console.log('   ✅ WebSocket dual-alias (streaming de ticks) validado com sucesso.');

  console.log('\n🎉 [SUBETAPA 05] TODOS OS TESTES PASSARAM COM SUCESSO! GATE 5 HOMOLOGADO.');
}

run().catch((err) => {
  console.error('❌ Falha na validação da Subetapa 05:', err);
  process.exit(1);
});
