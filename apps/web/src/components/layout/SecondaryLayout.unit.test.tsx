import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SecondaryLayout } from './SecondaryLayout';

describe('SUBETAPA 01: SecondaryLayout - Layout Arejado e Institucional', () => {
  it('1.1 Renderiza Header com Logo, Ping 16ms, Seletor ES/PT e Botões de Login/Cadastro quando deslogado', () => {
    const html = renderToString(
      <SecondaryLayout>
        <div data-testid="test-content">Conteúdo da Página</div>
      </SecondaryLayout>
    );

    expect(html).toContain('data-testid="secondary-layout"');
    expect(html).toContain('data-testid="test-content"');
    expect(html).toContain('BINMAX');
    expect(html).toContain('16ms');
    expect(html).toContain('ES');
    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('>Crear cuenta</button>');
  });

  it('1.2 Renderiza Seletor de Conta com saldo e botão Depositar quando logado', () => {
    const html = renderToString(
      <SecondaryLayout
        userEmail="trader@binmax.com"
        balanceFormatted="$10,000.00"
        onDepositClick={vi.fn()}
      >
        <div>Dashboard Logado</div>
      </SecondaryLayout>
    );

    expect(html).toContain('Cuenta de práctica');
    expect(html).toContain('$10,000.00');
    expect(html).toContain('Depositar');
  });

  it('1.3 Renderiza Rodapé Completo com Links Institucionais e Advertência de Risco Regulatório', () => {
    const html = renderToString(
      <SecondaryLayout showRiskDisclaimer={true}>
        <div>Conteúdo</div>
      </SecondaryLayout>
    );

    expect(html).toContain('Sobre nosotros');
    expect(html).toContain('Términos y condiciones');
    expect(html).toContain('Política de privacidad');
    expect(html).toContain('Contacto');
    expect(html).toContain('Advertencia de riesgo');
    expect(html).toContain('Los contratos de índices sintéticos y derivados implican un riesgo sustancial de pérdida de capital y no son adecuados para todos los perfiles.');
    expect(html).toContain('Los rendimientos simulados o pasados no constituyen garantía de rentabilidad futura.');
  });
});
