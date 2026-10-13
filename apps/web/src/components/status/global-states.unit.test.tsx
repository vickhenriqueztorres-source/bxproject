import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { MaintenancePage } from '../../pages/MaintenancePage';
import { GlobalReconnectingOverlay } from './GlobalReconnectingOverlay';
import { PaymentErrorModal } from './PaymentErrorModal';

describe('SUBETAPA 01: Estados Globais da BINMAX', () => {
  it('1.1 NotFoundPage (404): Renderiza arte estilizada 404, copy em espanhol e botão Ir a operar', () => {
    const html = renderToString(<NotFoundPage />);

    expect(html).toContain('404');
    expect(html).toContain('Página');
    expect(html).toContain('no encontrada');
    expect(html).toContain('Ir a operar');
    expect(html).toContain('Volver al inicio');
    expect(html).toContain('data-testid="not-found-page"');
  });

  it('1.2 MaintenancePage: Renderiza manutenção programada com relógio 23:30 (UTC-3) e suporte', () => {
    const html = renderToString(<MaintenancePage />);

    expect(html).toContain('Mantenimiento programado');
    expect(html).toContain('Volvemos');
    expect(html).toContain('en breve');
    expect(html).toContain('23:30 (UTC-3)');
    expect(html).toContain('soporte@binmax.com');
    expect(html).toContain('data-testid="maintenance-page"');
  });

  it('1.3 GlobalReconnectingOverlay: Não renderiza quando isReconnecting é falso e renderiza alert quando ativo', () => {
    const hiddenHtml = renderToString(<GlobalReconnectingOverlay isReconnecting={false} />);
    expect(hiddenHtml).toBe('');

    const visibleHtml = renderToString(
      <GlobalReconnectingOverlay isReconnecting={true} message="Reconectando…" />
    );
    expect(visibleHtml).toContain('data-testid="global-reconnecting-overlay"');
    expect(visibleHtml).toContain('Reconectando…');
    expect(visibleHtml).toContain('Sincronizando feed de mercado');
  });

  it('1.4 PaymentErrorModal: Renderiza stepper de pagamento, banner vermelho e opções de retry', () => {
    const closedHtml = renderToString(
      <PaymentErrorModal
        isOpen={false}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onChangeMethod={vi.fn()}
      />
    );
    expect(closedHtml).toBe('');

    const openHtml = renderToString(
      <PaymentErrorModal
        isOpen={true}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onChangeMethod={vi.fn()}
        paymentMethodLabel="Mastercard terminada en 4242"
        amountFormatted="$100.00"
      />
    );
    expect(openHtml).toContain('data-testid="payment-error-modal"');
    expect(openHtml).toContain('No pudimos procesar tu pago');
    expect(openHtml).toContain('Mastercard terminada en 4242');
    expect(openHtml).toContain('$100.00');
    expect(openHtml).toContain('Intentar de nuevo');
    expect(openHtml).toContain('Cambiar método');
  });
});
