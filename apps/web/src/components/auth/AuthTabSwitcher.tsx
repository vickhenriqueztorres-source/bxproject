import React from 'react';
import {
  PRECISION_SURFACES,
  PRECISION_COLORS,
  PRECISION_TEXT,
  PRECISION_FONTS,
} from '../../lib/design-tokens';

export interface AuthTabSwitcherProps {
  activeTab: 'login' | 'register';
  onTabChange: (tab: 'login' | 'register') => void;
  labels?: {
    login?: string;
    register?: string;
  };
}

export function AuthTabSwitcher({
  activeTab,
  onTabChange,
  labels = { login: 'Entrar', register: 'Criar conta' },
}: AuthTabSwitcherProps) {
  const isLogin = activeTab === 'login';

  const handleKeyDown = (e: React.KeyboardEvent, target: 'login' | 'register') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTabChange(target);
    } else if (e.key === 'ArrowRight' && !isLogin) {
      e.preventDefault();
      onTabChange('login');
    } else if (e.key === 'ArrowLeft' && isLogin) {
      e.preventDefault();
      onTabChange('register');
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Seleção de modo de autenticação"
      data-testid="auth-tab-switcher"
      className="bm-pill-container"
      style={{
        marginBottom: '28px',
        width: '100%',
        height: '44px',
      }}
    >
      {/* 1. ABA CRIAR CONTA (À ESQUERDA, CONFORME A CAPTURA DE TELA) */}
      <button
        type="button"
        role="tab"
        id="tab-register"
        aria-controls="tabpanel-register"
        data-testid="auth-tab-register"
        aria-selected={!isLogin}
        tabIndex={!isLogin ? 0 : -1}
        onClick={() => onTabChange('register')}
        onKeyDown={(e) => handleKeyDown(e, 'register')}
        className={`bm-pill-tab ${!isLogin ? 'bm-pill-tab-active' : ''}`}
      >
        {labels.register || 'Criar conta'}
      </button>

      {/* 2. ABA ENTRAR (À DIREITA, CONFORME A CAPTURA DE TELA) */}
      <button
        type="button"
        role="tab"
        id="tab-login"
        aria-controls="tabpanel-login"
        data-testid="auth-tab-login"
        aria-selected={isLogin}
        tabIndex={isLogin ? 0 : -1}
        onClick={() => onTabChange('login')}
        onKeyDown={(e) => handleKeyDown(e, 'login')}
        className={`bm-pill-tab ${isLogin ? 'bm-pill-tab-active' : ''}`}
      >
        {labels.login || 'Entrar'}
      </button>
    </div>
  );
}
