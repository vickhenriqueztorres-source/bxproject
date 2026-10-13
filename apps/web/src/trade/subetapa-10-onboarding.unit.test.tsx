import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  LeadOnboardingTour,
  TOUR_STEPS,
  ONBOARDING_STORAGE_KEY,
} from '../components/onboarding/LeadOnboardingTour';

describe('SUBETAPA 10: Onboarding do Lead (Sessão 12)', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // Ignorar se ambiente não tiver localStorage
    }
  });

  describe('10.1 LeadOnboardingTour: Fidelidade aos 3 Passos da Sessão 12', () => {
    it('Passo 1 de 3: Renderiza coachmark de montante de investimento', () => {
      const html = renderToString(<LeadOnboardingTour isOpen={true} initialStep={1} />);

      expect(html).toContain('data-testid="onboarding-tour-root"');
      expect(html).toContain('data-testid="onboarding-tour-card"');
      expect(html).toContain('data-testid="onboarding-step-indicator"');
      expect(html).toContain('Paso 1 de 3');
      expect(html).toContain('data-testid="onboarding-title"');
      expect(html).toContain('Elige cuánto invertir');
      expect(html).toContain('data-testid="onboarding-body"');
      expect(html).toContain('Empieza con poco en la cuenta de práctica.');
      expect(html).toContain('data-testid="btn-onboarding-next"');
      expect(html).toContain('Siguiente');
      expect(html).toContain('data-testid="btn-onboarding-skip"');
      expect(html).toContain('Saltar');
    });

    it('Passo 2 de 3: Renderiza coachmark de seleção de ativos', () => {
      const html = renderToString(<LeadOnboardingTour isOpen={true} initialStep={2} />);

      expect(html).toContain('Paso 2 de 3');
      expect(html).toContain('Selecciona el activo');
      expect(html).toContain('Explora los activos y su porcentaje de ganancia.');
      expect(html).toContain('Siguiente');
    });

    it('Passo 3 de 3: Renderiza coachmark de tomada de decisão e botão final', () => {
      const html = renderToString(<LeadOnboardingTour isOpen={true} initialStep={3} />);

      expect(html).toContain('Paso 3 de 3');
      expect(html).toContain('Pronostica la dirección');
      expect(html).toContain('Pronostica si el precio subirá o bajará en el tiempo elegido.');
      expect(html).toContain('Entendido');
    });

    it('Não renderiza quando isOpen é falso', () => {
      const html = renderToString(<LeadOnboardingTour isOpen={false} />);
      expect(html).toBe('');
    });
  });

  describe('10.2 Configuração Estrutural e Constantes', () => {
    it('TOUR_STEPS possui rigorosamente 3 passos educativos ancorados', () => {
      expect(TOUR_STEPS).toHaveLength(3);
      expect(TOUR_STEPS[0].position).toBe('ticket-amount');
      expect(TOUR_STEPS[1].position).toBe('asset-selector');
      expect(TOUR_STEPS[2].position).toBe('order-direction');
      expect(ONBOARDING_STORAGE_KEY).toBe('BINMAX_ONBOARDING_SEEN');
    });
  });

  describe('10.3 Teste de Estresse e Desempenho', () => {
    it('Executa 100 renderizações completas do OnboardingTour em menos de 800ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(
          <LeadOnboardingTour
            isOpen={true}
            initialStep={(i % 3) + 1}
          />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(800);
    });
  });
});
