import React, { useState, useMemo } from 'react';
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
} from '../components/icons/PrecisionIcons';
import {
  PRECISION_COLORS,
} from '../lib/design-tokens';

export function RegisterPage() {
  const { navigate } = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Validação dinâmica dos 3 requisitos de senha da captura oficial
  const hasEightChars = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  // Força da senha (0 a 4 barras)
  const strengthScore = useMemo(() => {
    let score = 0;
    if (password.length >= 4) score++;
    if (hasEightChars) score++;
    if (hasLetter) score++;
    if (hasNumber) score++;
    return score;
  }, [password, hasEightChars, hasLetter, hasNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage('');

    if (!termsAccepted) {
      setErrorMessage('Você deve aceitar os Termos e a Política de Riscos para continuar.');
      return;
    }

    if (!hasEightChars || !hasLetter || !hasNumber) {
      setErrorMessage('A senha deve ter no mínimo 8 caracteres, uma letra e um número.');
      return;
    }

    setIsLoading(true);

    try {
      await AuthService.register({ name, email, password, country: 'BR' });
      setGuestMode(false);
      setIsLoading(false);
      navigate(`/verificar?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Erro ao criar a conta. Tente novamente.');
    }
  };

  return (
    <div data-testid="register-page">
      <AuthShell activeMode="register">
        <div data-testid="register-card" className="bm-card-fintech">
          {/* Seletor de Abas em Cápsula (Criar conta ativa à esquerda) */}
          <AuthTabSwitcher
            activeTab="register"
            labels={{ login: 'Entrar', register: 'Criar conta' }}
            onTabChange={(tab) => {
              if (tab === 'login') navigate('/login');
            }}
          />

          <form onSubmit={handleSubmit} data-testid="register-form">
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
              Abra sua conta grátis.
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: '#8A92A1',
                margin: '0 0 24px',
                lineHeight: 1.45,
              }}
            >
              Leva 15 segundos. Você começa na conta de prática.
            </p>

            {/* Mensagem de Erro Cirúrgica Sem Tremores */}
            {errorMessage && (
              <div
                data-testid="register-error-alert"
                className="bm-error-message"
                style={{
                  backgroundColor: 'rgba(242, 84, 91, 0.1)',
                  border: `1px solid ${PRECISION_COLORS.loss}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: PRECISION_COLORS.loss,
                  fontSize: '12.5px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <IconAlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Campo: Nome completo */}
            <div style={{ marginBottom: '18px' }}>
              <label
                htmlFor="reg-name"
                style={{
                  display: 'block',
                  fontSize: '13.5px',
                  color: '#F4F5F7',
                  marginBottom: '8px',
                  fontWeight: 600,
                }}
              >
                Nome completo
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como no seu documento"
                className="bm-input-fintech"
              />
            </div>

            {/* Campo: E-mail */}
            <div style={{ marginBottom: '18px' }}>
              <label
                htmlFor="reg-email"
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
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="bm-input-fintech"
              />
            </div>

            {/* Campo: Senha */}
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="reg-pass"
                style={{
                  display: 'block',
                  fontSize: '13.5px',
                  color: '#F4F5F7',
                  marginBottom: '8px',
                  fontWeight: 600,
                }}
              >
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  className="bm-input-fintech"
                  style={{ paddingRight: '44px' }}
                />
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

              {/* Indicador de Força de Senha (4 Barras Horizontais) */}
              <div
                data-testid="password-strength-bars"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  marginTop: '10px',
                }}
              >
                {[1, 2, 3, 4].map((barIndex) => {
                  const isActive = strengthScore >= barIndex;
                  return (
                    <div
                      key={barIndex}
                      style={{
                        height: '3px',
                        borderRadius: '2px',
                        backgroundColor: isActive ? PRECISION_COLORS.profit : '#1C2738',
                        transition: 'background-color 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  );
                })}
              </div>

              {/* 3 Requisitos com Marcadores Circulares */}
              <div
                data-testid="password-requirements"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginTop: '10px',
                  fontSize: '11.5px',
                  color: '#7E8B9F',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      border: hasEightChars ? `2px solid ${PRECISION_COLORS.profit}` : '1.5px solid #4E5A6E',
                      backgroundColor: hasEightChars ? PRECISION_COLORS.profit : 'transparent',
                      display: 'inline-block',
                      transition: 'all 180ms ease',
                    }}
                  />
                  <span style={{ color: hasEightChars ? '#F4F5F7' : '#7E8B9F' }}>8+ caracteres</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      border: hasLetter ? `2px solid ${PRECISION_COLORS.profit}` : '1.5px solid #4E5A6E',
                      backgroundColor: hasLetter ? PRECISION_COLORS.profit : 'transparent',
                      display: 'inline-block',
                      transition: 'all 180ms ease',
                    }}
                  />
                  <span style={{ color: hasLetter ? '#F4F5F7' : '#7E8B9F' }}>Uma letra</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      border: hasNumber ? `2px solid ${PRECISION_COLORS.profit}` : '1.5px solid #4E5A6E',
                      backgroundColor: hasNumber ? PRECISION_COLORS.profit : 'transparent',
                      display: 'inline-block',
                      transition: 'all 180ms ease',
                    }}
                  />
                  <span style={{ color: hasNumber ? '#F4F5F7' : '#7E8B9F' }}>Um número</span>
                </div>
              </div>
            </div>

            {/* Checkbox de Termos e Política de Riscos */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '12.5px',
                  color: '#8A92A1',
                  cursor: 'pointer',
                  lineHeight: 1.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  style={{
                    accentColor: PRECISION_COLORS.profit,
                    width: '16px',
                    height: '16px',
                    marginTop: '2px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                />
                <span>
                  Tenho 18 anos ou mais e aceito os{' '}
                  <a
                    href="#termos"
                    style={{ color: '#F4F5F7', textDecoration: 'underline' }}
                  >
                    Termos
                  </a>{' '}
                  e a{' '}
                  <a
                    href="#riscos"
                    style={{ color: '#F4F5F7', textDecoration: 'underline' }}
                  >
                    Política de Riscos
                  </a>
                  .
                </span>
              </label>
            </div>

            {/* Botão Primário: Criar minha conta grátis → (Pill Button) */}
            <button
              type="submit"
              disabled={isLoading}
              className="bm-btn-pill-primary bm-btn-press"
            >
              {isLoading ? (
                <span>Criando conta de prática...</span>
              ) : (
                <>
                  <span>Criar minha conta grátis</span>
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>→</span>
                </>
              )}
            </button>

            {/* Disclaimer de Segurança Criptografada */}
            <div className="bm-security-disclaimer">
              <div style={{ color: PRECISION_COLORS.profit, marginTop: '1px' }}>
                <IconLock size={15} />
              </div>
              <span>
                Conexão criptografada. A BINMAX nunca pede sua senha por WhatsApp, e-mail ou telefone.
              </span>
            </div>
          </form>
        </div>
      </AuthShell>
    </div>
  );
}
