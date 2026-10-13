import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ChartErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((reset: () => void, error: Error | null) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  symbol?: string;
  autoHeal?: boolean;
  maxAutoRetries?: number;
  autoRetryDelayMs?: number;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  autoRetriesCount?: number;
  isAutoHealing?: boolean;
}

export class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  private autoHealTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      autoRetriesCount: 0,
      isAutoHealing: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ChartErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      this.setState({ errorInfo });
    } catch {
      if (this.state) {
        (this as any).state = { ...this.state, errorInfo };
      }
    }
    console.error('[ChartErrorBoundary] Falha isolada no subsistema gráfico:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    const autoHealEnabled = this.props.autoHeal ?? true;
    const maxRetries = this.props.maxAutoRetries ?? 2;
    const delay = this.props.autoRetryDelayMs ?? 600;

    const currentRetries = this.state?.autoRetriesCount ?? 0;

    if (autoHealEnabled && currentRetries < maxRetries) {
      this.setState({ isAutoHealing: true });
      if (this.state) {
        (this as any).state = { ...this.state, isAutoHealing: true };
      }
      if (this.autoHealTimer) clearTimeout(this.autoHealTimer);
      this.autoHealTimer = setTimeout(() => {
        const nextState = {
          hasError: false,
          error: null,
          errorInfo: null,
          autoRetriesCount: currentRetries + 1,
          isAutoHealing: false,
        };
        this.setState(nextState);
        (this as any).state = nextState;
        if (this.props.onReset) {
          this.props.onReset();
        }
      }, delay);
    }
  }

  public override componentWillUnmount(): void {
    if (this.autoHealTimer) {
      clearTimeout(this.autoHealTimer);
      this.autoHealTimer = null;
    }
  }

  public handleReset = (): void => {
    if (this.autoHealTimer) {
      clearTimeout(this.autoHealTimer);
      this.autoHealTimer = null;
    }
    const nextState = {
      hasError: false,
      error: null,
      errorInfo: null,
      autoRetriesCount: 0,
      isAutoHealing: false,
    };
    this.setState(nextState);
    (this as any).state = nextState;
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.handleReset, this.state.error);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const titleText = `Gráfico Temporariamente Indisponível${this.props.symbol ? ` (${this.props.symbol})` : ''}`;

      return (
        <div
          data-testid="chart-error-fallback"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            minHeight: '260px',
            background: '#0D0F14',
            color: '#F4F5F7',
            padding: '24px',
            boxSizing: 'border-box',
            textAlign: 'center',
            border: '1px solid rgba(242, 84, 91, 0.35)',
            borderRadius: '6px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(242, 84, 91, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              marginBottom: '16px',
              border: '1px solid rgba(242, 84, 91, 0.3)',
            }}
          >
            📉
          </div>
          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: '15px',
              fontWeight: 700,
              color: '#F4F5F7',
              letterSpacing: '-0.01em',
            }}
          >
            {titleText}
          </h3>
          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '12px',
              lineHeight: '1.5',
              color: '#8A92A1',
              maxWidth: '380px',
            }}
          >
            Ocorreu uma falha no renderizador visual. Suas ordens ativas, histórico e saldo demo continuam
            operando com 100% de integridade no servidor.
          </p>
          {this.state.error && (
            <div
              style={{
                fontSize: '11px',
                color: '#F2545B',
                background: 'rgba(242, 84, 91, 0.08)',
                padding: '6px 12px',
                borderRadius: '4px',
                marginBottom: '16px',
                fontFamily: 'monospace',
                maxWidth: '420px',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message || 'Erro inesperado no Canvas'}
            </div>
          )}
          {this.state.isAutoHealing && (
            <div
              data-testid="auto-healing-indicator"
              style={{
                fontSize: '11px',
                color: '#22C47A',
                marginBottom: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⚡</span> Tentando auto-recuperação transparente...
            </div>
          )}
          <button
            type="button"
            data-testid="chart-error-retry-btn"
            onClick={this.handleReset}
            style={{
              background: '#22C47A',
              color: '#070C18',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2be28e')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#22C47A')}
          >
            <span>↻</span> Recarregar Gráfico
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
