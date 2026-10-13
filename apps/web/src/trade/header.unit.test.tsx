import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AssetFlagBadge, FlagCircle } from '../components/header/AssetFlagBadge';
import { AccountSelectorDropdown } from '../components/header/AccountSelectorDropdown';
import { TerminalHeader, getTabDisplayTitle } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('Subetapa 2: Cabeçalho Turbo Prata, Abas e Seletor de Conta', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  describe('1. AssetFlagBadge e Bandeiras Circulares', () => {
    it('Renderiza bandeiras circulares para pares Forex (NZDJPY, EURUSD, GBPJPY)', () => {
      const htmlNzdJpy = renderToString(<AssetFlagBadge symbol="NZDJPY_OTC" size={18} />);
      expect(htmlNzdJpy).toContain('<svg');
      // NZD canton/southern cross and JPY red circle
      expect(htmlNzdJpy).toContain('fill="#BC002D"'); // Círculo vermelho do Japão

      const htmlEurUsd = renderToString(<AssetFlagBadge symbol="EURUSD_OTC" size={18} />);
      expect(htmlEurUsd).toContain('fill="#003399"'); // Fundo azul da UE
      expect(htmlEurUsd).toContain('fill="#B22234"'); // Fundo vermelho dos EUA
    });

    it('Renderiza ícones distintos para Criptoativos (BTC, ETH)', () => {
      const htmlBtc = renderToString(<AssetFlagBadge symbol="BTCUSD_OTC" size={18} />);
      expect(htmlBtc).toContain('fill="#F7931A"'); // Laranja do Bitcoin
      expect(htmlBtc).toContain('₿');

      const htmlEth = renderToString(<AssetFlagBadge symbol="ETHUSD_OTC" size={18} />);
      expect(htmlEth).toContain('fill="#627EEA"'); // Azul do Ethereum
    });

    it('Renderiza ícones para Commodities (XAUUSD, XAGUSD, USOIL)', () => {
      const htmlGold = renderToString(<AssetFlagBadge symbol="XAUUSD_OTC" size={18} />);
      expect(htmlGold).toContain('fill="#E5A93C"');
      expect(htmlGold).toContain('Au');

      const htmlSilver = renderToString(<AssetFlagBadge symbol="XAGUSD_OTC" size={18} />);
      expect(htmlSilver).toContain('fill="#A8B2C1"');
      expect(htmlSilver).toContain('Ag');

      const htmlOil = renderToString(<AssetFlagBadge symbol="USOIL_OTC" size={18} />);
      expect(htmlOil).toContain('fill="#F2545B"');
    });

    it('Renderiza ícones para Índices Sintéticos (SYNTH_VOL_50, SYNTH_CRASH_BOOM_100)', () => {
      const htmlSynth = renderToString(<AssetFlagBadge symbol="SYNTH_VOL_50" size={18} />);
      expect(htmlSynth).toContain('stroke="#22C47A"'); // Curva estocástica verde Turbo Prata

      const htmlCrash = renderToString(<AssetFlagBadge symbol="SYNTH_CRASH_BOOM_100" size={18} />);
      expect(htmlCrash).toContain('stroke="#22C47A"');
    });

    it('FlagCircle fallback opera de forma segura para ativos desconhecidos', () => {
      const htmlUnknown = renderToString(<FlagCircle code="XYZ" size={16} />);
      expect(htmlUnknown).toContain('<svg');
      expect(htmlUnknown).toContain('XY');
    });
  });

  describe('2. getTabDisplayTitle Helper', () => {
    it('Formata nomes de pares Forex e criptos com barra amigável', () => {
      expect(getTabDisplayTitle('NZDJPY_OTC')).toBe('NZD/JPY');
      expect(getTabDisplayTitle('EURUSD_OTC')).toBe('EUR/USD');
      expect(getTabDisplayTitle('BTCUSD_OTC')).toBe('BTC/USD');
      expect(getTabDisplayTitle('ETHUSD_OTC')).toBe('ETH/USD');
    });

    it('Formata índices sintéticos e commodities de forma limpa', () => {
      expect(getTabDisplayTitle('SYNTH_VOL_10')).toBe('Vol 10');
      expect(getTabDisplayTitle('SYNTH_VOL_50')).toBe('Vol 50');
      expect(getTabDisplayTitle('SYNTH_CRASH_BOOM_100')).toBe('Crash 100');
      expect(getTabDisplayTitle('XAUUSD_OTC')).toBe('Gold');
      expect(getTabDisplayTitle('XAGUSD_OTC')).toBe('Silver');
      expect(getTabDisplayTitle('USOIL_OTC')).toBe('WTI Oil');
    });
  });

  describe('3. AccountSelectorDropdown', () => {
    it('Renderiza saldo formatado a partir de inteiros minor com cor verde', () => {
      const html = renderToString(
        <AccountSelectorDropdown
          balanceMinor={960375}
          accountType="DEMO"
          onSelectAccountType={vi.fn()}
          onResetDemo={vi.fn()}
        />
      );
      expect(html).toMatch(/9[.,]603[.,]75/);
      expect(html).toContain('Cuenta de práctica');
      expect(html).toContain('color:#F4F5F7');
    });

    it('Resiliência a saldo nulo ou zero sem quebrar o componente', () => {
      const htmlNull = renderToString(
        <AccountSelectorDropdown
          balanceMinor={null}
          accountType="DEMO"
          onSelectAccountType={vi.fn()}
          onResetDemo={vi.fn()}
        />
      );
      expect(htmlNull).toMatch(/10[.,]000[.,]00/);

      const htmlRealZero = renderToString(
        <AccountSelectorDropdown
          balanceMinor={0}
          accountType="REAL"
          onSelectAccountType={vi.fn()}
          onResetDemo={vi.fn()}
        />
      );
      expect(htmlRealZero).toMatch(/0[.,]00/);
      expect(htmlRealZero).toContain('Cuenta real');
    });

    it('Proteção contra XSS na exibição do email de usuário', () => {
      const maliciousEmail = '<script>alert("hack")</script>';
      const html = renderToString(
        <AccountSelectorDropdown
          balanceMinor={100000}
          accountType="DEMO"
          onSelectAccountType={vi.fn()}
          onResetDemo={vi.fn()}
          accountEmail={maliciousEmail}
          initialOpen={true}
        />
      );
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('4. TerminalHeader - Padrão Duas Portas e Navegação', () => {
    const defaultProps = {
      activeSymbol: 'NZDJPY_OTC',
      openTabs: ['NZDJPY_OTC', 'EURUSD_OTC', 'BTCUSD_OTC'],
      onSelectTab: vi.fn(),
      onCloseTab: vi.fn(),
      onAddTab: vi.fn(),
      balanceMinor: 1000000,
      accountEmail: 'trader@binmax.com',
      isLive: true,
      latencyMs: 16,
      onResetDemo: vi.fn(),
      onSignOut: vi.fn(),
    };

    it('Quando NEW_TRADEROOM = false, renderiza o cabeçalho clássico sem regressão', () => {
      setFeatureFlagForTesting(false);
      const html = renderToString(<TerminalHeader {...defaultProps} />);

      expect(html).toContain('BROKER');
      expect(html).toContain('PRO');
      expect(html).toContain('CONTA PRÁTICA');
      expect(html).not.toContain('header-grid-layout-btn');
      expect(html).not.toContain('Turbo');
    });

    it('Quando NEW_TRADEROOM = true, renderiza elementos institucionais Turbo Prata', () => {
      setFeatureFlagForTesting(true);
      const html = renderToString(<TerminalHeader {...defaultProps} />);

      // 1. Logo Binmax e Botão Grid [::]
      expect(html).toContain('Binmax Option');
      expect(html).toContain('data-testid="header-grid-layout-btn"');

      // 2. Abas com Bandeiras, Turbo e Payout
      expect(html).toContain('data-testid="tab-NZDJPY_OTC"');
      expect(html).toContain('data-testid="tab-EURUSD_OTC"');
      expect(html).toContain('Turbo');
      expect(html).toContain('+85%');

      // 3. Seletor de Conta com Saldo Geist Mono
      expect(html).toContain('data-testid="account-balance-display"');
      expect(html).toMatch(/10[.,]000[.,]00/);

      // 4. Botão DEPOSITAR e Status de Feed
      expect(html).toContain('data-testid="header-deposit-button"');
      expect(html).toContain('data-testid="header-feed-status"');
      expect(html).toContain('16ms');
      expect(html).toContain('data-testid="header-signout-button"');
    });

    it('Estresse: Suporta renderização suave de 12 abas simultâneas em alta velocidade', () => {
      setFeatureFlagForTesting(true);
      const twelveTabs = [
        'EURUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC', 'USDCHF_OTC',
        'AUDUSD_OTC', 'USDCAD_OTC', 'NZDUSD_OTC', 'EURGBP_OTC',
        'BTCUSD_OTC', 'ETHUSD_OTC', 'XAUUSD_OTC', 'SYNTH_VOL_50'
      ];

      const start = performance.now();
      const html = renderToString(
        <TerminalHeader
          {...defaultProps}
          openTabs={twelveTabs}
          activeSymbol="SYNTH_VOL_50"
        />
      );
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(250); // Renderização ultra-rápida < 250ms sob carga
      twelveTabs.forEach((sym) => {
        expect(html).toContain(`data-testid="tab-${sym}"`);
      });
    });

    it('Controle de fechamento de abas: botão × é renderizado quando openTabs > 1', () => {
      setFeatureFlagForTesting(true);
      const html = renderToString(<TerminalHeader {...defaultProps} />);
      expect(html).toContain('data-testid="close-tab-NZDJPY_OTC"');
      expect(html).toContain('data-testid="close-tab-EURUSD_OTC"');
    });

    it('Quando apenas 1 aba está aberta, botão de fechar não é renderizado', () => {
      setFeatureFlagForTesting(true);
      const html = renderToString(
        <TerminalHeader
          {...defaultProps}
          openTabs={['NZDJPY_OTC']}
        />
      );
      expect(html).not.toContain('data-testid="close-tab-NZDJPY_OTC"');
    });
  });
});
