import React, { useState } from 'react';
import { useRouter } from '../router/RouterContext';
import { setGuestMode } from '../auth/oidc';
import { AuthService } from '../auth/auth-service';
import { AuthShell } from '../components/auth/AuthShell';
import { AuthTabSwitcher } from '../components/auth/AuthTabSwitcher';
import {
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconShield,
} from '../components/icons/PrecisionIcons';
import {
  PRECISION_SURFACES,
  PRECISION_COLORS,
  PRECISION_TEXT,
  PRECISION_FONTS,
} from '../lib/design-tokens';

export function LoginPage() {
  const { navigate } = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  const isLocked = failedAttempts >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || isLoading) return;

    setErrorMessage('');
    setIsLoading(true);

    try {
      await AuthService.login({ email, password });
      setGuestMode(false);
      setIsLoading(false);
      navigate('/operar');
    } catch (err: any) {
      setIsLoading(false);
      setFailedAttempts((prev) => prev + 1);
      setErrorMessage(err.message || 'E-mail ou senha incorretos.');
    }
  };

  return (
    <div data-testid="login-page">
      <AuthShell activeMode="login">
        <div data-testid="login-card" className="bm-card-fintech">
          {/* Seletor de Abas em Cápsula (Pill Shape Oficial da Captura) */}
          <AuthTabSwitcher
            activeTab="login"
            labels={{ login: 'Entrar', register: 'Criar conta' }}
            onTabChange={(tab) => {
              if (tab === 'register') navigate('/registro');
            }}
          />

          {isLocked ? (
            /* Estado de Bloqueio por Força Bruta (5 Tentativas) */
            <div data-testid="login-locked-card" style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(242, 84, 91, 0.12)',
                  color: PRECISION_COLORS.loss,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  border: `1px solid ${PRECISION_COLORS.loss}`,
                }}
              >
                <IconShield size={24} />
              </div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: '0 0 8px',
                  color: PRECISION_TEXT.strong,
                }}
              >
                Conta bloqueada
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: PRECISION_TEXT.muted,
                  margin: '0 0 20px',
                }}
              >
                Você excedeu o número de tentativas de acesso. Por segurança, sua conta foi temporariamente bloqueada.
              </p>
              <div
                className="bm-tabular-nums"
                style={{
                  backgroundColor: '#1C2738',
                  border: `1px solid rgba(255, 255, 255, 0.08)`,
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: PRECISION_TEXT.muted,
                }}
              >
                Tente novamente em 15 minutos.
              </div>
            </div>
          ) : (
            /* Formulário Principal de Login Fiel à Imagem */
            <form onSubmit={handleSubmit} data-testid="login-form">
              {/* Título Principal */}
              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  margin: '0 0 6px',
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Bem-vindo de volta.
              </h1>
              <p
                style={{
                  fontSize: '14px',
                  color: '#8A92A1',
                  margin: '0 0 28px',
                  lineHeight: 1.45,
                }}
              >
                Entre para voltar a operar de onde parou.
              </p>

              {/* Mensagem de Erro Cirúrgica Sem Tremores */}
              {errorMessage && (
                <div
                  data-testid="login-error-alert"
                  className="bm-error-message"
                  style={{
                    backgroundColor: 'rgba(242, 84, 91, 0.1)',
                    border: `1px solid ${PRECISION_COLORS.loss}`,
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: PRECISION_COLORS.loss,
                    fontSize: '12.5px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <IconAlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Campo: E-mail */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="login-email"
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    color: '#F4F5F7',
                    marginBottom: '8px',
                    fontWeight: 600,
                  }}
                >
                  E-mail
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="bm-input-fintech"
                  style={{
                    backgroundColor: '#1C2738',
                    borderColor: errorMessage ? PRECISION_COLORS.loss : undefined,
                  }}
                />
              </div>

              {/* Campo: Senha */}
              <div style={{ marginBottom: '28px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <label
                    htmlFor="login-password"
                    style={{
                      fontSize: '13.5px',
                      color: '#F4F5F7',
                      fontWeight: 600,
                    }}
                  >
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/recuperar')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#7E8B9F',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 500,
                      transition: 'color 100ms ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#F4F5F7')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#7E8B9F')}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    className="bm-input-fintech"
                    style={{
                      paddingRight: '44px',
                      borderColor: errorMessage ? PRECISION_COLORS.loss : undefined,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: showPassword ? PRECISION_COLORS.profit : '#5A6578',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    aria-label="Alternar visibilidade de senha"
                  >
                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              {/* Botão Primário: Entrar → (Pill Button 9999px) */}
              <button
                type="submit"
                disabled={isLoading}
                className="bm-btn-pill-primary bm-btn-press"
              >
                {isLoading ? (
                  <span>Acessando o terminal...</span>
                ) : (
                  <>
                    <span>Entrar</span>
                    <span style={{ fontSize: '18px', fontWeight: 800 }}>→</span>
                  </>
                )}
              </button>

              {/* Disclaimer de Segurança Criptografada da Imagem */}
              <div className="bm-security-disclaimer">
                <div style={{ color: PRECISION_COLORS.profit, marginTop: '1px' }}>
                  <IconLock size={15} />
                </div>
                <span>
                  Conexão criptografada. A BINMAX nunca pede sua senha por WhatsApp, e-mail ou telefone.
                </span>
              </div>
            </form>
          )}
        </div>
      </AuthShell>
    </div>
  );
}
