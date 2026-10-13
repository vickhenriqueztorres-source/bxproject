import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChartErrorBoundary } from './ChartErrorBoundary';

describe('SUBETAPA 1: ChartErrorBoundary & Resiliência a Falhas Críticas', () => {
  it('EB-01: Renderiza normalmente os filhos quando não há erro', () => {
    const html = renderToString(
      <ChartErrorBoundary symbol="SYNTH_VOL_50">
        <div data-testid="live-chart-canvas">Canvas Operacional</div>
      </ChartErrorBoundary>
    );

    expect(html).toContain('data-testid="live-chart-canvas"');
    expect(html).toContain('Canvas Operacional');
    expect(html).not.toContain('data-testid="chart-error-fallback"');
  });

  it('EB-02: getDerivedStateFromError captura a exceção e altera estado para hasError=true', () => {
    const testError = new Error('LightweightCharts: Assertion failed: data must be sorted by time');
    const nextState = ChartErrorBoundary.getDerivedStateFromError(testError);

    expect(nextState.hasError).toBe(true);
    expect(nextState.error).toBe(testError);
  });

  it('EB-03: Renderiza Fallback de Resiliência Turbo Prata quando hasError=true', () => {
    const boundary = new ChartErrorBoundary({
      symbol: 'EURUSD_OTC',
      children: <div>Canvas</div>,
    });

    // Simula transição para estado de erro
    boundary.state = {
      hasError: true,
      error: new Error('WebGL context lost and failed to restore'),
      errorInfo: null,
    };

    const rendered = boundary.render();
    const html = renderToString(rendered as React.ReactElement);

    expect(html).toContain('data-testid="chart-error-fallback"');
    expect(html).toContain('Gráfico Temporariamente Indisponível (EURUSD_OTC)');
    expect(html).toContain('WebGL context lost and failed to restore');
    expect(html).toContain('data-testid="chart-error-retry-btn"');
    expect(html).toContain('Recarregar Gráfico');
    expect(html).toContain('Suas ordens ativas, histórico e saldo demo continuam operando');
  });

  it('EB-04: Suporta fallback customizado via prop fallback ReactNode e render prop', () => {
    const boundaryWithNode = new ChartErrorBoundary({
      children: <div>Canvas</div>,
      fallback: <div data-testid="custom-fallback">Falha customizada</div>,
    });
    boundaryWithNode.state = { hasError: true, error: new Error('Err'), errorInfo: null };
    const htmlNode = renderToString(boundaryWithNode.render() as React.ReactElement);
    expect(htmlNode).toContain('data-testid="custom-fallback"');

    const boundaryWithFn = new ChartErrorBoundary({
      children: <div>Canvas</div>,
      fallback: (_reset, err) => (
        <div data-testid="custom-render-prop">{`Erro interceptado: ${err?.message}`}</div>
      ),
    });
    boundaryWithFn.state = { hasError: true, error: new Error('Erro Grave 500'), errorInfo: null };
    const htmlFn = renderToString(boundaryWithFn.render() as React.ReactElement);
    expect(htmlFn).toContain('data-testid="custom-render-prop"');
    expect(htmlFn).toContain('Erro interceptado: Erro Grave 500');
  });

  it('EB-05: Invoca callbacks onError e onReset adequadamente', () => {
    const onError = vi.fn();
    const onReset = vi.fn();

    const boundary = new ChartErrorBoundary({
      children: <div>Canvas</div>,
      onError,
      onReset,
    });

    const error = new Error('Out of bounds canvas render');
    const errorInfo: React.ErrorInfo = { componentStack: '\n    in PriceChart' };

    boundary.componentDidCatch(error, errorInfo);
    expect(onError).toHaveBeenCalledWith(error, errorInfo);

    // Testar handleReset
    boundary.state = { hasError: true, error, errorInfo };
    boundary.handleReset();

    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
    expect(boundary.state.errorInfo).toBeNull();
    expect(onReset).toHaveBeenCalled();
  });
});
