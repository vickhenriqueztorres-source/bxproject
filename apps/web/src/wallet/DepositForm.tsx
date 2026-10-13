import React, { useState } from 'react';

export type PaymentMethodType = 'card' | 'bank' | 'crypto' | 'wallet';

export interface DepositFormProps {
  onSuccess?: (amountUsd: number) => void;
  onResetDemo?: () => void;
}

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000, 5000];

export function DepositForm({ onSuccess, onResetDemo }: DepositFormProps) {
  const [method, setMethod] = useState<PaymentMethodType>('card');
  const [selectedPreset, setSelectedPreset] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('100');
  const [cardNumber, setCardNumber] = useState('1234 5678 9012 3456');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('123');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const currentAmount = Number(customAmount) || selectedPreset;

  const handleSelectPreset = (val: number) => {
    setSelectedPreset(val);
    setCustomAmount(String(val));
    setErrorMsg('');
  };

  const handleCustomChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setCustomAmount(clean);
    const parsed = Number(clean);
    setSelectedPreset(PRESET_AMOUNTS.includes(parsed) ? parsed : 0);
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!currentAmount || currentAmount < 10 || currentAmount > 10000) {
      setErrorMsg('El monto debe estar entre $10 y $10,000 USD.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    setTimeout(() => {
      setSubmitting(false);
      setSuccessMsg(`¡Depósito de $${currentAmount.toLocaleString()} USD acreditado con éxito!`);
      if (onResetDemo) onResetDemo();
      if (onSuccess) onSuccess(currentAmount);
    }, 400);
  };

  return (
    <form
      data-testid="deposit-form"
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        color: '#F4F5F7',
      }}
    >
      {/* 1. Selecciona un método de pago */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#DCE1EA' }}>
          1. Selecciona un método de pago
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Opção 1: Tarjeta de crédito / débito */}
          <div
            data-testid="method-card"
            onClick={() => setMethod('card')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#151922',
              border: method === 'card' ? '1px solid #22C47A' : '1px solid rgba(244, 245, 247, 0.08)',
              cursor: 'pointer',
              transition: 'border 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: method === 'card' ? '5px solid #22C47A' : '2px solid rgba(138, 146, 161, 0.5)',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '18px' }}>💳</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F4F5F7' }}>
                  Tarjeta de crédito / débito
                </div>
                <div style={{ fontSize: '11px', color: '#8A92A1' }}>
                  Visa, Mastercard, Maestro
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: '#DCE1EA' }}>VISA</span>
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: '#FF5F00' }}>mastercard</span>
            </div>
          </div>

          {/* Opção 2: Transferencia bancaria */}
          <div
            data-testid="method-bank"
            onClick={() => setMethod('bank')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#151922',
              border: method === 'bank' ? '1px solid #22C47A' : '1px solid rgba(244, 245, 247, 0.08)',
              cursor: 'pointer',
              transition: 'border 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: method === 'bank' ? '5px solid #22C47A' : '2px solid rgba(138, 146, 161, 0.5)',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '18px' }}>🏛️</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F4F5F7' }}>
                  Transferencia bancaria
                </div>
                <div style={{ fontSize: '11px', color: '#8A92A1' }}>
                  Transferencia local o internacional
                </div>
              </div>
            </div>
          </div>

          {/* Opção 3: Criptomonedas */}
          <div
            data-testid="method-crypto"
            onClick={() => setMethod('crypto')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#151922',
              border: method === 'crypto' ? '1px solid #22C47A' : '1px solid rgba(244, 245, 247, 0.08)',
              cursor: 'pointer',
              transition: 'border 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: method === 'crypto' ? '5px solid #22C47A' : '2px solid rgba(138, 146, 161, 0.5)',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '18px' }}>₿</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F4F5F7' }}>
                  Criptomonedas
                </div>
                <div style={{ fontSize: '11px', color: '#8A92A1' }}>
                  Bitcoin, USDT, Ethereum y más
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '3px', background: 'rgba(247, 147, 26, 0.2)', color: '#F7931A' }}>BTC</span>
              <span style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '3px', background: 'rgba(38, 161, 123, 0.2)', color: '#26A17B' }}>USDT</span>
              <span style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '3px', background: 'rgba(98, 126, 234, 0.2)', color: '#627EEA' }}>ETH</span>
            </div>
          </div>

          {/* Opção 4: Billeteras digitales */}
          <div
            data-testid="method-wallet"
            onClick={() => setMethod('wallet')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#151922',
              border: method === 'wallet' ? '1px solid #22C47A' : '1px solid rgba(244, 245, 247, 0.08)',
              cursor: 'pointer',
              transition: 'border 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: method === 'wallet' ? '5px solid #22C47A' : '2px solid rgba(138, 146, 161, 0.5)',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '18px' }}>👛</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F4F5F7' }}>
                  Billeteras digitales
                </div>
                <div style={{ fontSize: '11px', color: '#8A92A1' }}>
                  Skrill, Neteller, AdvCash
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#811e4d', fontWeight: 700 }}>Skrill</span>
              <span style={{ fontSize: '10px', color: '#8dc63f', fontWeight: 700 }}>NETELLER</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Ingresa el monto */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#DCE1EA' }}>
          2. Ingresa el monto
        </h4>

        {/* Grade de 6 Presets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {PRESET_AMOUNTS.map((val) => {
            const isSelected = selectedPreset === val;
            return (
              <button
                key={val}
                type="button"
                data-testid={`preset-${val}`}
                onClick={() => handleSelectPreset(val)}
                style={{
                  height: '42px',
                  borderRadius: '8px',
                  background: isSelected ? 'rgba(34, 196, 122, 0.12)' : '#151922',
                  border: isSelected ? '1.5px solid #22C47A' : '1px solid rgba(244, 245, 247, 0.08)',
                  color: isSelected ? '#22C47A' : '#F4F5F7',
                  fontSize: '14px',
                  fontWeight: 700,
                  fontFamily: "'Geist Mono', monospace",
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                ${val.toLocaleString()}
              </button>
            );
          })}
        </div>

        {/* Campo Personalizado */}
        <div>
          <label style={{ fontSize: '11px', color: '#8A92A1', display: 'block', marginBottom: '4px' }}>
            Monto personalizado
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#151922',
              border: '1px solid rgba(244, 245, 247, 0.12)',
              borderRadius: '8px',
              height: '42px',
              padding: '0 12px',
            }}
          >
            <span style={{ color: '#DCE1EA', fontSize: '14px', fontWeight: 700, marginRight: '6px' }}>$</span>
            <input
              id="custom-deposit-input"
              data-testid="custom-deposit-input"
              aria-label="Monto personalizado"
              inputMode="numeric"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#F4F5F7',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: "'Geist Mono', monospace",
              }}
            />
            <span style={{ color: '#8A92A1', fontSize: '12px', fontWeight: 600 }}>USD</span>
          </div>
          <div style={{ fontSize: '11px', color: '#8A92A1', marginTop: '4px' }}>
            Mínimo $10 | Máximo $10,000
          </div>
        </div>
      </div>

      {/* 3. Datos de la tarjeta */}
      {method === 'card' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#DCE1EA' }}>
            3. Datos de la tarjeta
          </h4>

          <div>
            <label style={{ fontSize: '11px', color: '#8A92A1', display: 'block', marginBottom: '4px' }}>
              Número de tarjeta
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#151922',
                border: '1px solid rgba(244, 245, 247, 0.12)',
                borderRadius: '8px',
                height: '42px',
                padding: '0 12px',
              }}
            >
              <input
                id="card-number-input"
                data-testid="card-number-input"
                aria-label="Número de tarjeta"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: '#F4F5F7',
                  fontSize: '13px',
                  fontFamily: "'Geist Mono', monospace",
                }}
              />
              <span style={{ fontSize: '16px', opacity: 0.7 }}>💳</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#8A92A1', display: 'block', marginBottom: '4px' }}>
                Fecha de expiración
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#151922',
                  border: '1px solid rgba(244, 245, 247, 0.12)',
                  borderRadius: '8px',
                  height: '42px',
                  padding: '0 12px',
                }}
              >
                <input
                  id="card-expiry-input"
                  data-testid="card-expiry-input"
                  aria-label="Fecha de expiración"
                  placeholder="MM / AA"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: '#F4F5F7',
                    fontSize: '13px',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                />
                <span style={{ fontSize: '14px', opacity: 0.7 }}>📅</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#8A92A1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Código CVV</span>
                <span style={{ opacity: 0.6 }}>?</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#151922',
                  border: '1px solid rgba(244, 245, 247, 0.12)',
                  borderRadius: '8px',
                  height: '42px',
                  padding: '0 12px',
                }}
              >
                <input
                  id="card-cvv-input"
                  data-testid="card-cvv-input"
                  aria-label="Código CVV"
                  type="password"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: '#F4F5F7',
                    fontSize: '13px',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                />
                <span style={{ fontSize: '14px', opacity: 0.7 }}>🔒</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensagens de Erro ou Sucesso */}
      {errorMsg && (
        <div data-testid="deposit-error" style={{ color: '#F2545B', fontSize: '12px', background: 'rgba(242, 84, 91, 0.1)', padding: '8px 12px', borderRadius: '6px' }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div data-testid="deposit-success" style={{ color: '#22C47A', fontSize: '12px', background: 'rgba(34, 196, 122, 0.1)', padding: '8px 12px', borderRadius: '6px' }}>
          {successMsg}
        </div>
      )}

      {/* Botão Primário de Depósito */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        <button
          type="submit"
          data-testid="btn-submit-deposit"
          disabled={submitting}
          style={{
            height: '48px',
            borderRadius: '8px',
            background: '#22C47A',
            border: 'none',
            color: '#0D0F14',
            fontSize: '15px',
            fontWeight: 800,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(34, 196, 122, 0.35)',
            transition: 'transform 0.12s ease',
          }}
        >
          <span>🔒</span>
          <span>{`Depositar $${currentAmount ? currentAmount.toLocaleString() : '100'}`}</span>
        </button>

        <div style={{ textAlign: 'center', fontSize: '11px', color: '#8A92A1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span>🛡️</span>
          <span>Pago seguro y cifrado</span>
        </div>
      </div>
    </form>
  );
}
