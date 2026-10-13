import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SUBETAPA 03: Motion Design de Precisão e Física Inercial das Ondas', () => {
  const cssPath = path.resolve(__dirname, 'tokens-precision.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  it('3.1 Contém a classe .bm-bg-curve-motion com duração de 16s e transform-origin adequada', () => {
    expect(cssContent).toContain('.bm-bg-curve-motion');
    expect(cssContent).toContain('animation: bmWaveDrift 16s ease-in-out infinite;');
    expect(cssContent).toContain('will-change: transform, opacity;');
    expect(cssContent).toContain('transform-origin: center bottom;');
  });

  it('3.2 Contém @keyframes bmWaveDrift com translação suave e aceleração controlada', () => {
    expect(cssContent).toContain('@keyframes bmWaveDrift');
    expect(cssContent).toContain('transform: translate3d(0, 0, 0) scale(1);');
    expect(cssContent).toContain('transform: translate3d(-16px, 10px, 0) scale(1.015);');
  });

  it('3.3 Contém @keyframes bmGlowPulse com respiração de 10s e escala volumétrica', () => {
    expect(cssContent).toContain('@keyframes bmGlowPulse');
    expect(cssContent).toContain('animation: bmGlowPulse 10s ease-in-out infinite;');
    expect(cssContent).toContain('transform: scale(1.04);');
  });

  it('3.4 Acessibilidade Estrita: Respeito à media query prefers-reduced-motion: reduce', () => {
    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssContent).toContain('animation: none !important;');
  });
});
