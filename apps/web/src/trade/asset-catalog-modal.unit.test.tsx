import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AssetCatalogModal } from '../components/modals/AssetCatalogModal';
import { ASSET_CATALOG } from '../catalog/assets';

describe('SUBETAPA 3: Modal Completo de Catálogo de Ativos IQ Option', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSelectAsset: vi.fn(),
    openTabs: ['EURUSD_OTC'],
    activeSymbol: 'EURUSD_OTC',
  };

  it('AC-01: Renderiza o modal quando isOpen = true com título e busca', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} />);
    expect(html).toContain('data-testid="asset-catalog-modal"');
    expect(html).toContain('Catálogo de Activos · Opciones Digitales');
    expect(html).toContain('data-testid="asset-catalog-search-input"');
    expect(html).toContain('data-testid="btn-close-asset-catalog"');
  });

  it('AC-02: Não renderiza nada quando isOpen = false', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} isOpen={false} />);
    expect(html).toBe('');
  });

  it('AC-03: Renderiza todas as abas oficiais de categoria', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} />);
    expect(html).toContain('data-testid="catalog-tab-TODOS"');
    expect(html).toContain('data-testid="catalog-tab-FAVORITOS"');
    expect(html).toContain('data-testid="catalog-tab-Sintéticos"');
    expect(html).toContain('data-testid="catalog-tab-Forex"');
    expect(html).toContain('data-testid="catalog-tab-Cripto"');
    expect(html).toContain('data-testid="catalog-tab-Commodities"');
  });

  it('AC-04: Renderiza linhas de ativos com bandeiras circulares, badge Digital e payouts de até 85%', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} />);
    expect(html).toContain('data-testid="catalog-row-EURUSD_OTC"');
    expect(html).toContain('data-testid="catalog-row-BTCUSD_OTC"');
    expect(html).toContain('data-testid="catalog-row-SYNTH_VOL_50"');
    expect(html).toContain('+85%');
    expect(html).toContain('Digital');
    expect(html).not.toContain('Turbo');
  });

  it('AC-05: Indica ativo que já se encontra aberto em abas com badge "Abierta"', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} openTabs={['EURUSD_OTC']} />);
    expect(html).toContain('Abierta');
  });

  it('AC-06: Botão de favoritar ativo com estrela interativa', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} />);
    expect(html).toContain('data-testid="btn-fav-EURUSD_OTC"');
  });

  it('AC-07: Renderiza cabeçalho oficial com colunas Activo, Ganancia e Cambio 24h conforme Prancha 2', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} />);
    expect(html).toContain('data-testid="asset-catalog-table-header"');
    expect(html).toContain('Activo');
    expect(html).toContain('Ganancia');
    expect(html).toContain('Cambio 24h');
  });

  it('AC-08: Renderiza variação 24h com formatação e cores oficiais (+0.21% para EUR/USD, +1.24% para Vol 50)', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} />);
    expect(html).toContain('data-testid="change24h-EURUSD_OTC"');
    expect(html).toContain('+0.21%');
    expect(html).toContain('data-testid="change24h-SYNTH_VOL_50"');
    expect(html).toContain('+1.24%');
  });
});
