import { useEffect, useState } from 'react';
import type { Contract } from '../../api/client';
import { formatMinor } from '../../lib/money';

export interface PortfolioDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  contracts: Contract[];
  currentPrice: number | string | null;
  currentSymbol: string;
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const openContracts = contracts.filter((c) => c.status === 'OPEN');
  const settledContracts = contracts.filter((c) => c.status !== 'OPEN');

  // Calcular PnL total potencial
  const potentialPnlMinor = openContracts.reduce((acc, c) => {
    const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
    return acc + Math.round(stake * 0.85);
  }, 0);

  return (
    <div
      className="portfolio-drawer-wrap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: '#0a101f',
        borderTop: '1px solid #1a253a',
        boxSizing: 'border-box',
      }}
    >
      {/* Barra de Rodapé Fixa (32px) */}
      <div
        className="terminal-drawer-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: '32px',
          fontSize: '11px',
          color: '#8e9db7',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💼</span>
            <strong style={{ color: '#fff' }}>Portfólio Total</strong>
            <span
              style={{
                background: openContracts.length > 0 ? '#00e676' : '#1c2d4a',
                color: openContracts.length > 0 ? '#051827' : '#8898b8',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '10px',
                fontWeight: 800,
              }}
            >
              {openContracts.length} ativas
            </span>
          </div>

          {openContracts.length > 0 && (
            <span style={{ color: '#00e676', fontWeight: 600 }}>
              Retorno potencial: +{formatMinor(potentialPnlMinor)}
            </span>
          )}

          <span style={{ color: '#4a5b78' }}>|</span>
          <span style={{ color: '#687b99', fontSize: '10px' }}>
            Ambiente demonstrativo · Saldo USD · Risco zero
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            background: '#131e33',
            border: '1px solid #253450',
            color: '#bcd0ec',
            borderRadius: '4px',
            padding: '2px 10px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isOpen ? '▼ Ocultar Painel' : `▲ Expandir (${openContracts.length})`}
        </button>
      </div>

      {/* Conteúdo Expandido da Gaveta (220px) */}
      {isOpen && (
        <div
          style={{
            height: '220px',
            maxHeight: '220px',
            background: '#090f1d',
            borderTop: '1px solid #162238',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
        >
          {/* Sub-abas da gaveta */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '8px 16px',
              borderBottom: '1px solid #162238',
              background: '#070c18',
            }}
          >
            <button
              type="button"
              onClick={() => setTab('ACTIVE')}
              style={{
                background: tab === 'ACTIVE' ? '#192b49' : 'transparent',
                border: tab === 'ACTIVE' ? '1px solid #273e66' : '1px solid transparent',
                color: tab === 'ACTIVE' ? '#00e676' : '#7d8fae',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Operações Abertas ({openContracts.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('HISTORY')}
              style={{
                background: tab === 'HISTORY' ? '#192b49' : 'transparent',
                border: tab === 'HISTORY' ? '1px solid #273e66' : '1px solid transparent',
                color: tab === 'HISTORY' ? '#00e676' : '#7d8fae',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Histórico Finalizado ({settledContracts.length})
            </button>
          </div>

          {/* Tabela de Operações */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {tab === 'ACTIVE' ? (
              openContracts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#687b99', fontSize: '12px' }}>
                  Nenhuma ordem em andamento. Abra uma posição ACIMA ou ABAIXO para acompanhar ao vivo aqui.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#687b99', borderBottom: '1px solid #1a273e' }}>
                      <th style={{ padding: '8px 6px' }}>ID / Ativo</th>
                      <th style={{ padding: '8px 6px' }}>Direção</th>
                      <th style={{ padding: '8px 6px' }}>Valor</th>
                      <th style={{ padding: '8px 6px' }}>Expiração</th>
                      <th style={{ padding: '8px 6px' }}>Status</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Retorno Potencial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openContracts.map((c) => {
                      const stakeNum = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
                      const expEpoch = Date.parse(c.expires_at);
                      const secondsLeft = Math.max(0, Math.ceil((expEpoch - now) / 1000));
                      const progressPct = Math.min(100, Math.max(0, ((60 - secondsLeft) / 60) * 100));

                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #141f33', color: '#e0e9f6' }}>
                          <td style={{ padding: '8px 6px' }}>
                            <strong style={{ color: '#fff' }}>{c.symbol}</strong>
                            <div style={{ fontSize: '10px', color: '#687b99' }}>#{c.id.slice(0, 8)}</div>
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <span
                              style={{
                                color: c.direction === 'UP' ? '#00e676' : '#ff3d71',
                                fontWeight: 700,
                              }}
                            >
                              {c.direction === 'UP' ? '▲ ACIMA' : '▼ ABAIXO'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 6px' }}>{formatMinor(stakeNum)}</td>
                          <td style={{ padding: '8px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{secondsLeft}s</span>
                              <div
                                style={{
                                  width: '60px',
                                  height: '4px',
                                  background: '#192b49',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${progressPct}%`,
                                    background: '#00e676',
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <span style={{ color: '#65d5ff', fontWeight: 600 }}>Em andamento</span>
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                            <strong style={{ color: '#00e676', fontFamily: "'Space Grotesk', sans-serif" }}>
                              +{formatMinor(Math.round(stakeNum * 0.85))}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : settledContracts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#687b99', fontSize: '12px' }}>
                Nenhum histórico disponível ainda.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: '#687b99', borderBottom: '1px solid #1a273e' }}>
                    <th style={{ padding: '8px 6px' }}>ID / Ativo</th>
                    <th style={{ padding: '8px 6px' }}>Direção</th>
                    <th style={{ padding: '8px 6px' }}>Investido</th>
                    <th style={{ padding: '8px 6px' }}>Resultado</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right' }}>Retorno</th>
                  </tr>
                </thead>
                <tbody>
                  {settledContracts.slice(0, 20).map((c) => {
                    const stakeNum = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
                    const payoutNum = c.payout_minor !== null ? (typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : c.payout_minor) : 0;
                    const isWin = c.result === 'WIN';
                    const isDraw = c.result === 'DRAW';

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #141f33', color: '#e0e9f6' }}>
                        <td style={{ padding: '8px 6px' }}>
                          <strong style={{ color: '#fff' }}>{c.symbol}</strong>
                          <div style={{ fontSize: '10px', color: '#687b99' }}>#{c.id.slice(0, 8)}</div>
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <span style={{ color: c.direction === 'UP' ? '#00e676' : '#ff3d71', fontWeight: 700 }}>
                            {c.direction === 'UP' ? '▲ ALTA' : '▼ BAIXA'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 6px' }}>{formatMinor(stakeNum)}</td>
                        <td style={{ padding: '8px 6px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              background: isWin ? 'rgba(0, 230, 118, 0.15)' : isDraw ? 'rgba(255, 171, 0, 0.15)' : 'rgba(255, 61, 113, 0.15)',
                              color: isWin ? '#00e676' : isDraw ? '#ffab00' : '#ff3d71',
                            }}
                          >
                            {isWin ? 'VITÓRIA' : isDraw ? 'EMPATE' : 'DERROTA'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                          <strong
                            style={{
                              color: isWin ? '#00e676' : isDraw ? '#ffab00' : '#ff3d71',
                              fontFamily: "'Space Grotesk', sans-serif",
                            }}
                          >
                            {isWin ? `+${formatMinor(payoutNum)}` : isDraw ? formatMinor(payoutNum) : '$0,00'}
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
