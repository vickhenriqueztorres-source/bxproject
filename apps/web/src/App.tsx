import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from 'oidc-client-ts';
import { getCandles, getContracts, getIndex, getWallet, onMockPrivateEvent, resetMockWallet, type Wallet } from './api/client';
import { finishSignin, guestUser, isGuestMode, setGuestMode, signIn, signOut, userManager } from './auth/oidc';
import { MultiChartGrid, type GridLayout } from './chart/MultiChartGrid';
import { ChartErrorBoundary } from './chart/ChartErrorBoundary';
import { useFeed, type PrivateEvent } from './feed/use-feed';
import { useMultiSymbolPriceFeed } from './feed/use-multi-symbol-price-feed';
import { History } from './history/History';
import { formatMinor, formatCurrencyBinmax } from './lib/money';
import { OrderTicket } from './trade/OrderTicket';
import { TerminalLayout } from './components/layout/TerminalLayout';
import { TerminalHeader } from './components/header/TerminalHeader';
import { SidebarDock, type SidebarTab } from './components/sidebar/SidebarDock';
import { normalizeSymbol } from './catalog/assets';
import { PortfolioDrawer } from './components/drawer/PortfolioDrawer';
import { TerminalFooter } from './components/footer/TerminalFooter';
import { useTickPulse } from './chart/useTickPulse';
import { MarketNewsDrawer } from './news/MarketNewsDrawer';
import { isNewTraderoomEnabled } from './lib/feature-flags';
import { TradeResultToast } from './components/toasts/TradeResultToast';
import { BinmaxPortfolioDrawer } from './components/drawer/BinmaxPortfolioDrawer';
import { BinmaxHistoryDrawer } from './components/drawer/BinmaxHistoryDrawer';
import { TournamentsDrawer } from './components/drawer/TournamentsDrawer';
import { LeadOnboardingTour } from './components/onboarding/LeadOnboardingTour';
import { soundEngine } from './lib/sound-engine';
import { RouterProvider, useRouter } from './router/RouterContext';
import { NotFoundPage } from './pages/NotFoundPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { AuthService } from './auth/auth-service';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';
import { DepositPage } from './pages/DepositPage';
import { WithdrawPage } from './pages/WithdrawPage';
import { VerificationPage } from './pages/VerificationPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { ArenaPage } from './pages/ArenaPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { TutorialsPage } from './pages/TutorialsPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { LandingPage } from './pages/LandingPage';
import { PreviewHubPage } from './pages/PreviewHubPage';
import { GeoblockedPage } from './pages/GeoblockedPage';
import { useTranslation } from './i18n';




const candidate = typeof window !== 'undefined' && window.location
  ? new URLSearchParams(window.location.search).get('symbol')
  : null;
const symbol = candidate && /^[A-Z0-9_]{3,32}$/.test(candidate)
  ? normalizeSymbol(candidate) : 'VOL_50';

function Dashboard({ user, symbol }: { user: User; symbol: string }) {
  const { navigate } = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');
  const [settledToast, setSettledToast] = useState<{
    result: 'WIN' | 'LOSS' | 'DRAW';
    amountFormatted: string;
    symbol: string;
    direction: 'SUBE' | 'BAJA';
  } | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([symbol]);
  const [activeSymbol, setActiveSymbol] = useState<string>(symbol);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(null);
  const [gridLayout, setGridLayout] = useState<GridLayout>('1x1');
  const [soundEnabled, setSoundEnabled] = useState(false); // Mudo por padrão (regra do Designer Sênior: instrumento, não cassino)
  const [timeZone, setTimeZone] = useState<'UTC-3' | 'UTC'>('UTC-3');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const contracts = useQuery({ queryKey: ['contracts'], queryFn: () => getContracts(''), refetchInterval: 15_000 });
  const activeContractsCount = contracts.data?.filter((c) => c.status === 'OPEN').length ?? 0;

  const { portfolioTotalFormatted, todayProfitFormatted } = useMemo(() => {
    const list = contracts.data ?? [];
    const openList = list.filter((c) => c.status === 'OPEN');
    const openStakeMinor = openList.reduce((sum, c) => {
      const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : (c.stake_minor || 0);
      return sum + stake;
    }, 0);
    const pTotal = formatCurrencyBinmax(openStakeMinor);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayStartMs = startOfDay.getTime();

    const settledToday = list.filter((c) => {
      if (c.status !== 'SETTLED') return false;
      const settledMs = c.expires_at ? Date.parse(c.expires_at) : (c.created_at ? Date.parse(c.created_at) : 0);
      return Number.isFinite(settledMs) && settledMs >= todayStartMs;
    });

    const netProfitMinor = settledToday.reduce((sum, c) => {
      const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : (c.stake_minor || 0);
      const payout = c.payout_minor !== null ? (typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : (c.payout_minor || 0)) : 0;
      if (c.result === 'WIN') {
        return sum + (payout - stake);
      } else if (c.result === 'LOSS') {
        return sum - stake;
      }
      return sum;
    }, 0);

    const absProfit = Math.abs(netProfitMinor);
    const pToday = netProfitMinor > 0
      ? `+${formatCurrencyBinmax(absProfit)}`
      : netProfitMinor < 0
      ? `-${formatCurrencyBinmax(absProfit)}`
      : '$0.00';

    return { portfolioTotalFormatted: pTotal, todayProfitFormatted: pToday };
  }, [contracts.data]);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: getWallet,
    retry: false, refetchInterval: 15_000 });

  useEffect(() => {
    if (wallet.data && Number.isSafeInteger(wallet.data.available_minor)) {
      const session = AuthService.getSession();
      if (session?.user && session.user.demoBalanceMinor !== wallet.data.available_minor) {
        AuthService.setSession({
          ...session,
          user: {
            ...session.user,
            demoBalanceMinor: wallet.data.available_minor,
          },
        });
      }
    }
  }, [wallet.data]);

  const index = useQuery({ queryKey: ['index', activeSymbol],
    queryFn: () => getIndex(activeSymbol), refetchInterval: 30_000 });
  useQuery({ queryKey: ['candles', activeSymbol, '1m'],
    queryFn: () => getCandles(activeSymbol, '1m', 2880) });
  const onPrivate = useCallback((event: PrivateEvent) => {
    if (event.type === 'wallet_balance' && Number.isSafeInteger(event.available_minor)) {
      queryClient.setQueryData<Wallet>(['wallet'], (previous) => previous
        ? { ...previous, available_minor: event.available_minor! } : previous);
      const session = AuthService.getSession();
      if (session?.user && session.user.demoBalanceMinor !== event.available_minor) {
        AuthService.setSession({
          ...session,
          user: {
            ...session.user,
            demoBalanceMinor: event.available_minor!,
          },
        });
      }
    }
    if (event.type === 'contract_settled') {
      const isBinmax = isNewTraderoomEnabled();
      if (isBinmax) {
        const isWin = event.result === 'WIN';
        const isDraw = event.result === 'DRAW';
        const matchedContract = contracts.data?.find((c) => c.id === event.contract_id);
        const fallbackStake = matchedContract
          ? (typeof matchedContract.stake_minor === 'string' ? parseInt(matchedContract.stake_minor, 10) : (matchedContract.stake_minor || 0))
          : 0;
        const resolvedStakeMinor = event.stake_minor ?? fallbackStake;
        const payoutMinor = event.payout_minor ?? 0;
        const netWinProfitMinor =
          resolvedStakeMinor > 0 && payoutMinor > resolvedStakeMinor
            ? payoutMinor - resolvedStakeMinor
            : payoutMinor;
        const formatted = isWin
          ? `+$${(netWinProfitMinor / 100).toFixed(2)}`
          : isDraw
          ? `$0.00`
          : `-$${(resolvedStakeMinor / 100).toFixed(2)}`;

        const resolvedSymbol = event.symbol || matchedContract?.symbol || activeSymbol;
        const rawDirection = event.direction || matchedContract?.direction || 'UP';
        const resolvedDirection: 'SUBE' | 'BAJA' =
          rawDirection === 'DOWN' || rawDirection === 'BAJA' ? 'BAJA' : 'SUBE';

        // Áudio dopaminérgico / feedback acústico de precisão
        if (soundEnabled) {
          if (isWin) {
            soundEngine.playWin();
          } else if (!isDraw) {
            soundEngine.playLoss();
          } else {
            soundEngine.playDraw();
          }
        }

        setSettledToast({
          result: isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS',
          amountFormatted: formatted,
          symbol: resolvedSymbol,
          direction: resolvedDirection,
        });
        setAnnouncement(isWin ? `${t('result.win')} ${formatted}` : `${t('result.loss')} ${formatted}`);
      } else {
        const result = event.result === 'WIN' ? 'WIN' : event.result === 'DRAW' ? 'DRAW' : 'LOSS';
        setAnnouncement(`Contrato ${result}: ${formatMinor(event.payout_minor ?? 0)}`);
      }
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      void queryClient.invalidateQueries({ queryKey: ['contract', event.contract_id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    }
  }, [queryClient, soundEnabled, activeSymbol, contracts.data, t]);

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
  void (tickPulse === 'UP' ? 'price-flash-green' : tickPulse === 'DOWN' ? 'price-flash-red' : '');
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

  const handleSignOut = useCallback(async () => {
    try {
      await signOut('/');
    } finally {
      navigate('/');
    }
  }, [navigate]);

  // Lista de símbolos dinamicamente monitorados em tempo real (abas abertas + contratos ativos)
  const trackedSymbols = useMemo(() => {
    const set = new Set<string>(openTabs);
    if (contracts.data) {
      for (const c of contracts.data) {
        if (c.status === 'OPEN' && c.symbol) {
          set.add(c.symbol);
        }
      }
    }
    return Array.from(set);
  }, [openTabs, contracts.data]);

  const multiPrices = useMultiSymbolPriceFeed(trackedSymbols);

  const consolidatedPrices = useMemo(() => {
    const merged = { ...multiPrices };
    if (feed.tick) {
      const p = Number(feed.tick.price);
      if (Number.isFinite(p)) {
        merged[activeSymbol] = p;
      }
    }
    return merged;
  }, [multiPrices, feed.tick, activeSymbol]);

  return (
    <>
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
          onSignOut={handleSignOut}
          currentLayout={gridLayout}
          onSelectLayout={setGridLayout}
          contracts={contracts.data ?? []}
          currentPrices={consolidatedPrices}
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
          historyContent={
            isNewTraderoomEnabled() ? (
              <BinmaxHistoryDrawer
                contracts={contracts.data ?? []}
                onClose={() => setSidebarTab(null)}
              />
            ) : (
              <History />
            )
          }
          portfolioContent={
            <BinmaxPortfolioDrawer
              contracts={contracts.data ?? []}
              currentPrice={feed.tick?.price ?? null}
              currentPrices={consolidatedPrices}
              onClose={() => setSidebarTab(null)}
            />
          }
          newsContent={<MarketNewsDrawer isOpen={true} onClose={() => setSidebarTab(null)} />}
          tournamentsContent={<TournamentsDrawer onClose={() => setSidebarTab(null)} />}
        />
      }
      center={
        <ChartErrorBoundary symbol={activeSymbol}>
          <MultiChartGrid
            activeSymbol={activeSymbol}
            onActiveSymbolChange={(newSym) => {
              handleAddTab(newSym);
              setActiveSymbol(newSym);
            }}
            allContracts={contracts.data ?? []}
            layout={gridLayout}
            onLayoutChange={setGridLayout}
            openTabs={openTabs}
            availableMinor={wallet.data?.available_minor ?? null}
            soundEnabled={soundEnabled}
            onChanged={onChanged}
          />
        </ChartErrorBoundary>
      }
      orderDock={
        gridLayout === '1x1' ? (
          <OrderTicket
            symbol={activeSymbol}
            paused={index.data?.status === 'PAUSED'}
            stale={feed.stale || !feed.connected}
            availableMinor={wallet.data?.available_minor ?? null}
            soundEnabled={soundEnabled}
            onChanged={onChanged}
          />
        ) : null
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
      footer={
        <TerminalFooter
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((s) => !s)}
          timeZone={timeZone}
          onToggleTimeZone={() => setTimeZone((t) => t === 'UTC-3' ? 'UTC' : 'UTC-3')}
          isConnected={feed.connected && !feed.stale}
          activeContractsCount={activeContractsCount}
          portfolioTotalFormatted={portfolioTotalFormatted}
          todayProfitFormatted={todayProfitFormatted}
        />
      }
      toast={
        settledToast && isNewTraderoomEnabled() ? (
          <TradeResultToast
            result={settledToast.result}
            amountFormatted={settledToast.amountFormatted}
            assetSymbol={settledToast.symbol}
            direction={settledToast.direction}
            drawerOpen={sidebarTab !== null && sidebarTab !== 'operar'}
            onClose={() => setSettledToast(null)}
          />
        ) : announcement ? (
          <div className="toast" aria-live="polite" role="status">
            {announcement}
            <button type="button" onClick={() => setAnnouncement('')} aria-label="Fechar notificação">×</button>
          </div>
        ) : null
      }
    />
    {isNewTraderoomEnabled() && <LeadOnboardingTour />}
  </>
  );
}

export function TraderoomShell() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const [loading, setLoading] = useState(true);
  const [error] = useState('');
  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        const session = AuthService.getSession();
        if (session?.user && session?.token) {
          setGuestMode(false);
          if (active) {
            setUser({
              profile: {
                sub: session.user.id,
                email: session.user.email,
                name: session.user.name,
              },
              access_token: session.token,
              expires_at: Math.floor(Date.now() / 1000) + 86400,
            } as unknown as User);
          }
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
        if (loaded) {
          setGuestMode(false);
          if (active) setUser(loaded);
        } else {
          setGuestMode(true);
          if (active) setUser(guestUser);
        }
      } catch {
        setGuestMode(true);
        if (active) setUser(guestUser);
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

function MainRouter() {
  const { currentPath } = useRouter();
  const { geoBlocked, t } = useTranslation();

  if (geoBlocked || currentPath === '/nao-disponivel' || currentPath === '/geoblocked') {
    return <GeoblockedPage />;
  }

  // Rotas da sala de trading e Arena Blitz (já contêm rodapé operacional com aviso demo/risco sem alterar geometria 100vh)
  if (currentPath === '/operar' || currentPath === '/traderoom') {
    return <TraderoomShell />;
  }
  if (currentPath === '/arena' || currentPath === '/sala/arena') {
    return <ArenaPage />;
  }

  let pageContent: JSX.Element;
  if (currentPath === '/mantenimiento') {
    pageContent = <MaintenancePage />;
  } else if (currentPath === '/login') {
    pageContent = <LoginPage />;
  } else if (currentPath === '/registro') {
    pageContent = <RegisterPage />;
  } else if (currentPath === '/recuperar') {
    pageContent = <PasswordRecoveryPage />;
  } else if (currentPath === '/verificar' || currentPath === '/verificar-email') {
    pageContent = <EmailVerificationPage />;
  } else if (currentPath === '/deposito') {
    pageContent = <DepositPage />;
  } else if (currentPath === '/retiro') {
    pageContent = <WithdrawPage />;
  } else if (currentPath === '/verificacion') {
    pageContent = <VerificationPage />;
  } else if (currentPath === '/ajustes') {
    pageContent = <SettingsPage />;
  } else if (currentPath === '/historial') {
    pageContent = <HistoryPage />;
  } else if (currentPath === '/torneos') {
    pageContent = <TournamentsPage />;
  } else if (currentPath === '/analisis') {
    pageContent = <AnalysisPage />;
  } else if (currentPath === '/tutoriales') {
    pageContent = <TutorialsPage />;
  } else if (currentPath === '/promociones') {
    pageContent = <PromotionsPage />;
  } else if (currentPath === '/landing' || currentPath === '/') {
    pageContent = <LandingPage />;
  } else if (currentPath === '/preview' || currentPath === '/previews') {
    pageContent = <PreviewHubPage />;
  } else {
    pageContent = <NotFoundPage />;
  }

  return (
    <>
      <div
        data-testid="global-demo-banner"
        style={{
          background: '#101622',
          borderBottom: '1px solid rgba(246, 195, 68, 0.25)',
          color: '#F6C344',
          fontSize: '11px',
          fontWeight: 700,
          textAlign: 'center',
          padding: '4px 12px',
          letterSpacing: '0.02em',
        }}
      >
        🛡️ {t('common.demo_banner')} — {t('common.risk_warning')}
      </div>
      {pageContent}
    </>
  );
}

export function App() {
  return (
    <RouterProvider>
      <MainRouter />
    </RouterProvider>
  );
}

