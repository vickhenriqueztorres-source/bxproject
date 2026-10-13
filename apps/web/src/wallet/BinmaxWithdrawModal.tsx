import React, { useEffect, useRef, useState } from 'react';
import {
  IconCheckCircle,
  IconShield,
  IconClock,
  IconAlertCircle,
} from '../components/icons/PrecisionIcons';
import { PRECISION_SURFACES, PRECISION_COLORS } from '../lib/design-tokens';
import es from '../i18n/locales/es-ES.json';
import { requestWithdrawal, getWallet, type WithdrawMethod } from '../api/client';

export interface BinmaxWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalanceFormatted?: string;
  onWithdrawRequested?: (amount: number, address: string) => void;
}

export type { WithdrawMethod };

export function BinmaxWithdrawModal({
  isOpen,
  onClose,
  availableBalanceFormatted,
  onWithdrawRequested,
}: BinmaxWithdrawModalProps) {
  const [method, setMethod] = useState<WithdrawMethod>('PIX');
  const [amount, setAmount] = useState<number>(100);
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [realBalanceFormatted, setRealBalanceFormatted] = useState<string>(availableBalanceFormatted || '');

  useEffect(() => {
    if (isOpen) {
      if (!availableBalanceFormatted) {
        getWallet()
          .then((w) => {
            const dollars = (w.available_minor / 100).toFixed(2);
            setRealBalanceFormatted(`$${dollars}`);
          })
          .catch(() => {
            setRealBalanceFormatted(es.withdraw_demo.unavailable);
          });
      } else {
        setRealBalanceFormatted(availableBalanceFormatted);
      }
    } else {
      setIsLoading(false);
      setSuccess(false);
      setErrorMsg('');
      setTransactionId(null);
    }
  }, [isOpen, availableBalanceFormatted]);

  const handleClose = () => {
    setIsLoading(false);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || success) return;

    setErrorMsg('');

    if (amount < 50) {
      setErrorMsg('El monto mínimo de retiro es de $50.00');
      return;
    }

    if (!address.trim()) {
      setErrorMsg('Por favor, ingresa tu clave PIX, cuenta bancaria o dirección de cartera.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await requestWithdrawal({
        amount_minor: Math.round(amount * 100),
        method,
        destination_account: address.trim(),
      });
      setTransactionId(res.transaction?.id || null);
      if (onWithdrawRequested) onWithdrawRequested(amount, address);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : es.withdraw_demo.failure;
      setErrorMsg(msg === 'INSUFFICIENT_FUNDS' ? 'Saldo insuficiente para realizar el retiro' : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="binmax-withdraw-modal"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-modal-title"
    >
      <div
        className="bm-modal-scale"
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: PRECISION_SURFACES.panel,
          border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
          borderRadius: '8px',
          padding: '28px 24px',
          boxSizing: 'border-box',
          position: 'relative',
          color: PRECISION_COLORS.textPrimary,
          fontFamily: "'Geist', sans-serif",
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Botão Fechar X */}
        <button
          type="button"
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: PRECISION_COLORS.textSecondary,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
          }}
          aria-label="Cerrar retiro"
        >
          ✕
        </button>

        <h2
          id="withdraw-modal-title"
          style={{
            margin: '0 0 16px',
            fontSize: '22px',
            fontWeight: 800,
            color: PRECISION_COLORS.textPrimary,
            letterSpacing: '-0.01em',
          }}
        >
          Retirar fondos
        </h2>
        <p style={{ fontSize: '12px', lineHeight: 1.5 }}>{es.withdraw_demo.notice}</p>

        {success ? (
          /* ESTADO SUCESSO: SÓBRIO, CONFIRMAÇÃO DIRETA SEM CONFETES */
          <div data-testid="withdraw-success-state" style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 229, 153, 0.12)',
                color: PRECISION_COLORS.gain,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <IconCheckCircle size={28} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px', color: PRECISION_COLORS.textPrimary }}>
              {es.withdraw_demo.complete}
            </h3>
            <p style={{ fontSize: '13px', color: PRECISION_COLORS.textSecondary, lineHeight: 1.5, margin: '0 0 20px' }}>
              {es.withdraw_demo.complete_message}
            </p>

            <div
              style={{
                backgroundColor: PRECISION_SURFACES.bg,
                border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                borderRadius: '6px',
                padding: '14px',
                marginBottom: '20px',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                <span style={{ color: PRECISION_COLORS.textSecondary }}>{es.withdraw_demo.amount}</span>
                <span className="bm-tabular-nums" style={{ color: PRECISION_COLORS.textPrimary, fontWeight: 700 }}>
                  ${amount.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                <span style={{ color: PRECISION_COLORS.textSecondary }}>Comisión de retiro</span>
                <span className="bm-tabular-nums" style={{ color: PRECISION_COLORS.gain, fontWeight: 700 }}>
                  {es.withdraw_demo.fee}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: PRECISION_COLORS.textSecondary }}>Destino</span>
                <span className="bm-tabular-nums" style={{ color: PRECISION_COLORS.textPrimary }}>
                  {address.slice(0, 18)}...
                </span>
              </div>
              {transactionId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#8A96A8' }}>
                  <span>ID de transacción</span>
                  <span className="bm-tabular-nums" style={{ fontFamily: "'Geist Mono', monospace" }}>
                    {transactionId.slice(0, 13)}...
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="bm-btn-press"
              style={{
                width: '100%',
                backgroundColor: PRECISION_COLORS.gain,
                color: '#08140B',
                fontWeight: 700,
                fontSize: '14px',
                padding: '11px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Volver al terminal
            </button>
          </div>
        ) : (
          /* FORMULÁRIO DE RETIRADA DIRETO */
          <div>
            {/* Card de Saldo Disponível */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.bg,
                border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                borderRadius: '6px',
                padding: '14px',
                textAlign: 'center',
                marginBottom: '18px',
              }}
            >
              <div style={{ fontSize: '12px', color: PRECISION_COLORS.textSecondary, marginBottom: '2px' }}>
                Saldo disponible
              </div>
              <div
                className="bm-tabular-nums"
                style={{
                  fontSize: '26px',
                  fontWeight: 900,
                  color: PRECISION_COLORS.gain,
                }}
              >
                {realBalanceFormatted || availableBalanceFormatted || es.withdraw_demo.unavailable}
              </div>
            </div>

            <form onSubmit={handleWithdraw}>
              {errorMsg && (
                <div
                  className="bm-error-message"
                  style={{
                    backgroundColor: 'rgba(255, 59, 86, 0.1)',
                    border: `1px solid ${PRECISION_COLORS.loss}`,
                    borderRadius: '4px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <IconAlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Seletor de Método de Retiro (PIX em destaque) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: PRECISION_COLORS.textSecondary, marginBottom: '6px' }}>
                  Método de retiro
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setMethod('PIX')}
                    className="bm-btn-press"
                    style={{
                      backgroundColor: method === 'PIX' ? '#1A2A38' : PRECISION_SURFACES.field,
                      border: method === 'PIX' ? `1px solid ${PRECISION_COLORS.gain}` : `1px solid ${PRECISION_COLORS.borderSubtle}`,
                      borderRadius: '4px',
                      padding: '10px 6px',
                      color: PRECISION_COLORS.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800, color: PRECISION_COLORS.gain }}>⚡ PIX</span>
                    <span style={{ fontSize: '10px', color: PRECISION_COLORS.textSecondary }}>Instantáneo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('BANK')}
                    className="bm-btn-press"
                    style={{
                      backgroundColor: method === 'BANK' ? '#1A2A38' : PRECISION_SURFACES.field,
                      border: method === 'BANK' ? `1px solid ${PRECISION_COLORS.gain}` : `1px solid ${PRECISION_COLORS.borderSubtle}`,
                      borderRadius: '4px',
                      padding: '10px 6px',
                      color: PRECISION_COLORS.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <span>Banco</span>
                    <span style={{ fontSize: '10px', color: PRECISION_COLORS.textSecondary }}>1 a 24h</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('CRYPTO')}
                    className="bm-btn-press"
                    style={{
                      backgroundColor: method === 'CRYPTO' ? '#1A2A38' : PRECISION_SURFACES.field,
                      border: method === 'CRYPTO' ? `1px solid ${PRECISION_COLORS.gain}` : `1px solid ${PRECISION_COLORS.borderSubtle}`,
                      borderRadius: '4px',
                      padding: '10px 6px',
                      color: PRECISION_COLORS.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <span>Cripto</span>
                    <span style={{ fontSize: '10px', color: PRECISION_COLORS.textSecondary }}>Red rápida</span>
                  </button>
                </div>
              </div>

              {/* Campo Monto com Chips */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: PRECISION_COLORS.textSecondary, marginBottom: '6px' }}>
                  Monto a retirar
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="number"
                      min="50"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="bm-tabular-nums"
                      style={{
                        width: '100%',
                        backgroundColor: PRECISION_SURFACES.field,
                        border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                        borderRadius: '4px',
                        padding: '9px 12px 9px 26px',
                        color: PRECISION_COLORS.textPrimary,
                        fontSize: '15px',
                        fontWeight: 700,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: PRECISION_COLORS.textSecondary,
                        fontSize: '14px',
                      }}
                    >
                      $
                    </span>
                  </div>

                  {[50, 100, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className="bm-btn-press bm-tabular-nums"
                      style={{
                        backgroundColor: amount === val ? '#1A2A38' : PRECISION_SURFACES.field,
                        border: amount === val ? `1px solid ${PRECISION_COLORS.gain}` : `1px solid ${PRECISION_COLORS.borderSubtle}`,
                        color: amount === val ? PRECISION_COLORS.gain : PRECISION_COLORS.textPrimary,
                        fontWeight: 700,
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Mínimo de retiro: $50.00</div>
              </div>

              {/* Campo Chave PIX ou Carteira */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: PRECISION_COLORS.textSecondary, marginBottom: '6px' }}>
                  {method === 'PIX' ? 'Clave PIX (CPF, Email, Teléfono o Aleatoria)' : 'Dirección de destino / cuenta bancaria'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={method === 'PIX' ? '123.456.789-00' : 'Número de cuenta o dirección'}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: PRECISION_SURFACES.field,
                    border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                    borderRadius: '4px',
                    padding: '10px 12px',
                    color: PRECISION_COLORS.textPrimary,
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Aviso de Transparência Sem Rollover Obscuro */}
              <div
                style={{
                  backgroundColor: PRECISION_SURFACES.bg,
                  border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                  borderRadius: '4px',
                  padding: '10px 12px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <IconShield size={16} />
                <div style={{ fontSize: '11px', color: PRECISION_COLORS.textSecondary, lineHeight: 1.4 }}>
                  {es.withdraw_demo.kyc}
                </div>
              </div>

              {/* Botão Solicitar Retiro Sóbrio */}
              <button
                type="submit"
                disabled={isLoading}
                className="bm-btn-press"
                style={{
                  width: '100%',
                  backgroundColor: PRECISION_COLORS.gain,
                  color: '#08140B',
                  fontWeight: 700,
                  fontSize: '14px',
                  padding: '12px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.75 : 1,
                  marginBottom: '18px',
                }}
              >
                {isLoading ? es.withdraw_demo.processing : es.withdraw_demo.action}
              </button>
            </form>
            <p style={{ fontSize: '12px', lineHeight: 1.5 }}>{es.withdraw_demo.last_withdraw}: {es.withdraw_demo.unavailable}</p>
          </div>
        )}
      </div>
    </div>
  );
}
