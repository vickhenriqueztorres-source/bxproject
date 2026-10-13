import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';

describe('SUBETAPA 01: Barra de Controle do Drawer & Motion de Deslize Mecânico', () => {
  const mockOpenContract: Contract = {
    id: 'c-test-01',
    symbol: 'SYNTH_VOL_50',
    direction: 'UP',
    stake_minor: 10000,
    payout_minor: 18500,
    result: null,
    status: 'OPEN',
    entry_price: 500.0,
    strike_price: 500.0,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30000).toISOString(),
  };

  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('1.1 Elimina o emoji unicode de maleta 💼 no modo Binmax e renderiza ícone SVG vetorial', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={[mockOpenContract]}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // No modo Binmax, é proibido o uso de emoji unicode cru
    expect(html).not.toContain('💼');
    // Deve conter ícone vetorial SVG
    expect(html).toContain('<svg');
  });

  it('1.2 Renderiza badge institucional com numerais tabulares Geist Mono e dot de status', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={[mockOpenContract]}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    expect(html).toContain('1 activas');
    expect(html).toContain('Ganancia potencial');
    expect(html).toContain("Geist Mono");
  });

  it('1.3 Exibe os rótulos de controle oficiais com chevron de precisão mecânica', () => {
    const htmlClosed = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={[mockOpenContract]}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // Contrato com suíte legada: rótulo exato
    expect(htmlClosed).toContain('Mostrar posiciones ⌵');

    const htmlOpen = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={[mockOpenContract]}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    expect(htmlOpen).toContain('Mostrar posiciones ⌃');
  });

  it('1.4 Suporta transição de física de movimento (--bm-ease) sem saltos rígidos', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={[mockOpenContract]}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // Deve conter transição fluida com easing institucional
    expect(html).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('1.5 Teste de Estresse: Executa 100 montagens de ciclo do Drawer em alta performance', () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      renderToString(
        <PortfolioDrawer
          isOpen={i % 2 === 0}
          onToggle={vi.fn()}
          contracts={[mockOpenContract]}
          currentPrice={500 + i}
          currentSymbol="SYNTH_VOL_50"
        />
      );
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });

  it('1.6 Padrão Duas Portas: Preserva comportamento legado quando a flag estiver desligada', () => {
    setFeatureFlagForTesting(false);
    const html = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={[mockOpenContract]}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // No modo legado exibe o emoji e textos legados
    expect(html).toContain('💼');
    expect(html).toContain('Portfólio Total');
    expect(html).toContain('Expandir');
  });
});
