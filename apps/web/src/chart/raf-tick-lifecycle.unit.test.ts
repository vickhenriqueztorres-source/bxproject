import { describe, it, expect, vi } from 'vitest';
import { RafChartUpdater } from './raf-updater';
import type { Tick } from '../feed/protocol';

describe('[SUBETAPA 02] RafChartUpdater — Motor rAF e Ciclo de Vida de Ticks', () => {
  const createMockTick = (price: string | number, sequence: number): Tick => ({
    type: 'tick',
    sequence,
    symbol: 'SYNTH_VOL_50',
    price: String(price),
    ts: new Date().toISOString(),
    event_time: Date.now(),
    latency_ms: 12,
  });

  it('RAF-01: Coalesce rajada de 100 ticks consecutivos no mesmo frame gerando exatamente 1 render', () => {
    let queuedCb: FrameRequestCallback | null = null;
    const customRaf = (cb: FrameRequestCallback) => {
      queuedCb = cb;
      return 1;
    };
    const customCancel = vi.fn();

    const updater = new RafChartUpdater(customRaf, customCancel);
    const renderCallback = vi.fn();

    // Dispara 100 ticks velozes com sequência estritamente crescente
    for (let i = 1; i <= 100; i++) {
      updater.push(createMockTick(100 + i * 0.1, i), renderCallback);
    }

    const statsBefore = updater.getStats();
    expect(statsBefore.dropped).toBe(99); // 99 descartados por coalescência
    expect(statsBefore.isPending).toBe(true);
    expect(renderCallback).not.toHaveBeenCalled();

    // Executa o frame de 60fps acumulado
    if (queuedCb) (queuedCb as FrameRequestCallback)(performance.now());

    expect(renderCallback).toHaveBeenCalledTimes(1);
    expect(renderCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        price: '110', // Último tick consolidado
        sequence: 100,
      })
    );

    const statsAfter = updater.getStats();
    expect(statsAfter.rendered).toBe(1);
    expect(statsAfter.isPending).toBe(false);
  });

  it('RAF-02: Descarta defensivamente preços malformados (NaN, <= 0, strings inválidas)', () => {
    const customRaf = vi.fn();
    const updater = new RafChartUpdater(customRaf);
    const renderCallback = vi.fn();

    // Ticks com preços ilegais
    updater.push({ ...createMockTick('100', 1), price: 'NaN' }, renderCallback);
    updater.push({ ...createMockTick('100', 2), price: '-50.2' }, renderCallback);
    updater.push({ ...createMockTick('100', 3), price: '0' }, renderCallback);
    updater.push({ ...createMockTick('100', 4), price: 'null' }, renderCallback);

    expect(customRaf).not.toHaveBeenCalled();
    expect(updater.getStats().dropped).toBe(4);
    expect(updater.getStats().isPending).toBe(false);
  });

  it('RAF-03: Monotonicidade estrita — descarta ticks fora de ordem ou duplicados (F-06)', () => {
    let queuedCb: ((time: number) => void) | null = null;
    const updater = new RafChartUpdater((cb) => {
      queuedCb = cb;
      return 1;
    });
    const renderCallback = vi.fn();

    // Tick 10
    updater.push(createMockTick(105, 10), renderCallback);
    if (queuedCb) (queuedCb as any)(performance.now());
    expect(renderCallback).toHaveBeenCalledTimes(1);

    // Ticks antigos chegando com atraso de rede (sequence 8 e 9)
    updater.push(createMockTick(104, 8), renderCallback);
    updater.push(createMockTick(104.5, 9), renderCallback);
    updater.push(createMockTick(105, 10), renderCallback); // duplicado

    // Nenhum render deve ser agendado para ticks defasados
    expect(updater.getStats().isPending).toBe(false);
    expect(renderCallback).toHaveBeenCalledTimes(1);

    // Tick 11 válido avança o cursor
    updater.push(createMockTick(106, 11), renderCallback);
    expect(updater.getStats().isPending).toBe(true);
    if (queuedCb) (queuedCb as any)(performance.now());
    expect(renderCallback).toHaveBeenCalledTimes(2);
  });

  it('RAF-04: Pausa e retomada graciosa sem acúmulo de frames quando em segundo plano', () => {
    const cancelSpy = vi.fn();
    let queuedCb: ((time: number) => void) | null = null;
    const updater = new RafChartUpdater(
      (cb) => {
        queuedCb = cb;
        return 999;
      },
      cancelSpy
    );
    const renderCallback = vi.fn();

    updater.push(createMockTick(100, 1), renderCallback);
    expect(updater.getStats().isPending).toBe(true);

    // Entra em segundo plano (aba oculta)
    updater.pause();
    expect(cancelSpy).toHaveBeenCalledWith(999);
    expect(updater.getStats().isPaused).toBe(true);

    // Novos ticks enquanto pausado são retidos sem agendar rAF
    updater.push(createMockTick(101, 2), renderCallback);
    expect(updater.getStats().isPending).toBe(true);

    // Volta ao primeiro plano (aba ativa)
    updater.resume(renderCallback);
    expect(updater.getStats().isPaused).toBe(false);
    if (queuedCb) (queuedCb as any)(performance.now());
    expect(renderCallback).toHaveBeenCalledWith(expect.objectContaining({ price: '101' }));
  });

  it('RAF-05: Reset de sequência permite alternância segura entre múltiplos ativos', () => {
    const updater = new RafChartUpdater();
    updater.push(createMockTick(100, 5000), vi.fn());
    expect(updater.getStats().lastSequence).toBe('5000');

    // Ao mudar de ativo, a sequência do novo ativo pode começar em 1
    updater.resetSequence();
    expect(updater.getStats().lastSequence).toBe('0');

    // Aceita sequência menor após o reset
    updater.push(createMockTick(200, 1), vi.fn());
    expect(updater.getStats().lastSequence).toBe('1');
  });
});
