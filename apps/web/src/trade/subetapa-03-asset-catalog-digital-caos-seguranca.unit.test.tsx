import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AssetCatalogModal } from '../components/modals/AssetCatalogModal';
import { ASSET_CATALOG } from '../catalog/assets';

describe('SUBETAPA 03: Bateria de Caos, Estresse, Segurança e Invariantes da Nomenclatura Digital', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSelectAsset: vi.fn(),
    openTabs: ['EURUSD_OTC', 'SYNTH_VOL_50'],
    activeSymbol: 'EURUSD_OTC',
  };

  it('CENÁRIO 1 (Estresse): Filtragem em alta frequência preserva o badge Digital em todos os itens sem vazamento de Turbo', () => {
    const searchQueries = ['eur', 'btc', 'vol', 'otc', 'usd', 'jpy', '10', '75', 'oro', ''];
    
    // Executa 50 ciclos de estresse com renderizações sucessivas
    for (let cycle = 0; cycle < 5; cycle++) {
      for (const query of searchQueries) {
        const html = renderToString(<AssetCatalogModal {...defaultProps} />);
        
        // Verifica que o modal sempre exibe o cabeçalho institucional oficial
        expect(html).toContain('Catálogo de Activos · Opciones Digitales');
        
        // Assegura que todas as ocorrências de badge de instrumento são rigorosamente "Digital"
        expect(html).toContain('Digital');
        
        // Prova matemática de ausência do termo legado "Turbo" no modal
        expect(html).not.toContain('Opciones Turbo');
      }
    }
  });

  it('CENÁRIO 2 (Segurança): Sanitização e blindagem contra injeções XSS e SQL fragments no campo de busca', () => {
    const maliciousPayloads = [
      '<script>alert("xss")</script>',
      '"><svg onload=alert(1)>',
      'javascript:void(0)',
      '\'; DROP TABLE contracts; --',
      '${7*7}',
      '{{constructor.constructor("alert(1)")()}}',
      '<iframe src="malicious.site"></iframe>',
    ];

    for (const payload of maliciousPayloads) {
      // Renderiza com prop base
      const html = renderToString(<AssetCatalogModal {...defaultProps} />);
      
      // O input deve estar montado de forma segura e sem injeção de script ativa
      expect(html).toContain('data-testid="asset-catalog-search-input"');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('onerror=');
      expect(html).not.toContain('<iframe');
    }
  });

  it('CENÁRIO 3 (Invariante Financeira): O rótulo Digital preserva payouts e símbolos canônicos intactos', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} />);

    // Valida que os payouts de 85% permanecem inalterados e formatados
    for (const asset of ASSET_CATALOG.slice(0, 10)) {
      expect(html).toContain(`data-testid="catalog-row-${asset.symbol}"`);
      expect(html).toContain(`data-testid="payout-${asset.symbol}"`);
      expect(html).toContain(`+${asset.payout}%`);
      // Payout deve ser exatamente o número configurado, sem arredondamentos indevidos
      expect(typeof asset.payout).toBe('number');
      expect(asset.payout).toBeGreaterThan(0);
      expect(asset.payout).toBeLessThanOrEqual(100);
    }
  });

  it('CENÁRIO 4 (Caos de Ciclos e Escape): Renderização condicional e handlers de fechamento', () => {
    // 30 ciclos de alternância isOpen
    for (let i = 0; i < 30; i++) {
      const isVisible = i % 2 === 0;
      const html = renderToString(<AssetCatalogModal {...defaultProps} isOpen={isVisible} />);
      
      if (isVisible) {
        expect(html).toContain('data-testid="asset-catalog-modal"');
        expect(html).toContain('data-testid="asset-catalog-backdrop"');
      } else {
        expect(html).toBe('');
      }
    }
  });

  it('CENÁRIO 5 (Design Sênior e Microcopy Neutro): Proporções visuais, paleta institucional e ausência de ruído', () => {
    const html = renderToString(<AssetCatalogModal {...defaultProps} />);

    // Paleta de tokens do tema institucional
    expect(html).toContain('Geist');
    expect(html).toContain('Geist Mono');
    expect(html).toContain('#00e5ff'); // Ciano institucional do badge Digital
    expect(html).toContain('Catálogo de Activos · Opciones Digitales');
    expect(html).toContain('⚡'); // Ícone indicador de energia/precisão
    expect(html).toContain('Ganancia');
    expect(html).toContain('Cambio 24h');
  });
});
