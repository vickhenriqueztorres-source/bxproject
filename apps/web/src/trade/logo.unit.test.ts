import { describe, it, expect } from 'vitest';
import React from 'react';
import { BinmaxLogo } from '../components/brand/BinmaxLogo';

describe('Identidade Visual - Logo e Ativos de Marca (Etapa 04)', () => {
  it('Componente BinmaxLogo renderiza a variante horizontal com textos esperados', () => {
    const element = BinmaxLogo({ variant: 'horizontal', height: 32 });
    expect(element.props.role).toBe('img');
    expect(element.props['aria-label']).toBe('Binmax Option');
  });

  it('Componente BinmaxLogo renderiza a variante short com altura e proporção', () => {
    const element = BinmaxLogo({ variant: 'short', height: 28 });
    expect(element.props.className).toContain('binmax-logo-short');
    expect(element.props['aria-label']).toBe('Binmax Option');
  });

  it('Componente BinmaxLogo renderiza a variante mark com símbolo isolado', () => {
    const element = BinmaxLogo({ variant: 'mark', height: 24 });
    expect(element.props.className).toContain('binmax-logo-mark');
  });

  it('Componente BinmaxLogo renderiza a variante vertical para materiais de marketing', () => {
    const element = BinmaxLogo({ variant: 'vertical', height: 40 });
    expect(element.props.className).toContain('binmax-logo-vertical');
  });
});
