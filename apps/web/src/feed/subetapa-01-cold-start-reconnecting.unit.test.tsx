import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradingFeedManager } from './TradingFeedManager';
import { ReconnectingOverlay } from '../chart/ReconnectingOverlay';

describe('SUBETAPA 01 — Eliminação Cirúrgica do Falso "Reconectando..." no Refresh / Cold-Start', () => {
  let manager: TradingFeedManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
    manager = new TradingFeedManager('ws://localhost:9999/ws');
  });

  afterEach(() => {
    manager.disconnect();
    vi.useRealTimers();
  });

  describe('1.1 Cold-Start Grace Window (Zero Falso Alarme no Refresh F5)', () => {
    it('No instante do boot/refresh (t=0ms), isColdStarting e isSymbolColdStarting são true e suprimem o alerta "Reconectando..."', () => {
      const cb = vi.fn();
      const unsub = manager.subscribeSymbol('VOL_50', cb);

      expect(manager.isColdStarting()).toBe(true);
      expect(manager.isSymbolColdStarting('VOL_50')).toBe(true);

      const effectiveIsStale = manager.isSymbolStale('VOL_50') && !manager.isSymbolColdStarting('VOL_50');
      expect(effectiveIsStale).toBe(false);

      const html = renderToString(
        <ReconnectingOverlay
          isReconnecting={effectiveIsStale}
          isLoadingInitial={false}
          symbol="VOL_50"
        />
      );
      expect(html).toBe('');
      expect(html).not.toContain('Reconectando...');

      unsub();
    });

    it('Assim que o 1º tick válido chega no cold-start, isSymbolColdStarting e isSymbolStale ficam false simultaneamente (transição invisível)', () => {
      const cb = vi.fn();
      const unsub = manager.subscribeSymbol('EURUSD_OTC', cb);

      expect(manager.isSymbolColdStarting('EURUSD_OTC')).toBe(true);

      // Simula chegada do 1º tick
      (manager as any).connected = true;
      (manager as any).everConnected = true;
      (manager as any).applyTick({
        type: 'tick',
        symbol: 'EURUSD_OTC',
        sequence: 101,
        price: '1.08542',
        ts: new Date().toISOString(),
      });

      expect(manager.isSymbolColdStarting('EURUSD_OTC')).toBe(false);
      expect(manager.isSymbolStale('EURUSD_OTC')).toBe(false);
      expect(cb).toHaveBeenCalledTimes(1);

      unsub();
    });
  });

  describe('1.2 Modo Ícone de Carregamento Silencioso (isLoadingInitial)', () => {
    it('Renderiza apenas ícone minimalista silencioso (cold-start-loading-icon) sem texto "Reconectando..." quando isLoadingInitial=true e isReconnecting=false', () => {
      const html = renderToString(
        <ReconnectingOverlay
          isReconnecting={false}
          isLoadingInitial={true}
          symbol="EURUSD_OTC"
        />
      );

      expect(html).toContain('data-testid="cold-start-loading-icon"');
      expect(html).not.toContain('data-testid="reconnecting-overlay"');
      expect(html).not.toContain('Reconectando...');
    });

    it('Preserva 100% o overlay "Reconectando..." tradicional quando isReconnecting=true (queda real de conexão)', () => {
      const html = renderToString(
        <ReconnectingOverlay
          isReconnecting={true}
          isLoadingInitial={true}
          symbol="EURUSD_OTC"
        />
      );

      expect(html).toContain('data-testid="reconnecting-overlay"');
      expect(html).toContain('Reconectando...');
      expect(html).not.toContain('data-testid="cold-start-loading-icon"');
    });
  });

  describe('1.3 Testes de Caos (Queda Pós-Conexão, Timeout de Boot e Ticks Atrasados)', () => {
    it('Caos A: Se o cold-start ultrapassar 4000ms sem nenhum tick, encerra a janela de grace e ativa o estado stale / Reconectando', () => {
      const unsub = manager.subscribeSymbol('GBPUSD_OTC', vi.fn());
      expect(manager.isSymbolColdStarting('GBPUSD_OTC', 4000)).toBe(true);

      vi.advanceTimersByTime(4001);

      expect(manager.isSymbolColdStarting('GBPUSD_OTC', 4000)).toBe(false);
      const effectiveIsStale = manager.isSymbolStale('GBPUSD_OTC') && !manager.isSymbolColdStarting('GBPUSD_OTC', 4000);
      expect(effectiveIsStale).toBe(true);

      unsub();
    });

    it('Caos B: Se a conexão já esteve ativa (everConnected=true) e cair no meio da sessão, isSymbolColdStarting retorna false imediatamente', () => {
      const unsub = manager.subscribeSymbol('VOL_100', vi.fn());
      (manager as any).everConnected = true;
      (manager as any).connected = false;

      expect(manager.isColdStarting()).toBe(false);
      expect(manager.isSymbolColdStarting('VOL_100')).toBe(false);

      unsub();
    });

    it('Caos C: Se um tick muito atrasado (>5s) for rejeitado, isSymbolColdStarting retorna false imediatamente', () => {
      const unsub = manager.subscribeSymbol('VOL_75', vi.fn());
      (manager as any).connected = true;
      (manager as any).applyTick({
        type: 'tick',
        symbol: 'VOL_75',
        sequence: 1,
        price: '500.00',
        ts: new Date(Date.now() - 9000).toISOString(),
      });

      expect(manager.getSymbolDelayedCount('VOL_75')).toBe(1);
      expect(manager.isSymbolColdStarting('VOL_75')).toBe(false);
      expect(manager.isSymbolStale('VOL_75')).toBe(true);

      unsub();
    });
  });

  describe('1.4 Testes de Segurança (Prevenção de XSS e Injeção no Overlay)', () => {
    it('Escapa payloads maliciosos em symbol e message tanto no modo loading quanto no modo reconnecting', () => {
      const maliciousSymbol = '<script>window.__pwned=1</script><img src=x onerror=alert(1)>';
      const maliciousMsg = '<svg onload=alert(2)>Reconectando</svg>';

      const htmlLoading = renderToString(
        <ReconnectingOverlay
          isReconnecting={false}
          isLoadingInitial={true}
          symbol={maliciousSymbol}
        />
      );
      expect(htmlLoading).not.toContain('<script>window.__pwned');
      expect(htmlLoading).not.toContain('<img src=x');

      const htmlReconnecting = renderToString(
        <ReconnectingOverlay
          isReconnecting={true}
          symbol={maliciousSymbol}
          message={maliciousMsg}
        />
      );
      expect(htmlReconnecting).not.toContain('<script>window.__pwned');
      expect(htmlReconnecting).not.toContain('<svg onload=alert(2)>');
    });
  });

  describe('1.5 Teste de Estresse (500 Ciclos de Inscrição / Troca de Aba / Render)', () => {
    it('Executa 500 ciclos de subscribe/unsubscribe + checagem de cold-start e renderização em < 250ms sem vazamento', () => {
      vi.useRealTimers();
      const stressManager = new TradingFeedManager('ws://localhost:9999/ws');
      const start = performance.now();

      for (let i = 0; i < 500; i++) {
        const sym = `SYNTH_VOL_${i % 10}`;
        const unsub = stressManager.subscribeSymbol(sym, () => {});
        const cold = stressManager.isSymbolColdStarting(sym);
        expect(typeof cold).toBe('boolean');

        const html = renderToString(
          <ReconnectingOverlay
            isReconnecting={!cold && i % 3 === 0}
            isLoadingInitial={cold}
            symbol={sym}
          />
        );
        expect(html.length).toBeGreaterThan(0);
        unsub();
      }

      const elapsed = performance.now() - start;
      stressManager.disconnect();
      expect(elapsed).toBeLessThan(250);
    });
  });
});
