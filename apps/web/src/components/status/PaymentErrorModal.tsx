import React from 'react';

export interface PaymentErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onChangeMethod: () => void;
  paymentMethodLabel?: string;
  amountFormatted?: string;
  errorMessage?: string;
}

export function PaymentErrorModal({
  isOpen,
  onClose,
  onRetry,
  onChangeMethod,
  paymentMethodLabel = 'Mastercard terminada en 4242',
  amountFormatted = '$100.00',
  errorMessage = 'Hubo un problema con tu transacción. Por favor, inténtalo de nuevo o elige otro método de pago.',
}: PaymentErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div
      data-testid="payment-error-modal"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-error-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#111A2B',
          border: '1px solid #1F2A3A',
          borderRadius: '8px',
          padding: '28px 24px',
          boxSizing: 'border-box',
          position: 'relative',
          color: '#E6EDF5',
          fontFamily: "'Geist', sans-serif",
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Botão de Fechar X */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#8A96A8',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
          }}
          aria-label="Cerrar modal"
        >
          ✕
        </button>

        {/* Título e Subtítulo */}
        <h2
          id="payment-error-title"
          style={{
            margin: '0 0 6px',
            fontSize: '22px',
            fontWeight: 800,
            color: '#E6EDF5',
          }}
        >
          Depositar
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#8A96A8', lineHeight: 1.4 }}>
          Añade fondos a tu cuenta para empezar a operar en la sala de trading.
        </p>

        {/* Stepper de 3 passos */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            position: 'relative',
          }}
        >
          {/* Passo 1 - Concluído */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: '#38BDF8',
                color: '#08140B',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✓
            </div>
            <span style={{ fontSize: '11px', color: '#E6EDF5' }}>Método de pago</span>
          </div>

          {/* Linha conectora 1 */}
          <div
            style={{
              position: 'absolute',
              top: '13px',
              left: '18%',
              right: '50%',
              height: '1px',
              backgroundColor: '#1F2A3A',
              zIndex: 1,
            }}
          />

          {/* Passo 2 - Atual/Erro */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: '1px solid #EF4444',
                color: '#EF4444',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#111A2B',
              }}
            >
              2
            </div>
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>Detalles</span>
          </div>

          {/* Linha conectora 2 */}
          <div
            style={{
              position: 'absolute',
              top: '13px',
              left: '50%',
              right: '18%',
              height: '1px',
              backgroundColor: '#1F2A3A',
              zIndex: 1,
            }}
          />

          {/* Passo 3 - Pendente */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: '1px solid #1F2A3A',
                color: '#8A96A8',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#111A2B',
              }}
            >
              3
            </div>
            <span style={{ fontSize: '11px', color: '#8A96A8' }}>Confirmación</span>
          </div>
        </div>

        {/* Card Vermelho de Erro */}
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            gap: '14px',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            !
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#EF4444', marginBottom: '4px' }}>
              No pudimos procesar tu pago
            </div>
            <div style={{ fontSize: '13px', color: '#E6EDF5', lineHeight: 1.4 }}>
              {errorMessage}
            </div>
          </div>
        </div>

        {/* Resumo da Operação */}
        <div
          style={{
            backgroundColor: '#0B1220',
            border: '1px solid #1F2A3A',
            borderRadius: '6px',
            padding: '14px 16px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#8A96A8' }}>Método de pago</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#E6EDF5', fontWeight: 600 }}>💳 {paymentMethodLabel}</span>
              <button
                type="button"
                onClick={onChangeMethod}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38BDF8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Cambiar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#8A96A8' }}>Importe</span>
            <span
              style={{
                color: '#E6EDF5',
                fontWeight: 700,
                fontFamily: "'Geist Mono', monospace",
                fontSize: '15px',
              }}
            >
              {amountFormatted}
            </span>
          </div>
        </div>

        {/* Ações: Intentar de Nuevo & Cambiar Método */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              width: '100%',
              backgroundColor: '#22C55E',
              color: '#08140B',
              border: 'none',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Intentar de nuevo</span>
            <span>→</span>
          </button>

          <button
            type="button"
            onClick={onChangeMethod}
            style={{
              background: 'none',
              border: 'none',
              color: '#38BDF8',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Cambiar método
          </button>
        </div>
      </div>
    </div>
  );
}
