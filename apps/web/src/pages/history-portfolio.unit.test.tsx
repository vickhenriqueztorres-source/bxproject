import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HistoryPage, sanitizeCsvField, generateCsvContent } from './HistoryPage';
import { RouterProvider } from '../router/RouterContext';
import type { Contract } from '../api/client';

function renderWithProviders(ui: React.ReactElement, initialPath: string = '/historial') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <RouterProvider initialPath={initialPath}>
        {ui}
      </RouterProvider>
    </QueryClientProvider>
  );
}

describe('SUBETAPA 05: Historial Completo de Operaciones & Portafolio', () => {
  const mockContracts: Contract[] = [
    {
      id: 'cnt_test_01',
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 10000,
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 18500,
      expires_at: '2026-10-09T20:00:00Z',
      created_at: '2026-10-09T19:59:00Z',
      entry_price: 500.0,
      strike_price: 501.0,
    },
    {
      id: 'cnt_test_02',
      symbol: 'SYNTH_VOL_25',
      direction: 'DOWN',
      stake_minor: 5000,
      status: 'SETTLED',
      result: 'LOSS',
      payout_minor: 0,
      expires_at: '2026-10-09T20:10:00Z',
      created_at: '2026-10-09T20:09:00Z',
      entry_price: 250.0,
      strike_price: 251.0,
    },
  ];

  it('5.1 Sanitização e Segurança de Exportação CSV contra Injeção de Fórmulas (CWE-1236)', () => {
    // Fórmulas maliciosas que iniciam com =, +, -, @
    expect(sanitizeCsvField('=SUM(A1:A10)')).toBe(`'=SUM(A1:A10)`);
    expect(sanitizeCsvField('=cmd|"/C calc"!A0')).toBe(`"'=cmd|""/C calc""!A0"`);
    expect(sanitizeCsvField('+12345')).toBe(`'+12345`);
    expect(sanitizeCsvField('-999')).toBe(`'-999`);
    expect(sanitizeCsvField('@SUM(A1:A10)')).toBe(`'@SUM(A1:A10)`);

    // Strings normais sem fórmulas
    expect(sanitizeCsvField('SYNTH_VOL_50')).toBe('SYNTH_VOL_50');

    // Strings com vírgula ou aspas
    expect(sanitizeCsvField('Índice, Volatilidad')).toBe('"Índice, Volatilidad"');
  });

  it('5.2 Geração de CSV RFC-4180 com UTF-8 BOM e cabeçalhos oficiais', () => {
    const csv = generateCsvContent(mockContracts);

    // Contém UTF-8 BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // Cabeçalhos
    expect(csv).toContain('ID Operación,Fecha y Hora,Activo,Dirección,Inversión (USD)');
    expect(csv).toContain('SYNTH_VOL_50');
    expect(csv).toContain('SUBE');
    expect(csv).toContain('100.00');
    expect(csv).toContain('SYNTH_VOL_25');
    expect(csv).toContain('BAJA');
    expect(csv).toContain('50.00');
  });

  it('5.3 Renderiza extrato institucional de Histórico com tabela, filtros e totais', () => {
    const html = renderWithProviders(<HistoryPage />);

    expect(html).toContain('Historial completo de operaciones');
    expect(html).toContain('Cuenta de práctica');
    expect(html).toContain('Cuenta real');
    expect(html).toContain('data-testid="filter-period"');
    expect(html).toContain('data-testid="filter-asset"');
    expect(html).toContain('data-testid="filter-result"');
    expect(html).toContain('data-testid="total-ops-count"');
    expect(html).toContain('data-testid="total-invested-sum"');
    expect(html).toContain('data-testid="net-profit-sum"');
    expect(html).toContain('data-testid="export-csv-btn"');
    expect(html).toContain('Exportar CSV');
  });
});
