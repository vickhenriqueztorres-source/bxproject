import React, { useState } from 'react';
import type { Contract } from '../../api/client';
import { AssetFlagBadge } from '../header/AssetFlagBadge';

export interface BinmaxHistoryDrawerProps {
  contracts: Contract[];
  onClose?: () => void;
}

export const BinmaxHistoryDrawer: React.FC<BinmaxHistoryDrawerProps> = ({
  contracts,
  onClose,
}) => {
  const [filter, setFilter] = useState<'TODOS' | 'WIN' | 'LOSS'>('TODOS');

  const settled = contracts.filter((c) => c.status !== 'OPEN');
  const filtered = settled.filter((c) => {
    if (filter === 'WIN') return c.result === 'WIN';
    if (filter === 'LOSS') return c.result === 'LOSS';
    return true;
  });

  return (
    <div
      data-testid="binmax-history-drawer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: '#F4F5F7',
        fontFamily: "'Geist', sans-serif",
      }}
    >
      {/* Filtro de Resultado Dropdown Estilo Prancha 6 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#8A92A1', fontWeight: 600 }}>Filtrar:</span>
        <select
          data-testid="history-filter-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          style={{
            background: '#151922',
            border: '1px solid rgba(244, 245, 247, 0.12)',
            borderRadius: '6px',
            color: '#F4F5F7',
            padding: '4px 8px',
            fontSize: '11px',
            fontFamily: "'Geist', sans-serif",
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="TODOS">Resultado: Todos</option>
          <option value="WIN">Ganadas</option>
          <option value="LOSS">Perdidas</option>
        </select>
      </div>

      {/* Agrupador Temporal: Hoy */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#8A92A1',
          padding: '4px 0',
          borderBottom: '1px solid rgba(244, 245, 247, 0.06)',
          marginBottom: '8px',
        }}
      >
        Hoy
      </div>

      {/* Lista de Cards de Histórico (Sessão 6) */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#8A92A1', fontSize: '12px' }}>
          No hay operaciones en este filtro.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((c) => {
            const isWin = c.result === 'WIN';
            const isUp = c.direction === 'UP';
            const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor;
            const stakeDollars = Math.round(stake / 100);

            const payout = typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : (c.payout_minor ?? 0);
            const profitDollars = isWin ? ((payout - stake) / 100).toFixed(2) : stakeDollars.toFixed(2);
            const formattedResult = isWin ? `+$${profitDollars}` : `-$${profitDollars}`;

            const timeStr = new Date(c.created_at).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });

            const cleanSym = c.symbol.replace('_OTC', '').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');

            return (
              <div
                key={c.id}
                data-testid={`history-card-${c.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  background: 'rgba(21, 25, 34, 0.75)',
                  border: '1px solid rgba(244, 245, 247, 0.06)',
                  borderRadius: '6px',
                }}
              >
                {/* Lado Esquerdo: Bandeira + Ativo + Horário */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AssetFlagBadge symbol={c.symbol} size={18} />
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                    <strong style={{ fontSize: '11.5px', color: '#F4F5F7' }}>{cleanSym}</strong>
                    <span style={{ fontSize: '9px', color: '#8A92A1', fontFamily: "'Geist Mono', monospace" }}>
                      {timeStr}
                    </span>
                  </div>
                </div>

                {/* Centro: Tag SUBE/BAJA + Montante */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: isUp ? '#22C47A' : '#F2545B',
                    fontFamily: "'Geist Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  <span>{isUp ? '▲ SUBE' : '▼ BAJA'}</span>
                  <span style={{ color: '#DCE1EA' }}>${stakeDollars}</span>
                </div>

                {/* Lado Direito: Lucro/Prejuízo Consolidado */}
                <strong
                  data-testid={`history-result-${c.id}`}
                  style={{
                    fontSize: '12px',
                    color: isWin ? '#22C47A' : '#F2545B',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {formattedResult}
                </strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
