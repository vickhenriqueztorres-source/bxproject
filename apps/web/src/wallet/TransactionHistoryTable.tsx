import React, { useState } from 'react';

export interface Transaction {
  id: string;
  date: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  method: string;
  methodIcon: string;
  amountMinor: number;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
}

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', date: '08 oct 2024, 02:15', type: 'DEPOSIT', method: 'VISA', methodIcon: '💳', amountMinor: 50000, status: 'COMPLETED' },
  { id: 'tx-2', date: '06 oct 2024, 14:32', type: 'WITHDRAWAL', method: 'Banco', methodIcon: '🏛️', amountMinor: 25000, status: 'COMPLETED' },
  { id: 'tx-3', date: '03 oct 2024, 11:18', type: 'DEPOSIT', method: 'Mastercard', methodIcon: '💳', amountMinor: 100000, status: 'COMPLETED' },
  { id: 'tx-4', date: '28 sep 2024, 09:44', type: 'DEPOSIT', method: 'USDT', methodIcon: '₮', amountMinor: 30000, status: 'COMPLETED' },
  { id: 'tx-5', date: '25 sep 2024, 16:21', type: 'WITHDRAWAL', method: 'Banco', methodIcon: '🏛️', amountMinor: 15000, status: 'COMPLETED' },
  { id: 'tx-6', date: '20 sep 2024, 13:10', type: 'DEPOSIT', method: 'Skrill', methodIcon: '👛', amountMinor: 20000, status: 'COMPLETED' },
  { id: 'tx-7', date: '15 sep 2024, 10:05', type: 'DEPOSIT', method: 'BTC', methodIcon: '₿', amountMinor: 40000, status: 'COMPLETED' },
  { id: 'tx-8', date: '10 sep 2024, 18:47', type: 'WITHDRAWAL', method: 'Skrill', methodIcon: '👛', amountMinor: 30000, status: 'COMPLETED' },
  { id: 'tx-9', date: '02 sep 2024, 12:33', type: 'DEPOSIT', method: 'Mastercard', methodIcon: '💳', amountMinor: 25000, status: 'COMPLETED' },
  { id: 'tx-10', date: '28 ago 2024, 08:19', type: 'DEPOSIT', method: 'Banco', methodIcon: '🏛️', amountMinor: 10000, status: 'COMPLETED' },
];

export interface TransactionHistoryTableProps {
  transactions?: Transaction[];
}

export function TransactionHistoryTable({ transactions = INITIAL_TRANSACTIONS }: TransactionHistoryTableProps) {
  const [filter, setFilter] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filtered = transactions.filter((t) => {
    if (filter === 'deposits') return t.type === 'DEPOSIT';
    if (filter === 'withdrawals') return t.type === 'WITHDRAWAL';
    return true;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const pageIndex = Math.max(1, Math.min(currentPage, totalPages));
  const currentItems = filtered.slice((pageIndex - 1) * itemsPerPage, pageIndex * itemsPerPage);

  const formatAmount = (minor: number, type: 'DEPOSIT' | 'WITHDRAWAL') => {
    const dollars = (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return type === 'DEPOSIT' ? `+$${dollars}` : `-$${dollars}`;
  };

  return (
    <div
      data-testid="transaction-history-table-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        color: '#F4F5F7',
      }}
    >
      {/* Header com Título e Dropdown de Filtro */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#F4F5F7' }}>
          Historial de transacciones
        </h3>
        <select
          data-testid="history-filter-select"
          aria-label="Filtrar transacciones"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as any);
            setCurrentPage(1);
          }}
          style={{
            background: '#151922',
            border: '1px solid rgba(244, 245, 247, 0.12)',
            borderRadius: '6px',
            color: '#DCE1EA',
            padding: '4px 10px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all">Todos ▾</option>
          <option value="deposits">Depósitos</option>
          <option value="withdrawals">Retiros</option>
        </select>
      </div>

      {/* Tabela de Transações */}
      <div
        style={{
          border: '1px solid rgba(244, 245, 247, 0.08)',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#0D0F14',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(244, 245, 247, 0.08)', color: '#8A92A1', fontSize: '11px' }}>
              <th style={{ padding: '10px 12px', fontWeight: 500 }}>Fecha y hora</th>
              <th style={{ padding: '10px 12px', fontWeight: 500 }}>Tipo</th>
              <th style={{ padding: '10px 12px', fontWeight: 500 }}>Método</th>
              <th style={{ padding: '10px 12px', fontWeight: 500, textAlign: 'right' }}>Monto</th>
              <th style={{ padding: '10px 12px', fontWeight: 500, textAlign: 'center' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((tx) => {
              const isDeposit = tx.type === 'DEPOSIT';
              return (
                <tr
                  key={tx.id}
                  data-testid={`tx-row-${tx.id}`}
                  style={{
                    borderBottom: '1px solid rgba(244, 245, 247, 0.04)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ padding: '10px 12px', color: '#8A92A1', fontFamily: "'Geist Mono', monospace", fontSize: '11px' }}>
                    {tx.date}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isDeposit ? '#22C47A' : '#F2545B', fontWeight: 600 }}>
                      <span>{isDeposit ? '↓' : '↑'}</span>
                      <span>{isDeposit ? 'Depósito' : 'Retiro'}</span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#DCE1EA' }}>
                    <span style={{ marginRight: '6px' }}>{tx.methodIcon}</span>
                    <span>{tx.method}</span>
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 700,
                      color: isDeposit ? '#22C47A' : '#F2545B',
                    }}
                  >
                    {formatAmount(tx.amountMinor, tx.type)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: 600,
                        background: 'rgba(34, 196, 122, 0.15)',
                        color: '#22C47A',
                        border: '1px solid rgba(34, 196, 122, 0.3)',
                      }}
                    >
                      Completado
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação Inferior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          aria-label="Página anterior"
          disabled={pageIndex <= 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          style={{
            background: 'none',
            border: 'none',
            color: pageIndex <= 1 ? 'rgba(138, 146, 161, 0.4)' : '#DCE1EA',
            cursor: pageIndex <= 1 ? 'not-allowed' : 'pointer',
            padding: '4px 8px',
            fontSize: '12px',
          }}
        >
          ‹
        </button>

        {Array.from({ length: totalPages }).map((_, i) => {
          const pageNum = i + 1;
          const isActive = pageNum === pageIndex;
          return (
            <button
              key={pageNum}
              type="button"
              aria-label={`Página ${pageNum}`}
              onClick={() => setCurrentPage(pageNum)}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: isActive ? '#22C47A' : 'rgba(255, 255, 255, 0.04)',
                border: 'none',
                color: isActive ? '#0D0F14' : '#8A92A1',
                fontWeight: isActive ? 800 : 500,
                fontSize: '11px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          aria-label="Página siguiente"
          disabled={pageIndex >= totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          style={{
            background: 'none',
            border: 'none',
            color: pageIndex >= totalPages ? 'rgba(138, 146, 161, 0.4)' : '#DCE1EA',
            cursor: pageIndex >= totalPages ? 'not-allowed' : 'pointer',
            padding: '4px 8px',
            fontSize: '12px',
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
