import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from 'oidc-client-ts';
import { getCandles, getContracts, getIndex, getWallet, onMockPrivateEvent, resetMockWallet, type Wallet } from './api/client';
import { finishSignin, guestUser, isGuestMode, setGuestMode, signIn, signOut, userManager } from './auth/oidc';
import { MultiChartGrid } from './chart/MultiChartGrid';
import { useFeed, type PrivateEvent } from './feed/use-feed';
import { History } from './history/History';
import { formatMinor } from './lib/money';
import { OrderTicket } from './trade/OrderTicket';
import { TerminalLayout } from './components/layout/TerminalLayout';
import { TerminalHeader } from './components/header/TerminalHeader';
import { SidebarDock, type SidebarTab } from './components/sidebar/SidebarDock';
import { PortfolioDrawer } from './components/drawer/PortfolioDrawer';
import { useTickPulse } from './chart/useTickPulse';

const candidate = new URLSearchParams(window.location.search).get('symbol');
const symbol = candidate && /^[A-Z0-9_]{3,32}$/.test(candidate)
  ? candidate : 'SYNTH_VOL_50';

function Dashboard({ user, symbol }: { user: User; symbol: string }) {
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');
  const [openTabs, setOpenTabs] = useState<string[]>([symbol]);
  const [activeSymbol, setActiveSymbol] = useState<string>(symbol);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [timeZone, setTimeZone] = useState<'UTC-3' | 'UTC'>('UTC-3');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const contracts = useQuery({ queryKey: ['contracts'], queryFn: () => getContracts(''), refetchInterval: 3000 });
  const activeContractsCount = contracts.data?.filter((c) => c.status === 'OPEN').length ?? 0;

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: getWallet,
    retry: false, refetchInterval: 2000 });
  const index = useQuery({ queryKey: ['index', activeSymbol],
    queryFn: () => getIndex(activeSymbol), refetchInterval: 30_000 });
  const candles = useQuery({ queryKey: ['candles', activeSymbol],
    queryFn: () => getCandles(activeSymbol) });
  const onPrivate = useCallback((event: PrivateEvent) => {
    if (event.type === 'wallet_balance' && Number.isSafeInteger(event.available_minor)) {
      queryClient.setQueryData<Wallet>(['wallet'], (previous) => previous
        ? { ...previous, available_minor: event.available_minor! } : previous);
    }
    if (event.type === 'contract_settled') {
      const result = event.result === 'WIN' ? 'WIN' : event.result === 'DRAW' ? 'DRAW' : 'LOSS';
      setAnnouncement(`Contrato ${result}: ${formatMinor(event.payout_minor ?? 0)}`);
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      void queryClient.invalidateQueries({ queryKey: ['contract', event.contract_id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    }
  }, [queryClient]);

  useEffect(() => {
    if (isGuestMode()) {
      return onMockPrivateEvent((event) => {
        onPrivate(event as PrivateEvent);
      });
    }
  }, [onPrivate]);

  const onResync = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['candles', activeSymbol] });
  }, [queryClient, activeSymbol]);
  const feed = useFeed(activeSymbol, onPrivate, onResync);
  const tickPulse = useTickPulse(feed.tick);
  const priceFlashClass = tickPulse === 'UP' ? 'price-flash-green' : tickPulse === 'DOWN' ? 'price-flash-red' : '';
  const onChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['contracts'] });
    void queryClient.invalidateQueries({ queryKey: ['index', activeSymbol] });
  }, [queryClient, activeSymbol]);

  const handleSelectTab = (sym: string) => {
    setActiveSymbol(sym);
  };

  const handleCloseTab = (sym: string) => {
    if (openTabs.length <= 1) return;
    const remaining = openTabs.filter((t) => t !== sym);
    setOpenTabs(remaining);
    if (activeSymbol === sym) {
      setActiveSymbol(remaining[0]);
    }
  };

  const handleAddTab = (sym: string) => {
    if (!openTabs.includes(sym)) {
      setOpenTabs([...openTabs, sym]);
    }
    setActiveSymbol(sym);
  };

  const handleResetDemo = () => {
    resetMockWallet();
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    setAnnouncement('Conta prática recarregada: US$ 10.000,00 adicionados com sucesso.');
  };

  const [showHistory, setShowHistory] = useState(false);

  return (
    <TerminalLayout
      header={
        <TerminalHeader
          activeSymbol={activeSymbol}
          openTabs={openTabs}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onAddTab={handleAddTab}
          balanceMinor={wallet.data?.available_minor ?? null}
          accountEmail={user.profile.email ?? 'demo'}
          isLive={feed.connected && !feed.stale}
          latencyMs={feed.connected ? 16 : 88}
          onResetDemo={handleResetDemo}
          onSignOut={() => void signOut()}
        />
      }
      sidebar={
        <SidebarDock
          activeTab={sidebarTab}
          onSelectTab={setSidebarTab}
          activeContractsCount={activeContractsCount}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((s) => !s)}
          timeZone={timeZone}
          onToggleTimeZone={() => setTimeZone((t) => t === 'UTC-3' ? 'UTC' : 'UTC-3')}
          historyContent={<History />}
        />
      }
      center={
        <MultiChartGrid
          activeSymbol={activeSymbol}
          onActiveSymbolChange={(newSym) => {
            handleAddTab(newSym);
            setActiveSymbol(newSym);
          }}
          allContracts={contracts.data ?? []}
        />
      }
      orderDock={
        <OrderTicket
          symbol={activeSymbol}
          paused={index.data?.status === 'PAUSED'}
          stale={feed.stale}
          availableMinor={wallet.data?.available_minor ?? null}
          soundEnabled={soundEnabled}
          onChanged={onChanged}
        />
      }
      drawer={
        <PortfolioDrawer
          isOpen={drawerOpen}
          onToggle={() => setDrawerOpen((prev) => !prev)}
          contracts={contracts.data ?? []}
          currentPrice={feed.tick?.price ?? null}
          currentSymbol={activeSymbol}
        />
      }
      toast={
        announcement ? (
          <div className="toast" aria-live="polite" role="status">
            {announcement}
            <button type="button" onClick={() => setAnnouncement('')} aria-label="Fechar notificação">×</button>
          </div>
        ) : null
      }
    />
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        if (isGuestMode()) {
          if (active) setUser(guestUser);
          return;
        }
        const loaded = window.location.pathname === '/callback'
          ? await finishSignin() : await userManager.getUser();
        if (loaded && typeof loaded.state === 'object' && loaded.state !== null &&
            'symbol' in loaded.state && typeof loaded.state.symbol === 'string' &&
            /^[A-Z0-9_]{3,32}$/.test(loaded.state.symbol)) {
          setSelectedSymbol(loaded.state.symbol);
        }
        if (window.location.pathname === '/callback') window.history.replaceState(null, '', '/');
        if (active) setUser(loaded);
      } catch {
        if (active) setError('Não foi possível concluir o acesso. Tente novamente.');
      } finally { if (active) setLoading(false); }
    };
    void start();
    return () => { active = false; };
  }, []);
  if (loading) return <div className="auth-shell"><div className="auth-card">Carregando sessão…</div></div>;
  if (!user) return <div className="auth-shell"><div className="auth-card">
    <span className="brand-mark large">∿</span><span className="eyebrow">PLATAFORMA DEMO</span>
    <h1>Índices Sintéticos</h1><p>Acompanhe o mercado sintético e experimente contratos de 60 segundos com saldo demonstrativo.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" type="button" onClick={() => {
      setGuestMode(true);
      setUser(guestUser);
    }}>🚀 Entrar como Convidado Demo (Instantâneo)</button>
    <div style={{ margin: '18px 0 10px', height: '1px', background: '#253450' }} />
    <button className="secondary-button" type="button" onClick={() => void signIn(selectedSymbol)}>
      Entrar com Keycloak
    </button>
    <button className="secondary-button" type="button" onClick={() => void signIn(selectedSymbol)}>
      Criar conta no Keycloak
    </button>
    <small>No modo convidado você tem US$ 10.000 de saldo demo e gráfico em tempo real para testar agora mesmo.</small>
  </div></div>;
  return <Dashboard user={user} symbol={selectedSymbol} />;
}
