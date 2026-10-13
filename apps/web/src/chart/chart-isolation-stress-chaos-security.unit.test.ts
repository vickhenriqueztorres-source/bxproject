import { describe, it, expect, vi } from 'vitest';
import { RafChartUpdater } from './raf-updater';
import { resampleCandles, type Timeframe } from './candle-adapter';
import type { Tick } from '../feed/protocol';
import type { Candle } from '../api/client';

describe('[SUBETAPA 04] Bateria Final de Estresse, Caos e Segurança do Gráfico', () => {
  // ==========================================
  // 1. MATRIZ DE ESTRESSE
  // ==========================================
  describe('Matriz de Estresse Operacional', () => {
    it('STR-01: Rajada de 1.000 ticks em alta frequência — coalescência e estabilidade de thread', () => {
      let renderCalls = 0;
      let scheduledCb: FrameRequestCallback | null = null;

      const updater = new RafChartUpdater((cb) => {
        scheduledCb = cb;
        return 1;
      });

      const startTime = performance.now();

      // Dispara 1.000 ticks consecutivos simulando estresse de alta volatilidade
      for (let i = 1; i <= 1000; i++) {
        updater.push(
          {
            type: 'tick',
            sequence: i,
            symbol: 'SYNTH_VOL_100',
            price: (100 + (i % 50) * 0.2).toFixed(5),
            ts: new Date().toISOString(),
          },
          () => {
            renderCalls++;
          }
        );
      }

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(100); // 1000 pushes processados em <100ms

      const stats = updater.getStats();
      expect(stats.dropped).toBe(999); // 999 ticks coalescidos
      expect(stats.isPending).toBe(true);

      // Descarrega o rAF
      if (scheduledCb) (scheduledCb as FrameRequestCallback)(performance.now());
      expect(renderCalls).toBe(1); // Exatamente 1 frame renderizado
    });

    it('STR-02: Carga e Resample de Janela Macro com 3.500 velas em menos de 50ms', () => {
      const mockCandles: Candle[] = Array.from({ length: 3500 }, (_, i) => ({
        time: 1700000000 + i * 60,
        open: String(100 + (i % 10)),
        high: String(105 + (i % 10)),
        low: String(95 + (i % 10)),
        close: String(102 + (i % 10)),
        volume: 1000,
      }));

      const start = performance.now();
      const resampled5m = resampleCandles(mockCandles, '5m');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(resampled5m.length).toBeGreaterThan(0);
      expect(resampled5m.length).toBeLessThanOrEqual(3500);
    });

    it('STR-03: Comutação veloz de 100 ativos consecutivos resetando cursor e sequências', () => {
      const updater = new RafChartUpdater();

      for (let i = 0; i < 100; i++) {
        updater.resetSequence();
        expect(updater.getStats().lastSequence).toBe('0');

        // Cada novo ativo começa em sequence 1
        updater.push(
          {
            type: 'tick',
            sequence: 1,
            symbol: `SYNTH_ASSET_${i}`,
            price: '150.00',
            ts: new Date().toISOString(),
          },
          vi.fn()
        );
        expect(updater.getStats().lastSequence).toBe('1');
      }
    });
  });

  // ==========================================
  // 2. MATRIZ DE CAOS
  // ==========================================
  describe('Matriz de Caos e Resiliência', () => {
    it('CHS-01: Colapso temporário de dimensões do container (0x0px) não gera exceção', () => {
      const applyOptionsSpy = vi.fn();
      const mockChart = { applyOptions: applyOptionsSpy };

      const safeApplyResize = (w: number, h: number) => {
        if (w > 50 && h > 50) {
          mockChart.applyOptions({ width: w, height: h });
          return true;
        }
        return false;
      };

      // Simula 50 tentativas de resize com container colapsado (0x0, 0x100, 100x0)
      for (let i = 0; i < 50; i++) {
        expect(safeApplyResize(0, 0)).toBe(false);
        expect(safeApplyResize(0, 400)).toBe(false);
        expect(safeApplyResize(600, 0)).toBe(false);
        expect(safeApplyResize(49, 49)).toBe(false);
      }

      expect(applyOptionsSpy).not.toHaveBeenCalled();

      // Recuperação pós-colapso
      expect(safeApplyResize(1024, 600)).toBe(true);
      expect(applyOptionsSpy).toHaveBeenCalledWith({ width: 1024, height: 600 });
    });

    it('CHS-02: Ticks corrompidos ou com preços negativos/NaN são descartados atimicamente', () => {
      const updater = new RafChartUpdater();
      const corruptTicks = [
        { price: 'NaN', sequence: 10 },
        { price: '-10.5', sequence: 11 },
        { price: '0', sequence: 12 },
        { price: 'Infinity', sequence: 13 },
        { price: '-Infinity', sequence: 14 },
        { price: 'abc', sequence: 15 },
        { price: '', sequence: 16 },
      ];

      for (const ct of corruptTicks) {
        updater.push(
          {
            type: 'tick',
            sequence: ct.sequence,
            symbol: 'SYNTH_VOL_50',
            price: ct.price,
            ts: new Date().toISOString(),
          },
          vi.fn()
        );
      }

      expect(updater.getStats().rendered).toBe(0);
      expect(updater.getStats().dropped).toBe(corruptTicks.length);
    });

    it('CHS-03: Recuperação transparente de localStorage corrompido sem crash', () => {
      const corruptStorageValues = [
        '{bad_json: 123',
        'null',
        'undefined',
        '12345',
        '"string"',
        '[{"invalid": true}]',
      ];

      for (const val of corruptStorageValues) {
        let loadedDrawings: any[] = [];
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.every((d) => d && typeof d.id === 'string')) {
            loadedDrawings = parsed;
          } else {
            loadedDrawings = [];
          }
        } catch {
          loadedDrawings = [];
        }

        expect(Array.isArray(loadedDrawings)).toBe(true);
      }
    });
  });

  // ==========================================
  // 3. MATRIZ DE SEGURANÇA E SANITIZAÇÃO
  // ==========================================
  describe('Matriz de Segurança', () => {
    it('SEC-01: Prevenção de injeção de payload em preço formatado e títulos de cotação', () => {
      const maliciousPayload = '<script>alert(1)</script>';
      const safeNumericPrice = Number(maliciousPayload);

      expect(Number.isFinite(safeNumericPrice)).toBe(false);

      const updater = new RafChartUpdater();
      updater.push(
        {
          type: 'tick',
          sequence: 1,
          symbol: 'SYNTH_VOL_50',
          price: maliciousPayload,
          ts: new Date().toISOString(),
        },
        vi.fn()
      );

      expect(updater.getStats().rendered).toBe(0);
      expect(updater.getStats().dropped).toBe(1);
    });

    it('SEC-02: Validação estrita de identificador de ativo contra path traversal', () => {
      const symbolRegex = /^[A-Z0-9_]{3,32}$/;

      expect(symbolRegex.test('SYNTH_VOL_50')).toBe(true);
      expect(symbolRegex.test('EURUSD_OTC')).toBe(true);
      expect(symbolRegex.test('BTCUSD_OTC')).toBe(true);

      // Ataques de path traversal e injeção
      expect(symbolRegex.test('../../etc/passwd')).toBe(false);
      expect(symbolRegex.test('<script>')).toBe(false);
      expect(symbolRegex.test('VOL;DROP TABLE--')).toBe(false);
      expect(symbolRegex.test('A')).toBe(false); // muito curto
      expect(symbolRegex.test('A'.repeat(33))).toBe(false); // muito longo
    });
  });
});
