import React, { useState } from 'react';

export type TurboPaymentMethod = 'pix' | 'tarjeta' | 'usdt';

export interface TurboDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amountUsd: number) => void;
  onResetDemo?: () => void;
}

export const PRESET_AMOUNTS = [20, 50, 100, 200];

export const TurboDepositModal: React.FC<TurboDepositModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onResetDemo,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<TurboPaymentMethod>('pix');
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleContinue = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setCompletedMessage(`¡Depósito de $${selectedAmount} USD iniciado con éxito!`);
      if (onResetDemo) {
        onResetDemo();
      }
      if (onSuccess) {
        onSuccess(selectedAmount);
      }
      setTimeout(() => {
        setCompletedMessage(null);
        onClose();
      }, 1200);
    }, 400);
  };

  return (
    <div
      data-testid="turbo-deposit-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 2500,
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-testid="turbo-deposit-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#151922',
          border: '1px solid rgba(244, 245, 247, 0.12)',
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#F4F5F7',
          animation: 'fadeInModal 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header do Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(244, 245, 247, 0.08)',
          }}
        >
          <h3
            data-testid="deposit-modal-title"
            style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 700,
              color: '#F4F5F7',
              letterSpacing: '-0.2px',
            }}
          >
            Depositar
          </h3>
          <button
            type="button"
            data-testid="deposit-modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8A92A1',
              fontSize: '18px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '4px',
              transition: 'color 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Corpo do Modal */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {completedMessage ? (
            <div
              data-testid="deposit-success-banner"
              style={{
                background: 'rgba(34, 196, 122, 0.15)',
                border: '1px solid #22C47A',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                color: '#22C47A',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              ✓ {completedMessage}
            </div>
          ) : (
            <>
              {/* Lista de Métodos de Pagamento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 1. PIX */}
                <div
                  data-testid="payment-method-pix"
                  onClick={() => setSelectedMethod('pix')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: selectedMethod === 'pix' ? 'rgba(34, 196, 122, 0.08)' : '#1B2230',
                    border:
                      selectedMethod === 'pix'
                        ? '1px solid #22C47A'
                        : '1px solid rgba(244, 245, 247, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: 'rgba(50, 188, 173, 0.15)',
                        border: '1px solid rgba(50, 188, 173, 0.3)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#32BCAD',
                        fontWeight: 800,
                        fontSize: '11px',
                        flexShrink: 0,
                      }}
                    >
                      PIX
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#F4F5F7' }}>PIX</span>
                      <span style={{ fontSize: '11px', color: '#8A92A1' }}>Mínimo $10</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '15px', color: '#8A92A1', fontWeight: 600 }}>›</span>
                </div>

                {/* 2. Tarjeta */}
                <div
                  data-testid="payment-method-tarjeta"
                  onClick={() => setSelectedMethod('tarjeta')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: selectedMethod === 'tarjeta' ? 'rgba(34, 196, 122, 0.08)' : '#1B2230',
                    border:
                      selectedMethod === 'tarjeta'
                        ? '1px solid #22C47A'
                        : '1px solid rgba(244, 245, 247, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: 'rgba(255, 171, 0, 0.15)',
                        border: '1px solid rgba(255, 171, 0, 0.3)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ffab00',
                        fontSize: '16px',
                        flexShrink: 0,
                      }}
                    >
                      💳
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#F4F5F7' }}>Tarjeta</span>
                      <span style={{ fontSize: '11px', color: '#8A92A1' }}>Mínimo $10</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '15px', color: '#8A92A1', fontWeight: 600 }}>›</span>
                </div>

                {/* 3. Cripto (USDT) */}
                <div
                  data-testid="payment-method-usdt"
                  onClick={() => setSelectedMethod('usdt')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: selectedMethod === 'usdt' ? 'rgba(34, 196, 122, 0.08)' : '#1B2230',
                    border:
                      selectedMethod === 'usdt'
                        ? '1px solid #22C47A'
                        : '1px solid rgba(244, 245, 247, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: 'rgba(38, 161, 123, 0.15)',
                        border: '1px solid rgba(38, 161, 123, 0.3)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#26A17B',
                        fontWeight: 800,
                        fontSize: '15px',
                        flexShrink: 0,
                      }}
                    >
                      ₮
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#F4F5F7' }}>Cripto (USDT)</span>
                      <span style={{ fontSize: '11px', color: '#8A92A1' }}>Mínimo $10</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '15px', color: '#8A92A1', fontWeight: 600 }}>›</span>
                </div>
              </div>

              {/* Seletor de Monto (Presets $20, $50, $100, $200) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#8A92A1',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Monto
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {PRESET_AMOUNTS.map((amt) => {
                    const isSelected = selectedAmount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        data-testid={`amount-pill-${amt}`}
                        onClick={() => setSelectedAmount(amt)}
                        style={{
                          padding: '10px 0',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(34, 196, 122, 0.15)' : '#1B2230',
                          border: isSelected ? '1px solid #22C47A' : '1px solid rgba(244, 245, 247, 0.08)',
                          color: isSelected ? '#22C47A' : '#F4F5F7',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          fontFamily: "'Geist Mono', monospace",
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {`$${amt}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botão de Ação: Continuar */}
              <button
                type="button"
                data-testid="turbo-deposit-continue-btn"
                onClick={handleContinue}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: '8px',
                  background: isProcessing
                    ? '#163326'
                    : 'linear-gradient(135deg, #22C47A 0%, #1CA866 100%)',
                  border: 'none',
                  color: isProcessing ? '#8A92A1' : '#0B0E14',
                  fontWeight: 800,
                  fontSize: '14px',
                  letterSpacing: '0.3px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: isProcessing ? 'none' : '0 4px 14px rgba(34, 196, 122, 0.35)',
                  transition: 'all 0.15s ease',
                  marginTop: '4px',
                }}
              >
                {isProcessing ? 'Procesando...' : 'Continuar'}
              </button>
            </>
          )}

          {/* Rodapé de Segurança */}
          <div
            data-testid="turbo-deposit-security-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: '#8A92A1',
              fontSize: '11px',
              paddingTop: '4px',
            }}
          >
            <span>🔒</span>
            <span>Tus pagos son procesados de forma segura</span>
          </div>
        </div>
      </div>
    </div>
  );
};
