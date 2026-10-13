import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReconnectingOverlay } from '../chart/ReconnectingOverlay';
import { OrderTicket } from './OrderTicket';
import { setNewTraderoomEnabled } from '../lib/feature-flags';

describe('SUBETAPA 08: Resiliência de Conexão & Overlay Reconectando (Sessão 10)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    setNewTraderoomEnabled(true);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderTicket = (props: Partial<React.ComponentProps<typeof OrderTicket>> = {}) => {
    return renderToString(
      <QueryClientProvider client={queryClient}>
        <OrderTicket
          symbol="EURUSD_OTC"
          paused={false}
          stale={false}
          availableMinor={1000000}
          onChanged={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('8.1 ReconnectingOverlay: Fidelidade Visual à Sessão 10', () => {
    it('Renderiza ícone de radar pulsante, backdrop de segurança e texto "Reconectando..." quando ativo', () => {
      const html = renderToString(
        <ReconnectingOverlay
          isReconnecting={true}
          symbol="EURUSD_OTC"
          message="Reconectando..."
        />
      );

      expect(html).toContain('data-testid="reconnecting-overlay"');
      expect(html).toContain('data-testid="radar-pulse-icon"');
      expect(html).toContain('data-testid="reconnecting-text"');
      expect(html).toContain('Reconectando...');
      expect(html).toContain('EURUSD_OTC');
    });

    it('Não renderiza nenhum elemento no DOM quando isReconnecting é falso', () => {
      const html = renderToString(
        <ReconnectingOverlay
          isReconnecting={false}
          symbol="EURUSD_OTC"
        />
      );

      expect(html).toBe('');
    });
  });

  describe('8.2 Proteção Operacional no OrderTicket sob Queda de Conexão', () => {
    it('Desabilita botões SUBE e BAJA quando stale = true (feed desconectado)', () => {
      const html = renderTicket({ stale: true });

      // Botões SUBE e BAJA devem estar desabilitados (disabled attribute)
      expect(html).toContain('data-testid="btn-sube"');
      expect(html).toContain('data-testid="btn-baja"');
      expect(html).toMatch(/<button[^>]*data-testid="btn-sube"[^>]*disabled/);
      expect(html).toMatch(/<button[^>]*data-testid="btn-baja"[^>]*disabled/);
    });

    it('Habilita botões SUBE e BAJA quando a conexão está ativa (stale = false)', () => {
      const html = renderTicket({ stale: false });

      // Botão SUBE não deve conter disabled
      expect(html).toContain('data-testid="btn-sube"');
      expect(html).not.toMatch(/<button[^>]*data-testid="btn-sube"[^>]*disabled/);
    });
  });

  describe('8.3 Teste de Estresse e Desempenho (Sessão 10)', () => {
    it('Executa 100 renderizações completas do ReconnectingOverlay em menos de 800ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(
          <ReconnectingOverlay
            isReconnecting={i % 2 === 0}
            symbol="SYNTH_VOL_50"
          />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(800);
    });
  });
});
