import React from 'react';

export interface TerminalLayoutProps {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  center: React.ReactNode;
  orderDock: React.ReactNode;
  drawer?: React.ReactNode;
  toast?: React.ReactNode;
}

export function TerminalLayout({
  header,
  sidebar,
  center,
  orderDock,
  drawer,
  toast,
}: TerminalLayoutProps) {
  return (
    <div className="terminal-container" data-testid="terminal-shell">
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
        <aside className="terminal-order-dock" aria-label="Painel de Ordens">
          {orderDock}
        </aside>
      </div>
      {drawer && (
        <section className="terminal-drawer" aria-label="Portfólio e Operações">
          {drawer}
        </section>
      )}
      {toast}
    </div>
  );
}
