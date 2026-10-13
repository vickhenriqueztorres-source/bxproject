import React, { useEffect, useState } from 'react';
import { DepositForm } from './DepositForm';
import { TransactionHistoryTable, INITIAL_TRANSACTIONS, type Transaction } from './TransactionHistoryTable';

export interface BilleteraModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableMinor?: number | null;
  onResetDemo?: () => void;
}

export function BilleteraModal({
  isOpen,
  onClose,
  availableMinor = 0,
  onResetDemo,
}: BilleteraModalProps) {
  const [activeTab, setActiveTab] = useState<'depositar' | 'metodos' | 'historial'>('depositar');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedBalance = availableMinor !== null && availableMinor !== undefined
    ? `$${(availableMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';

  const handleDepositSuccess = (amountUsd: number) => {
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      type: 'DEPOSIT',
      method: 'Tarjeta',
      methodIcon: '💳',
      amountMinor: amountUsd * 100,
      status: 'COMPLETED',
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  return (
    <div
      data-testid="billetera-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        data-testid="billetera-modal-content"
        className="billetera-view"
        style={{
          background: '#0D0F14',
          border: '1px solid rgba(244, 245, 247, 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          color: '#F4F5F7',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Superior: Título + Saldos + Botão Fechar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 28px 20px',
            borderBottom: '1px solid rgba(244, 245, 247, 0.08)',
          }}
        >
          <div>
            <h2
              data-testid="billetera-title"
              style={{
                margin: 0,
                fontSize: '26px',
                fontWeight: 800,
                color: '#F4F5F7',
                letterSpacing: '-0.5px',
              }}
            >
              Billetera
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '13px',
                color: '#8A92A1',
              }}
            >
              Gestiona tus fondos, deposita y consulta tu historial de transacciones.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Card Saldo disponible */}
            <div
              data-testid="card-saldo-disponible"
              style={{
                background: '#151922',
                border: '1px solid rgba(244, 245, 247, 0.08)',
                borderRadius: '10px',
                padding: '10px 16px',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '11px', color: '#8A92A1', fontWeight: 500 }}>
                Saldo disponible
              </div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: '#22C47A',
                  fontFamily: "'Geist Mono', monospace",
                  marginTop: '2px',
                }}
              >
                {formattedBalance}
              </div>
            </div>

            {/* Card Saldo en operaciones */}
            <div
              data-testid="card-saldo-operaciones"
              style={{
                background: '#151922',
                border: '1px solid rgba(244, 245, 247, 0.08)',
                borderRadius: '10px',
                padding: '10px 16px',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '11px', color: '#8A92A1', fontWeight: 500 }}>
                Saldo en operaciones <span style={{ opacity: 0.6 }}>ⓘ</span>
              </div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#F4F5F7',
                  fontFamily: "'Geist Mono', monospace",
                  marginTop: '2px',
                }}
              >
                $0.00
              </div>
            </div>

            {/* Botão Fechar */}
            <button
              type="button"
              data-testid="btn-close-billetera"
              aria-label="Cerrar Billetera"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                color: '#DCE1EA',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                marginLeft: '8px',
                transition: 'background 0.15s ease',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Abas Horizontais: Depositar / Métodos de pago / Historial */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            padding: '0 28px',
            borderBottom: '1px solid rgba(244, 245, 247, 0.08)',
            background: '#11141C',
          }}
        >
          <button
            type="button"
            data-testid="tab-depositar"
            onClick={() => setActiveTab('depositar')}
            style={{
              padding: '14px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'depositar' ? '2px solid #22C47A' : '2px solid transparent',
              color: activeTab === 'depositar' ? '#22C47A' : '#8A92A1',
              fontWeight: activeTab === 'depositar' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📥</span>
            <span>Depositar</span>
          </button>

          <button
            type="button"
            data-testid="tab-metodos"
            onClick={() => setActiveTab('metodos')}
            style={{
              padding: '14px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'metodos' ? '2px solid #22C47A' : '2px solid transparent',
              color: activeTab === 'metodos' ? '#22C47A' : '#8A92A1',
              fontWeight: activeTab === 'metodos' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>💳</span>
            <span>Métodos de pago</span>
          </button>

          <button
            type="button"
            data-testid="tab-historial"
            onClick={() => setActiveTab('historial')}
            style={{
              padding: '14px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'historial' ? '2px solid #22C47A' : '2px solid transparent',
              color: activeTab === 'historial' ? '#22C47A' : '#8A92A1',
              fontWeight: activeTab === 'historial' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🕒</span>
            <span>Historial</span>
          </button>
        </div>

        {/* Conteúdo Dinâmico com Rolagem Interna Suave */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
          }}
        >
          {activeTab === 'depositar' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.25fr',
                gap: '32px',
                alignItems: 'start',
              }}
            >
              {/* Coluna Esquerda: Formulário de Depósito em 3 Passos */}
              <DepositForm
                onSuccess={handleDepositSuccess}
                onResetDemo={onResetDemo}
              />

              {/* Coluna Direita: Tabela de Histórico de Transações */}
              <TransactionHistoryTable transactions={transactions} />
            </div>
          )}

          {activeTab === 'metodos' && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#8A92A1' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div>
              <h4 style={{ color: '#F4F5F7', margin: '0 0 8px' }}>Tus métodos guardados</h4>
              <p style={{ fontSize: '13px', maxWidth: '400px', margin: '0 auto' }}>
                Guarda tus tarjetas de crédito o billeteras cripto para depósitos y retiros en un clic con protección biométrica.
              </p>
            </div>
          )}

          {activeTab === 'historial' && (
            <TransactionHistoryTable transactions={transactions} />
          )}
        </div>
      </div>
    </div>
  );
}
