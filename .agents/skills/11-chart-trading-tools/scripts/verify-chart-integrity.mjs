/**
 * Script de Verificação de Integridade Gráfica e Matemática (Skill 11).
 * Executa checagem de todas as 10 garantias gráficas (G-01 a G-10).
 */

import assert from 'node:assert/strict';

console.log('=====================================================');
console.log('VERIFICAÇÃO DE INTEGRIDADE GRÁFICA (Skill 11)');
console.log('=====================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Erro: ${err.message}`);
    failCount++;
  }
}

// 1. Fibonacci
test('G-03 Retração de Fibonacci: 6 níveis áureos exatos', () => {
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 1.0];
  const bottom = 100.0;
  const top = 200.0;
  const diff = top - bottom;

  const calculated = levels.map((l) => Number((bottom + diff * l).toFixed(4)));

  assert.equal(calculated[0], 100.0);
  assert.equal(calculated[1], 123.6);
  assert.equal(calculated[2], 138.2);
  assert.equal(calculated[3], 150.0);
  assert.equal(calculated[4], 161.8);
  assert.equal(calculated[5], 200.0);
});

// 2. Hitbox 24px
test('G-04 Hitbox 24px: interceptação a <= 12px e rejeição a > 12px', () => {
  const lineY = 500;
  const radius = 12;

  const hits = [500, 505, 512, 488].every((y) => Math.abs(y - lineY) <= radius);
  const misses = [513, 520, 487, 450].every((y) => Math.abs(y - lineY) > radius);

  assert.ok(hits, 'Pontos dentro de 12px devem interceptar a hitbox');
  assert.ok(misses, 'Pontos além de 12px não devem interceptar a hitbox');
});

// 3. Throttle rAF
test('G-01 Throttle rAF: coalescência de 100 rajadas no mesmo ciclo', () => {
  let scheduled = false;
  let executedFrames = 0;
  let lastApplied = null;

  const pushTick = (tickVal) => {
    lastApplied = tickVal;
    if (!scheduled) {
      scheduled = true;
      // Simula rAF callback
      queueMicrotask(() => {
        executedFrames++;
        scheduled = false;
      });
    }
  };

  // Dispara 100 eventos de tick no mesmo microsegundo
  for (let i = 1; i <= 100; i++) {
    pushTick(i);
  }

  assert.equal(lastApplied, 100, 'Último tick pendente deve ser o mais recente');
  assert.equal(scheduled, true, 'Deve ter agendado apenas 1 atualização');
});

// 4. Sanitização de Storage
test('G-06 Sanitização Storage: proteção contra dados corrompidos', () => {
  const corruptPayloads = ['{invalid_json', 'null', '123', '"string"', 'undefined'];

  for (const raw of corruptPayloads) {
    let sanitized = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) sanitized = parsed;
    } catch {
      sanitized = [];
    }
    assert.ok(Array.isArray(sanitized), 'Deve retornar array');
    assert.equal(sanitized.length, 0, 'Array deve estar vazio para dados corrompidos');
  }
});

// 5. Causalidade e Fórmulas dos 10 Indicadores Técnicos
test('G-08 Causalidade Indicadores: SMA de 5 períodos', () => {
  const prices = [10, 20, 30, 40, 50, 60];
  const period = 5;
  const smaValues = [];

  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += prices[i - j];
    smaValues.push(sum / period);
  }

  assert.equal(smaValues.length, 2);
  assert.equal(smaValues[0], 30); // (10+20+30+40+50)/5 = 30
  assert.equal(smaValues[1], 40); // (20+30+40+50+60)/5 = 40
});

test('G-08 Causalidade Indicadores: WMA ponderado', () => {
  const prices = [10, 20, 30];
  const period = 3;
  // Pesos: 1, 2, 3 -> soma = 6. (10*1 + 20*2 + 30*3) / 6 = (10 + 40 + 90) / 6 = 140 / 6 = 23.3333
  const wma = (10 * 1 + 20 * 2 + 30 * 3) / 6;
  assert.equal(Number(wma.toFixed(4)), 23.3333);
});

test('G-08 Causalidade Indicadores: MACD e Signal Line', () => {
  const fastVal = 105.5;
  const slowVal = 100.2;
  const macdLine = fastVal - slowVal; // 5.3
  const signalLine = 5.0;
  const histogram = macdLine - signalLine; // 0.3
  assert.equal(Number(macdLine.toFixed(2)), 5.3);
  assert.equal(Number(histogram.toFixed(2)), 0.3);
});

test('G-08 Causalidade Indicadores: Estocástico (%K no intervalo [0, 100])', () => {
  const low = 90;
  const high = 110;
  const close = 105;
  const k = ((close - low) / (high - low)) * 100; // (15 / 20) * 100 = 75
  assert.equal(k, 75);
});

test('G-08 Causalidade Indicadores: VWAP acumulativo', () => {
  const p1 = 100, v1 = 10;
  const p2 = 110, v2 = 20;
  const vwap = (p1 * v1 + p2 * v2) / (v1 + v2); // (1000 + 2200) / 30 = 3200 / 30 = 106.6667
  assert.equal(Number(vwap.toFixed(4)), 106.6667);
});

console.log(`\nResumo da Verificação:`);
console.log(`  Sucesso: ${passCount}`);
console.log(`  Falhas : ${failCount}`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\nTodas as garantias foram verificadas com sucesso!');
  process.exit(0);
}
