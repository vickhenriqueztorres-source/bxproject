import { describe, it, expect } from 'vitest';
import {
  PRECISION_SURFACES,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
  getMotionTransition,
} from '../lib/design-tokens';
import fs from 'node:fs';
import path from 'node:path';

describe('Subetapa 01 — Tokens de Precisão e Física de Movimento', () => {
  it('garante as 4 superfícies oficiais e os aliases legados (bg < panel < field)', () => {
    expect(PRECISION_SURFACES.bg0).toBe('#0B0E14');
    expect(PRECISION_SURFACES.bg1).toBe('#101622');
    expect(PRECISION_SURFACES.bg2).toBe('#151D2B');
    expect(PRECISION_SURFACES.bg3).toBe('#1C2738');
    expect(PRECISION_SURFACES.bg).toBe('#0B0E14');
    expect(PRECISION_SURFACES.panel).toBe('#101622');
    expect(PRECISION_SURFACES.field).toBe('#1C2738');

    // Validação matemática de luminescência hexadecimal
    const hexToVal = (hex: string) => parseInt(hex.replace('#', ''), 16);
    expect(hexToVal(PRECISION_SURFACES.bg)).toBeLessThan(hexToVal(PRECISION_SURFACES.panel));
    expect(hexToVal(PRECISION_SURFACES.panel)).toBeLessThan(hexToVal(PRECISION_SURFACES.field));
  });

  it('valida que as cores semânticas obedecem ao contrato congelado de tokens BINMAX', () => {
    expect(PRECISION_COLORS.gain).toBe('#22C47A');
    expect(PRECISION_COLORS.loss).toBe('#F2545B');
    expect(PRECISION_COLORS.pending).toBe('#E8A33D');
    expect(PRECISION_COLORS.system).toBe('#4D8DFF');
    expect(PRECISION_COLORS.textPrimary).toBe('#F4F5F7');
    expect(PRECISION_COLORS.textSecondary).toBe('#8A92A1');
  });

  it('valida que os 8 tokens de física de movimento contêm durações e curva exatas', () => {
    expect(PRECISION_MOTION.ease).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(PRECISION_MOTION.tMicro).toBe(100);
    expect(PRECISION_MOTION.tBase).toBe(180);
    expect(PRECISION_MOTION.tEnter).toBe(260);
    expect(PRECISION_MOTION.tCount).toBe(500);
    expect(PRECISION_MOTION.distMax).toBe(64);
  });

  it('valida o gerador de transição mecânica getMotionTransition', () => {
    const tMicro = getMotionTransition('tMicro');
    expect(tMicro).toBe('opacity, transform 100ms cubic-bezier(0.16, 1, 0.3, 1)');

    const tEnter = getMotionTransition('tEnter', 'transform');
    expect(tEnter).toBe('transform 260ms cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('garante que o arquivo CSS tokens-precision.css desativa explicitamente tremores e saltos (anti-patterns)', () => {
    const cssPath = path.resolve(__dirname, 'tokens-precision.css');
    expect(fs.existsSync(cssPath)).toBe(true);

    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Anti-patterns neutralizados
    const cssRules = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(cssRules).not.toMatch(/@(?:-webkit-)?keyframes\s+[\w-]*(?:shake|bounce)[\w-]*\b/i);
    expect(cssRules).not.toMatch(/animation(?:-name)?\s*:[^;}]*\b[\w-]*(?:shake|bounce)[\w-]*\b/i);
    const noShakeRule = cssRules.match(/\.bm-no-shake\s*\{([^}]*)\}/)?.[1];
    expect(noShakeRule).toMatch(/\banimation\s*:\s*none\s*!important\s*;/);
    expect(noShakeRule).toMatch(/\btransform\s*:\s*none\s*!important\s*;/);
    expect(cssRules).toMatch(/\.bm-no-bounce\s*\{\s*transition-timing-function\s*:\s*var\(--ease\)\s*!important\s*;\s*\}/);

    // Suporte obrigatório a prefers-reduced-motion
    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssContent).toContain('animation-duration: 0.01ms');
  });

  describe('Teste de Estresse de Performance de Tokens', () => {
    it('calcula transições para 10.000 nós virtuais em alta performance sem gargalo', () => {
      const start = performance.now();
      let lastTrans = '';
      for (let i = 0; i < 10_000; i++) {
        lastTrans = getMotionTransition(i % 2 === 0 ? 'tMicro' : 'tBase');
      }
      const elapsed = performance.now() - start;
      expect(lastTrans).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
      expect(elapsed).toBeLessThan(100);
    });
  });
});
