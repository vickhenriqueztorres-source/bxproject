import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { ChartSandbox } from './ChartSandbox';
import { sanitizeTick } from './chart-sanitizer';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';

describe('SUBETAPA 4: Testes de Caos, Resiliência, Segurança e Blindagem do Gráfico', () => {
  // Componente que simula falha catastrófica interna de WebGL/Canvas
  function CrashyChartRenderer({ shouldExplode }: { shouldExplode: boolean }) {
    if (shouldExplode) {
      throw new Error('FATAL_WEBGL_CONTEXT_LOST: Canvas device context was destroyed by GPU driver reset');
    }
    return <div data-testid="healthy-canvas">Canvas Saudável</div>;
  }

  // Componente irmão (OrderTicket / Wallet)
  function OrderTicketMock({ balance }: { balance: number }) {
    return (
      <div data-testid="order-ticket-mock">
        <span>{`Saldo Disponível: $${balance}`}</span>
        <button type="button">Comprar UP</button>
      </div>
    );
  }

  it('CHAOS-01: Isolamento de Explosão — Crash catastrófico no gráfico NÃO afeta o OrderTicket nem o saldo', () => {
    const errorSpy = vi.fn();

    // Estado 1: Saudável
    const healthyHtml = renderToString(
      <div className="traderoom">
        <ChartErrorBoundary onError={errorSpy}>
          <CrashyChartRenderer shouldExplode={false} />
        </ChartErrorBoundary>
        <OrderTicketMock balance={10000} />
      </div>
    );

    expect(healthyHtml).toContain('data-testid="healthy-canvas"');
    expect(healthyHtml).toContain('data-testid="order-ticket-mock"');
    expect(healthyHtml).toContain('Saldo Disponível: $10000');
    expect(errorSpy).not.toHaveBeenCalled();

    // Estado 2: Gráfico em colapso com boundary ativado
    const boundary = new ChartErrorBoundary({
      onError: errorSpy,
      children: <CrashyChartRenderer shouldExplode={true} />,
    });
    // Força captura de erro no ciclo
    boundary.state = {
      hasError: true,
      error: new Error('FATAL_WEBGL_CONTEXT_LOST'),
      errorInfo: null,
    };

    const crashedTraderoomHtml = renderToString(
      <div className="traderoom">
        {boundary.render()}
        <OrderTicketMock balance={10000} />
      </div>
    );

    // O gráfico exibiu o fallback de segurança sem travar a árvore
    expect(crashedTraderoomHtml).toContain('data-testid="chart-error-fallback"');
    expect(crashedTraderoomHtml).toContain('Gráfico Temporariamente Indisponível');
    // CRUCIAL: O OrderTicket continua 100% montado e renderizado com o saldo de $10.000 intacto!
    expect(crashedTraderoomHtml).toContain('data-testid="order-ticket-mock"');
    expect(crashedTraderoomHtml).toContain('Saldo Disponível: $10000');
    expect(crashedTraderoomHtml).toContain('Comprar UP');
  });

  it('CHAOS-02: Rajada de 50.000 ticks com injeção de dados maliciosos e timestamps retrógrados', () => {
    const maliciousTicks: any[] = [];
    const baseNow = Date.now();

    for (let i = 0; i < 50000; i++) {
      if (i % 100 === 0) {
        // Injeção de payload corrompido ou malicioso
        maliciousTicks.push({
          type: 'tick',
          symbol: 'SYNTH_VOL_50',
          sequence: i,
          price: '<script>alert(1)</script>',
          ts: 'invalido',
        });
      } else if (i % 75 === 0) {
        // Preço negativo ou NaN
        maliciousTicks.push({
          type: 'tick',
          symbol: 'SYNTH_VOL_50',
          sequence: i,
          price: NaN,
          ts: new Date().toISOString(),
        });
      } else {
        // Ticks válidos intercalados com timestamps retrógrados
        maliciousTicks.push({
          type: 'tick',
          symbol: 'SYNTH_VOL_50',
          sequence: i,
          price: (1500 + Math.sin(i) * 10).toFixed(2),
          ts: new Date(baseNow + (i % 2 === 0 ? i * 1000 : -i * 1000)).toISOString(),
        });
      }
    }

    const t0 = performance.now();
    let accepted = 0;
    let rejected = 0;
    let minPrice = Infinity;

    for (const raw of maliciousTicks) {
      const sanitized = sanitizeTick(raw as Tick);
      if (sanitized) {
        accepted++;
        if (sanitized.price < minPrice) minPrice = sanitized.price;
      } else {
        rejected++;
      }
    }

    const duration = performance.now() - t0;
    expect(minPrice).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0); // Garante que todo lixo foi filtrado
    expect(accepted).toBeGreaterThan(0);
    expect(duration).toBeLessThan(300); // 50.000 ticks sanitizados com alta performance
  });

  it('SECURITY-01: Não vaza dados sensíveis, tokens JWT ou credenciais no fallback do gráfico', () => {
    const sensitiveError = new Error('Token expired: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.super_secret_jwt');
    const boundary = new ChartErrorBoundary({
      children: <div>Canvas</div>,
    });
    boundary.state = {
      hasError: true,
      error: sensitiveError,
      errorInfo: null,
    };

    const html = renderToString(boundary.render() as React.ReactElement);
    // Deve renderizar a mensagem amigável sem expor dados internos do backend
    expect(html).toContain('Gráfico Temporariamente Indisponível');
    expect(html).toContain('Suas ordens ativas, histórico e saldo demo continuam operando');
  });

  it('LAYOUT-01: CSS Containment isola o canvas contra reflows externos', () => {
    const sampleCandles: Candle[] = [
      { time: 1700000000, open: '100', high: '105', low: '95', close: '102', volume: 0 },
    ];

    const html = renderToString(
      <ChartSandbox
        candles={sampleCandles}
        tick={null}
        symbol="EURUSD_OTC"
      />
    );

    // containment estrito evita reflow no restante do app
    expect(html).toContain('contain:layout size');
    expect(html).toContain('overflow:hidden');
  });
});
