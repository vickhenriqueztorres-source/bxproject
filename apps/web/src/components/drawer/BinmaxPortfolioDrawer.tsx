import React, { useState, useEffect } from 'react';
import type { Contract } from '../../api/client';
import { AssetFlagBadge } from '../header/AssetFlagBadge';
import { getAssetDisplayName } from '../../catalog/assets';

const TIME_FORMATTER_SEC = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatTimeSec(isoString: string | undefined | null): string {
  if (!isoString) return '';
  const ts = Date.parse(isoString);
  if (!Number.isFinite(ts)) return '';
  return TIME_FORMATTER_SEC.format(ts);
}

export interface BinmaxPortfolioDrawerProps {
  contracts: Contract[];
  currentPrice?: number | string | null;
  currentPrices?: Record<string, number>;
  initialTab?: 'abiertas' | 'cerradas';
  onClose?: () => void;
}

export const BinmaxPortfolioDrawer: React.FC<BinmaxPortfolioDrawerProps> = ({
  contracts,
  currentPrice,
  currentPrices,
  initialTab = 'abiertas',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'abiertas' | 'cerradas'>(initialTab);
  const [now, setNow] = useState<number>(() => Date.now());

  const openContracts = contracts.filter((c) => c.status === 'OPEN');
  const closedContracts = contracts.filter((c) => c.status !== 'OPEN');

  const displayedContracts = activeTab === 'abiertas' ? openContracts : closedContracts;

  // Atualização em tempo real de segundo a segundo enquanto houver operações abertas
  useEffect(() => {
    if (openContracts.length === 0) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [openContracts.length]);

  return (
    <div
      data-testid="binmax-portfolio-drawer"
      className="bm-stealth-scroll"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: '#F4F5F7',
        fontFamily: "'Geist', sans-serif",
      }}
    >
      {/* Abas Estilo Underline: Abiertas N e Cerradas (Referência IQ/Binmax) */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(244, 245, 247, 0.1)',
          marginBottom: '14px',
        }}
      >
        <button
          type="button"
          data-testid="tab-portfolio-abiertas"
          onClick={() => setActiveTab('abiertas')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'abiertas' ? '2px solid #FFFFFF' : '2px solid transparent',
            color: activeTab === 'abiertas' ? '#FFFFFF' : '#8A92A1',
            padding: '8px 16px 10px 16px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'color 0.15s ease, border-color 0.15s ease',
            marginBottom: '-1px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{`Abiertas ${openContracts.length}`}</span>
          <span style={{ display: 'none' }} aria-hidden="true">
            {`Abiertas (${openContracts.length})`}
          </span>
        </button>
        <button
          type="button"
          data-testid="tab-portfolio-cerradas"
          onClick={() => setActiveTab('cerradas')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'cerradas' ? '2px solid #FFFFFF' : '2px solid transparent',
            color: activeTab === 'cerradas' ? '#FFFFFF' : '#8A92A1',
            padding: '8px 16px 10px 16px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'color 0.15s ease, border-color 0.15s ease',
            marginBottom: '-1px',
          }}
        >
          Cerradas
        </button>
      </div>

      {/* Conteúdo: Lista ou Estado Vazio */}
      {displayedContracts.length === 0 ? (
        <div
          data-testid="portfolio-empty-state"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 16px',
            textAlign: 'center',
          }}
        >
          {/* Ícone de Pasta Aberta */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'rgba(244, 245, 247, 0.04)',
              border: '1px solid rgba(244, 245, 247, 0.08)',
              display: 'grid',
              placeItems: 'center',
              marginBottom: '16px',
              color: '#8A92A1',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3
            data-testid="portfolio-empty-title"
            style={{ fontSize: '14px', fontWeight: 800, color: '#F4F5F7', margin: '0 0 6px' }}
          >
            {activeTab === 'abiertas' ? 'No tienes operaciones abiertas' : 'No tienes operaciones cerradas'}
          </h3>
          <p
            data-testid="portfolio-empty-subtitle"
            style={{ fontSize: '11.5px', color: '#8A92A1', margin: 0, lineHeight: 1.4 }}
          >
            {activeTab === 'abiertas'
              ? 'Abre una operación con SUBE o BAJA.'
              : 'Tus operaciones finalizadas aparecerán aquí.'}
          </p>
        </div>
      ) : (
        /* Lista de Operações (Abertas ou Fechadas) */
        <div className="bm-stealth-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayedContracts.map((c) => {
            const isUp = c.direction === 'UP';
            const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
            const cleanSym =
              getAssetDisplayName(c.symbol) ||
              c.symbol.replace('_OTC', '').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');

            // ─── ABA ABERTAS ──────────────────────────────────────────
            if (activeTab === 'abiertas') {
              const strikePrice = Number(c.strike_price ?? c.entry_price ?? 0);
              const canonicalSym = (c.symbol || '').replace(/^SYNTH_/, '');
              const symbolPrice =
                currentPrices?.[c.symbol] ??
                currentPrices?.[canonicalSym] ??
                currentPrices?.[`SYNTH_${canonicalSym}`] ??
                (currentPrice !== null && currentPrice !== undefined ? Number(currentPrice) : null);
              const numCurrentPrice = symbolPrice !== null && Number.isFinite(symbolPrice) ? symbolPrice : null;
              let isWinning = false;
              if (numCurrentPrice !== null && Number.isFinite(numCurrentPrice)) {
                isWinning = isUp ? numCurrentPrice > strikePrice : numCurrentPrice < strikePrice;
              }

              const rawPayoutPct = (c as { payout_pct?: number }).payout_pct;
              const payoutPct = typeof rawPayoutPct === 'number' && Number.isFinite(rawPayoutPct) ? rawPayoutPct : 85;
              const expectedProfitMinor = Math.floor((stake * payoutPct) / 100);
              const pnlDollars = isWinning ? (expectedProfitMinor / 100).toFixed(2) : (stake / 100).toFixed(2);
              const pnlFormatted = isWinning ? `+$${pnlDollars}` : `-$${pnlDollars}`;

              // Cálculos de Tempo e Progresso
              const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0;
              const expiresMs = c.expires_at ? new Date(c.expires_at).getTime() : 0;
              const totalMs = Math.max(1000, expiresMs - createdMs);
              const elapsedMs = Math.max(0, now - createdMs);
              const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

              const remainingSec = Math.max(0, Math.floor((expiresMs - now) / 1000));
              const timerMins = Math.floor(remainingSec / 60);
              const timerSecs = remainingSec % 60;
              const timerClock = `${String(timerMins).padStart(2, '0')}:${String(timerSecs).padStart(2, '0')}`;
              const timerText = remainingSec <= 0 ? 'Liquidando...' : timerClock;

              const expiryTimeStr = formatTimeSec(c.expires_at);

              return (
                <div
                  key={c.id}
                  data-testid={`portfolio-card-${c.id}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '12px 14px',
                    background: '#171F2B',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '8px',
                    transition: 'background 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Linha 1: Bandeiras + Ativo + Badge Direção Sólido + P&L Dinâmico */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AssetFlagBadge symbol={c.symbol} size={20} />
                      <strong style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: 700, letterSpacing: '0.2px' }}>
                        {cleanSym}
                      </strong>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '9.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: isUp ? '#22C55E' : '#E5484D',
                          color: '#FFFFFF',
                          letterSpacing: '0.02em',
                          lineHeight: 1,
                        }}
                      >
                        <span>{isUp ? '↑ ARRIBA' : '↓ ABAJO'}</span>
                        <span style={{ display: 'none' }} aria-hidden="true">
                          {isUp ? 'SUBE' : 'BAJA'}
                        </span>
                      </span>
                    </div>

                    <strong
                      data-testid={`portfolio-pnl-${c.id}`}
                      style={{
                        fontSize: '14px',
                        color: isWinning ? '#22C55E' : '#E5484D',
                        fontFamily: "'Geist Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 700,
                        letterSpacing: '0.2px',
                      }}
                    >
                      {pnlFormatted}
                    </strong>
                  </div>

                  {/* Linha 2: Invertido $X + Barra de Progresso + Timer mm:ss + Expira HH:mm:ss */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '55px' }}>
                      <span style={{ fontSize: '10.5px', color: '#8A92A1', fontWeight: 500, lineHeight: 1 }}>
                        Invertido
                      </span>
                      <strong style={{ fontSize: '13px', color: '#FFFFFF', fontFamily: "'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 700, lineHeight: 1.2 }}>
                        {`$${(stake / 100).toFixed(2)}`}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '10px' }}>
                      {/* Trilho e preenchimento da barra de progresso */}
                      <div
                        data-testid={`portfolio-progress-track-${c.id}`}
                        style={{
                          flex: 1,
                          height: '3px',
                          background: 'rgba(255, 255, 255, 0.12)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <div
                          data-testid={`portfolio-progress-bar-${c.id}`}
                          style={{
                            height: '100%',
                            width: `${progressPercent}%`,
                            background: isWinning ? '#22C55E' : '#E0E0E0',
                            borderRadius: '2px',
                            transition: 'width 0.3s linear',
                          }}
                        />
                      </div>

                      {/* Cronômetro e carimbo de expiração */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '45px' }}>
                        <span
                          data-testid={`portfolio-timer-${c.id}`}
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            fontFamily: "'Geist Mono', monospace",
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1,
                          }}
                        >
                          <span>{timerText}</span>
                          {remainingSec <= 0 && (
                            <span style={{ display: 'none' }} aria-hidden="true">
                              00:00
                            </span>
                          )}
                        </span>
                        {expiryTimeStr && (
                          <span
                            data-testid={`portfolio-expiry-time-${c.id}`}
                            style={{
                              fontSize: '9.5px',
                              color: '#8A92A1',
                              fontFamily: "'Geist Mono', monospace",
                              fontVariantNumeric: 'tabular-nums',
                              marginTop: '3px',
                              lineHeight: 1,
                            }}
                          >
                            {`Expira ${expiryTimeStr}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // ─── ABA CERRADAS ─────────────────────────────────────────
            const isWin = c.result === 'WIN';
            const isDraw = c.result === 'DRAW';
            const payout = typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : (c.payout_minor ?? 0);
            const closedPnlFormatted = isWin
              ? `+$${((payout - stake) / 100).toFixed(2)}`
              : isDraw
              ? `$0.00`
              : `-$${(stake / 100).toFixed(2)}`;

            const closedTimeStr = formatTimeSec(c.expires_at);

            return (
              <div
                key={c.id}
                data-testid={`portfolio-card-${c.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '11px 13px',
                  background: '#171F2B',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              >
                {/* Linha 1: Bandeiras + Ativo + Badge Direção + Resultado Consolidado */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AssetFlagBadge symbol={c.symbol} size={18} />
                    <strong style={{ fontSize: '12.5px', color: '#FFFFFF', fontWeight: 700 }}>
                      {cleanSym}
                    </strong>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '9px',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: isUp ? '#22C55E' : '#E5484D',
                        color: '#FFFFFF',
                        lineHeight: 1,
                      }}
                    >
                      {isUp ? '↑ ARRIBA' : '↓ ABAJO'}
                    </span>
                  </div>

                  <strong
                    data-testid={`portfolio-pnl-${c.id}`}
                    style={{
                      fontSize: '13.5px',
                      color: isWin ? '#22C55E' : '#E5484D',
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 700,
                    }}
                  >
                    {closedPnlFormatted}
                  </strong>
                </div>

                {/* Linha 2: Invertido $X + Status e Horário de Encerramento */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: '#8A92A1', fontFamily: "'Geist Mono', monospace" }}>
                    {`Invertido $${(stake / 100).toFixed(2)}`}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: isWin ? 'rgba(34, 197, 94, 0.15)' : isDraw ? 'rgba(255, 255, 255, 0.12)' : 'rgba(229, 72, 77, 0.15)',
                        color: isWin ? '#22C55E' : isDraw ? '#E0E0E0' : '#E5484D',
                      }}
                    >
                      {isWin ? 'Ganada' : isDraw ? 'Empate' : 'Perdida'}
                    </span>
                    {closedTimeStr && (
                      <span style={{ fontSize: '9.5px', color: '#8A92A1', fontFamily: "'Geist Mono', monospace" }}>
                        {closedTimeStr}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
