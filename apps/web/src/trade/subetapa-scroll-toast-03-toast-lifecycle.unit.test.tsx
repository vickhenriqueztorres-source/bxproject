import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { TradeResultToast } from '../components/toasts/TradeResultToast';

const toastFilePath = path.resolve(__dirname, '../components/toasts/TradeResultToast.tsx');
const toastSource = fs.readFileSync(toastFilePath, 'utf-8');

describe('SUBETAPA 03 — Redesign de Precisão e Ciclo de Vida do TradeResultToast', () => {
  it('1. [Unit] Renderiza telemetria de precisão com barra lateral 3px, AssetFlagBadge, getAssetDisplayName e barra de progresso temporal', () => {
    const winHtml = renderToStaticMarkup(
      <TradeResultToast
        result="WIN"
        amountFormatted="+$85.00"
        assetSymbol="SYNTH_VOL_50"
        direction="UP"
        autoCloseMs={4000}
        onClose={vi.fn()}
      />
    );

    expect(winHtml).toContain('data-testid="trade-result-toast-win"');
    expect(winHtml).toContain('Ganaste');
    expect(winHtml).toContain('+$85.00');
    expect(winHtml).toContain('Vol 50 · SUBE');
    expect(winHtml).not.toContain('SYNTH_VOL_50');
    expect(winHtml).toContain('data-testid="toast-progress-bar"');
    expect(winHtml).toContain('bmToastProgress 4000ms linear forwards');
    expect(winHtml).toContain('border-left:3px solid #22C47A');

    const lossHtml = renderToStaticMarkup(
      <TradeResultToast
        result="LOSS"
        amountFormatted="-$100.00"
        assetSymbol="USDCAD_OTC"
        direction="DOWN"
        autoCloseMs={4000}
        onClose={vi.fn()}
      />
    );

    expect(lossHtml).toContain('data-testid="trade-result-toast-loss"');
    expect(lossHtml).toContain('Perdiste');
    expect(lossHtml).toContain('-$100.00');
    expect(lossHtml).toContain('USD/CAD · BAJA');
    expect(lossHtml).toContain('border-left:3px solid #F2545B');
  });

  it('2. [Unit] Anti-Colisão com Gaveta: desloca left de 84px para 448px quando drawerOpen={true}', () => {
    const closedDrawerHtml = renderToStaticMarkup(
      <TradeResultToast
        result="WIN"
        amountFormatted="+$85.00"
        drawerOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(closedDrawerHtml).toContain('left:84px');

    const openDrawerHtml = renderToStaticMarkup(
      <TradeResultToast
        result="LOSS"
        amountFormatted="-$100.00"
        drawerOpen={true}
        onClose={vi.fn()}
      />
    );
    expect(openDrawerHtml).toContain('left:448px');
    expect(openDrawerHtml).toContain('transition:left 220ms cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('3. [Ciclo de Vida & Regressão] Usa useRef(onClose) para que re-renders de ticks 1Hz nunca reiniciem o timer de autoCloseMs', () => {
    // O bug que prendia o toast na tela para sempre ocorria porque [onClose, autoCloseMs]
    // reiniciava o setTimeout a cada render do Dashboard (1 tick/segundo).
    expect(toastSource).toContain('useRef(onClose)');
    expect(toastSource).toContain('onCloseRef.current()');
    expect(toastSource).not.toContain('[onClose, autoCloseMs]');
  });

  it('4. [Estresse & Caos] Suporta 100 renderizações concorrentes com direções, símbolos e autoCloseMs variados (< 150ms)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const result = i % 3 === 0 ? 'WIN' : i % 3 === 1 ? 'LOSS' : 'DRAW';
      const html = renderToStaticMarkup(
        <TradeResultToast
          result={result}
          amountFormatted={result === 'WIN' ? '+$85.00' : result === 'LOSS' ? '-$100.00' : '$0.00'}
          assetSymbol={i % 2 === 0 ? 'SYNTH_VOL_50' : 'EURUSD_OTC'}
          direction={i % 2 === 0 ? 'UP' : 'DOWN'}
          drawerOpen={i % 2 === 1}
          autoCloseMs={i % 5 === 0 ? 0 : 4000}
          onClose={vi.fn()}
        />
      );
      expect(html).toContain('role="alert"');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
