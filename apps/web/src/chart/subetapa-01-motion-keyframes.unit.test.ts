/**
 * Subetapa 01 — Keyframes CSS Oficiais de Motion Win/Loss
 *
 * Verifica que tokens-precision.css contém os 5 keyframes de motion
 * para ExpirationResultPin e TradeResultToast com os valores corretos
 * dos tokens do Designer Sênior.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const cssPath = resolve(__dirname, '../styles/tokens-precision.css');
const cssContent = readFileSync(cssPath, 'utf-8');

describe('Subetapa 01 — Keyframes CSS de Motion Win/Loss', () => {
  // T01: Pin entry keyframe
  it('T01 — CSS contém @keyframes bmPinEnter com opacity e translateX', () => {
    expect(cssContent).toContain('@keyframes bmPinEnter');
    // Verifica que anima opacity de 0 para 1
    expect(cssContent).toMatch(/bmPinEnter[\s\S]*?opacity:\s*0/);
    expect(cssContent).toMatch(/bmPinEnter[\s\S]*?opacity:\s*1/);
    // Verifica que usa translateX para slide
    expect(cssContent).toMatch(/bmPinEnter[\s\S]*?translateX/);
  });

  // T02: Pin exit keyframe
  it('T02 — CSS contém @keyframes bmPinExit com opacity e translateX', () => {
    expect(cssContent).toContain('@keyframes bmPinExit');
    expect(cssContent).toMatch(/bmPinExit[\s\S]*?opacity:\s*1/);
    expect(cssContent).toMatch(/bmPinExit[\s\S]*?opacity:\s*0/);
    expect(cssContent).toMatch(/bmPinExit[\s\S]*?translateX/);
  });

  // T03: Toast slide-in keyframe
  it('T03 — CSS contém @keyframes bmToastSlideIn com translateY(16px)', () => {
    expect(cssContent).toContain('@keyframes bmToastSlideIn');
    expect(cssContent).toMatch(/bmToastSlideIn[\s\S]*?translateY\(16px\)/);
    expect(cssContent).toMatch(/bmToastSlideIn[\s\S]*?opacity:\s*0/);
    expect(cssContent).toMatch(/bmToastSlideIn[\s\S]*?opacity:\s*1/);
  });

  // T04: Toast slide-out keyframe
  it('T04 — CSS contém @keyframes bmToastSlideOut com translateY(8px)', () => {
    expect(cssContent).toContain('@keyframes bmToastSlideOut');
    expect(cssContent).toMatch(/bmToastSlideOut[\s\S]*?translateY\(8px\)/);
    expect(cssContent).toMatch(/bmToastSlideOut[\s\S]*?opacity:\s*1/);
    expect(cssContent).toMatch(/bmToastSlideOut[\s\S]*?opacity:\s*0/);
  });

  // T05: Anchor dot pulse keyframe
  it('T05 — CSS contém @keyframes bmAnchorPulse com scale(1.4) e scale(1)', () => {
    expect(cssContent).toContain('@keyframes bmAnchorPulse');
    expect(cssContent).toMatch(/bmAnchorPulse[\s\S]*?scale\(1\.4\)/);
    expect(cssContent).toMatch(/bmAnchorPulse[\s\S]*?scale\(1\)/);
  });

  // T06: Anti-casino — nenhum keyframe usa bounce, elastic, spring, overshoot
  it('T06 — Nenhum keyframe de motion win/loss contém bounce, elastic, spring ou overshoot', () => {
    // Extrai apenas os blocos dos 5 keyframes de motion
    const motionKeyframes = ['bmPinEnter', 'bmPinExit', 'bmToastSlideIn', 'bmToastSlideOut', 'bmAnchorPulse'];
    for (const name of motionKeyframes) {
      const regex = new RegExp(`@keyframes ${name}[\\s\\S]*?\\}\\s*\\}`, 'g');
      const match = cssContent.match(regex);
      expect(match, `Keyframe ${name} deve existir`).not.toBeNull();
      const block = match![0];
      expect(block.toLowerCase()).not.toContain('bounce');
      expect(block.toLowerCase()).not.toContain('elastic');
      expect(block.toLowerCase()).not.toContain('spring');
      expect(block.toLowerCase()).not.toContain('overshoot');
    }
  });
});
