import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PRECISION_SURFACES,
  PRECISION_COLORS,
  PRECISION_MOTION,
  PRECISION_FONTS,
} from '../../apps/web/src/lib/design-tokens';

describe('Subetapa 06 — Certificação Oficial de Design Sênior & Anti-Cassino', () => {
  const webSrcPath = path.resolve(__dirname, '../../apps/web/src');

  it('1. Varredura Estática Anti-Cassino: Zero efeitos de confete, moedas ou festa nos arquivos de tela', () => {
    const filesToScan = [
      'pages/VerificationPage.tsx',
      'pages/LoginPage.tsx',
      'wallet/BinmaxWithdrawModal.tsx',
      'components/toasts/TradeResultToast.tsx',
    ];

    const casinoKeywords = ['confetti', 'moedinha', 'jackpot', 'cha-ching', 'slot-machine', 'sparkle'];

    for (const file of filesToScan) {
      const fullPath = path.join(webSrcPath, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();

      for (const kw of casinoKeywords) {
        expect(content).not.toContain(kw);
      }
    }
  });

  it('2. Varredura de Anti-Patterns de Movimento: Nenhuma animação com shake em inputs', () => {
    const loginPageContent = fs.readFileSync(path.join(webSrcPath, 'pages/LoginPage.tsx'), 'utf8');
    expect(loginPageContent).not.toContain('shake');
  });

  it('3. Validação dos 8 Tokens Matemáticos de Física de Movimento', () => {
    expect(PRECISION_MOTION.ease).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(PRECISION_MOTION.tMicro).toBe(100);
    expect(PRECISION_MOTION.tBase).toBe(180);
    expect(PRECISION_MOTION.tEnter).toBe(260);
    expect(PRECISION_MOTION.tCount).toBe(500);
    expect(PRECISION_MOTION.distMax).toBe(64);
  });

  it('4. Validação das 4 Superfícies Tonais de Profundidade (--bg-0 a --bg-3)', () => {
    expect(PRECISION_SURFACES.bg0).toBe('#0B0E14');
    expect(PRECISION_SURFACES.bg1).toBe('#101622');
    expect(PRECISION_SURFACES.bg2).toBe('#151D2B');
    expect(PRECISION_SURFACES.bg3).toBe('#1C2738');
    expect(PRECISION_SURFACES.line).toBe('rgba(138, 146, 161, 0.16)');
  });

  it('5. Validação das Cores Semânticas Invioláveis e Neutro Metálico Dominante', () => {
    expect(PRECISION_COLORS.profit).toBe('#22C47A');
    expect(PRECISION_COLORS.loss).toBe('#F2545B');
    expect(PRECISION_COLORS.pending).toBe('#E8A33D');
    expect(PRECISION_COLORS.info).toBe('#4D8DFF');
    expect(PRECISION_COLORS.metal).toBe('#AEB8C8');
  });

  it('6. Validação do arquivo CSS global tokens-precision.css', () => {
    const cssContent = fs.readFileSync(path.join(webSrcPath, 'styles/tokens-precision.css'), 'utf8');
    expect(cssContent).toContain('--bm-ease: cubic-bezier(0.16, 1, 0.3, 1)');
    expect(cssContent).toContain('.bm-tabular-nums');
    expect(cssContent).toContain('.bm-page-enter');
    expect(cssContent).toContain('.bm-btn-press');
    expect(cssContent).toContain('.bm-modal-scale');
    expect(cssContent).toContain('.bm-error-message');
    expect(cssContent).toContain('.bm-connection-lost');
    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('7. Validação do Sistema Tipográfico Suíço Unificado (Geist + Geist Mono)', () => {
    expect(PRECISION_FONTS.sans).toContain('Geist');
    expect(PRECISION_FONTS.mono).toContain('Geist Mono');
    expect(PRECISION_FONTS.sans).not.toContain('Archivo');
  });
});
