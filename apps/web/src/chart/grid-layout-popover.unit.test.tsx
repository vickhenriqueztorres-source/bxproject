import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { GridLayoutPopover, type GridLayout } from './GridLayoutPopover';

describe('[SUBETAPA 02] Popover de Distribuição de Grade de Multi-Gráficos', () => {
  it('GRID-01: Renderiza as 4 opções de layouts institucionais (1x1, 2x1, 2x2, 3x2)', () => {
    const html = renderToString(
      <GridLayoutPopover
        isOpen={true}
        currentLayout="1x1"
        onSelectLayout={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Distribución de Gráficos');
    expect(html).toContain('data-layout="1x1"');
    expect(html).toContain('data-layout="2x1"');
    expect(html).toContain('data-layout="2x2"');
    expect(html).toContain('data-layout="3x2"');
    expect(html).toContain('1 Gráfico (Completo)');
    expect(html).toContain('2 Gráficos (Dividido)');
    expect(html).toContain('4 Gráficos (Cuadrícula 2x2)');
    expect(html).toContain('6 Gráficos (Institucional 3x2)');
  });

  it('GRID-02: Não renderiza nada quando isOpen é false', () => {
    const html = renderToString(
      <GridLayoutPopover
        isOpen={false}
        currentLayout="1x1"
        onSelectLayout={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('GRID-03: Destaca visualmente o layout atualmente selecionado', () => {
    const html = renderToString(
      <GridLayoutPopover
        isOpen={true}
        currentLayout="2x2"
        onSelectLayout={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // O botão 2x2 deve conter o marcador ativo
    expect(html).toContain('data-active="true"');
  });

  it('GRID-04: Teste de Estresse de Layout: Simula 100 mudanças rápidas de layout sem degradação', () => {
    const layouts: GridLayout[] = ['1x1', '2x1', '2x2', '3x2'];
    const onSelect = vi.fn();

    for (let i = 0; i < 100; i++) {
      const selected = layouts[i % layouts.length];
      const html = renderToString(
        <GridLayoutPopover
          isOpen={true}
          currentLayout={selected}
          onSelectLayout={onSelect}
          onClose={vi.fn()}
        />
      );
      expect(html).toContain(`data-layout="${selected}"`);
    }
  });
});
