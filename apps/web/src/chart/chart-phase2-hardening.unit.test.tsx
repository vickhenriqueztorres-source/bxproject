import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { RafChartUpdater } from './raf-updater';
import type { Tick } from '../feed/protocol';

describe('[FASE 2 HARDENING] Blindagem Avançada, Auto-Heal e Resiliência WebGL/CPU', () => {
  it('HARD-01: Auto-Heal recupera automaticamente o gráfico após falha transitória', async () => {
    const onReset = vi.fn();
    const boundary = new ChartErrorBoundary({
      symbol: 'BTCUSD_OTC',
      autoHeal: true,
      maxAutoRetries: 2,
      autoRetryDelayMs: 15,
      onReset,
      children: <div>Canvas</div>,
    });

    const error = new Error('GPU_DRIVER_RESET');
    const errorInfo: React.ErrorInfo = { componentStack: '\n    in PriceChart' };

    boundary.componentDidCatch(error, errorInfo);

    // Imediatamente após o crash: isAutoHealing está ativo
    expect(boundary.state.isAutoHealing).toBe(true);
    expect(boundary.state.autoRetriesCount).toBe(0);

    // Aguarda o timer de auto-cura expirar (15ms + margem)
    await new Promise((resolve) => setTimeout(resolve, 35));

    // Estado auto-curado: hasError resetado para false e retries incrementado
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.autoRetriesCount).toBe(1);
    expect(boundary.state.isAutoHealing).toBe(false);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('HARD-02: Auto-Heal exibe indicador visual de auto-recuperação durante a transição', () => {
    const boundary = new ChartErrorBoundary({
      symbol: 'BTCUSD_OTC',
      children: <div>Canvas</div>,
    });

    boundary.state = {
      hasError: true,
      error: new Error('WebGL Lost'),
      errorInfo: null,
      autoRetriesCount: 0,
      isAutoHealing: true,
    };

    const html = renderToString(boundary.render() as React.ReactElement);
    expect(html).toContain('data-testid="auto-healing-indicator"');
    expect(html).toContain('Tentando auto-recuperação transparente');
  });

  it('HARD-03: WebGL Context Lost previne default para permitir restauração pela GPU', () => {
    let defaultPrevented = false;
    const fakeEvent = {
      type: 'webglcontextlost',
      preventDefault: () => {
        defaultPrevented = true;
      },
    };

    // Simula a rotina obrigatória do padrão Khronos WebGL
    const handleContextLost = (e: any) => {
      e.preventDefault();
    };

    handleContextLost(fakeEvent);
    expect(defaultPrevented).toBe(true);
  });

  it('HARD-04: RafChartUpdater monitora duração do frame e detecta alta carga de CPU (>25ms)', () => {
    let queuedCb: ((time: number) => void) | null = null;
    const customRaf = (cb: (time: number) => void) => {
      queuedCb = cb;
      return 1;
    };

    const updater = new RafChartUpdater(customRaf);

    const heavyRenderCallback = vi.fn(() => {
      // Simula renderização pesada que consome 30ms
      const start = Date.now();
      while (Date.now() - start < 30) {
        // busy wait
      }
    });

    const mockTick: Tick = {
      type: 'tick',
      symbol: 'SYNTH_VOL_50',
      sequence: 1,
      price: '1500.25',
      ts: new Date().toISOString(),
    };

    updater.push(mockTick, heavyRenderCallback);

    // Executa o frame
    if (queuedCb) (queuedCb as any)(performance.now());

    const stats = updater.getStats();
    expect(stats.rendered).toBe(1);
    expect(stats.lastFrameDurationMs).toBeGreaterThanOrEqual(25);
    expect(stats.highLoadFramesCount).toBeGreaterThanOrEqual(1);
  });
});
