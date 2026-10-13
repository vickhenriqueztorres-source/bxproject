import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { LandingPage } from './LandingPage';
import { RouterProvider } from '../router/RouterContext';

function renderLanding(initialPath: string = '/') {
  return renderToString(
    <RouterProvider initialPath={initialPath}>
      <LandingPage />
    </RouterProvider>
  );
}

describe('SUBETAPA 07: Landing Pública Oficial com Live Preview Gráfico (/)', () => {
  it('7.1 Hero Section: Renderiza proposta de valor, copy oficial e ações primárias', () => {
    const html = renderLanding('/');

    expect(html).toContain('Trading de opciones');
    expect(html).toContain('simple y rápido');
    expect(html).toContain('data-testid="landing-login-btn"');
    expect(html).toContain('data-testid="landing-register-btn"');
    expect(html).toContain('data-testid="hero-create-account-btn"');
    expect(html).toContain('data-testid="hero-enter-traderoom-btn"');
    expect(html).toContain('Cuenta de práctica ilimitada con $10.000');
  });

  it('7.2 Live Preview: Renderiza simulação fiel em miniatura com gráfico e boleta', () => {
    const html = renderLanding('/');

    expect(html).toContain('data-testid="hero-traderoom-preview"');
    expect(html).toContain('BINMAX TERMINAL');
    expect(html).toContain('SYNTH_VOL_50');
    expect(html).toContain('$10,000.00 DEMO');
    expect(html).toContain('16ms');
    expect(html).toContain('data-testid="vol50-mini-chart"');
    expect(html).toContain('▲ SUBE');
    expect(html).toContain('▼ BAJA');
    expect(html).toContain('+85% ($185.00)');
  });

  it('7.3 Seção de Benefícios e Mercados Populares', () => {
    const html = renderLanding('/');

    expect(html).toContain('Amplia variedad de activos');
    expect(html).toContain('Plataforma rápida y estable');
    expect(html).toContain('Seguridad y transparencia');
    expect(html).toContain('EUR/USD');
    expect(html).toContain('BTC/USD');
    expect(html).toContain('SYNTH_VOL_50');
  });

  it('7.4 Acordeão de FAQs e Rodapé Regulatório', () => {
    const html = renderLanding('/');

    expect(html).toContain('Resolvemos tus dudas');
    expect(html).toContain('data-testid="faq-item-0"');
    expect(html).toContain('¿Qué es BINMAX?');
    expect(html).toContain('data-testid="faq-answer-0"');

    // Aviso de Risco Completo
    expect(html).toContain('Advertencia de riesgo:');
    expect(html).toContain('El trading de opciones binarias conlleva un alto nivel de riesgo');
  });
});
