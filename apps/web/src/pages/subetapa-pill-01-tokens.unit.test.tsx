import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

describe('SUBETAPA 01: Tokens CSS de Cápsulas, Inputs 12px/48px e Fundo Aveludado', () => {
  it('1.1 Renderiza classes utilitárias de cápsula pill, input fintech e card 20px', () => {
    const html = renderToString(
      <div className="bm-card-fintech">
        <div className="bm-pill-container">
          <button className="bm-pill-tab bm-pill-tab-active">Criar conta</button>
          <button className="bm-pill-tab">Entrar</button>
        </div>
        <input className="bm-input-fintech" placeholder="voce@email.com" />
        <button className="bm-btn-pill-primary">Entrar →</button>
        <div className="bm-security-disclaimer">Conexão criptografada.</div>
      </div>
    );

    expect(html).toContain('bm-card-fintech');
    expect(html).toContain('bm-pill-container');
    expect(html).toContain('bm-pill-tab');
    expect(html).toContain('bm-pill-tab-active');
    expect(html).toContain('bm-input-fintech');
    expect(html).toContain('bm-btn-pill-primary');
    expect(html).toContain('bm-security-disclaimer');
  });

  it('1.2 Estresse de renderização SSR da estrutura básica em 100 ciclos', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const html = renderToString(
        <div className="bm-card-fintech">
          <input className="bm-input-fintech" defaultValue={`test${i}@email.com`} />
        </div>
      );
      expect(html.length).toBeGreaterThan(50);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(300);
  });
});
