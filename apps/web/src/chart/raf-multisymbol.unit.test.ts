import { describe, it, expect, vi } from 'vitest';
import { RafChartUpdater } from './raf-updater';
import type { Tick } from '../feed/protocol';

describe('SUBETAPA 01: Desbloqueio Sequencial e Isolamento Multi-Ativo no RafUpdater', () => {
  it('deve processar ticks de novo ativo mesmo quando a sequência numérica for inferior ao ativo anterior', () => {
    let capturedRafCb: FrameRequestCallback | null = null;
    const mockRaf = vi.fn((cb: FrameRequestCallback) => {
      capturedRafCb = cb;
      return 1;
    });
    const mockCancelRaf = vi.fn();

    const updater = new RafChartUpdater(mockRaf, mockCancelRaf);
    const renderedTicks: Tick[] = [];
    const onRender = (t: Tick) => renderedTicks.push(t);

    // 1. Envia ticks para SYNTH_VOL_50 com sequência alta (50.000)
    updater.push(
      { type: 'tick', symbol: 'SYNTH_VOL_50', sequence: 50000, price: '1000.50', ts: new Date().toISOString() },
      onRender
    );
    expect(mockRaf).toHaveBeenCalledTimes(1);
    capturedRafCb!(performance.now());
    expect(renderedTicks.length).toBe(1);
    expect(renderedTicks[0].symbol).toBe('SYNTH_VOL_50');

    // 2. Agora o usuário alterna para EURUSD_OTC que inicia em sequência baixa (100)
    // Sem isolamento multissímbolo, este tick seria descartado como duplicata defasada (100 <= 50000)
    updater.push(
      { type: 'tick', symbol: 'EURUSD_OTC', sequence: 100, price: '1.08500', ts: new Date().toISOString() },
      onRender
    );
    expect(mockRaf).toHaveBeenCalledTimes(2);
    capturedRafCb!(performance.now());

    expect(renderedTicks.length).toBe(2);
    expect(renderedTicks[1].symbol).toBe('EURUSD_OTC');
    expect(renderedTicks[1].price).toBe('1.08500');

    // 3. Verifica que a sequência interna de EURUSD_OTC continua estritamente monotônica
    // Tick com seq 99 em EURUSD_OTC deve ser descartado
    updater.push(
      { type: 'tick', symbol: 'EURUSD_OTC', sequence: 99, price: '1.08510', ts: new Date().toISOString() },
      onRender
    );
    expect(mockRaf).toHaveBeenCalledTimes(2); // Não disparou novo rAF
    expect(updater.getStats().dropped).toBe(1);

    // Tick com seq 101 em EURUSD_OTC deve ser aceito
    updater.push(
      { type: 'tick', symbol: 'EURUSD_OTC', sequence: 101, price: '1.08520', ts: new Date().toISOString() },
      onRender
    );
    expect(mockRaf).toHaveBeenCalledTimes(3);
    capturedRafCb!(performance.now());
    expect(renderedTicks.length).toBe(3);
    expect(renderedTicks[2].sequence).toBe(101);
  });

  it('reset(symbol) deve expurgar a sequência e o tick pendente sem vazar para o próximo ciclo', () => {
    let capturedRafCb: FrameRequestCallback | null = null;
    const mockRaf = vi.fn((cb: FrameRequestCallback) => {
      capturedRafCb = cb;
      return 42;
    });
    const mockCancelRaf = vi.fn();

    const updater = new RafChartUpdater(mockRaf, mockCancelRaf);
    const renderedTicks: Tick[] = [];

    // Enfileira tick de BTCUSD
    updater.push(
      { type: 'tick', symbol: 'BTCUSD_OTC', sequence: 9999, price: '64000.00', ts: new Date().toISOString() },
      (t) => renderedTicks.push(t)
    );
    expect(updater.getStats().isPending).toBe(true);

    // Reset chamado ao trocar de tela / ativo
    updater.reset('BTCUSD_OTC');
    expect(mockCancelRaf).toHaveBeenCalledWith(42);
    expect(updater.getStats().isPending).toBe(false);

    // Se o rAF antigo disparar por anomalia do browser, nada deve ser processado
    const cb = capturedRafCb as ((time: number) => void) | null;
    if (cb) {
      cb(performance.now());
    }
    expect(renderedTicks.length).toBe(0);
  });

  it('Stress Test: rajada de 2.000 ticks entre 4 pares simultâneos sem corrupção de estado', () => {
    const executedTicks: Tick[] = [];
    // Executa callbacks síncronos imediatos para estressar o motor
    const syncRaf = (cb: FrameRequestCallback) => {
      cb(performance.now());
      return 1;
    };
    const updater = new RafChartUpdater(syncRaf as any, vi.fn());

    const symbols = ['SYNTH_VOL_50', 'EURUSD_OTC', 'BTCUSD_OTC', 'ETHUSD_OTC'];
    const counters = { SYNTH_VOL_50: 1000, EURUSD_OTC: 50, BTCUSD_OTC: 500000, ETHUSD_OTC: 10 };

    for (let i = 0; i < 2000; i++) {
      const sym = symbols[i % symbols.length];
      counters[sym as keyof typeof counters] += 1;
      const seq = counters[sym as keyof typeof counters];

      updater.push(
        {
          type: 'tick',
          symbol: sym,
          sequence: seq,
          price: (100 + i * 0.01).toFixed(4),
          ts: new Date().toISOString(),
        },
        (t) => executedTicks.push(t)
      );
    }

    expect(executedTicks.length).toBe(2000);
    const stats = updater.getStats();
    expect(stats.dropped).toBe(0);
    expect(stats.rendered).toBe(2000);
  });
});
