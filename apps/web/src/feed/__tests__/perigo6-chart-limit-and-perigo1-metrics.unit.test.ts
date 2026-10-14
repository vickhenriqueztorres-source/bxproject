import { describe, it, expect, beforeEach } from 'vitest';
import {
  TradingFeedManager,
  getSymbolStalenessThresholdMs,
  setSymbolStalenessThreshold,
} from '../TradingFeedManager';

describe('[Subetapa 05 — Perigo 6 & Perigo 1 Frontend] Limite de 6 Charts Simultâneos, Staleness por Símbolo e 5 Métricas de Feed', () => {
  let manager: TradingFeedManager;

  beforeEach(() => {
    manager = new TradingFeedManager('ws://localhost:3999/ws');
    manager.disconnect();
  });

  it('[PERIGO 6 — TÉCNICA 3] Permite até 6 gráficos simultâneos, bloqueia o 7º com alerta e libera vaga no unmount', () => {
    expect(TradingFeedManager.MAX_CONCURRENT_CHARTS).toBe(6);

    for (let i = 1; i <= 6; i++) {
      const res = manager.registerChartInstance(`chart-${i}`);
      expect(res.allowed).toBe(true);
      expect(res.activeCount).toBe(i);
      expect(res.warning).toBeUndefined();
    }

    // 7º gráfico deve ser rejeitado com aviso de proteção de CPU/memória
    const seventh = manager.registerChartInstance('chart-7');
    expect(seventh.allowed).toBe(false);
    expect(seventh.activeCount).toBe(6);
    expect(seventh.warning).toContain('MAX_CHARTS_LIMIT_REACHED');

    // Re-registrar um chart já ativo é idempotente
    const duplicate = manager.registerChartInstance('chart-3');
    expect(duplicate.allowed).toBe(true);
    expect(duplicate.activeCount).toBe(6);

    // Desmontar chart-2 libera 1 slot imediatamente
    manager.unregisterChartInstance('chart-2');
    expect(manager.getActiveChartCount()).toBe(5);

    const nowAllowed = manager.registerChartInstance('chart-7');
    expect(nowAllowed.allowed).toBe(true);
    expect(nowAllowed.activeCount).toBe(6);
  });

  it('[PERIGO 1 — MÉTODO 3 & 7] Threshold por classe de símbolo e 5 métricas em getSymbolFeedMetrics', () => {
    expect(getSymbolStalenessThresholdMs('R_100')).toBe(4000);
    expect(getSymbolStalenessThresholdMs('EURUSD-OTC')).toBe(4000);
    expect(getSymbolStalenessThresholdMs('BTCUSDT')).toBe(4500);
    expect(getSymbolStalenessThresholdMs('XAUUSD')).toBe(6000);

    setSymbolStalenessThreshold('R_10', 2200);
    expect(getSymbolStalenessThresholdMs('R_10')).toBe(2200);
    setSymbolStalenessThreshold('R_10', 4000);

    const metrics = manager.getSymbolFeedMetrics('R_100');
    expect(metrics).toEqual({
      symbol: 'R_100',
      tick_age_seconds: -1,
      feed_gap_count: 0,
      latency_ms: 0,
      staleness_alert: true,
      reconnect_count: 0,
    });
  });
});
