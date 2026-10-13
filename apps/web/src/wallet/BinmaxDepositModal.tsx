import React, { useState, useEffect } from 'react';
import { PaymentErrorModal } from '../components/status/PaymentErrorModal';
import { requestDeposit, confirmDeposit, type DepositMethod } from '../api/client';

export interface BinmaxDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositSuccess?: (amountUsd: number) => void;
}

export type { DepositMethod };

export function BinmaxDepositModal({
  isOpen,
  onClose,
  onDepositSuccess,
}: BinmaxDepositModalProps) {
  const [screen, setScreen] = useState<'SELECT' | 'PAY_PIX' | 'ERROR'>('SELECT');
  const [method, setMethod] = useState<DepositMethod>('PIX');
  const [amount, setAmount] = useState<number>(100);
  const [pixTimeRemaining, setPixTimeRemaining] = useState(1798); // 29m 58s
  const [pixCopied, setPixCopied] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState<string>(
    '00020126580014BR.GOV.BCB.PIX0136a1b2c3d4-e5f6-7890-abcd-ef12345678905204000053039865802BR5912 BINMAX LTDA6009SAO PAULO62070503***6304A1B2'
  );

  // Timer de Expiração do PIX (29:58)
  useEffect(() => {
    if (screen !== 'PAY_PIX' || isConfirmed) return;

    const timer = setInterval(() => {
      setPixTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [screen, isConfirmed]);

  const handleConfirmPayment = async () => {
    if (isSubmitting || isConfirmed) return;
    setIsSubmitting(true);
    try {
      if (transactionId) {
        await confirmDeposit(transactionId);
      }
      setIsConfirmed(true);
      if (onDepositSuccess) onDepositSuccess(amount);
    } catch (err) {
      console.error('[Deposit Confirmation Error]', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyPix = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(pixPayload);
    }
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2500);
  };

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (method === 'PIX') {
        const res = await requestDeposit({
          amount_minor: Math.round(amount * 100),
          method: 'PIX',
        });
        if (res.transaction?.id) {
          setTransactionId(res.transaction.id);
        }
        if (res.transaction?.pix_code) {
          setPixPayload(res.transaction.pix_code);
        }
        setScreen('PAY_PIX');
      } else {
        // Métodos com tela de erro de simulação
        setScreen('ERROR');
      }
    } catch (err) {
      console.error('[Deposit Request Error]', err);
      setScreen('ERROR');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="binmax-deposit-modal"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.78)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deposit-modal-title"
    >
      {/* TELA DE ERRO DE PAGAMENTO */}
      {screen === 'ERROR' ? (
        <PaymentErrorModal
          isOpen={true}
          onClose={onClose}
          onRetry={() => setScreen('SELECT')}
          onChangeMethod={() => {
            setMethod('PIX');
            setScreen('SELECT');
          }}
          paymentMethodLabel={
            method === 'CARD' ? 'Tarjeta terminada en 4242' : 'Cripto USDT TRC-20'
          }
          amountFormatted={`$${amount.toFixed(2)}`}
        />
      ) : (
        /* CONTEÚDO PRINCIPAL (520px) */
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
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65)',
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
            aria-label="Cerrar depósito"
          >
            ✕
          </button>

          {/* TELA 1: SELEÇÃO DE MÉTODO E VALOR */}
          {screen === 'SELECT' && (
            <div>
              <h2
                id="deposit-modal-title"
                style={{
                  margin: '0 0 6px',
                  fontSize: '24px',
                  fontWeight: 800,
                  color: '#E6EDF5',
                }}
              >
                Depositar
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#8A96A8' }}>
                Elige un método de pago y realiza tu depósito para continuar operando.
              </p>

              {/* 3 Métodos de Pagamento em Cartões */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  marginBottom: '24px',
                }}
              >
                {/* PIX */}
                <button
                  type="button"
                  onClick={() => setMethod('PIX')}
                  style={{
                    backgroundColor: method === 'PIX' ? '#14233A' : '#0B1220',
                    border: method === 'PIX' ? '2px solid #22C55E' : '1px solid #1F2A3A',
                    borderRadius: '8px',
                    padding: '16px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        border: method === 'PIX' ? '2px solid #22C55E' : '1px solid #8A96A8',
                        backgroundColor: method === 'PIX' ? '#22C55E' : 'transparent',
                        display: 'block',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '24px' }}>💠</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#E6EDF5' }}>PIX</div>
                  <div style={{ fontSize: '11px', color: '#8A96A8' }}>Mínimo $10</div>
                  <div style={{ fontSize: '11px', color: '#22C55E', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span>⚡</span>
                    <span>Instantáneo</span>
                  </div>
                </button>

                {/* Tarjeta */}
                <button
                  type="button"
                  onClick={() => setMethod('CARD')}
                  style={{
                    backgroundColor: method === 'CARD' ? '#14233A' : '#0B1220',
                    border: method === 'CARD' ? '2px solid #22C55E' : '1px solid #1F2A3A',
                    borderRadius: '8px',
                    padding: '16px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        border: method === 'CARD' ? '2px solid #22C55E' : '1px solid #8A96A8',
                        backgroundColor: method === 'CARD' ? '#22C55E' : 'transparent',
                        display: 'block',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '24px' }}>💳</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#E6EDF5' }}>Tarjeta</div>
                  <div style={{ fontSize: '11px', color: '#8A96A8' }}>Mínimo $10</div>
                  <div style={{ fontSize: '11px', color: '#22C55E', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span>⚡</span>
                    <span>Instantáneo</span>
                  </div>
                </button>

                {/* Cripto */}
                <button
                  type="button"
                  onClick={() => setMethod('CRYPTO')}
                  style={{
                    backgroundColor: method === 'CRYPTO' ? '#14233A' : '#0B1220',
                    border: method === 'CRYPTO' ? '2px solid #22C55E' : '1px solid #1F2A3A',
                    borderRadius: '8px',
                    padding: '16px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        border: method === 'CRYPTO' ? '2px solid #22C55E' : '1px solid #8A96A8',
                        backgroundColor: method === 'CRYPTO' ? '#22C55E' : 'transparent',
                        display: 'block',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '24px' }}>₮</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#E6EDF5' }}>Cripto (USDT)</div>
                  <div style={{ fontSize: '11px', color: '#8A96A8' }}>Mínimo $10</div>
                  <div style={{ fontSize: '11px', color: '#8A96A8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span>🕒</span>
                    <span>Hasta 10 min</span>
                  </div>
                </button>
              </div>

              {/* Campo Monto e Chips Rápidos */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#8A96A8', marginBottom: '8px' }}>
                  Monto
                </label>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(10, Number(e.target.value)))}
                    style={{
                      width: '100%',
                      backgroundColor: '#0B1220',
                      border: '1px solid #1F2A3A',
                      borderRadius: '6px',
                      padding: '12px 14px 12px 32px',
                      color: '#E6EDF5',
                      fontSize: '18px',
                      fontWeight: 700,
                      fontFamily: "'Geist Mono', monospace",
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#8A96A8',
                      fontSize: '16px',
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    $
                  </span>
                </div>

                {/* Chips Rápidos: $20, $50, $100, $250, $500 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[20, 50, 100, 250, 500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      style={{
                        flex: 1,
                        backgroundColor: amount === val ? '#1F2A3A' : '#0B1220',
                        border: amount === val ? '1px solid #22C55E' : '1px solid #1F2A3A',
                        color: amount === val ? '#22C55E' : '#E6EDF5',
                        fontWeight: 700,
                        fontSize: '13px',
                        fontFamily: "'Geist Mono', monospace",
                        padding: '8px 0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {`$${val}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumo: Recibes $100.00 · Sin comisión */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderTop: '1px solid #1F2A3A',
                  fontSize: '13px',
                  color: '#8A96A8',
                }}
              >
                <div>
                  {'Recibes '}
                  <strong
                    style={{
                      color: '#22C55E',
                      fontSize: '16px',
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    {`$${amount.toFixed(2)}`}
                  </strong>
                </div>
                <div>· Sin comisión</div>
              </div>

              {/* Bônus de Boas-Vindas Discreto */}
              <div
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.06)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#22C55E',
                }}
              >
                <span>🎁</span>
                <span>Bono de bienvenida +30% aplicado</span>
              </div>

              {/* Botão Verde Continuar */}
              <button
                type="button"
                onClick={handleContinue}
                style={{
                  width: '100%',
                  backgroundColor: '#22C55E',
                  color: '#08140B',
                  fontWeight: 700,
                  fontSize: '15px',
                  padding: '13px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                Continuar
              </button>

              {/* Rodapé: Pagos procesados por proveedor seguro */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#64748B',
                }}
              >
                <span>🔒</span>
                <span>Pagos procesados por proveedor seguro</span>
              </div>
            </div>
          )}

          {/* TELA 2: PAGAMENTO PIX COM QR CODE E TIMER */}
          {screen === 'PAY_PIX' && (
            <div>
              {/* Stepper */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  color: '#8A96A8',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#1F2A3A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: '#E6EDF5',
                    }}
                  >
                    1
                  </span>
                  <span>Método de pago: PIX</span>
                </div>
                <span>→</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22C55E' }}>
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#22C55E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: '#08140B',
                      fontWeight: 700,
                    }}
                  >
                    2
                  </span>
                  <span>Realiza el pago</span>
                </div>
              </div>

              {/* Título */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '28px' }}>💠</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#E6EDF5' }}>
                    Paga con PIX
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#8A96A8' }}>
                    Escanea el código QR o copia el código PIX para realizar el pago desde tu banco o app.
                  </p>
                </div>
              </div>

              {/* Grid: QR Code e Timer */}
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
                {/* QR Code Container */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}
                >
                  <svg width="130" height="130" viewBox="0 0 100 100" fill="#000000">
                    {/* Mock Estilizado de QR Code Oficial */}
                    <rect x="0" y="0" width="30" height="30" fill="#000" />
                    <rect x="5" y="5" width="20" height="20" fill="#fff" />
                    <rect x="10" y="10" width="10" height="10" fill="#000" />

                    <rect x="70" y="0" width="30" height="30" fill="#000" />
                    <rect x="75" y="5" width="20" height="20" fill="#fff" />
                    <rect x="80" y="10" width="10" height="10" fill="#000" />

                    <rect x="0" y="70" width="30" height="30" fill="#000" />
                    <rect x="5" y="75" width="20" height="20" fill="#fff" />
                    <rect x="10" y="80" width="10" height="10" fill="#000" />

                    <rect x="40" y="10" width="10" height="10" fill="#000" />
                    <rect x="50" y="20" width="10" height="10" fill="#000" />
                    <rect x="35" y="45" width="30" height="10" fill="#000" />
                    <rect x="40" y="60" width="20" height="10" fill="#000" />
                    <rect x="70" y="40" width="10" height="20" fill="#000" />
                    <rect x="80" y="70" width="20" height="20" fill="#000" />
                  </svg>
                </div>

                {/* Card de Esperando Pago e Timer */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      backgroundColor: '#0B1220',
                      border: '1px solid #1F2A3A',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        color: '#EAB308',
                        fontSize: '13px',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      <span>🕒</span>
                      <span>Esperando pago</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#8A96A8', marginBottom: '10px' }}>
                      Realiza el pago para que tu depósito sea acreditado automáticamente.
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>
                      Expira en
                    </div>
                    <div
                      style={{
                        fontSize: '26px',
                        fontWeight: 900,
                        fontFamily: "'Geist Mono', monospace",
                        color: '#E6EDF5',
                      }}
                    >
                      {formatTimer(pixTimeRemaining)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Caixa de Código Copia y Pega */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: '#8A96A8', marginBottom: '6px' }}>
                  Código PIX (Copia y pega)
                </div>
                <div
                  style={{
                    backgroundColor: '#0B1220',
                    border: '1px solid #1F2A3A',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: "'Geist Mono', monospace",
                      color: '#8A96A8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pixPayload}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    style={{
                      backgroundColor: pixCopied ? '#22C55E' : '#1F2A3A',
                      color: pixCopied ? '#08140B' : '#E6EDF5',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {pixCopied ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Status de Confirmação Automática */}
              {isConfirmed ? (
                <div
                  data-testid="pix-confirmed-banner"
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid #22C55E',
                    borderRadius: '6px',
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#22C55E',
                      color: '#08140B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '14px',
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#22C55E' }}>
                      Pago confirmado
                    </div>
                    <div style={{ fontSize: '12px', color: '#E6EDF5' }}>
                      Tu depósito está siendo acreditado. Saldo actualizado en tu cuenta.
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="btn-confirm-deposit"
                  disabled={isSubmitting}
                  onClick={handleConfirmPayment}
                  style={{
                    width: '100%',
                    backgroundColor: '#1F2A3A',
                    color: isSubmitting ? '#64748B' : '#8A96A8',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    marginBottom: '16px',
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? 'Verificando pago...' : 'Simular confirmación bancaria inmediata →'}
                </button>
              )}

              {/* Voltar ao Início do Modal */}
              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setScreen('SELECT')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8A96A8',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Cambiar método o monto
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
