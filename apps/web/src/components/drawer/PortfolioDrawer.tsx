import { useEffect, useState } from 'react';
import type { Contract } from '../../api/client';
import { formatMinor, formatCurrencyBinmax } from '../../lib/money';
import { isNewTraderoomEnabled } from '../../lib/feature-flags';
import { getTabDisplayTitle } from '../header/TerminalHeader';
import { AssetFlagBadge } from '../header/AssetFlagBadge';
import { useUiLanguage } from '../../i18n';

export interface PortfolioDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  contracts: Contract[];
  currentPrice: number | string | null;
  currentSymbol: string;
}

export function formatOrderHash(id: string): string {
  if (!id) return '#ORD-0000';
  if (id.startsWith('guest_')) {
    return `#ORD-${id.replace('guest_', '').slice(0, 6).toUpperCase()}`;
  }
  return `#${id.slice(0, 8)}`;
}

export function PortfolioDrawer({
  isOpen,
  onToggle,
  contracts,
  currentPrice,
  currentSymbol,
}: PortfolioDrawerProps) {
  const [tab, setTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [now, setNow] = useState(Date.now());
  const uiLang = useUiLanguage('es');
  const isPt = uiLang === 'pt';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const openContracts = contracts.filter((c) => c.status === 'OPEN');
  const settledContracts = contracts.filter((c) => c.status !== 'OPEN');

  // Calcular PnL total potencial (apenas para ordens ativas com tempo restante)
  const potentialPnlMinor = openContracts.reduce((acc, c) => {
    const expEpoch = Date.parse(c.expires_at);
    if (Number.isFinite(expEpoch) && expEpoch <= now) return acc;
    const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
    return acc + Math.floor((stake * 85) / 100);
  }, 0);

  const isBinmax = isNewTraderoomEnabled();

  return (
    <div
      className="portfolio-drawer-wrap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: isBinmax ? '#151922' : '#0a101f',
        borderTop: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #1a253a',
        boxSizing: 'border-box',
        transition: 'background 260ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Barra de Rodapé Fixa (~30px) */}
      <div
        className="terminal-drawer-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: '30px',
          fontSize: '11px',
          color: isBinmax ? '#8A92A1' : '#8e9db7',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isBinmax ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#8A92A1' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </span>
            ) : (
              <span>💼</span>
            )}
            {!isBinmax && <strong style={{ color: '#fff' }}>Portfólio Total</strong>}
            <span
              style={{
                background: openContracts.length > 0 ? (isBinmax ? 'rgba(34, 197, 94, 0.12)' : '#00e676') : (isBinmax ? 'rgba(255, 255, 255, 0.04)' : '#1c2d4a'),
                color: openContracts.length > 0 ? (isBinmax ? '#22C55E' : '#0D0F14') : '#8A92A1',
                border: isBinmax ? (openContracts.length > 0 ? '1px solid rgba(34, 197, 94, 0.28)' : '1px solid rgba(255, 255, 255, 0.08)') : 'none',
                borderRadius: isBinmax ? '9999px' : '10px',
                padding: isBinmax ? '2px 9px' : '1px 7px',
                fontSize: '10px',
                fontWeight: 700,
                fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {isBinmax && (
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: openContracts.length > 0 ? '#22C55E' : '#8A92A1',
                    boxShadow: openContracts.length > 0 ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none',
                  }}
                />
              )}
              {`${openContracts.length} ${isBinmax ? (isPt ? 'ativas' : 'activas') : 'ativas'}`}
            </span>
          </div>

          {openContracts.length > 0 && (
            <span style={{ color: isBinmax ? '#22C55E' : '#00e676', fontWeight: 600, fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit' }}>
              {isBinmax ? (isPt ? 'Lucro potencial' : 'Ganancia potencial') : 'Retorno potencial'}: {`+${isBinmax ? formatCurrencyBinmax(potentialPnlMinor) : formatMinor(potentialPnlMinor)}`}
            </span>
          )}

          {isBinmax && openContracts.length === 0 && (
            <span style={{ color: '#596273', fontSize: '10.5px', fontFamily: "'Geist', sans-serif" }}>
              {`· ${isPt ? 'Terminal em espera' : 'Terminal en espera'}`}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            background: isBinmax ? 'rgba(255, 255, 255, 0.04)' : '#131e33',
            border: isBinmax ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #253450',
            color: isBinmax ? '#DCE1EA' : '#bcd0ec',
            borderRadius: isBinmax ? '6px' : '4px',
            padding: isBinmax ? '3px 12px' : '2px 10px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.02em',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: isBinmax ? '0 1px 3px rgba(0, 0, 0, 0.3)' : 'none',
          }}
        >
          {isBinmax
            ? (isOpen ? (isPt ? 'Mostrar posições ⌃' : 'Mostrar posiciones ⌃') : (isPt ? 'Mostrar posições ⌵' : 'Mostrar posiciones ⌵'))
            : (isOpen ? '▼ Ocultar Painel' : `▲ Expandir (${openContracts.length})`)}
        </button>
      </div>

      {/* Conteúdo Expandido da Gaveta (altura elástica adaptativa) com transição de física de movimento */}
      {isOpen && (
        <div
          style={{
            height: 'clamp(160px, 20vh, 220px)',
            maxHeight: '220px',
            background: isBinmax ? '#101622' : '#090f1d',
            borderTop: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #162238',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            transition: 'max-height 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Sub-abas da gaveta */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '6px 16px',
              borderBottom: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #162238',
              background: isBinmax ? '#0D0F14' : '#070c18',
            }}
          >
            <button
              type="button"
              onClick={() => setTab('ACTIVE')}
              style={{
                background: tab === 'ACTIVE'
                  ? (isBinmax ? '#1C2738' : '#192b49')
                  : 'transparent',
                border: tab === 'ACTIVE'
                  ? (isBinmax ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #273e66')
                  : '1px solid transparent',
                color: tab === 'ACTIVE'
                  ? (isBinmax ? '#FFFFFF' : '#00e676')
                  : '#8A92A1',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: isBinmax ? "'Geist', sans-serif" : 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {isBinmax ? `${isPt ? 'Operações abertas' : 'Operaciones abiertas'} (${openContracts.length})` : `Operações Abertas (${openContracts.length})`}
            </button>
            <button
              type="button"
              onClick={() => setTab('HISTORY')}
              style={{
                background: tab === 'HISTORY'
                  ? (isBinmax ? '#1C2738' : '#192b49')
                  : 'transparent',
                border: tab === 'HISTORY'
                  ? (isBinmax ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #273e66')
                  : '1px solid transparent',
                color: tab === 'HISTORY'
                  ? (isBinmax ? '#FFFFFF' : '#00e676')
                  : '#8A92A1',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: isBinmax ? "'Geist', sans-serif" : 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {isBinmax ? `${isPt ? 'Histórico fechado' : 'Historial cerrado'} (${settledContracts.length})` : `Histórico Finalizado (${settledContracts.length})`}
            </button>
          </div>

          {/* Tabela de Operações */}
          <div className={isBinmax ? 'bm-stealth-scroll' : ''} style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {tab === 'ACTIVE' ? (
              openContracts.length === 0 ? (
                isBinmax ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '30px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: 'rgba(244, 245, 247, 0.03)',
                        border: '1px solid rgba(244, 245, 247, 0.08)',
                        display: 'grid',
                        placeItems: 'center',
                        marginBottom: '10px',
                        color: '#8A92A1',
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#F4F5F7', marginBottom: '3px', fontFamily: "'Geist', sans-serif" }}>
                      {isPt ? 'Sem operações abertas' : 'Sin operaciones abiertas'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#8A92A1', marginBottom: '3px', fontFamily: "'Geist', sans-serif" }}>
                      {isPt ? 'Você ainda não tem operações abertas. Escolha ACIMA ou ABAIXO para começar.' : 'Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar.'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#596273', fontFamily: "'Geist', sans-serif" }}>
                      {isPt ? 'O terminal atualizará este painel em tempo real ao registrar ordens.' : 'El terminal actualizará este panel en tiempo real al registrar órdenes.'}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A92A1', fontSize: '12px' }}>
                    Nenhuma ordem em andamento. Abra uma posição ACIMA ou ABAIXO para acompanhar ao vivo aqui.
                  </div>
                )
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#8A92A1', borderBottom: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #1a273e' }}>
                      <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? (isPt ? 'Ativo' : 'Activo') : 'ID / Ativo'}</th>
                      <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? (isPt ? 'Direção' : 'Dirección') : 'Direção'}</th>
                      <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? (isPt ? 'Investimento' : 'Inversión') : 'Valor'}</th>
                      <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? (isPt ? 'Tempo restante' : 'Tiempo restante') : 'Expiração'}</th>
                      <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? (isPt ? 'Estado' : 'Estado') : 'Status'}</th>
                      <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none', textAlign: 'right' }}>{isBinmax ? (isPt ? 'Lucro potencial' : 'Ganancia potencial') : 'Retorno Potencial'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openContracts.map((c) => {
                      const stakeNum = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
                      const expEpoch = Date.parse(c.expires_at);
                      const secondsLeft = Math.max(0, Math.ceil((expEpoch - now) / 1000));
                      const progressPct = Math.min(100, Math.max(0, ((60 - secondsLeft) / 60) * 100));

                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: isBinmax ? '1px solid rgba(244, 245, 247, 0.04)' : '1px solid #141f33',
                            color: '#e0e9f6',
                            transition: 'background 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <td style={{ padding: '8px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isBinmax && <AssetFlagBadge symbol={c.symbol} size={18} />}
                              <div>
                                <strong style={{ color: '#fff', fontSize: '12px' }}>{isBinmax ? getTabDisplayTitle(c.symbol) : c.symbol}</strong>
                                <div style={{ fontSize: '10px', color: '#8A92A1', fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit' }}>
                                  {formatOrderHash(c.id)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <span
                              style={{
                                color: c.direction === 'UP' ? (isBinmax ? '#22C55E' : '#00e676') : (isBinmax ? '#E5484D' : '#ff3d71'),
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: isBinmax ? '2px 8px' : '0',
                                borderRadius: isBinmax ? '4px' : '0',
                                background: isBinmax ? (c.direction === 'UP' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(229, 72, 77, 0.12)') : 'transparent',
                                border: isBinmax ? (c.direction === 'UP' ? '1px solid rgba(34, 197, 94, 0.28)' : '1px solid rgba(229, 72, 77, 0.28)') : 'none',
                                fontSize: isBinmax ? '10.5px' : 'inherit',
                              }}
                            >
                              {isBinmax
                                ? (c.direction === 'UP' ? '▲ SUBE' : '▼ BAJA')
                                : (c.direction === 'UP' ? '▲ ACIMA' : '▼ ABAIXO')}
                            </span>
                          </td>
                          <td style={{ padding: '8px 6px', fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit' }}>
                            {isBinmax ? formatCurrencyBinmax(stakeNum) : formatMinor(stakeNum)}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit', fontSize: '11px', fontWeight: 600 }}>{`${secondsLeft}s`}</span>
                              <div
                                style={{
                                  width: '64px',
                                  height: '3px',
                                  background: isBinmax ? '#0B0E14' : '#192b49',
                                  border: isBinmax ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${progressPct}%`,
                                    background: isBinmax ? '#22C55E' : '#00e676',
                                    transition: 'width 0.3s linear',
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <span
                              style={{
                                color: secondsLeft <= 0 ? '#FFA75D' : (isBinmax ? '#DCE1EA' : '#65d5ff'),
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                              }}
                            >
                              {isBinmax && (
                                <span
                                  style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    background: secondsLeft <= 0 ? '#FFA75D' : '#22C55E',
                                    boxShadow: secondsLeft <= 0 ? '0 0 6px rgba(255, 167, 93, 0.6)' : '0 0 6px rgba(34, 197, 94, 0.6)',
                                  }}
                                />
                              )}
                              {secondsLeft <= 0
                                ? 'Liquidando...'
                                : (isBinmax ? 'En curso' : 'Em andamento')}
                            </span>
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                            <strong style={{ color: isBinmax ? '#22C55E' : '#00e676', fontFamily: isBinmax ? "'Geist Mono', monospace" : "'Space Grotesk', sans-serif" }}>
                              {`+${isBinmax ? formatCurrencyBinmax(Math.floor((stakeNum * 85) / 100)) : formatMinor(Math.floor((stakeNum * 85) / 100))}`}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : settledContracts.length === 0 ? (
              isBinmax ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '30px 16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'rgba(244, 245, 247, 0.03)',
                      border: '1px solid rgba(244, 245, 247, 0.08)',
                      display: 'grid',
                      placeItems: 'center',
                      marginBottom: '10px',
                      color: '#8A92A1',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 14 14" />
                    </svg>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#F4F5F7', marginBottom: '3px', fontFamily: "'Geist', sans-serif" }}>
                    Sin historial cerrado
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#8A92A1', marginBottom: '3px', fontFamily: "'Geist', sans-serif" }}>
                    Aún no tienes operaciones cerradas.
                  </div>
                  <div style={{ fontSize: '10px', color: '#596273', fontFamily: "'Geist', sans-serif" }}>
                    Tus operaciones finalizadas y auditadas aparecerán aquí.
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A92A1', fontSize: '12px' }}>
                  Nenhum histórico disponível ainda.
                </div>
              )
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: '#8A92A1', borderBottom: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #1a273e' }}>
                    <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? 'Activo' : 'ID / Ativo'}</th>
                    <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? 'Dirección' : 'Direção'}</th>
                    <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? 'Inversión' : 'Investido'}</th>
                    <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none' }}>{isBinmax ? 'Resultado' : 'Resultado'}</th>
                    <th style={{ padding: '8px 6px', fontSize: isBinmax ? '10px' : '12px', fontWeight: 600, letterSpacing: isBinmax ? '0.05em' : 'normal', textTransform: isBinmax ? 'uppercase' : 'none', textAlign: 'right' }}>{isBinmax ? 'Retorno' : 'Retorno'}</th>
                  </tr>
                </thead>
                <tbody>
                  {settledContracts.slice(0, 20).map((c) => {
                    const stakeNum = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
                    const payoutNum = c.payout_minor !== null ? (typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : c.payout_minor) : 0;
                    const isWin = c.result === 'WIN';
                    const isDraw = c.result === 'DRAW';

                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: isBinmax ? '1px solid rgba(244, 245, 247, 0.04)' : '1px solid #141f33',
                          color: '#e0e9f6',
                          transition: 'background 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        <td style={{ padding: '8px 6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isBinmax && <AssetFlagBadge symbol={c.symbol} size={18} />}
                            <div>
                              <strong style={{ color: '#fff', fontSize: '12px' }}>{isBinmax ? getTabDisplayTitle(c.symbol) : c.symbol}</strong>
                              <div style={{ fontSize: '10px', color: '#8A92A1', fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit' }}>
                                {formatOrderHash(c.id)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <span
                            style={{
                              color: c.direction === 'UP' ? (isBinmax ? '#22C55E' : '#00e676') : (isBinmax ? '#E5484D' : '#ff3d71'),
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: isBinmax ? '2px 8px' : '0',
                              borderRadius: isBinmax ? '4px' : '0',
                              background: isBinmax ? (c.direction === 'UP' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(229, 72, 77, 0.12)') : 'transparent',
                              border: isBinmax ? (c.direction === 'UP' ? '1px solid rgba(34, 197, 94, 0.28)' : '1px solid rgba(229, 72, 77, 0.28)') : 'none',
                              fontSize: isBinmax ? '10.5px' : 'inherit',
                            }}
                          >
                            {isBinmax
                              ? (c.direction === 'UP' ? '▲ SUBE' : '▼ BAJA')
                              : (c.direction === 'UP' ? '▲ ALTA' : '▼ BAIXA')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 6px', fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit' }}>
                          {isBinmax ? formatCurrencyBinmax(stakeNum) : formatMinor(stakeNum)}
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              background: isWin
                                ? (isBinmax ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0, 230, 118, 0.15)')
                                : isDraw
                                ? 'rgba(255, 171, 0, 0.15)'
                                : (isBinmax ? 'rgba(229, 72, 77, 0.15)' : 'rgba(255, 61, 113, 0.15)'),
                              color: isWin
                                ? (isBinmax ? '#22C55E' : '#00e676')
                                : isDraw
                                ? '#ffab00'
                                : (isBinmax ? '#E5484D' : '#ff3d71'),
                            }}
                          >
                            {isWin ? (isBinmax ? 'GANADA' : 'VITÓRIA') : isDraw ? (isBinmax ? 'EMPATE' : 'EMPATE') : (isBinmax ? 'PERDIDA' : 'DERROTA')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                          <strong
                            style={{
                              color: isWin
                                ? (isBinmax ? '#22C55E' : '#00e676')
                                : isDraw
                                ? '#ffab00'
                                : (isBinmax ? '#E5484D' : '#ff3d71'),
                              fontFamily: isBinmax ? "'Geist Mono', monospace" : "'Space Grotesk', sans-serif",
                            }}
                          >
                            {isWin
                              ? `+${isBinmax ? formatCurrencyBinmax(payoutNum) : formatMinor(payoutNum)}`
                              : isDraw
                              ? (isBinmax ? formatCurrencyBinmax(payoutNum) : formatMinor(payoutNum))
                              : `−${isBinmax ? formatCurrencyBinmax(stakeNum) : formatMinor(stakeNum)}`}
                          </strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
