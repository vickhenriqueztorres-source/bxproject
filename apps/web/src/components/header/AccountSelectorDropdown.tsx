import React, { useState, useRef, useEffect } from 'react';
import { formatMinor, formatCurrencyBinmax } from '../../lib/money';
import { useRouter } from '../../router/RouterContext';
import { AuthService } from '../../auth/auth-service';

export interface AccountSelectorDropdownProps {
  balanceMinor: number | null;
  realBalanceMinor?: number | null;
  accountType: 'DEMO' | 'REAL';
  onSelectAccountType: (type: 'DEMO' | 'REAL') => void;
  onResetDemo: () => void;
  accountEmail?: string;
  initialOpen?: boolean;
  onSignOut?: () => void;
}

export const AccountSelectorDropdown: React.FC<AccountSelectorDropdownProps> = ({
  balanceMinor,
  realBalanceMinor,
  accountType,
  onSelectAccountType,
  onResetDemo,
  accountEmail = 'demo',
  initialOpen = false,
  onSignOut,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const { navigate } = useRouter();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const realBalanceDisplay =
    accountType === 'REAL'
      ? balanceMinor !== null && balanceMinor !== undefined
        ? formatCurrencyBinmax(balanceMinor)
        : '$0.00'
      : realBalanceMinor !== undefined && realBalanceMinor !== null
      ? formatCurrencyBinmax(realBalanceMinor)
      : '$0.00';

  const sessionUser = typeof window !== 'undefined' ? AuthService.getSession()?.user : null;
  const initialSessionBalance = sessionUser?.demoBalanceMinor ?? 1000000;

  const demoBalanceDisplay =
    accountType === 'DEMO'
      ? balanceMinor !== null && balanceMinor !== undefined
        ? formatCurrencyBinmax(balanceMinor)
        : formatCurrencyBinmax(initialSessionBalance)
      : '$10,000.00';

  const displayBalance = accountType === 'REAL' ? realBalanceDisplay : demoBalanceDisplay;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
      data-testid="account-selector-container"
    >
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(21, 25, 34, 0.92)',
          border: '1px solid rgba(244, 245, 247, 0.12)',
          borderRadius: '8px',
          padding: '6px 14px',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        data-testid="account-selector-button"
      >
        {/* Avatar Circular do Usuário Ampliado */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1C273E 0%, #2A3B5C 100%)',
            border: '1px solid rgba(244, 245, 247, 0.18)',
            display: 'grid',
            placeItems: 'center',
            color: '#DCE1EA',
            fontSize: '15px',
            fontWeight: 700,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        {/* Informações da Conta e Saldo Condicional */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15, gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#8A92A1',
                letterSpacing: '0.2px',
              }}
            >
              {accountType === 'DEMO' ? 'Cuenta de práctica' : 'Cuenta real'}
            </span>
            <span style={{ fontSize: '9px', color: '#8A92A1', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 100ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
              ▼
            </span>
          </div>
          <strong
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: accountType === 'REAL' ? '#22C47A' : '#F4F5F7',
              fontFamily: "'Geist Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.3px',
            }}
            data-testid="account-balance-display"
          >
            {displayBalance}
          </strong>
        </div>
      </div>

      {/* Popover / Dropdown de Seleção de Contas (Sessão 8) */}
      {isOpen && (
        <div
          data-testid="account-dropdown-menu"
          style={{
            position: 'absolute',
            top: '52px',
            right: 0,
            width: '260px',
            background: '#151922',
            border: '1px solid rgba(244, 245, 247, 0.12)',
            borderRadius: '10px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.75)',
            zIndex: 100,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Opção 1: Cuenta Real */}
          <div
            data-testid="account-option-real"
            onClick={() => {
              onSelectAccountType('REAL');
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '8px',
              background: accountType === 'REAL' ? 'rgba(34, 196, 122, 0.12)' : '#1B2230',
              border: accountType === 'REAL' ? '1px solid rgba(34, 196, 122, 0.4)' : '1px solid rgba(244, 245, 247, 0.06)',
              cursor: 'pointer',
              transition: 'background 0.1s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {accountType === 'REAL' && (
                <span data-testid="real-account-check" style={{ color: '#22C47A', fontWeight: 800, fontSize: '13px' }}>
                  ✓
                </span>
              )}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#F4F5F7' }}>Cuenta real</div>
                <div style={{ fontSize: '9px', color: '#8A92A1' }}>{accountEmail}</div>
              </div>
            </div>
            <strong style={{ fontSize: '13px', color: '#22C47A', fontFamily: "'Geist Mono', monospace" }}>
              {realBalanceDisplay}
            </strong>
          </div>

          {/* Opção 2: Cuenta de Práctica */}
          <div
            data-testid="account-option-demo"
            onClick={() => {
              onSelectAccountType('DEMO');
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: accountType === 'DEMO' ? 'rgba(34, 196, 122, 0.12)' : '#1B2230',
              border: accountType === 'DEMO' ? '1px solid rgba(34, 196, 122, 0.4)' : '1px solid rgba(244, 245, 247, 0.06)',
              cursor: 'pointer',
              transition: 'background 0.1s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {accountType === 'DEMO' && (
                  <span data-testid="demo-account-check" style={{ color: '#22C47A', fontWeight: 800, fontSize: '13px' }}>
                    ✓
                  </span>
                )}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#F4F5F7' }}>Cuenta de práctica</div>
                  <div style={{ fontSize: '9px', color: '#8A92A1' }}>Saldo demonstrativo</div>
                </div>
              </div>
              <strong style={{ fontSize: '13px', color: '#22C47A', fontFamily: "'Geist Mono', monospace" }}>
                {demoBalanceDisplay}
              </strong>
            </div>

            {/* Botão de Ação Direta: Recargar Práctica */}
            <button
              type="button"
              data-testid="btn-reload-demo"
              onClick={(e) => {
                e.stopPropagation();
                onResetDemo();
              }}
              style={{
                width: '100%',
                padding: '6px 0',
                background: 'rgba(255, 171, 0, 0.12)',
                border: '1px solid rgba(255, 171, 0, 0.35)',
                color: '#ffab00',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
              title="Recargar $10.000 demo"
            >
              <span>↺</span>
              <span>Recargar práctica</span>
            </button>

            {/* Divisor Institucional */}
            <div style={{ height: '1px', background: 'rgba(244, 245, 247, 0.08)', margin: '6px 0' }} />

            {/* Acesso a Login e Registro */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                data-testid="header-dropdown-login-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  navigate('/login');
                }}
                style={{
                  padding: '7px 0',
                  background: '#151D2B',
                  border: '1px solid #1C2738',
                  color: '#F4F5F7',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s ease',
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                data-testid="header-dropdown-register-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  navigate('/registro');
                }}
                style={{
                  padding: '7px 0',
                  background: 'rgba(34, 196, 122, 0.15)',
                  border: '1px solid #22C47A',
                  color: '#22C47A',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s ease',
                }}
              >
                Crear cuenta
              </button>
            </div>

            {onSignOut && (
              <button
                type="button"
                data-testid="dropdown-signout-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onSignOut();
                }}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '7px 0',
                  background: 'transparent',
                  border: '1px solid rgba(244, 245, 247, 0.1)',
                  color: '#8A92A1',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#EF4444';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#8A92A1';
                  e.currentTarget.style.borderColor = 'rgba(244, 245, 247, 0.1)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Cerrar sesión</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
