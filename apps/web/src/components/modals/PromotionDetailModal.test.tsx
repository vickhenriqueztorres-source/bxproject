import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  PromotionDetailModal,
  type PromotionDetailModalProps,
} from './PromotionDetailModal';

/* ═══════════════════════════════════════════════════════════════════════
   FIXTURES: Dados de teste reutilizáveis para os 3 tipos de promoção
   ═══════════════════════════════════════════════════════════════════════ */

const PROMO_WELCOME = {
  id: 'promo-welcome',
  title: 'Bono de Bienvenida para Práctica',
  badge: 'SIN REQUISITO DE DEPÓSITO',
  value: '$10.000 USD',
  subtext: 'Saldo de práctica recargable ilimitadamente',
  description:
    'Acceso completo a todos los índices sintéticos y herramientas de dibujo técnico profesional para calibrar algoritmos y operativa manual sin riesgo de capital.',
  requirements: [
    'Vigencia: Renovación automática permanente',
    'Volumen de práctica sugerido: $50,000',
    'Acceso sin restricciones a todos los feeds OTC e índices continuos',
  ],
  actionText: 'Asignar saldo',
};

const PROMO_CASHBACK = {
  id: 'promo-cashback',
  title: 'Cashback Semanal del 10%',
  badge: 'GESTIÓN DE RIESGO',
  value: 'Hasta $5,000 USD',
  subtext: 'Liquidación de balance los lunes 00:00 UTC',
  description:
    'Reembolso auditado del 10% sobre el saldo neto no ganador acumulado semanalmente, acreditado directamente para preservar la continuidad de la cuenta.',
  requirements: [
    'Acreditación automática semanal vía libro contable Blnk',
    'Cálculo exacto sobre pérdida neta de la semana operativa',
    'Sin cláusulas de retención ni bloqueos de retiro',
  ],
  actionText: 'Activar protección',
};

const PROMO_TOURNAMENT = {
  id: 'promo-tournament',
  title: 'Gran Torneo Mensual BINMAX',
  badge: 'PREMIOS EN BALANCE REAL',
  value: '$50,000 USD',
  subtext: 'Bolsa distribuida entre las 10 mejores posiciones',
  description:
    'Demuestra consistencia y control de varianza en el ranking público compitiendo en igualdad de condiciones con la comunidad de traders.',
  requirements: [
    'Inscripción incluida sin tarifa adicional',
    'Mínimo de 15 contratos durante el período del certamen',
    'Clasificación por estricta rentabilidad porcentual',
  ],
  actionText: 'Inscribir posición',
};

function makeProps(overrides: Partial<PromotionDetailModalProps> = {}): PromotionDetailModalProps {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onActivate: vi.fn(),
    isActivated: false,
    promotion: PROMO_WELCOME,
    ...overrides,
  };
}

function renderModal(overrides: Partial<PromotionDetailModalProps> = {}): string {
  return renderToString(<PromotionDetailModal {...makeProps(overrides)} />);
}

/* ═══════════════════════════════════════════════════════════════════════
   1. TESTES DE RENDERIZAÇÃO BASE
   ═══════════════════════════════════════════════════════════════════════ */

describe('PromotionDetailModal — Renderização Base', () => {
  it('1.1.1 NÃO renderiza quando isOpen=false (retorna null)', () => {
    const html = renderModal({ isOpen: false });
    expect(html).toBe('');
  });

  it('1.1.2 Renderiza quando isOpen=true', () => {
    const html = renderModal({ isOpen: true });
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('promotion-detail-modal');
  });

  it('1.1.3 Contém role="dialog" e aria-modal="true"', () => {
    const html = renderModal();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('1.1.4 Contém aria-labelledby apontando para o título', () => {
    const html = renderModal();
    expect(html).toContain('aria-labelledby="promotion-modal-title"');
    expect(html).toContain('id="promotion-modal-title"');
  });

  it('1.1.5 Contém data-testid="promotion-detail-modal"', () => {
    const html = renderModal();
    expect(html).toContain('data-testid="promotion-detail-modal"');
  });

  it('1.1.6 Backdrop com data-testid="promotion-detail-backdrop" existe', () => {
    const html = renderModal();
    expect(html).toContain('data-testid="promotion-detail-backdrop"');
  });

  it('1.1.7 Botão de fechar (✕) com aria-label existe', () => {
    const html = renderModal();
    expect(html).toContain('data-testid="promotion-modal-close-btn"');
    expect(html).toContain('aria-label');
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   2. TESTES DE CONTEÚDO DO CARD
   ═══════════════════════════════════════════════════════════════════════ */

describe('PromotionDetailModal — Conteúdo', () => {
  it('1.2.1 Exibe o título da promoção passada via props', () => {
    const html = renderModal({ promotion: PROMO_WELCOME });
    expect(html).toContain('Bono de Bienvenida para Práctica');
  });

  it('1.2.2 Exibe o badge da promoção', () => {
    const html = renderModal({ promotion: PROMO_WELCOME });
    expect(html).toContain('SIN REQUISITO DE DEPÓSITO');
  });

  it('1.2.3 Exibe o valor destacado', () => {
    const html = renderModal({ promotion: PROMO_WELCOME });
    expect(html).toContain('$10.000 USD');
  });

  it('1.2.4 Exibe a descrição completa', () => {
    const html = renderModal({ promotion: PROMO_WELCOME });
    expect(html).toContain('Acceso completo a todos los índices sintéticos');
  });

  it('1.2.5 Exibe todos os requisitos/parâmetros', () => {
    const html = renderModal({ promotion: PROMO_WELCOME });
    PROMO_WELCOME.requirements.forEach((req) => {
      expect(html).toContain(req);
    });
  });

  it('1.2.6 Exibe o botão de ação com texto correto', () => {
    const html = renderModal({ promotion: PROMO_WELCOME });
    expect(html).toContain('Asignar saldo');
  });

  it('1.2.7 Valores numéricos usam classe bm-tabular-nums', () => {
    const html = renderModal({ promotion: PROMO_WELCOME });
    expect(html).toContain('bm-tabular-nums');
  });

  it('1.2.8 Renderiza corretamente o Card de Cashback', () => {
    const html = renderModal({ promotion: PROMO_CASHBACK });
    expect(html).toContain('Cashback Semanal del 10%');
    expect(html).toContain('GESTIÓN DE RIESGO');
    expect(html).toContain('Hasta $5,000 USD');
    expect(html).toContain('Activar protección');
  });

  it('1.2.9 Renderiza corretamente o Card de Torneio', () => {
    const html = renderModal({ promotion: PROMO_TOURNAMENT });
    expect(html).toContain('Gran Torneo Mensual BINMAX');
    expect(html).toContain('PREMIOS EN BALANCE REAL');
    expect(html).toContain('$50,000 USD');
    expect(html).toContain('Inscribir posición');
  });

  it('1.2.10 Botão de ação mostra estado ativado quando isActivated=true', () => {
    const html = renderModal({ isActivated: true });
    expect(html).toContain('Programa Asignado');
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   3. TESTES DE DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════════ */

describe('PromotionDetailModal — Design Tokens BINMAX', () => {
  it('1.4.1 Backdrop tem background com rgba e blur', () => {
    const html = renderModal();
    expect(html).toMatch(/rgba\(/);
    expect(html).toMatch(/blur\(/);
  });

  it('1.4.2 Modal usa font-family Geist', () => {
    const html = renderModal();
    expect(html).toMatch(/Geist/);
  });

  it('1.4.3 Valor numérico usa fonte mono (Geist Mono)', () => {
    const html = renderModal();
    expect(html).toMatch(/Geist Mono/);
  });

  it('1.4.4 Animação usa classe bm-modal-scale', () => {
    const html = renderModal();
    expect(html).toContain('bm-modal-scale');
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   4. TESTES DE ESTRESSE 🔥
   ═══════════════════════════════════════════════════════════════════════ */

describe('PromotionDetailModal — Estresse', () => {
  it('1.5.1 100 renderizações open/close em <500ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const isOpen = i % 2 === 0;
      renderModal({ isOpen });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('1.5.2 50 renderizações com 3 promoções diferentes em <300ms', () => {
    const promos = [PROMO_WELCOME, PROMO_CASHBACK, PROMO_TOURNAMENT];
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const html = renderModal({ promotion: promos[i % 3] });
      expect(html.length).toBeGreaterThan(0);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(300);
  });

  it('1.5.3 Alternância rápida entre ativado e desativado 100x', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const html = renderModal({ isActivated: i % 2 === 0 });
      expect(html.length).toBeGreaterThan(0);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   5. TESTES DE CAOS (Edge Cases) 💥
   ═══════════════════════════════════════════════════════════════════════ */

describe('PromotionDetailModal — Caos (Edge Cases)', () => {
  it('1.5.3 Props com strings vazias — modal renderiza sem crash', () => {
    const emptyPromo = {
      id: '',
      title: '',
      badge: '',
      value: '',
      subtext: '',
      description: '',
      requirements: [],
      actionText: '',
    };
    expect(() => renderModal({ promotion: emptyPromo })).not.toThrow();
  });

  it('1.5.4 Props com strings extremamente longas — renderiza sem crash', () => {
    const longString = 'A'.repeat(500);
    const longPromo = {
      id: 'promo-long',
      title: longString,
      badge: longString,
      value: longString,
      subtext: longString,
      description: longString,
      requirements: [longString, longString],
      actionText: longString,
    };
    const html = renderModal({ promotion: longPromo });
    expect(html.length).toBeGreaterThan(0);
    // Verifica que o conteúdo longo está presente (não é cortado silenciosamente)
    expect(html).toContain(longString.substring(0, 50));
  });

  it('1.5.5 Array de requirements vazio — seção renderiza sem crash', () => {
    const noReqPromo = { ...PROMO_WELCOME, requirements: [] };
    const html = renderModal({ promotion: noReqPromo });
    expect(html).toContain('Bono de Bienvenida');
  });

  it('1.5.6 Array com 20 requirements — renderiza todos', () => {
    const manyReqs = Array.from({ length: 20 }, (_, i) => `Requisito ${i + 1}`);
    const bigPromo = { ...PROMO_WELCOME, requirements: manyReqs };
    const html = renderModal({ promotion: bigPromo });
    expect(html).toContain('Requisito 1');
    expect(html).toContain('Requisito 20');
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   6. TESTES DE SEGURANÇA 🔒
   ═══════════════════════════════════════════════════════════════════════ */

describe('PromotionDetailModal — Segurança', () => {
  it('1.5.7 Conteúdo HTML em title/description é escapado (XSS prevention)', () => {
    const xssPromo = {
      ...PROMO_WELCOME,
      title: '<script>alert("xss")</script>',
      description: '<img src=x onerror="alert(1)">',
    };
    const html = renderModal({ promotion: xssPromo });
    // React faz escape automático — verificamos que NÃO há tags HTML executáveis
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    // O conteúdo escapado DEVE estar presente como entidades HTML (seguro)
    expect(html).toContain('&lt;script&gt;');
    // onerror aparece como texto escapado com &quot; — não executável
    expect(html).toContain('onerror=&quot;');
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   7. TESTES ANTI-CASSINO 🚫🎰
   ═══════════════════════════════════════════════════════════════════════ */

describe('PromotionDetailModal — Anti-Cassino', () => {
  it('1.5.8 Zero strings de cassino no HTML renderizado', () => {
    const html = renderModal().toLowerCase();
    const proibidos = [
      'parabéns',
      'parabens',
      'congratulations',
      'ganhou',
      'you won',
      'confetti',
      'confete',
      'jackpot',
      'slot',
      'bounce',
      'spring',
      'shake',
      'spin',
      'cha-ching',
      'firework',
      'fogos',
      'estrela',
      'moeda',
      'coin',
    ];
    proibidos.forEach((termo) => {
      expect(html).not.toContain(termo);
    });
  });

  it('1.5.9 Zero animações bounce/spring/elastic nos estilos', () => {
    const html = renderModal();
    expect(html).not.toMatch(/bounce/i);
    expect(html).not.toMatch(/spring/i);
    expect(html).not.toMatch(/elastic/i);
    expect(html).not.toMatch(/overshoot/i);
  });
});
