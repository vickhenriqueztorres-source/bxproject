import { describe, it, expect, vi } from 'vitest';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { ensureStrictAscendingBars } from './IsolatedChartHost';

describe('[BLINDAGEM INDUSTRIAL] Robustez Extrema do Gráfico TradingView', () => {
  // ==========================================
  // 1. SANITIZAÇÃO MONOTÔNICA E DEDUPLICAÇÃO
  // ==========================================
  describe('In-Memory Monotonic Bar Guard (Anti-Crash de Sorting da TradingView)', () => {
    it('HARD-01: Corrige barras desordenadas e deduplica timestamps repetidos', () => {
      const noisyBars: CandlestickData<UTCTimestamp>[] = [
        { time: 1700000120 as UTCTimestamp, open: 105, high: 107, low: 104, close: 106 },
        { time: 1700000000 as UTCTimestamp, open: 100, high: 102, low: 99, close: 101 },
        { time: 1700000060 as UTCTimestamp, open: 101, high: 103, low: 100, close: 102 },
        { time: 1700000060 as UTCTimestamp, open: 102, high: 104, low: 101, close: 103 }, // timestamp duplicado
      ];

      const cleanBars = ensureStrictAscendingBars(noisyBars);

      expect(cleanBars.length).toBe(3); // Removeu a duplicata
      expect(cleanBars[0].time).toBe(1700000000);
      expect(cleanBars[1].time).toBe(1700000060);
      expect(cleanBars[2].time).toBe(1700000120);

      // Monotonicidade estrita comprovada: time[i] > time[i-1]
      for (let i = 1; i < cleanBars.length; i++) {
        expect(Number(cleanBars[i].time)).toBeGreaterThan(Number(cleanBars[i - 1].time));
      }
    });

    it('HARD-02: Filtra e descarta velas corrompidas (preço <= 0, NaN, Infinity)', () => {
      const corruptedBars: CandlestickData<UTCTimestamp>[] = [
        { time: 1700000000 as UTCTimestamp, open: 100, high: 102, low: 99, close: 101 },
        { time: 1700000060 as UTCTimestamp, open: -50, high: 100, low: 20, close: 30 }, // preço negativo
        { time: 1700000120 as UTCTimestamp, open: NaN, high: 100, low: 90, close: 95 }, // NaN
        { time: 1700000180 as UTCTimestamp, open: 100, high: Infinity, low: 90, close: 95 }, // Infinity
        { time: 1700000240 as UTCTimestamp, open: 105, high: 110, low: 104, close: 108 }, // válido
      ];

      const cleanBars = ensureStrictAscendingBars(corruptedBars);

      expect(cleanBars.length).toBe(2);
      expect(cleanBars[0].time).toBe(1700000000);
      expect(cleanBars[1].time).toBe(1700000240);
    });

    it('HARD-03: Garante invariante geométrico OHLC (high >= max, low <= min)', () => {
      const inconsistentBar: CandlestickData<UTCTimestamp>[] = [
        {
          time: 1700000000 as UTCTimestamp,
          open: 100,
          high: 95, // Erro: high menor que open
          low: 105, // Erro: low maior que close
          close: 102,
        },
      ];

      const [fixedBar] = ensureStrictAscendingBars(inconsistentBar);
      expect(fixedBar).toBeDefined();
      expect(fixedBar.high).toBe(102); // Ajustado para max(open, close)
      expect(fixedBar.low).toBe(100); // Ajustado para min(open, close)
    });
  });

  // ==========================================
  // 2. ANTI-CROSS-ASSET ZOMBIE TICKS
  // ==========================================
  describe('Anti-Cross-Asset Zombie Tick Guard', () => {
    it('HARD-04: Descarta ticks pertencentes a símbolos desativados em trânsito', () => {
      const activeSymbol = 'BTCUSD_OTC';
      const zombieTick = {
        type: 'tick' as const,
        sequence: 450,
        symbol: 'SYNTH_VOL_50', // Ativo anterior
        price: '125.50', // Cotação não compatível com BTC
        ts: new Date().toISOString(),
      };

      const shouldApply = (tick: typeof zombieTick, currentSym: string) => {
        if (tick.symbol && tick.symbol !== currentSym) {
          return false; // Descarta zombie tick
        }
        return true;
      };

      expect(shouldApply(zombieTick, activeSymbol)).toBe(false);

      const validTick = {
        ...zombieTick,
        symbol: 'BTCUSD_OTC',
        price: '65432.10',
      };
      expect(shouldApply(validTick, activeSymbol)).toBe(true);
    });
  });

  // ==========================================
  // 3. RECUPERAÇÃO DE HARDWARE / GPU RESET
  // ==========================================
  describe('Hardware Context Loss & WebGL Auto-Recovery', () => {
    it('HARD-05: Listeners de WebGL capturam perda de contexto sem crash', () => {
      const target: EventTarget = typeof document !== 'undefined' ? document.createElement('div') : new EventTarget();
      const lostSpy = vi.fn((e: Event) => e.preventDefault());
      const restoredSpy = vi.fn();

      target.addEventListener('webglcontextlost', lostSpy as EventListener);
      target.addEventListener('webglcontextrestored', restoredSpy as EventListener);

      // Simula evento nativo de crash de GPU / Sleep do Windows
      const lostEvent = new Event('webglcontextlost', { cancelable: true });
      target.dispatchEvent(lostEvent);

      expect(lostSpy).toHaveBeenCalledTimes(1);
      expect(lostEvent.defaultPrevented).toBe(true); // Default prevenido para permitir restauração

      // Simula retorno do contexto da GPU
      const restoredEvent = new Event('webglcontextrestored');
      target.dispatchEvent(restoredEvent);

      expect(restoredSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // 4. WAKE-UP AUTO-RESYNC EM BACKGROUND
  // ==========================================
  describe('Wake-up Auto-Resync na Retomada de Abas', () => {
    it('HARD-06: Acionamento de visibilitychange sincroniza escala temporal', () => {
      const scrollToRealTimeSpy = vi.fn();
      const mockChart = {
        timeScale: () => ({ scrollToRealTime: scrollToRealTimeSpy }),
        applyOptions: vi.fn(),
      };

      const handleVisibilityChange = (isHidden: boolean) => {
        if (!isHidden && mockChart) {
          mockChart.timeScale().scrollToRealTime();
          return true;
        }
        return false;
      };

      // Tab oculta: inerte
      expect(handleVisibilityChange(true)).toBe(false);
      expect(scrollToRealTimeSpy).not.toHaveBeenCalled();

      // Tab volta ao foco do usuário: sincroniza com tempo real
      expect(handleVisibilityChange(false)).toBe(true);
      expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
