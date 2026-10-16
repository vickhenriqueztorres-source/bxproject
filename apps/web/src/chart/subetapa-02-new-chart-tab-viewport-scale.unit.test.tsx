import { describe, it, expect } from 'vitest';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import {
  ensureStrictAscendingBars,
  shouldReanchorViewportOnDataUpdate,
} from './IsolatedChartHost';

describe('SUBETAPA 02 — Abertura de Novo Gráfico em Escala Imediata (Sem Compressão à Esquerda / Imagem 1)', () => {
  describe('2.1 Condição de Corrida no Boot de Nova Aba (0 -> 1 Tick -> 1440 Velas Históricas)', () => {
    it('Força re-ancoragem (scrollToRealTime + autoScale) quando 1 tick chega antes do lote histórico HTTP (1440 velas)', () => {
      // Passo 1: Nova aba EURUSD_OTC abre vazia (t=0ms)
      const step1Empty = shouldReanchorViewportOnDataUpdate({
        symbolChanged: true,
        timeframeChanged: false,
        wasEmpty: true,
        prevBarCount: 0,
        nextBarCount: 0,
        historyHydratedForKey: false,
      });
      expect(step1Empty).toBe(false);

      // Passo 2: 1º tick ao vivo chega via WebSocket antes do HTTP getCandles (t=40ms -> 1 barra)
      const step2SingleTick = shouldReanchorViewportOnDataUpdate({
        symbolChanged: false,
        timeframeChanged: false,
        wasEmpty: true,
        prevBarCount: 0,
        nextBarCount: 1,
        historyHydratedForKey: false,
      });
      expect(step2SingleTick).toBe(true);

      // Passo 3: HTTP getCandles('EURUSD_OTC', '1m') resolve com 1440 velas (t=220ms)
      // Antes da correção: symbolChanged=false, timeframeChanged=false, wasEmpty=false -> retornava FALSE e deixava o gráfico espremido à esquerda!
      // Agora: detecta salto de prevBarCount=1 (<5) para nextBarCount=1440 (>=5) com historyHydratedForKey=false -> retorna TRUE!
      const step3FullHistory = shouldReanchorViewportOnDataUpdate({
        symbolChanged: false,
        timeframeChanged: false,
        wasEmpty: false,
        prevBarCount: 1,
        nextBarCount: 1440,
        historyHydratedForKey: false,
      });
      expect(step3FullHistory).toBe(true);
    });

    it('Preserva o scroll/pan manual do usuário em atualizações subsequentes depois que o histórico já hidratou', () => {
      const subsequentUpdate = shouldReanchorViewportOnDataUpdate({
        symbolChanged: false,
        timeframeChanged: false,
        wasEmpty: false,
        prevBarCount: 1440,
        nextBarCount: 1441,
        historyHydratedForKey: true,
      });
      expect(subsequentUpdate).toBe(false);
    });

    it('Re-ancora imediatamente sempre que o usuário alterna símbolo ou timeframe', () => {
      expect(
        shouldReanchorViewportOnDataUpdate({
          symbolChanged: true,
          timeframeChanged: false,
          wasEmpty: false,
          prevBarCount: 1440,
          nextBarCount: 1440,
          historyHydratedForKey: true,
        })
      ).toBe(true);

      expect(
        shouldReanchorViewportOnDataUpdate({
          symbolChanged: false,
          timeframeChanged: true,
          wasEmpty: false,
          prevBarCount: 1440,
          nextBarCount: 288,
          historyHydratedForKey: true,
        })
      ).toBe(true);
    });
  });

  describe('2.2 Testes de Caos (Timestamps Fora de Ordem, Duplicados e Gaps)', () => {
    it('Ordena e deduplica barras fora de ordem sem corromper o lote que vai para setData', () => {
      const rawBars: CandlestickData<UTCTimestamp>[] = [
        { time: 1700000180 as UTCTimestamp, open: 1.085, high: 1.086, low: 1.084, close: 1.0855 },
        { time: 1700000060 as UTCTimestamp, open: 1.081, high: 1.083, low: 1.080, close: 1.082 },
        { time: 1700000120 as UTCTimestamp, open: 1.082, high: 1.084, low: 1.081, close: 1.083 },
        // Duplicata no timestamp 1700000120 com fechamento atualizado
        { time: 1700000120 as UTCTimestamp, open: 1.082, high: 1.087, low: 1.081, close: 1.0865 },
      ];

      const clean = ensureStrictAscendingBars(rawBars);
      expect(clean).toHaveLength(3);
      expect(clean[0].time).toBe(1700000060);
      expect(clean[1].time).toBe(1700000120);
      expect(clean[1].close).toBe(1.0865);
      expect(clean[2].time).toBe(1700000180);
    });
  });

  describe('2.3 Testes de Segurança (Imunidade a NaN, Infinity e Preços Corrompidos)', () => {
    it('Filtra barras com valores NaN, Infinity ou timestamps inválidos antes de tocar no motor gráfico', () => {
      const corrupted: CandlestickData<UTCTimestamp>[] = [
        { time: NaN as unknown as UTCTimestamp, open: 1.08, high: 1.09, low: 1.07, close: 1.08 },
        { time: 1700000060 as UTCTimestamp, open: NaN, high: 1.09, low: 1.07, close: 1.08 },
        { time: 1700000120 as UTCTimestamp, open: 1.08, high: Infinity, low: 1.07, close: 1.08 },
        { time: 1700000180 as UTCTimestamp, open: 1.085, high: 1.086, low: 1.084, close: 1.0855 },
      ];

      const clean = ensureStrictAscendingBars(corrupted);
      expect(clean).toHaveLength(1);
      expect(clean[0].time).toBe(1700000180);
      expect(Number.isFinite(clean[0].close)).toBe(true);
    });
  });

  describe('2.4 Teste de Estresse (100 Trocas Rápidas de Aba com 1.500 Velas por Aba)', () => {
    it('Processa 100 aberturas/alternâncias de abas com 1.500 velas cada em < 300ms', () => {
      const templateBars: CandlestickData<UTCTimestamp>[] = Array.from({ length: 1500 }, (_, i) => ({
        time: (1700000000 + i * 60) as UTCTimestamp,
        open: 1.08 + (i % 20) * 0.0001,
        high: 1.082 + (i % 20) * 0.0001,
        low: 1.079 + (i % 20) * 0.0001,
        close: 1.081 + (i % 20) * 0.0001,
      }));

      const start = performance.now();
      for (let tab = 0; tab < 100; tab++) {
        const clean = ensureStrictAscendingBars(templateBars);
        const reanchor = shouldReanchorViewportOnDataUpdate({
          symbolChanged: true,
          timeframeChanged: false,
          wasEmpty: tab === 0,
          prevBarCount: 1,
          nextBarCount: clean.length,
          historyHydratedForKey: false,
        });
        expect(clean).toHaveLength(1500);
        expect(reanchor).toBe(true);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300);
    });
  });
});
