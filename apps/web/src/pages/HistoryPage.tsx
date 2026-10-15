import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import { getContracts, type Contract } from '../api/client';
import { AuthService } from '../auth/auth-service';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../lib/design-tokens';

export function sanitizeCsvField(field: string | number): string {
  const str = String(field ?? '');
  let safeStr = str;
  if (/^[=+\-@\t\r]/.test(safeStr)) {
    safeStr = `'${safeStr}`;
  }
  if (/[",\n\r]/.test(safeStr)) {
    safeStr = `"${safeStr.replace(/"/g, '""')}"`;
  }
  return safeStr;
}

export function resolveContractClosingPrice(c: Contract): number | string | null {
  if (!c || c.status === 'OPEN') return null;
  if (c.exit_price !== undefined) return c.exit_price;
  if (c.strike_price !== undefined && c.strike_price !== null && c.strike_price !== c.entry_price) {
    return c.strike_price;
  }
  return null;
}

export function generateCsvContent(contracts: Contract[]): string {
  const headers = [
    'ID Operación',
    'Fecha y Hora',
    'Activo',
    'Dirección',
    'Inversión (USD)',
    'Precio Apertura',
    'Precio Cierre',
    'Resultado',
    'Retorno (USD)',
    'Lucro Neto (USD)',
  ];

  const rows = contracts.map((c) => {
    const stakeNum = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
    const payoutNum = c.payout_minor !== null ? (typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : c.payout_minor) : 0;
    const netProfit = c.result === 'WIN' ? (payoutNum - stakeNum) : c.result === 'DRAW' ? 0 : -stakeNum;
    const closingPrice = resolveContractClosingPrice(c);

    return [
      c.id,
      new Date(c.expires_at || c.created_at).toLocaleString('es-ES'),
      c.symbol,
      c.direction === 'UP' ? 'SUBE' : 'BAJA',
      (stakeNum / 100).toFixed(2),
      c.entry_price ?? '—',
      closingPrice ?? '—',
      c.result ?? 'PENDIENTE',
      (payoutNum / 100).toFixed(2),
      (netProfit / 100).toFixed(2),
    ].map(sanitizeCsvField).join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export interface HistoryPageProps {
  initialContracts?: Contract[];
}

export function HistoryPage({ initialContracts }: HistoryPageProps = {}) {
  const [periodFilter, setPeriodFilter] = useState<'7d' | 'today' | '30d' | 'all'>('7d');
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [accountType, setAccountType] = useState<'practice' | 'real'>('practice');

  const session = AuthService.getSession();
  const user = session?.user;
  const userEmail = user?.email || null;
  const demoBalanceMinor = user?.demoBalanceMinor ?? 1000000;
  const balanceFormatted = accountType === 'real'
    ? '$0.00'
    : `$${(demoBalanceMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const { data: serverContracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => getContracts(''),
    retry: false,
    initialData: initialContracts,
  });

  const allContracts = useMemo(() => {
    if (accountType === 'real') {
      // Conta real sem depósitos e sem operações
      return [];
    }
    const apiList = Array.isArray(serverContracts) ? serverContracts : [];
    return apiList.filter((c) => c.status !== 'OPEN');
  }, [serverContracts, accountType]);

  const filteredContracts = useMemo(() => {
    const now = Date.now();
    return allContracts.filter((c) => {
      if (assetFilter !== 'ALL' && c.symbol !== assetFilter) return false;
      if (resultFilter === 'WIN' && c.result !== 'WIN') return false;
      if (resultFilter === 'LOSS' && c.result !== 'LOSS') return false;

      const cTime = new Date(c.expires_at || c.created_at).getTime();
      if (periodFilter === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        if (cTime < startOfDay.getTime()) return false;
      } else if (periodFilter === '7d') {
        if (now - cTime > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (periodFilter === '30d') {
        if (now - cTime > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [allContracts, assetFilter, resultFilter, periodFilter]);

  const stats = useMemo(() => {
    const totalOps = filteredContracts.length;
    let totalInvestedMinor = 0;
    let totalPayoutMinor = 0;

    filteredContracts.forEach((c) => {
      const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
      const payout = c.payout_minor !== null ? (typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : c.payout_minor) : 0;
      totalInvestedMinor += stake;
      if (c.result === 'WIN') {
        totalPayoutMinor += payout;
      } else if (c.result === 'DRAW') {
        totalPayoutMinor += stake;
      }
    });

    const netProfitMinor = totalPayoutMinor - totalInvestedMinor;
    return {
      totalOps,
      totalInvestedMinor,
      netProfitMinor,
    };
  }, [filteredContracts]);

  const handleExportCsv = () => {
    const csvContent = generateCsvContent(filteredContracts);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historial_operaciones_${periodFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <SecondaryLayout userEmail={userEmail} balanceFormatted={balanceFormatted}>
      <div
        data-testid="history-page-container"
        className="bm-page-enter"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* ─── CABEÇALHO DO EXTRATO ───────────────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: PRECISION_COLORS.metal,
                  }}
                >
                  Libro Contable Auditado
                </span>
                <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>·</span>
                <span style={{ fontSize: '11px', color: PRECISION_TEXT.muted, fontFamily: PRECISION_FONTS.mono }}>
                  Blnk Ledger Engine
                </span>
              </div>
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: PRECISION_TEXT.strong,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                Historial completo de operaciones
              </h1>
            </div>

            {/* Alternador de Conta: Práctica / Real */}
            <div
              style={{
                display: 'flex',
                background: PRECISION_SURFACES.bg1,
                padding: '3px',
                borderRadius: '6px',
                border: `1px solid ${PRECISION_SURFACES.line}`,
              }}
            >
              <button
                type="button"
                data-testid="account-practice-btn"
                onClick={() => setAccountType('practice')}
                className="bm-btn-press"
                style={{
                  background: accountType === 'practice' ? PRECISION_SURFACES.bg3 : 'transparent',
                  color: accountType === 'practice' ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: accountType === 'practice' ? 700 : 500,
                  cursor: 'pointer',
                  transition: `background-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                Cuenta de práctica
              </button>
              <button
                type="button"
                data-testid="account-real-btn"
                onClick={() => setAccountType('real')}
                className="bm-btn-press"
                style={{
                  background: accountType === 'real' ? PRECISION_SURFACES.bg3 : 'transparent',
                  color: accountType === 'real' ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: accountType === 'real' ? 700 : 500,
                  cursor: 'pointer',
                  transition: `background-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                Cuenta real
              </button>
            </div>
          </div>
        </div>

        {/* ─── BARRA DE FILTROS & AÇÃO DE EXPORTAÇÃO CSV ──────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
            backgroundColor: PRECISION_SURFACES.bg1,
            border: `1px solid ${PRECISION_SURFACES.line}`,
            borderRadius: '8px',
            padding: '14px 18px',
          }}
        >
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Período */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="period-filter-select" style={{ fontSize: '11.5px', color: PRECISION_TEXT.quiet, fontWeight: 600 }}>
                Período:
              </label>
              <select
                id="period-filter-select"
                data-testid="filter-period"
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as any)}
                style={{
                  background: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  color: PRECISION_TEXT.strong,
                  borderRadius: '4px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="today">Hoy</option>
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="all">Histórico completo</option>
              </select>
            </div>

            {/* Ativo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="asset-filter-select" style={{ fontSize: '11.5px', color: PRECISION_TEXT.quiet, fontWeight: 600 }}>
                Activo:
              </label>
              <select
                id="asset-filter-select"
                data-testid="filter-asset"
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                style={{
                  background: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  color: PRECISION_TEXT.strong,
                  borderRadius: '4px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="ALL">Todos los activos</option>
                <option value="SYNTH_VOL_10">Índice Volatilidad 10</option>
                <option value="SYNTH_VOL_25">Índice Volatilidad 25</option>
                <option value="SYNTH_VOL_50">Índice Volatilidad 50</option>
                <option value="SYNTH_VOL_75">Índice Volatilidad 75</option>
                <option value="SYNTH_VOL_100">Índice Volatilidad 100</option>
              </select>
            </div>

            {/* Resultado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="result-filter-select" style={{ fontSize: '11.5px', color: PRECISION_TEXT.quiet, fontWeight: 600 }}>
                Resultado:
              </label>
              <select
                id="result-filter-select"
                data-testid="filter-result"
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value as any)}
                style={{
                  background: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  color: PRECISION_TEXT.strong,
                  borderRadius: '4px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="ALL">Todos los resultados</option>
                <option value="WIN">Ganadas</option>
                <option value="LOSS">No ganadas</option>
              </select>
            </div>
          </div>

          {/* Botão de Exportação CSV */}
          <button
            type="button"
            data-testid="export-csv-btn"
            className="bm-btn-precision"
            onClick={handleExportCsv}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Exportar CSV</span>
          </button>
        </div>

        {/* ─── TABELA DE EXTRATO INSTITUCIONAL ────────────────────────── */}
        <div
          style={{
            backgroundColor: PRECISION_SURFACES.bg1,
            border: `1px solid ${PRECISION_SURFACES.line}`,
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '24px',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              data-testid="history-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '12.5px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: PRECISION_SURFACES.bg2,
                    borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
                    color: PRECISION_TEXT.quiet,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <th style={{ padding: '12px 18px' }}>Operación</th>
                  <th style={{ padding: '12px 18px' }}>Fecha y Hora</th>
                  <th style={{ padding: '12px 18px' }}>Activo</th>
                  <th style={{ padding: '12px 18px' }}>Dirección</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Stake</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Entrada</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Cierre</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Retorno</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '64px 24px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: PRECISION_TEXT.strong }}>
                          {accountType === 'real'
                            ? 'No hay operaciones en tu cuenta real'
                            : 'No se encontraron operaciones registradas'}
                        </div>
                        <div style={{ fontSize: '12px', color: PRECISION_TEXT.muted, maxWidth: '420px', lineHeight: 1.5 }}>
                          {accountType === 'real'
                            ? 'Tu cuenta real tiene saldo de $0.00. Realiza un depósito para comenzar a operar en vivo.'
                            : 'Abre tu primera operación en la Sala de Trading para registrar tu historial de transacciones.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map((c) => {
                    const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
                    const payout = c.payout_minor !== null ? (typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : c.payout_minor) : 0;
                    const net = c.result === 'WIN' ? (payout - stake) : c.result === 'DRAW' ? 0 : -stake;
                    const isWin = c.result === 'WIN';

                    return (
                      <tr
                        key={c.id}
                        data-testid={`history-row-${c.id}`}
                        style={{
                          borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
                          transition: `background-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                        }}
                      >
                        <td style={{ padding: '14px 18px', fontFamily: PRECISION_FONTS.mono, color: PRECISION_TEXT.muted, fontSize: '11.5px' }} className="bm-tabular-nums">
                          {c.id.slice(0, 14)}
                        </td>
                        <td style={{ padding: '14px 18px', color: PRECISION_TEXT.muted, whiteSpace: 'nowrap', fontFamily: PRECISION_FONTS.mono, fontSize: '11.5px' }} className="bm-tabular-nums">
                          {new Date(c.expires_at || c.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' })}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: PRECISION_TEXT.strong }}>
                          {c.symbol}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: c.direction === 'UP' ? PRECISION_COLORS.profit : PRECISION_COLORS.loss,
                              background: c.direction === 'UP' ? 'rgba(34, 196, 122, 0.1)' : 'rgba(242, 84, 91, 0.1)',
                              border: `1px solid ${c.direction === 'UP' ? 'rgba(34, 196, 122, 0.25)' : 'rgba(242, 84, 91, 0.25)'}`,
                            }}
                          >
                            {c.direction === 'UP' ? 'SUBE' : 'BAJA'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: PRECISION_FONTS.mono, color: PRECISION_TEXT.strong }} className="bm-tabular-nums">
                          {`$${(stake / 100).toFixed(2)}`}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: PRECISION_FONTS.mono, color: PRECISION_TEXT.muted }} className="bm-tabular-nums">
                          {typeof c.entry_price === 'number' ? c.entry_price.toFixed(4) : c.entry_price ?? '—'}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: PRECISION_FONTS.mono, color: PRECISION_TEXT.muted }} className="bm-tabular-nums" data-testid={`closing-price-${c.id}`}>
                          {(() => {
                            const cp = resolveContractClosingPrice(c);
                            return typeof cp === 'number' ? cp.toFixed(4) : cp ?? '—';
                          })()}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: isWin ? PRECISION_COLORS.profit : PRECISION_COLORS.loss,
                            }}
                          >
                            {c.result ?? 'PENDIENTE'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: PRECISION_FONTS.mono, color: PRECISION_TEXT.strong }} className="bm-tabular-nums">
                          {`$${(payout / 100).toFixed(2)}`}
                        </td>
                        <td
                          style={{
                            padding: '14px 18px',
                            textAlign: 'right',
                            fontFamily: PRECISION_FONTS.mono,
                            fontWeight: 700,
                            color: net > 0 ? PRECISION_COLORS.profit : net < 0 ? PRECISION_COLORS.loss : PRECISION_TEXT.muted,
                          }}
                          className="bm-tabular-nums"
                        >
                          {`${net > 0 ? '+' : ''}$${(net / 100).toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── SUMÁRIO CONSOLIDADO DO EXTRATO ─────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            backgroundColor: PRECISION_SURFACES.bg1,
            border: `1px solid ${PRECISION_SURFACES.line}`,
            borderRadius: '8px',
            padding: '16px 22px',
          }}
        >
          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase' }}>Operaciones Auditadas</span>
              <div data-testid="total-ops-count" style={{ fontSize: '16px', fontWeight: 700, color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                {stats.totalOps}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase' }}>Volumen Total Stake</span>
              <div data-testid="total-invested-sum" style={{ fontSize: '16px', fontWeight: 700, color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                {`$${(stats.totalInvestedMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase', display: 'block', textAlign: 'right' }}>Resultado Neto Consolidado</span>
            <div
              data-testid="net-profit-sum"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                fontFamily: PRECISION_FONTS.mono,
                color: stats.netProfitMinor >= 0 ? PRECISION_COLORS.profit : PRECISION_COLORS.loss,
                textAlign: 'right',
              }}
              className="bm-tabular-nums"
            >
              {`${stats.netProfitMinor >= 0 ? '+' : '-'}$${Math.abs(stats.netProfitMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
          </div>
        </div>
      </div>
    </SecondaryLayout>
  );
}
