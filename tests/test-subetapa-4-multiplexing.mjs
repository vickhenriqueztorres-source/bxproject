import assert from 'node:assert';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 4 (Fan-Out): Multiplexação em Lote (1 Socket = N Símbolos)');

const WS_URL = 'ws://localhost:3001/ticks';

async function runTests() {
  const ws = new globalThis.WebSocket(WS_URL);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const messagesReceived = [];
  ws.onmessage = (event) => {
    try {
      messagesReceived.push(JSON.parse(String(event.data)));
    } catch {}
  };

  // 1. Autenticação do socket único
  ws.send(JSON.stringify({ type: 'auth' }));
  await new Promise(r => setTimeout(r, 100));

  const authMsg = messagesReceived.find(m => m.type === 'auth_ok' || m.type === 'authenticated');
  assert.ok(authMsg, 'Socket único deve autenticar com sucesso');
  console.log('  ✅ [PASS] Conexão WebSocket única estabelecida e autenticada');

  // 2. Subscrição em lote (Batch Subscribe) de 4 símbolos em uma única mensagem
  const batchSymbols = ['EURUSD_OTC', 'BTCUSD_OTC', 'ETHUSD_OTC', 'SOLUSD_OTC'];
  ws.send(JSON.stringify({
    type: 'subscribe',
    symbols: batchSymbols
  }));

  await new Promise(r => setTimeout(r, 200));

  const subscribedSymbols = messagesReceived
    .filter(m => m.type === 'subscribed')
    .map(m => m.symbol);

  for (const sym of batchSymbols) {
    assert.ok(subscribedSymbols.includes(sym), `Símbolo ${sym} deve constar entre os inscritos`);
  }
  console.log('  ✅ [PASS] Subscrição multiplexada em lote de 4 ativos confirmada em 1 único socket');

  // 3. Teste de Borda: Tentativa de ultrapassar o limite de 10 símbolos
  // Já temos 4. Tentar adicionar 7 novos símbolos (4 + 7 = 11 > 10)
  const overflowBatch = [
    'ADAUSD_OTC', 'DOGEUSD_OTC', 'DOTUSD_OTC', 'AVAXUSD_OTC',
    'LINKUSD_OTC', 'LTCUSD_OTC', 'XAUUSD_OTC'
  ];
  ws.send(JSON.stringify({
    type: 'subscribe',
    symbols: overflowBatch
  }));

  await new Promise(r => setTimeout(r, 200));

  const errorMsg = messagesReceived.find(m => m.type === 'error' && m.message.includes('Max 10'));
  assert.ok(errorMsg, 'Servidor deve rejeitar tentativa que exceda 10 subscrições na mesma conexão');
  console.log('  ✅ [PASS] Teto institucional de 10 subscrições por conexão validado com sucesso');

  // 4. Recepção de ticks multiplexados de múltiplos ativos no mesmo socket
  // Aguarda 1.2s para ticks chegarem pelo broadcast
  await new Promise(r => setTimeout(r, 1200));
  const tickSymbolsReceived = new Set(
    messagesReceived.filter(m => m.type === 'tick').map(m => m.symbol)
  );

  assert.ok(tickSymbolsReceived.size >= 2, 'Pelo menos 2 dos ativos subscritos devem ter emitido ticks multiplexados');
  console.log(`  ✅ [PASS] Ticks multiplexados de ${tickSymbolsReceived.size} símbolos recebidos na mesma conexão TCP`);

  // 5. Desinscrição em lote (Batch Unsubscribe)
  ws.send(JSON.stringify({
    type: 'unsubscribe',
    symbols: ['BTCUSD_OTC', 'ETHUSD_OTC']
  }));
  await new Promise(r => setTimeout(r, 100));

  const unsubscribed = messagesReceived
    .filter(m => m.type === 'unsubscribed')
    .map(m => m.symbol);

  assert.ok(unsubscribed.includes('BTCUSD_OTC'));
  assert.ok(unsubscribed.includes('ETHUSD_OTC'));
  console.log('  ✅ [PASS] Desinscrição em lote processada com sucesso');

  ws.close();

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 4 (MULTIPLEXING BATCH SUBSCRIBE) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 4:', err);
  process.exit(1);
});
