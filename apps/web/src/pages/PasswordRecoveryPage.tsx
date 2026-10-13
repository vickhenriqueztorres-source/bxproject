import React, { useState } from 'react';
import { BinmaxLogo } from '../components/brand/BinmaxLogo';
import { useRouter } from '../router/RouterContext';
import { AuthService } from '../auth/auth-service';

function tokenFromEmailLink(): string {
  const value = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.hash.slice(1)).get('token')
    : null;
  return value && /^[0-9a-f]{64}$/.test(value) ? value : '';
}

export function PasswordRecoveryPage() {
  const { navigate } = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(() => tokenFromEmailLink() ? 3 : 1);
  const [email, setEmail] = useState('');
  const [recoveryToken] = useState(tokenFromEmailLink);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Por favor, ingresa un correo electrónico válido.');
      return;
    }
    setErrorMsg('');
    try {
      await AuthService.requestPasswordRecovery(email);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al solicitar el enlace.');
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    setErrorMsg('');
    try {
      await AuthService.resetPassword({
        token: recoveryToken,
        newPassword
      });
      setSuccessMsg('Contraseña actualizada con éxito.');
      setTimeout(() => {
        navigate('/login');
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'El enlace de recuperación es inválido o ha expirado.');
    }
  };

  return (
    <div
      data-testid="password-recovery-page"
      className="theme-binmax"
      style={{
        minHeight: '100vh',
        backgroundColor: '#0B1220',
        color: '#E6EDF5',
        fontFamily: "'Geist', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Limpo */}
      <header
        style={{
          height: '64px',
          borderBottom: '1px solid #1F2A3A',
          backgroundColor: '#070D18',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <BinmaxLogo variant="horizontal" height={28} />
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{
            background: 'none',
            border: 'none',
            color: '#8A96A8',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Volver al inicio de sesión
        </button>
      </header>

      {/* Área Central com o Cartão de 420px */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: '#111A2B',
            border: '1px solid #1F2A3A',
            borderRadius: '8px',
            padding: '36px 32px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
            textAlign: 'center',
          }}
        >
          {/* PASSO 1: Solicitar link */}
          {step === 1 && (
            <form onSubmit={handleSendLink} data-testid="recovery-step-1">
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#1F2A3A',
                  color: '#38BDF8',
                  fontSize: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                ✉️
              </div>

              <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#E6EDF5' }}>
                Recuperar acceso
              </h1>
              <p style={{ fontSize: '13px', color: '#8A96A8', lineHeight: 1.5, margin: '0 0 24px' }}>
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              {errorMsg && (
                <div style={{ color: '#EF4444', fontSize: '12px', marginBottom: '16px' }}>{errorMsg}</div>
              )}

              <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                <label htmlFor="recovery-email" style={{ display: 'block', fontSize: '13px', color: '#8A96A8', marginBottom: '6px' }}>
                  Correo electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="recovery-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    style={{
                      width: '100%',
                      backgroundColor: '#0B1220',
                      border: '1px solid #1F2A3A',
                      borderRadius: '6px',
                      padding: '11px 14px 11px 36px',
                      color: '#E6EDF5',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8A96A8' }}>
                    ✉️
                  </span>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  backgroundColor: '#22C55E',
                  color: '#08140B',
                  fontWeight: 700,
                  fontSize: '14px',
                  padding: '12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: '20px',
                }}
              >
                Enviar enlace
              </button>

              <div style={{ fontSize: '13px', color: '#8A96A8' }}>
                <span style={{ margin: '0 8px' }}>o</span>
                <br />
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8A96A8',
                    cursor: 'pointer',
                    marginTop: '8px',
                    textDecoration: 'underline',
                  }}
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          )}

          {/* PASSO 2: Revisa tu correo */}
          {step === 2 && (
            <div data-testid="recovery-step-2">
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: '#22C55E',
                  fontSize: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                ✓
              </div>

              <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#E6EDF5' }}>
                Revisa tu correo
              </h1>
              <p style={{ fontSize: '13px', color: '#8A96A8', lineHeight: 1.5, margin: '0 0 20px' }}>
                Si existe una cuenta, recibirás un enlace para restablecer la contraseña en:
                <br />
                <strong style={{ color: '#E6EDF5' }}>{email || 'tu@correo.com'}</strong>
              </p>

              <div
                style={{
                  backgroundColor: '#0B1220',
                  border: '1px solid #1F2A3A',
                  borderRadius: '6px',
                  padding: '14px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '20px' }}>🕒</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#E6EDF5' }}>
                    El enlace vence en 15 minutos.
                  </div>
                  <div style={{ fontSize: '11px', color: '#8A96A8', marginTop: '2px' }}>
                    Si no ves el correo, revisa tu carpeta de spam o correo no deseado.
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: '#8A96A8' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38BDF8',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Enviar de nuevo
                </button>
                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8A96A8',
                      cursor: 'pointer',
                      fontSize: '12px',
                      textDecoration: 'underline',
                    }}
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: Nueva contraseña */}
          {step === 3 && (
            <form onSubmit={handleSavePassword} data-testid="recovery-step-3">
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#1F2A3A',
                  color: '#38BDF8',
                  fontSize: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                🔒
              </div>

              <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#E6EDF5' }}>
                Nueva contraseña
              </h1>
              <p style={{ fontSize: '13px', color: '#8A96A8', lineHeight: 1.5, margin: '0 0 24px' }}>
                Crea una contraseña segura para tu cuenta de BINMAX.
              </p>

              {errorMsg && (
                <div style={{ color: '#EF4444', fontSize: '12px', marginBottom: '16px' }}>{errorMsg}</div>
              )}
              {successMsg && (
                <div style={{ color: '#22C55E', fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>{successMsg}</div>
              )}

              {/* Nueva Contraseña */}
              <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label htmlFor="rec-new-pass" style={{ display: 'block', fontSize: '13px', color: '#8A96A8', marginBottom: '6px' }}>
                  Nueva contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="rec-new-pass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    style={{
                      width: '100%',
                      backgroundColor: '#0B1220',
                      border: '1px solid #1F2A3A',
                      borderRadius: '6px',
                      padding: '11px 40px 11px 36px',
                      color: '#E6EDF5',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8A96A8' }}>
                    🔒
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#8A96A8',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              {/* Confirmar Contraseña */}
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <label htmlFor="rec-conf-pass" style={{ display: 'block', fontSize: '13px', color: '#8A96A8', marginBottom: '6px' }}>
                  Confirmar contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="rec-conf-pass"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    style={{
                      width: '100%',
                      backgroundColor: '#0B1220',
                      border: '1px solid #1F2A3A',
                      borderRadius: '6px',
                      padding: '11px 40px 11px 36px',
                      color: '#E6EDF5',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8A96A8' }}>
                    🔒
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#8A96A8',
                      cursor: 'pointer',
                    }}
                  >
                    {showConfirm ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  backgroundColor: '#22C55E',
                  color: '#08140B',
                  fontWeight: 700,
                  fontSize: '14px',
                  padding: '12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Guardar
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
