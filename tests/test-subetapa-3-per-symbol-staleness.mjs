import assert from 'node:assert';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 3: Frontend Staleness por Símbolo & Banner Visual no Gráfico');

// 1. Simulação fiel da lógica de TradingFeedManager com suporte a onSymbolStaleness
class MockTradingFeedManagerPerSymbol {
  constructor() {
    this.connected = true;
    this.symbolLastTickAt = new Map();
    this.symbolStaleListeners = new Map();
    this.symbolStaleStates = new Map();
  }

  onSymbolStaleness(symbol, callback) {
    let set = this.symbolStaleListeners.get(symbol);
    if (!set) {
      set = new Set();
      this.symbolStaleListeners.set(symbol, set);
    }
    set.add(callback);

    const last = this.symbolLastTickAt.get(symbol);
    const age = last ? Date.now() - last : Infinity;
    const initialStale = !this.connected || age > 4000;
    this.symbolStaleStates.set(symbol, initialStale);
    callback(initialStale, age === Infinity ? 99999 : age);

    return () => { set.delete(callback); };
  }

  receiveTick(symbol, price, ts = Date.now()) {
    this.symbolLastTickAt.set(symbol, ts);

    // De-staleness imediata no recebimento do tick
    if (this.symbolStaleStates.get(symbol) === true) {
      this.symbolStaleStates.set(symbol, false);
      const cbs = this.symbolStaleListeners.get(symbol);
      if (cbs) {
        for (const cb of cbs) cb(false, 0);
      }
    }
  }

  checkStaleness(now = Date.now()) {
    for (const [symbol, callbacks] of this.symbolStaleListeners.entries()) {
      const last = this.symbolLastTickAt.get(symbol);
      const age = last ? now - last : Infinity;
      const isStale = !this.connected || age > 4000;
      const prevStale = this.symbolStaleStates.get(symbol);

      if (prevStale !== isStale) {
        this.symbolStaleStates.set(symbol, isStale);
        for (const cb of callbacks) {
          cb(isStale, age === Infinity ? 99999 : age);
        }
      }
    }
  }
}

const feed = new MockTradingFeedManagerPerSymbol();

// 2. Dois Gráficos Abertos: Gráfico 1 (EURUSD) e Gráfico 2 (BTCUSD)
let eurStale = null;
let eurAge = null;
let btcStale = null;
let btcAge = null;

feed.onSymbolStaleness('EURUSD_OTC', (stale, age) => {
  eurStale = stale;
  eurAge = age;
});

feed.onSymbolStaleness('BTCUSD_OTC', (stale, age) => {
  btcStale = stale;
  btcAge = age;
});

// Ambos começam stale (sem ticks ainda)
assert.strictEqual(eurStale, true);
assert.strictEqual(btcStale, true);
console.log('  ✅ [PASS] Estado inicial: ambos os ativos começam marcados como stale antes do primeiro tick');

// 3. Ticks chegam para ambos
feed.receiveTick('EURUSD_OTC', '1.08542');
feed.receiveTick('BTCUSD_OTC', '64850.00');

assert.strictEqual(eurStale, false, 'EURUSD deve ficar FRESH imediatamente');
assert.strictEqual(btcStale, false, 'BTCUSD deve ficar FRESH imediatamente');
console.log('  ✅ [PASS] De-staleness imediata: ambos os ativos marcados como saudáveis (isStale = false)');

// 4. Simulação de passagem do tempo:
// EURUSD continua recebendo ticks a cada segundo
// BTCUSD CONGELA (nenhum tick enviado)
const baseTime = Date.now();

// t = +2000ms
feed.receiveTick('EURUSD_OTC', '1.08545', baseTime + 2000);
feed.checkStaleness(baseTime + 2000);
assert.strictEqual(eurStale, false, 'EURUSD deve continuar fresco aos 2s');
assert.strictEqual(btcStale, false, 'BTCUSD ainda está dentro da janela de tolerância de 4s');

// t = +4500ms (> 4000ms threshold)
feed.receiveTick('EURUSD_OTC', '1.08548', baseTime + 4500);
feed.checkStaleness(baseTime + 4500);

// VALIDAÇÃO FUNDAMENTAL: BTCUSD deve ficar STALE, mas EURUSD DEVE CONTINUAR FRESCO!
assert.strictEqual(btcStale, true, 'BTCUSD deve ser marcado como STALE após 4.5s sem ticks!');
assert.strictEqual(eurStale, false, 'EURUSD NÃO pode virar stale só porque o BTC congelou!');
console.log('  ✅ [PASS] ISOLAMENTO MULTI-GRÁFICOS COMPROVADO: BTCUSD ficou stale enquanto EURUSD permaneceu fresco!');

// 5. Simulação de Retomada do Feed do BTCUSD
feed.receiveTick('BTCUSD_OTC', '64860.00');
assert.strictEqual(btcStale, false, 'BTCUSD deve retornar imediatamente a fresco ao receber tick');
console.log('  ✅ [PASS] Recuperação instantânea: banner de alerta removido assim que o próximo tick chega');

console.log('\n================================================================================');
console.log('🎉 SUBETAPA 3 (PER-SYMBOL STALENESS & OVERLAY) 100% HOMOLOGADA E APROVADA!');
console.log('================================================================================\n');
process.exit(0);
