import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { SidebarDock, SidebarTab } from '../components/sidebar/SidebarDock';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

const cssPath = path.resolve(__dirname, '../styles/tokens-precision.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

describe('SUBETAPA 01 — Sistema Global de Stealth Scrollbar Dark & SidebarDock', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('1. [Unit] tokens-precision.css define .bm-stealth-scroll, .bm-no-scrollbar e oculta scrollbar-button nativo do Windows', () => {
    expect(cssContent).toContain('.bm-stealth-scroll');
    expect(cssContent).toContain('.sidebar-drawer-scroll');
    expect(cssContent).toContain('.theme-binmax *');
    expect(cssContent).toContain('::-webkit-scrollbar-button');
    expect(cssContent).toContain('::-webkit-scrollbar-corner');
    expect(cssContent).toContain('.bm-no-scrollbar');
    expect(cssContent).toContain('scrollbar-width: none !important;');
    expect(cssContent).toContain('border-radius: 9999px;');
  });

  it('2. [Unit] SidebarDock aplica bm-stealth-scroll, sidebar-drawer-scroll e overflowX: hidden em todas as abas de gaveta', () => {
    const tabs: Exclude<SidebarTab, null | 'operar'>[] = [
      'portfolio',
      'history',
      'news',
      'tournaments',
      'tutorials',
      'promotions',
      'alerts',
      'settings',
    ];

    for (const tab of tabs) {
      const html = renderToStaticMarkup(
        <SidebarDock
          activeTab={tab}
          onSelectTab={vi.fn()}
          openContractsCount={2}
          soundEnabled={false}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="sidebar-drawer-scroll"');
      expect(html).toContain('class="bm-stealth-scroll sidebar-drawer-scroll"');
      expect(html).toContain('overflow-y:auto');
      expect(html).toContain('overflow-x:hidden');
    }
  });

  it('3. [Estresse] SidebarDock renderiza 250 itens densos dentro da gaveta em menos de 150ms sem perder classes stealth', () => {
    const denseList = (
      <div data-testid="dense-list">
        {Array.from({ length: 250 }, (_, idx) => (
          <div key={idx} style={{ height: '32px' }}>
            Posición #{idx + 1} · Vol 50 · +$85.00
          </div>
        ))}
      </div>
    );

    const start = performance.now();
    const html = renderToStaticMarkup(
      <SidebarDock
        activeTab="portfolio"
        onSelectTab={vi.fn()}
        openContractsCount={250}
        portfolioContent={denseList}
        soundEnabled={false}
        onToggleSound={vi.fn()}
        timeZone="UTC-3"
        onToggleTimeZone={vi.fn()}
      />
    );
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(150);
    expect(html).toContain('data-testid="sidebar-drawer-scroll"');
    expect(html).toContain('bm-stealth-scroll sidebar-drawer-scroll');
    expect(html).toContain('Posición #250 · Vol 50 · +$85.00');
  });

  it('4. [Caos & Segurança] Troca rápida de abas e conteúdos nulos/undefined funcionam sem exceções', () => {
    const onSelectTab = vi.fn();
    const sequence: SidebarTab[] = [
      'portfolio',
      'history',
      'news',
      'alerts',
      'settings',
      'tutorials',
      'promotions',
      null,
      'portfolio',
    ];

    for (const nextTab of sequence) {
      const html = renderToStaticMarkup(
        <SidebarDock
          activeTab={nextTab}
          onSelectTab={onSelectTab}
          openContractsCount={0}
          portfolioContent={undefined}
          historyContent={undefined}
          newsContent={undefined}
          soundEnabled={false}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
        />
      );

      if (nextTab !== null && nextTab !== 'operar') {
        expect(html).toContain('data-testid="sidebar-drawer-scroll"');
      }
    }
  });
});
