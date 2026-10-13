import React from 'react';
import { isNewTraderoomEnabled } from '../../lib/feature-flags';

export interface TerminalLayoutProps {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  center: React.ReactNode;
  orderDock: React.ReactNode;
  drawer?: React.ReactNode;
  footer?: React.ReactNode;
  toast?: React.ReactNode;
}

export function TerminalLayout({
  header,
  sidebar,
  center,
  orderDock,
  drawer,
  footer,
  toast,
}: TerminalLayoutProps) {
  const isBinmax = isNewTraderoomEnabled();
  return (
    <div className={`terminal-container ${isBinmax ? 'theme-binmax' : ''}`} data-testid="terminal-shell">
      <header className="terminal-header" role="banner">
        {header}
      </header>
      <div className="terminal-body">
        <aside className="terminal-sidebar" aria-label="Navegação do Terminal">
          {sidebar}
        </aside>
        <main className="terminal-center" aria-label="Gráfico de Trading">
          {center}
        </main>
        {orderDock ? (
          <aside className="terminal-order-dock" aria-label="Painel de Ordens">
            {orderDock}
          </aside>
        ) : null}
      </div>
      {drawer && (
        <section className="terminal-drawer" aria-label="Portfólio e Operações">
          {drawer}
        </section>
      )}
      {footer && (
        <footer className="terminal-footer" role="contentinfo">
          {footer}
        </footer>
      )}
      {toast}
    </div>
  );
}
