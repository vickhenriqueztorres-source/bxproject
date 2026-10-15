import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PriceChart } from '../chart/PriceChart';
import { ChartErrorBoundary } from '../chart/ChartErrorBoundary';
import { useUiLanguage } from '../i18n';
import { formatPrice } from './engine';
import { cn } from './arena-ui';
import { ArenaBar, arenaClock } from './ArenaBar';
import { RebuyDialog, ResultDialog } from './ArenaDialogs';
import { ArenaLedger } from './ArenaLedger';
import { ArenaLobby } from './ArenaLobby';
import { ArenaTicket } from './ArenaTicket';
import { GhostAudit } from './GhostAudit';
import { Leaderboard } from './Leaderboard';
import { useArena, type ArenaApi, type UseArenaOptions } from './use-arena';

export type ArenaTab = 'ranking' | 'bot' | 'ledger';

export function ChartOverlay({ arena }: { arena: ArenaApi }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const { stage } = arena.s;
  if (stage === 'countdown') {
    const sec = Math.ceil(arenaClock(arena).countdownSec);
    return (
      <div
        data-testid="arena-chart-overlay-countdown"
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm"
        aria-live="polite"
      >
        <span className="text-sm font-medium text-muted-foreground">
          {isEs ? 'La Arena comienza en' : 'A Arena começa em'}
        </span>
        <span
          key={sec}
          className="platform-rise font-mono text-7xl font-semibold text-arena tabular-nums"
        >
          {sec}
        </span>
        <span className="text-xs text-muted-foreground">
          {isEs
            ? 'Todos los participantes reciben T$ 1.000 al mismo tiempo.'
            : 'Todos os participantes recebem T$ 1.000 ao mesmo tempo.'}
        </span>
      </div>
    );
  }
  if (stage === 'settling') {
    return (
      <div
        data-testid="arena-chart-overlay-settling"
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm"
        aria-live="polite"
      >
        <Loader2 className="size-6 animate-spin text-arena" aria-hidden="true" />
        <span className="text-sm font-medium">
          {isEs
            ? 'Liquidando órdenes y calculando el ranking final…'
            : 'Liquidando ordens e apurando o ranking final…'}
        </span>
      </div>
    );
  }
  return null;
}

export function ChartHeader({ arena }: { arena: ArenaApi }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const { asset, s, currentPrice, candles } = arena;
  const price = currentPrice;
  const prevClose = Number(candles[candles.length - 2]?.close ?? price);
  const up = price >= prevClose;

  return (
    <div
      data-testid="arena-chart-header"
      style={{ flexShrink: 0 }}
      className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{asset.name}</span>
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            up ? 'text-primary' : 'text-destructive'
          )}
        >
          {formatPrice(price, asset.digits)} {up ? '▲' : '▼'}
        </span>
      </div>
      <span data-testid="arena-orders-counter" className="text-xs text-muted-foreground">
        {s.positions.length}{' '}
        {s.positions.length === 1
          ? isEs ? 'orden abierta' : 'ordem aberta'
          : isEs ? 'órdenes abiertas' : 'ordens abertas'}{' '}
        · {s.trades.length} liquidadas
      </span>
    </div>
  );
}

export function ArenaLive({
  arena,
  initialTab = 'ranking',
}: {
  arena: ArenaApi;
  initialTab?: ArenaTab;
}) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const [tab, setTab] = useState<ArenaTab>(initialTab);
  const tabs: { id: ArenaTab; label: string }[] = [
    { id: 'ranking', label: 'Ranking' },
    { id: 'bot', label: isEs ? 'Bot' : 'Robô' },
    { id: 'ledger', label: isEs ? 'Extracto' : 'Extrato' },
  ];

  return (
    <div
      data-testid="arena-live-room"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
      className="arena-root flex h-full max-h-full min-h-0 flex-col overflow-hidden"
    >
      <ArenaBar arena={arena} />
      <div
        data-testid="arena-live-body"
        style={{
          display: 'flex',
          flex: '1 1 0%',
          minHeight: 0,
          maxHeight: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
      >
        <section
          aria-label="Gráfico e boleta"
          data-testid="arena-chart-column"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 0%',
            minWidth: 0,
            minHeight: 0,
            maxHeight: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <ChartHeader arena={arena} />
          <div
            data-testid="arena-mirrored-chart-wrapper"
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 0%',
              minHeight: 0,
              maxHeight: '100%',
              overflow: 'hidden',
            }}
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
          >
            <ChartErrorBoundary symbol={arena.symbol}>
              <PriceChart
                symbol={arena.symbol}
                candles={arena.candles}
                tick={arena.liveTick}
                contracts={arena.positionsAsContracts}
                activeContracts={arena.positionsAsContracts}
                isStale={arena.isStale}
                isVisible={true}
                onSelectSymbol={arena.onSelectSymbol}
              />
            </ChartErrorBoundary>
            <ChartOverlay arena={arena} />
          </div>
          <ArenaTicket arena={arena} />
        </section>

        <aside
          aria-label="Painel do torneio"
          data-testid="arena-sidebar-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            maxHeight: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
          className="flex min-h-0 flex-col overflow-hidden border-t border-border bg-background lg:h-full lg:w-[380px] lg:shrink-0 lg:border-t-0 lg:border-l"
        >
          <div
            role="tablist"
            aria-label="Seções do torneio"
            style={{
              backgroundColor: 'var(--surface, #0f1318)',
              borderBottom: '1px solid var(--border, #1c232c)',
              flexShrink: 0,
            }}
            className="flex shrink-0 border-b border-border bg-surface px-2"
          >
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  data-testid={`arena-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  style={{
                    backgroundColor: 'transparent',
                    color: active
                      ? 'var(--foreground, #f2f4f7)'
                      : 'var(--muted-foreground, #8b95a3)',
                    border: 'none',
                  }}
                  className={cn(
                    'relative h-11 flex-1 bg-transparent text-sm font-medium outline-none focus-visible:text-foreground',
                    active
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                  {active && (
                    <span
                      style={{ backgroundColor: 'var(--tournament-purple-glow, #9d4edd)' }}
                      className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-arena"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div
            id={`panel-${tab}`}
            data-testid="arena-sidebar-tabpanel"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              maxHeight: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
            className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4"
          >
            {tab === 'ranking' && <Leaderboard arena={arena} />}
            {tab === 'bot' && <GhostAudit arena={arena} />}
            {tab === 'ledger' && <ArenaLedger arena={arena} />}
          </div>
        </aside>
      </div>
      <RebuyDialog arena={arena} />
      <ResultDialog arena={arena} />
    </div>
  );
}

export interface ArenaRoomProps extends UseArenaOptions {
  arenaOverride?: ArenaApi;
  initialTab?: ArenaTab;
}

export function ArenaRoom(props: ArenaRoomProps = {}) {
  const internalArena = useArena(props);
  const arena = props.arenaOverride ?? internalArena;

  if (arena.s.stage === 'lobby') {
    return (
      <div
        data-testid="arena-lobby-view"
        style={{
          flex: '1 1 0%',
          height: '100%',
          maxHeight: '100%',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        className="arena-root flex-1 h-full max-h-full min-h-0 overflow-y-auto overflow-x-hidden"
      >
        <ArenaLobby
          onJoin={arena.join}
          initialRoomIndex={props.initialRoomIndex}
          initialTier={props.initialTier}
        />
      </div>
    );
  }
  return <ArenaLive arena={arena} initialTab={props.initialTab} />;
}
