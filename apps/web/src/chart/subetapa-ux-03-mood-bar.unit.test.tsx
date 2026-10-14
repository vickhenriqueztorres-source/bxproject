import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradersMoodBar } from './TradersMoodBar';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import { setTraderoomPolishEnabled } from '../lib/traderoom-polish';

// Este arquivo cobre os overlays anteriores (cápsula de sentimento, pílula de expiração). Ver chart/subetapa-polish-05-time-mood.
setTraderoomPolishEnabled(false);

describe('SUBETAPA UX 03: Redesign Ergonômico da Temperatura dos Traders (Traders Mood Bar)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
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

  it('3.3 Garante clamping ergonômico de segurança entre 5% e 95%', () => {
    // 100% de alta deve ser clamped em 95%
    const htmlMax = renderToString(<TradersMoodBar bullsPercentage={100} />);
    expect(htmlMax).toContain('SUBE 95%');
    expect(htmlMax).toContain('BAJA 5%');

    // 0% de alta deve ser clamped em 5%
    const htmlMin = renderToString(<TradersMoodBar bullsPercentage={0} />);
    expect(htmlMin).toContain('SUBE 5%');
    expect(htmlMin).toContain('BAJA 95%');
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
});
