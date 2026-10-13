import React, { useState, useEffect } from 'react';
import { BinmaxLogo } from '../components/brand/BinmaxLogo';
import { useRouter } from '../router/RouterContext';
import { AuthService } from '../auth/auth-service';

export function EmailVerificationPage() {
  const { navigate, searchParams } = useRouter();

  const codeParam = searchParams.get('code') || '';
  const tokenParam = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [codeDigits, setCodeDigits] = useState<string[]>(() => {
    if (codeParam && codeParam.length === 6) {
      return codeParam.split('');
    }
    return ['', '', '', '', '', ''];
  });
  const [email, setEmail] = useState(emailParam);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [resending, setResending] = useState(false);

  // Se o código veio na URL, tenta verificar automaticamente
  useEffect(() => {
    if (codeParam && codeParam.length === 6 && !success && !loading) {
      handleAutoVerify(codeParam);
    } else if (tokenParam && !success && !loading) {
      handleTokenVerify(tokenParam);
    }
  }, [codeParam, tokenParam]);

  const handleAutoVerify = async (codeToVerify: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await AuthService.verifyEmail({ code: codeToVerify });
      if (res.success) {
        setSuccess(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Código de activación inválido o expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenVerify = async (tok: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await AuthService.verifyEmail({ token: tok });
      if (res.success) {
        setSuccess(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Enlace de verificación inválido o expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Se colou código completo
      const cleaned = value.replace(/\D/g, '').slice(0, 6);
      if (cleaned.length > 0) {
        const nextDigits = [...codeDigits];
        for (let i = 0; i < 6; i++) {
          nextDigits[i] = cleaned[i] || '';
        }
        setCodeDigits(nextDigits);
        if (cleaned.length === 6) {
          handleAutoVerify(cleaned);
        }
        return;
      }
    }

    const digit = value.slice(-1).replace(/\D/g, '');
    const nextDigits = [...codeDigits];
    nextDigits[index] = digit;
    setCodeDigits(nextDigits);

    // Auto-focus no próximo campo
    if (digit && index < 5) {
      const nextInput = document.getElementById(`digit-${index + 1}`);
      nextInput?.focus();
    }

    // Se completou os 6 dígitos
    const fullCode = nextDigits.join('');
    if (fullCode.length === 6 && !nextDigits.includes('')) {
      handleAutoVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      const prevInput = document.getElementById(`digit-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = codeDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMsg('Ingresa el código completo de 6 dígitos.');
      return;
    }
    handleAutoVerify(fullCode);
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Ingresa tu correo para recibir un nuevo código.');
      return;
    }
    setResending(true);
    setErrorMsg('');
    setResendSuccess('');
    try {
      await AuthService.resendVerification(email);
      setResendSuccess('¡Nuevo código enviado! Revisa tu bandeja de entrada.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al reenviar código.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      data-testid="email-verification-page"
      className="theme-binmax"
      style={{
        minHeight: '100vh',
        backgroundColor: '#0D0F14',
        color: '#F4F5F7',
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Limpo */}
      <header
        style={{
          height: '64px',
          borderBottom: '1px solid #1C2738',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          backgroundColor: '#101622',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/operar')}>
          <BinmaxLogo />
        </div>
        <button
          onClick={() => navigate('/operar')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8A92A1',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '6px 12px',
          }}
        >
          Volver a la plataforma
        </button>
      </header>

      {/* Conteúdo Central */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#151922',
            border: '1px solid #232936',
            borderRadius: '12px',
            padding: '40px 32px',
            boxShadow: '0 16px 36px rgba(0,0,0,0.6)',
          }}
        >
          {success ? (
            /* Estado de Sucesso */
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 196, 122, 0.12)',
                  border: '1px solid rgba(34, 196, 122, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  color: '#22C47A',
                  fontSize: '28px',
                }}
              >
                ✓
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 10px', color: '#F4F5F7' }}>
                ¡Correo Verificado con Éxito!
              </h1>
              <p style={{ fontSize: '14px', color: '#8A92A1', margin: '0 0 24px', lineHeight: 1.5 }}>
                Tu cuenta está activa y hemos liberado tu saldo completo de{' '}
                <strong style={{ color: '#22C47A' }}>$10.000,00 USD</strong> en la sala de operaciones.
              </p>

              <button
                onClick={() => navigate('/operar')}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#22C47A',
                  color: '#0D0F14',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.3px',
                }}
              >
                IR A OPERAR EN VIVO →
              </button>
            </div>
          ) : (
            /* Formulário de Verificação */
            <div>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#8A92A1',
                    backgroundColor: '#0D0F14',
                    border: '1px solid #232936',
                    borderRadius: '4px',
                    letterSpacing: '0.8px',
                    marginBottom: '12px',
                  }}
                >
                  VERIFICACIÓN DE SEGURIDAD
                </span>
                <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px', color: '#F4F5F7' }}>
                  Confirma tu Correo Electrónico
                </h1>
                <p style={{ fontSize: '13px', color: '#8A92A1', margin: 0, lineHeight: 1.5 }}>
                  Ingresa el código de 6 dígitos enviado a tu correo para activar tu cuenta y desbloquear tus{' '}
                  <strong style={{ color: '#22C47A' }}>$10.000 USD</strong> demo.
                </p>
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'rgba(242, 84, 91, 0.1)',
                    border: '1px solid rgba(242, 84, 91, 0.3)',
                    borderRadius: '6px',
                    color: '#F2545B',
                    fontSize: '13px',
                    marginBottom: '20px',
                    textAlign: 'center',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {resendSuccess && (
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'rgba(34, 196, 122, 0.1)',
                    border: '1px solid rgba(34, 196, 122, 0.3)',
                    borderRadius: '6px',
                    color: '#22C47A',
                    fontSize: '13px',
                    marginBottom: '20px',
                    textAlign: 'center',
                  }}
                >
                  {resendSuccess}
                </div>
              )}

              <form onSubmit={handleManualSubmit}>
                {/* 6 Digit Inputs */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
                  {codeDigits.map((digit, index) => (
                    <input
                      key={index}
                      id={`digit-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      disabled={loading}
                      style={{
                        width: '48px',
                        height: '56px',
                        fontSize: '24px',
                        fontWeight: 700,
                        textAlign: 'center',
                        backgroundColor: '#0D0F14',
                        border: digit ? '1px solid #22C47A' : '1px solid #232936',
                        borderRadius: '8px',
                        color: '#F4F5F7',
                        fontFamily: 'monospace',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: '#22C47A',
                    color: '#0D0F14',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    letterSpacing: '0.3px',
                    marginBottom: '24px',
                  }}
                >
                  {loading ? 'VERIFICANDO...' : 'VERIFICAR Y ACTIVAR CUENTA'}
                </button>
              </form>

              {/* Seção de Reenvio */}
              <div style={{ borderTop: '1px solid #232936', paddingTop: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#8A92A1', margin: '0 0 12px' }}>
                  ¿No recibiste el código o ya expiró?
                </p>
                <form onSubmit={handleResend} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    placeholder="Tu correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      backgroundColor: '#0D0F14',
                      border: '1px solid #232936',
                      borderRadius: '6px',
                      color: '#F4F5F7',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={resending}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      border: '1px solid #364153',
                      borderRadius: '6px',
                      color: '#DCE1EA',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: resending ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {resending ? 'Enviando...' : 'Reenviar'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Legal */}
      <footer
        style={{
          padding: '18px 24px',
          textAlign: 'center',
          borderTop: '1px solid #1C2738',
          fontSize: '11px',
          color: '#535B6A',
          backgroundColor: '#0D0F14',
        }}
      >
        © 2026 Binmax Broker. Todos los derechos reservados.
      </footer>
    </div>
  );
}
