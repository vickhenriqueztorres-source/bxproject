import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { MultiChartGrid } from './MultiChartGrid';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('SUBETAPA UX 01: Remoção da Borda Verde do Gráfico e Ocultação da Logo TradingView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    setFeatureFlagForTesting(true);
  });

  it('1.1 Valida regras CSS no styles.css para supressão absoluta de #tv-attr-logo e links TradingView', () => {
    const cssPath = path.resolve(__dirname, '../styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toMatch(/#tv-attr-logo[^{]*\{[^}]*display:\s*none\s*!important/);
    expect(css).toMatch(/#tv-attr-logo[^{]*\{[^}]*visibility:\s*hidden\s*!important/);
    expect(css).toMatch(/#tv-attr-logo[^{]*\{[^}]*opacity:\s*0\s*!important/);
  });

  it('1.2 Garante que no modo Binmax a célula do gráfico NÃO possui borda verde (#00e676)', () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="SYNTH_VOL_50"
          onActiveSymbolChange={() => {}}
          allContracts={[]}
          layout="1x1"
        />
      </QueryClientProvider>
    );

    // No modo 1x1 da Binmax, o contorno não pode ter a borda verde brilhante
    expect(html).toContain('data-testid="grid-cell-SYNTH_VOL_50"');
    expect(html).not.toMatch(/border:\s*1px solid #00e676/);
    expect(html).toContain('border:none');
  });

  it('1.3 Padrão Duas Portas: Modo Legado preserva a borda verde (#00e676) na célula ativa', () => {
    setFeatureFlagForTesting(false);
    const htmlLegacy = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="SYNTH_VOL_50"
          onActiveSymbolChange={() => {}}
          allContracts={[]}
          layout="1x1"
        />
      </QueryClientProvider>
    );

    expect(htmlLegacy).toContain('border:1px solid #00e676');
  });

  it('1.4 Teste de Estresse: Executa renderizações repetidas da grade de gráficos sem falhas', () => {
    const start = performance.now();
    for (let i = 0; i < 30; i++) {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MultiChartGrid
            activeSymbol="SYNTH_VOL_50"
            onActiveSymbolChange={() => {}}
            allContracts={[]}
            layout="1x1"
          />
        </QueryClientProvider>
      );
      expect(html).toContain('grid-cell-SYNTH_VOL_50');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2500);
  });
});
