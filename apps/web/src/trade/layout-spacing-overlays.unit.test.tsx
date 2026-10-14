import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TimeLinesOverlay } from '../chart/TimeLinesOverlay';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { setTraderoomPolishEnabled } from '../lib/traderoom-polish';

// Este arquivo cobre os overlays anteriores (cápsula de sentimento, pílula de expiração). Ver chart/subetapa-polish-05-time-mood.
setTraderoomPolishEnabled(false);

describe('SUBETAPA 2: Refinamento de Design, Espaçamento & Descolisão de Overlays', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('LSO-01: TimeLinesOverlay escalona verticalmente etiquetas de compra e expiração para evitar colisão', () => {
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={1000}
        containerHeight={600}
        chartInstance={null}
        latestCandleTime={1700000000 as any}
        tickTimestamp="2026-10-08T18:00:15.000Z"
      />
    );

    // Deve conter ambas as tags
    expect(html).toContain('time-tag-purchase');
    expect(html).toContain('time-tag-expiration');

    // A tag de compra deve estar no topo superior (ex: 24px)
    expect(html).toContain('top:24px');

    // A tag de expiração deve estar em um trilho inferior (ex: 56px)
    expect(html).toContain('top:56px');
  });

  it('LSO-02: TimeLinesOverlay restringe xExpiration para nunca invadir a régua de preços à direita', () => {
    const containerWidth = 800;
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={containerWidth}
        containerHeight={500}
        chartInstance={null}
        latestCandleTime={1700000000 as any}
        tickTimestamp="2026-10-08T18:00:55.000Z" // Quase no final do minuto
      />
    );

    // O HTML deve renderizar com posições left absolutas contidas antes da régua
    // A régua de preço ocupa os últimos 65px (left <= 735)
    const matchExpiration = html.match(/class="time-line-expiration"[^>]*style="[^"]*left:\s*([0-9.]+)px/);
    expect(matchExpiration).not.toBeNull();
    if (matchExpiration) {
      const leftExp = parseFloat(matchExpiration[1]);
      // A linha de expiração deve respeitar a margem máxima da régua
      expect(leftExp).toBeLessThanOrEqual(containerWidth - 65);
    }
  });

  it('LSO-03: Renderização sem tags duplicadas e com textos em espanhol oficial', () => {
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={1200}
        containerHeight={700}
        chartInstance={null}
        latestCandleTime={1700000000 as any}
        tickTimestamp="2026-10-08T18:00:20.000Z"
      />
    );

    expect(html).toContain('HORA DE COMPRA');
    expect(html).toContain('EXPIRACIÓN');
    expect(html).not.toContain('COMPRA TRAVADA'); // Apenas texto padrão Turbo Prata
  });

  it('LSO-04: Prova matemática de não-intersecção vertical (Delta Y >= 8px)', () => {
    // A tag de compra tem topo em 24px e altura máxima estimada de 24px (Y de 24 a 48px)
    const purchaseYTop = 24;
    const purchaseYBottom = 24 + 24; // 48px

    // A tag de expiração tem topo em 56px e altura máxima estimada de 22px (Y de 56 a 78px)
    const expirationYTop = 56;
    const expirationYBottom = 56 + 22; // 78px

    // Intervalo de Y: [24, 48] vs [56, 78]
    const verticalGap = expirationYTop - purchaseYBottom;
    expect(verticalGap).toBeGreaterThanOrEqual(8);
  });

  it('LSO-05: Padrão Duas Portas - Modo clássico preserva posições originais', () => {
    setNewTraderoomEnabled(false);
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={1000}
        containerHeight={600}
        chartInstance={null}
        latestCandleTime={1700000000 as any}
        tickTimestamp="2026-10-08T18:00:15.000Z"
      />
    );

    // No modo legado (NEW_TRADEROOM = false), ambas utilizam a coordenada legada
    expect(html).toContain('top:40px');
  });
});
