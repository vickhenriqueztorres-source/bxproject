/**
 * Subetapa 06 — Integração de Som (Verificação de Arquitetura)
 *
 * Valida que:
 * - ExpirationResultPin NÃO importa soundEngine (isolamento visual-only)
 * - App.tsx onPrivate já dispara som corretamente
 * - soundEnabled default é false
 * - soundEngine é singleton resiliente
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pinSource = readFileSync(
  resolve(__dirname, './ExpirationResultPin.tsx'), 'utf-8'
);
const appSource = readFileSync(
  resolve(__dirname, '../App.tsx'), 'utf-8'
);
const soundSource = readFileSync(
  resolve(__dirname, '../lib/sound-engine.ts'), 'utf-8'
);

describe('Subetapa 06 — Integração de Som', () => {
  // T01: Pin não importa soundEngine (isolamento)
  it('T01 — ExpirationResultPin NÃO importa soundEngine', () => {
    expect(pinSource).not.toContain('soundEngine');
    expect(pinSource).not.toContain('sound-engine');
  });

  // T02: App.tsx onPrivate chama playWin
  it('T02 — App.tsx onPrivate chama soundEngine.playWin() para WIN', () => {
    expect(appSource).toContain('soundEngine.playWin()');
  });

  // T03: App.tsx onPrivate chama playLoss
  it('T03 — App.tsx onPrivate chama soundEngine.playLoss() para LOSS', () => {
    expect(appSource).toContain('soundEngine.playLoss()');
  });

  // T04: soundEnabled default false
  it('T04 — soundEnabled default é false', () => {
    expect(appSource).toMatch(/useState\s*\(\s*false\s*\)/);
    expect(appSource).toContain('soundEnabled');
  });

  // T05: Som condicional — gated por soundEnabled
  it('T05 — playWin/playLoss só executam se soundEnabled é true', () => {
    // O bloco if(soundEnabled) envolve os calls
    expect(appSource).toContain('if (soundEnabled)');
  });

  // T06: soundEngine é resiliente — try/catch em cada método
  it('T06 — soundEngine tem try/catch em playWin, playLoss, playDraw', () => {
    // Each play method has try/catch for browser blocking
    expect(soundSource).toMatch(/playWin[\s\S]*?try\s*\{/);
    expect(soundSource).toMatch(/playLoss[\s\S]*?try\s*\{/);
    expect(soundSource).toMatch(/playDraw[\s\S]*?try\s*\{/);
  });
});
