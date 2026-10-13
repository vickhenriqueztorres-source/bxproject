import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthBackgroundGridMotion } from '../components/auth/AuthBackgroundGridMotion';
import { AuthShell } from '../components/auth/AuthShell';
import { RouterProvider } from '../router/RouterContext';
import { PRECISION_SURFACES } from '../lib/design-tokens';

describe('SUBETAPA 01: Refinamento de Fundo de Autenticação (Motion Design UX/UI & Harmonia Cromática)', () => {
  describe('1.1 Verificação de Design Tokens & Harmonia com Fundo Mestre', () => {
    it('Renderiza AuthBackgroundGridMotion ancorado na paleta oficial PRECISION_SURFACES.bg0 (#0B0E14)', () => {
      const html = renderToString(<AuthBackgroundGridMotion />);

      expect(html).toContain('data-testid="auth-background-grid-motion"');
      expect(html).toContain('background-color:#0B0E14');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('pointer-events:none');
    });

    it('Aplica máscara radial elíptica sobre a malha cartesiana SVG para eliminar bordas duras', () => {
      const html = renderToString(<AuthBackgroundGridMotion />);

      expect(html).toContain('data-testid="auth-grid-svg"');
      expect(html).toContain('mask-image:radial-gradient(ellipse 75% 70% at 50% 50%, black 25%, transparent 85%)');
      expect(html).toContain('-webkit-mask-image:radial-gradient(ellipse 75% 70% at 50% 50%, black 25%, transparent 85%)');
      expect(html).toContain('id="bm-auth-cartesian-grid"');
    });

    it('Garante camadas de luz volumétrica difusa e vinheta perimétrica 360°', () => {
      const html = renderToString(<AuthBackgroundGridMotion />);

      expect(html).toContain('bm-bg-glow-drift');
      expect(html).toContain('data-testid="auth-motion-curves"');
      expect(html).toContain('bm-bg-curve-motion');
      expect(html).toContain('id="bm-curve-stroke"');
    });

    it('AuthShell integra perfeitamente a cor de fundo bg0 (#0B0E14) e header translúcido', () => {
      const html = renderToString(
        <RouterProvider>
          <AuthShell activeMode="login">
            <div data-testid="child-content">Formulário de Acesso</div>
          </AuthShell>
        </RouterProvider>
      );

      expect(html).toContain(`background-color:${PRECISION_SURFACES.bg0}`);
      expect(html).toContain('data-testid="auth-header"');
      expect(html).toContain('background-color:rgba(11, 14, 20, 0.75)');
      expect(html).toContain('data-testid="child-content"');
    });
  });

  describe('1.2 Testes de Estresse e Desempenho de Renderização', () => {
    it('Executa 100 renderizações completas do AuthBackgroundGridMotion em menos de 500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(<AuthBackgroundGridMotion />);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it('Executa 50 montagens completas de AuthShell com filhos complexos em menos de 600ms', () => {
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        renderToString(
          <RouterProvider>
            <AuthShell activeMode={i % 2 === 0 ? 'login' : 'register'}>
              <div className="bm-card-fintech">
                <span>Card de Teste Iteração {i}</span>
              </div>
            </AuthShell>
          </RouterProvider>
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(600);
    });
  });

  describe('1.3 Testes de Caos e Resiliência Visual', () => {
    it('Suporta passagem de classes adicionais e estilos inline customizados sem quebrar layout', () => {
      const customStyle: React.CSSProperties = { opacity: 0.9, filter: 'contrast(1.1)' };
      const html = renderToString(
        <AuthBackgroundGridMotion className="custom-chaos-class" style={customStyle} />
      );

      expect(html).toContain('custom-chaos-class');
      expect(html).toContain('opacity:0.9');
      expect(html).toContain('filter:contrast(1.1)');
    });
  });

  describe('1.4 Testes de Segurança e Isolamento de Interação', () => {
    it('Garante que a camada de fundo tem pointer-events: none para impedir sequestro de cliques', () => {
      const html = renderToString(<AuthBackgroundGridMotion />);
      expect(html).toContain('pointer-events:none');
    });

    it('Garante que o fundo seja invisível para leitores de tela com aria-hidden="true"', () => {
      const html = renderToString(<AuthBackgroundGridMotion />);
      expect(html).toContain('aria-hidden="true"');
    });
  });
});
