import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradersMoodBar } from './TradersMoodBar';
import { PriceChart } from './PriceChart';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import { setTraderoomPolishEnabled } from '../lib/traderoom-polish';
import { I18nProvider } from '../i18n';

// Este arquivo cobre os overlays anteriores (cápsula de sentimento, pílula de expiração). Ver chart/subetapa-polish-05-time-mood.
setTraderoomPolishEnabled(false);

describe('SUBETAPA UX 03: Redesign Ergonômico da Temperatura dos Traders (Traders Mood Bar)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
    setTraderoomPolishEnabled(false);
  });

  it('3.1 Modo Binmax renderiza cápsula contínua elegante em vez de diamantes empilhados', () => {
    const html = renderToString(<TradersMoodBar bullsPercentage={65} />);

    // Deve conter cápsula contínua institucional
    expect(html).toContain('data-testid="mood-capsule"');
    expect(html).toContain('data-testid="mood-fill-bulls"');
    expect(html).toContain('data-testid="mood-fill-bears"');

    // Verifica proporção e cores institucionais (#22C47A e #F2545B)
    expect(html).toContain('height:65%');
    expect(html).toContain('background:#22C47A');
    expect(html).toContain('background:#F2545B');
    expect(html).toContain('border-radius:999px');
  });

  it('3.2 Exibe micro-badges de SUBE e BAJA com formatação Geist Mono e valores exatos', () => {
    const html = renderToString(<TradersMoodBar bullsPercentage={72} />);

    expect(html).toContain('data-testid="mood-tag-bulls"');
    expect(html).toContain('SUBE 72%');
    expect(html).toContain('data-testid="mood-tag-bears"');
    expect(html).toContain('BAJA 28%');
    expect(html).toContain('Geist Mono');
  });

  it('3.3 Mantém apenas arredondamento sem clamp artificial duplicado 5–95%', () => {
    const htmlFloat = renderToString(<TradersMoodBar bullsPercentage={73.6} />);
    expect(htmlFloat).toContain('SUBE 74%');
    expect(htmlFloat).toContain('BAJA 26%');

    const htmlHigh = renderToString(<TradersMoodBar bullsPercentage={98} />);
    expect(htmlHigh).toContain('SUBE 98%');
    expect(htmlHigh).toContain('BAJA 2%');

    const htmlLow = renderToString(<TradersMoodBar bullsPercentage={2} />);
    expect(htmlLow).toContain('SUBE 2%');
    expect(htmlLow).toContain('BAJA 98%');
  });

  it('3.4 Padrão Duas Portas: Modo Legado preserva linha gradiente com ▲ e ▼', () => {
    setFeatureFlagForTesting(false);
    const htmlLegacy = renderToString(<TradersMoodBar bullsPercentage={60} />);

    expect(htmlLegacy).not.toContain('data-testid="mood-capsule"');
    expect(htmlLegacy).toContain('class="mood-track"');
    expect(htmlLegacy).toContain('▲ 60%');
    expect(htmlLegacy).toContain('▼ 40%');
  });

  it('3.5 Teste de Estresse: 100 variações dinâmicas de percentual (5% a 95%) em < 150ms', () => {
    const start = performance.now();
    for (let i = 5; i <= 95; i++) {
      const html = renderToString(<TradersMoodBar bullsPercentage={i} />);
      expect(html).toContain(`SUBE ${i}%`);
      expect(html).toContain(`BAJA ${100 - i}%`);
      expect(html).toContain('data-testid="mood-capsule"');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });

  it('3.6 i18n pt-BR: exibe rótulos "ALTA" / "BAIXA" e aria-label traduzido em português', () => {
    const html = renderToString(
      <I18nProvider initialLocale="pt-BR">
        <TradersMoodBar bullsPercentage={72} />
      </I18nProvider>
    );

    expect(html).toContain('ALTA 72%');
    expect(html).toContain('BAIXA 28%');
    expect(html).toContain('aria-label="Sentimento do mercado: 72% comprando, 28% vendendo"');
  });

  it('3.7 i18n es-MX: exibe rótulos "SUBE" / "BAJA" e aria-label traduzido em espanhol', () => {
    const html = renderToString(
      <I18nProvider initialLocale="es-MX">
        <TradersMoodBar bullsPercentage={72} />
      </I18nProvider>
    );

    expect(html).toContain('SUBE 72%');
    expect(html).toContain('BAJA 28%');
    expect(html).toContain('aria-label="Sentimiento del mercado: 72% comprando, 28% vendiendo"');
  });

  it('3.8 Prop neutral: exibe visual neutro (50/50, opacidade reduzida) e tooltip "poucas posições abertas"', () => {
    const html = renderToString(
      <I18nProvider initialLocale="pt-BR">
        <TradersMoodBar bullsPercentage={84} neutral={true} />
      </I18nProvider>
    );

    expect(html).toContain('ALTA 50%');
    expect(html).toContain('BAIXA 50%');
    expect(html).toContain('opacity:0.55');
    expect(html).toContain('title="poucas posições abertas"');
    expect(html).toContain('data-neutral="true"');
  });

  it('3.9 PriceChart não inicia em 64% fixo nem renderiza caixa inline duplicada COMPRA/VENDA', () => {
    setFeatureFlagForTesting(false);
    const html = renderToString(
      <I18nProvider initialLocale="pt-BR">
        <PriceChart
          candles={[]}
          tick={{ type: 'tick', symbol: 'VOL_50', sequence: 1, price: '100.50', ts: '2026-10-15T12:00:00.000Z' }}
          symbol="VOL_50"
        />
      </I18nProvider>
    );

    expect(html).not.toContain('64%');
    expect(html).not.toContain('% COMPRA');
    expect(html).not.toContain('% VENDA');
    expect(html).toContain('▲ 50%');
    expect(html).toContain('▼ 50%');
    expect(html).toContain('data-neutral="true"');
  });
});
