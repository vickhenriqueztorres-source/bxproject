import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TimeLinesOverlay } from './TimeLinesOverlay';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA REFINE 02: Desobstrução & Anti-Colisão de Linhas Temporais (TimeLinesOverlay)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('2.1 Com hideTopTags=true, as tags superiores de compra e expiração são suprimidas para não colidir com telemetria', () => {
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={1000}
        containerHeight={600}
        chartInstance={null}
        latestCandleTime={null}
        timeframe="1m"
        hideTopTags={true}
      />
    );

    // As linhas verticais contínuas e pontilhadas devem continuar intactas
    expect(html).toContain('data-testid="purchase-time-line"');
    expect(html).toContain('data-testid="expiration-time-line"');

    // As tags superiores redundantes que causavam colisão no HUD superior NÃO devem existir
    expect(html).not.toContain('data-testid="time-tag-purchase"');
    expect(html).not.toContain('data-testid="time-tag-expiration"');
    expect(html).not.toContain('EXPIRACIÓN');
  });

  it('2.2 Com hideTopTags=false (ou omitido), preserva as tags para compatibilidade retroativa', () => {
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={1000}
        containerHeight={600}
        chartInstance={null}
        latestCandleTime={null}
        timeframe="1m"
      />
    );

    // Tags superiores presentes
    expect(html).toContain('data-testid="time-tag-purchase"');
    expect(html).toContain('data-testid="time-tag-expiration"');
    expect(html).toContain('EXPIRACIÓN');
  });

  it('2.3 No modo Binmax com hideTopTags=true, preserva os marcadores circulares de base na borda inferior do gráfico', () => {
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={1000}
        containerHeight={600}
        chartInstance={null}
        latestCandleTime={null}
        timeframe="1m"
        hideTopTags={true}
      />
    );

    // Marcador circular de compra e de expiração na base (bottom: 12px)
    expect(html).toContain('bottom:12px');
    expect(html).toContain('title="Hora de compra"');
    expect(html).toContain('title="Expiración"');
  });
});
