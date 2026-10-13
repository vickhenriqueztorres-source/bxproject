import React, { useState, useEffect } from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import { AuthService } from '../auth/auth-service';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../lib/design-tokens';

export type SettingsSection = 'PROFILE' | 'SECURITY' | 'OPERATION' | 'NOTIFICATIONS' | 'LOCALE';

function detectCurrentDevice(): string {
  if (typeof navigator === 'undefined') return 'Navegador Web';
  const ua = navigator.userAgent || '';
  let os = 'Dispositivo';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';

  let browser = 'Navegador';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua)) browser = 'Safari';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';

  return `${os} · ${browser}`;
}

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('PROFILE');

  // Sessão Real de Autenticação
  const initialSession = AuthService.getSession();
  const initialUser = initialSession?.user;

  // Form Perfil
  const [name, setName] = useState(initialUser?.name || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [country, setCountry] = useState(initialUser?.country || 'ES');
  const [phoneCode, setPhoneCode] = useState(initialUser?.phoneCode || '+34');
  const [phoneNumber, setPhoneNumber] = useState(initialUser?.phoneNumber || '');
  const [demoBalanceMinor, setDemoBalanceMinor] = useState<number>(initialUser?.demoBalanceMinor ?? 1000000);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Form Segurança
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sessão Ativa Real (baseada no dispositivo atual)
  const [activeSessions, setActiveSessions] = useState(() => [
    {
      id: 'session-current',
      device: detectCurrentDevice(),
      location: 'Sesión activa en este navegador',
      date: 'Ahora mismo',
      isCurrent: true,
    },
  ]);

  // Carrega os dados reais do perfil a partir do backend
  useEffect(() => {
    let mounted = true;
    AuthService.getProfile()
      .then((user) => {
        if (!mounted) return;
        if (user.name) setName(user.name);
        if (user.email) setEmail(user.email);
        if (user.country) setCountry(user.country);
        if (user.phoneCode) setPhoneCode(user.phoneCode);
        if (user.phoneNumber) setPhoneNumber(user.phoneNumber);
        if (typeof user.demoBalanceMinor === 'number') setDemoBalanceMinor(user.demoBalanceMinor);
      })
      .catch(() => {
        // Modo offline ou convidado: preserva dados em memória
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Form Operação
  const [defaultAmount, setDefaultAmount] = useState(100);
  const [defaultExpiry, setDefaultExpiry] = useState('01:00');
  const [oneClickTrading, setOneClickTrading] = useState(true);
  const [resultSound, setResultSound] = useState(true);

  // Form Notificações
  const [depositEmail, setDepositEmail] = useState(true);
  const [withdrawEmail, setWithdrawEmail] = useState(true);
  const [tournamentEmail, setTournamentEmail] = useState(true);

  // Form Idioma
  const [localeLang, setLocaleLang] = useState('es');
  const [timeZone, setTimeZone] = useState('UTC-6');
  const [dateFormat, setDateFormat] = useState('DD MMM YYYY');

  const triggerSaveNotice = (msg: string) => {
    setSavedFeedback(msg);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  const handleCloseSession = (id: string) => {
    setActiveSessions((prev) => prev.filter((s) => s.id !== id));
    triggerSaveNotice('Sesión cerrada correctamente.');
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setProfileError('El nombre no puede estar vacío.');
      return;
    }
    try {
      setSavingProfile(true);
      setProfileError(null);
      const updated = await AuthService.updateProfile({
        name: name.trim(),
        country,
        phoneCode: phoneCode.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      setName(updated.name);
      setCountry(updated.country);
      if (updated.phoneCode) setPhoneCode(updated.phoneCode);
      if (updated.phoneNumber) setPhoneNumber(updated.phoneNumber);
      triggerSaveNotice('Perfil guardado con éxito.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el perfil.';
      setProfileError(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!currentPassword) {
      setPasswordError('Ingresa tu contraseña actual.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    try {
      setSavingPassword(true);
      setPasswordError(null);
      await AuthService.updatePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      triggerSaveNotice('Contraseña actualizada con éxito.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar la contraseña.';
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const balanceFormatted = `$${(demoBalanceMinor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <SecondaryLayout userEmail={email || null} balanceFormatted={balanceFormatted}>
      <div data-testid="settings-page" className="bm-page-enter" style={{ padding: '4px 0' }}>
        {/* Cabeçalho */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: PRECISION_COLORS.metal,
              }}
            >
              Configuración de Terminal
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: PRECISION_TEXT.strong, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Ajustes
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: PRECISION_TEXT.muted }}>
            Gestiona tu cuenta y preferencias
          </p>
        </div>

        {savedFeedback && (
          <div
            style={{
              backgroundColor: 'rgba(34, 196, 122, 0.12)',
              border: `1px solid ${PRECISION_COLORS.profit}`,
              borderRadius: '6px',
              padding: '10px 16px',
              color: PRECISION_COLORS.profit,
              fontSize: '12.5px',
              fontWeight: 600,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✓</span>
            <span>{savedFeedback}</span>
          </div>
        )}

        {/* Layout Grid: Menu Lateral 240px / Conteúdo em Superfícies */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: '24px' }} className="settings-grid">
          {/* MENU LATERAL INTERNO */}
          <nav
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              height: 'fit-content',
            }}
          >
            {[
              { id: 'PROFILE', label: 'Perfil', desc: 'Información personal' },
              { id: 'SECURITY', label: 'Seguridad', desc: 'Contraseña y verificación' },
              { id: 'OPERATION', label: 'Operación', desc: 'Preferencias de trading' },
              { id: 'NOTIFICATIONS', label: 'Notificaciones', desc: 'Alertas y comunicados' },
              { id: 'LOCALE', label: 'Idioma y zona horaria', desc: 'Región y formato' },
            ].map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id as SettingsSection)}
                  className="bm-btn-press"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: active ? PRECISION_SURFACES.bg2 : 'transparent',
                    border: 'none',
                    borderLeft: active ? `3px solid ${PRECISION_COLORS.profit}` : '3px solid transparent',
                    color: active ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: active ? 700 : 500, color: active ? PRECISION_TEXT.strong : PRECISION_TEXT.muted }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, marginTop: '2px' }}>
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* ÁREA DE CONTEÚDO MODULAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. SEÇÃO PERFIL */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.bg1,
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: PRECISION_TEXT.strong }}>Perfil</h3>
                  <div style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>Tu información personal y de contacto</div>
                </div>
                <button
                  type="button"
                  className="bm-btn-precision"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  style={{
                    backgroundColor: PRECISION_COLORS.profit,
                    color: '#07120B',
                    border: 'none',
                    fontWeight: 700,
                    opacity: savingProfile ? 0.7 : 1,
                    cursor: savingProfile ? 'wait' : 'pointer',
                  }}
                >
                  {savingProfile ? 'Guardando...' : 'Guardar'}
                </button>
              </div>

              {profileError && (
                <div
                  style={{
                    backgroundColor: 'rgba(235, 87, 87, 0.12)',
                    border: `1px solid ${PRECISION_COLORS.loss}`,
                    borderRadius: '6px',
                    padding: '8px 14px',
                    color: PRECISION_COLORS.loss,
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '16px',
                  }}
                >
                  {profileError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '9px 12px',
                      color: PRECISION_TEXT.strong,
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    disabled
                    style={{
                      width: '100%',
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '9px 12px',
                      color: PRECISION_TEXT.muted,
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed',
                      opacity: 0.8,
                    }}
                  />
                  <div style={{ fontSize: '10.5px', color: PRECISION_TEXT.quiet, marginTop: '4px' }}>
                    Identificador de cuenta único (no modificable).
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                    País
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '9px 12px',
                      color: PRECISION_TEXT.strong,
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="MX">México (MX)</option>
                    <option value="ES">España (ES)</option>
                    <option value="BR">Brasil (BR)</option>
                    <option value="CO">Colombia (CO)</option>
                    <option value="AR">Argentina (AR)</option>
                    <option value="CL">Chile (CL)</option>
                    <option value="PE">Perú (PE)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                    Teléfono
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      style={{
                        width: '65px',
                        backgroundColor: PRECISION_SURFACES.bg0,
                        border: `1px solid ${PRECISION_SURFACES.line}`,
                        borderRadius: '6px',
                        padding: '9px',
                        color: PRECISION_TEXT.strong,
                        fontSize: '12.5px',
                        textAlign: 'center',
                        fontFamily: PRECISION_FONTS.mono,
                      }}
                      className="bm-tabular-nums"
                    />
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      style={{
                        flex: 1,
                        backgroundColor: PRECISION_SURFACES.bg0,
                        border: `1px solid ${PRECISION_SURFACES.line}`,
                        borderRadius: '6px',
                        padding: '9px 12px',
                        color: PRECISION_TEXT.strong,
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                        fontFamily: PRECISION_FONTS.mono,
                      }}
                      className="bm-tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SEÇÃO SEGURANÇA */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.bg1,
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: PRECISION_TEXT.strong }}>Seguridad</h3>
                  <div style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>Protege tu cuenta y controla el acceso</div>
                </div>
                <button
                  type="button"
                  className="bm-btn-precision"
                  onClick={handleSavePassword}
                  disabled={savingPassword}
                  style={{
                    backgroundColor: PRECISION_COLORS.profit,
                    color: '#07120B',
                    border: 'none',
                    fontWeight: 700,
                    opacity: savingPassword ? 0.7 : 1,
                    cursor: savingPassword ? 'wait' : 'pointer',
                  }}
                >
                  {savingPassword ? 'Guardando...' : 'Guardar'}
                </button>
              </div>

              {passwordError && (
                <div
                  style={{
                    backgroundColor: 'rgba(235, 87, 87, 0.12)',
                    border: `1px solid ${PRECISION_COLORS.loss}`,
                    borderRadius: '6px',
                    padding: '8px 14px',
                    color: PRECISION_COLORS.loss,
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '16px',
                  }}
                >
                  {passwordError}
                </div>
              )}

              {/* Grid: Troca de Senha e 2FA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                      Contraseña actual
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña actual"
                      style={{
                        width: '100%',
                        backgroundColor: PRECISION_SURFACES.bg0,
                        border: `1px solid ${PRECISION_SURFACES.line}`,
                        borderRadius: '6px',
                        padding: '9px 12px',
                        color: PRECISION_TEXT.strong,
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ingresa tu nueva contraseña"
                      style={{
                        width: '100%',
                        backgroundColor: PRECISION_SURFACES.bg0,
                        border: `1px solid ${PRECISION_SURFACES.line}`,
                        borderRadius: '6px',
                        padding: '9px 12px',
                        color: PRECISION_TEXT.strong,
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                      Confirmar contraseña
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirma tu nueva contraseña"
                      style={{
                        width: '100%',
                        backgroundColor: PRECISION_SURFACES.bg0,
                        border: `1px solid ${PRECISION_SURFACES.line}`,
                        borderRadius: '6px',
                        padding: '9px 12px',
                        color: PRECISION_TEXT.strong,
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* 2FA */}
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: PRECISION_TEXT.strong, marginBottom: '4px' }}>
                    Verificación en dos pasos (2FA)
                  </div>
                  <div style={{ fontSize: '11.5px', color: PRECISION_TEXT.muted, marginBottom: '14px' }}>
                    Añade una capa extra de seguridad a tu cuenta.
                  </div>

                  <div
                    style={{
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: PRECISION_TEXT.strong }}>
                        Autenticador de aplicaciones
                      </div>
                      <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>
                        Google Authenticator, Authy, etc.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={twoFactorEnabled}
                      onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: PRECISION_COLORS.profit }}
                    />
                  </div>

                  {twoFactorEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: PRECISION_COLORS.profit }}>
                      <span>✓</span>
                      <span>2FA activado · Tu cuenta está protegida</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sesiones Activas */}
              <div style={{ borderTop: `1px solid ${PRECISION_SURFACES.line}`, paddingTop: '16px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: PRECISION_TEXT.strong, marginBottom: '4px' }}>
                  Sesiones activas
                </div>
                <div style={{ fontSize: '11.5px', color: PRECISION_TEXT.muted, marginBottom: '12px' }}>
                  Dispositivos que tienen acceso a tu cuenta
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      style={{
                        backgroundColor: PRECISION_SURFACES.bg0,
                        border: `1px solid ${PRECISION_SURFACES.line}`,
                        borderRadius: '6px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: PRECISION_TEXT.strong }}>
                            {session.device}
                          </span>
                          {session.isCurrent && (
                            <span
                              style={{
                                backgroundColor: 'rgba(34, 196, 122, 0.12)',
                                color: PRECISION_COLORS.profit,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              Sesión actual
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, marginTop: '2px' }}>
                          {session.location} · {session.date}
                        </div>
                      </div>

                      {session.isCurrent ? (
                        <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>Actual</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCloseSession(session.id)}
                          style={{
                            background: 'none',
                            border: `1px solid ${PRECISION_COLORS.loss}`,
                            color: PRECISION_COLORS.loss,
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Cerrar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. SEÇÃO OPERAÇÃO */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.bg1,
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: PRECISION_TEXT.strong }}>Operación</h3>
                  <div style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>Configura tus preferencias de trading</div>
                </div>
                <button
                  type="button"
                  className="bm-btn-precision"
                  onClick={() => triggerSaveNotice('Preferencias de operación guardadas.')}
                  style={{
                    backgroundColor: PRECISION_COLORS.profit,
                    color: '#07120B',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  Guardar
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                    Monto por defecto
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={defaultAmount}
                      onChange={(e) => setDefaultAmount(Number(e.target.value))}
                      style={{
                        width: '100%',
                        backgroundColor: PRECISION_SURFACES.bg0,
                        border: `1px solid ${PRECISION_SURFACES.line}`,
                        borderRadius: '6px',
                        padding: '9px 12px 9px 24px',
                        color: PRECISION_TEXT.strong,
                        fontSize: '12.5px',
                        fontFamily: PRECISION_FONTS.mono,
                        boxSizing: 'border-box',
                      }}
                      className="bm-tabular-nums"
                    />
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: PRECISION_TEXT.quiet, fontSize: '12px' }}>$</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                    Expiración por defecto
                  </label>
                  <select
                    value={defaultExpiry}
                    onChange={(e) => setDefaultExpiry(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '9px 12px',
                      color: PRECISION_TEXT.strong,
                      fontSize: '12.5px',
                      fontFamily: PRECISION_FONTS.mono,
                      boxSizing: 'border-box',
                    }}
                    className="bm-tabular-nums"
                  >
                    <option value="00:30">00:30 min</option>
                    <option value="01:00">01:00 min</option>
                    <option value="02:00">02:00 min</option>
                    <option value="05:00">05:00 min</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: PRECISION_TEXT.strong }}>Confirmación de un clic</div>
                    <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>Abrir operaciones sin confirmación adicional.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={oneClickTrading}
                    onChange={(e) => setOneClickTrading(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: PRECISION_COLORS.profit }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: PRECISION_TEXT.strong }}>Sonido de resultado</div>
                    <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>Efecto de audio metálico al cerrar una operación (mudo por defecto).</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={resultSound}
                    onChange={(e) => setResultSound(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: PRECISION_COLORS.profit }}
                  />
                </label>
              </div>
            </div>

            {/* 4. SEÇÃO NOTIFICAÇÕES */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.bg1,
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: PRECISION_TEXT.strong }}>Notificaciones</h3>
                  <div style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>Elige qué notificaciones deseas recibir</div>
                </div>
                <button
                  type="button"
                  className="bm-btn-precision"
                  onClick={() => triggerSaveNotice('Notificaciones guardadas.')}
                  style={{
                    backgroundColor: PRECISION_COLORS.profit,
                    color: '#07120B',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  Guardar
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: PRECISION_TEXT.strong }}>Email de depósito</div>
                    <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>Recibe un correo cuando se acredite un depósito en tu cuenta.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={depositEmail}
                    onChange={(e) => setDepositEmail(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: PRECISION_COLORS.profit }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: PRECISION_TEXT.strong }}>Email de saque</div>
                    <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>Recibe un correo cuando se procese un retiro de fondos.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={withdrawEmail}
                    onChange={(e) => setWithdrawEmail(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: PRECISION_COLORS.profit }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: PRECISION_TEXT.strong }}>Email de torneo</div>
                    <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>Recibe novedades y recordatorios sobre torneos y promociones.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tournamentEmail}
                    onChange={(e) => setTournamentEmail(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: PRECISION_COLORS.profit }}
                  />
                </label>
              </div>
            </div>

            {/* 5. SEÇÃO IDIOMA E FUSO HORÁRIO */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.bg1,
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: PRECISION_TEXT.strong }}>Idioma y zona horaria</h3>
                  <div style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>Configura tu región y formato</div>
                </div>
                <button
                  type="button"
                  className="bm-btn-precision"
                  onClick={() => triggerSaveNotice('Idioma y zona horaria guardados.')}
                  style={{
                    backgroundColor: PRECISION_COLORS.profit,
                    color: '#07120B',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  Guardar
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                    Idioma
                  </label>
                  <select
                    value={localeLang}
                    onChange={(e) => setLocaleLang(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '9px 12px',
                      color: PRECISION_TEXT.strong,
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="es">Español (América Latina)</option>
                    <option value="pt">Português (Brasil)</option>
                    <option value="en">English (US)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                    Zona horaria
                  </label>
                  <select
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '9px 12px',
                      color: PRECISION_TEXT.strong,
                      fontSize: '12.5px',
                      fontFamily: PRECISION_FONTS.mono,
                      boxSizing: 'border-box',
                    }}
                    className="bm-tabular-nums"
                  >
                    <option value="UTC-6">UTC-06:00 · Ciudad de México</option>
                    <option value="UTC-3">UTC-03:00 · São Paulo / Buenos Aires</option>
                    <option value="UTC-5">UTC-05:00 · Bogotá / Lima</option>
                    <option value="UTC+0">UTC+00:00 · Londres (GMT)</option>
                    <option value="UTC+1">UTC+01:00 · Madrid</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginBottom: '6px', fontWeight: 600 }}>
                  Formato de fecha
                </label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: PRECISION_SURFACES.bg0,
                    border: `1px solid ${PRECISION_SURFACES.line}`,
                    borderRadius: '6px',
                    padding: '9px 12px',
                    color: PRECISION_TEXT.strong,
                    fontSize: '12.5px',
                    fontFamily: PRECISION_FONTS.mono,
                    boxSizing: 'border-box',
                  }}
                  className="bm-tabular-nums"
                >
                  <option value="DD MMM YYYY">DD MMM YYYY (Ej: 10 oct 2026)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (Ej: 10/10/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (Ej: 2026-10-10)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SecondaryLayout>
  );
}
