/**
 * Circuit Breaker por Feed (Padrão de Resiliência R-04 & Blindagem contra Reconnect Storm)
 * 
 * Estados:
 * CLOSED (normal) -> OPEN (falhou 3x consecutivas) -> HALF-OPEN (tenta 1x após 30s de cooldown)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold?: number;     // Padrão: 3 falhas consecutivas
  openDurationMs?: number;       // Padrão: 30.000ms (30 segundos de pausa)
  halfOpenMaxAttempts?: number;  // Padrão: 1 tentativa em meia-abertura
}

export class FeedCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastStateChangeTime: number = Date.now();
  private halfOpenAttempts = 0;

  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  private readonly halfOpenMaxAttempts: number;

  constructor(
    config: CircuitBreakerConfig = {},
    private readonly timeFn: () => number = Date.now
  ) {
    this.failureThreshold = config.failureThreshold ?? 3;
    this.openDurationMs = config.openDurationMs ?? 30000;
    this.halfOpenMaxAttempts = config.halfOpenMaxAttempts ?? 1;
  }

  public getState(): CircuitState {
    const now = this.timeFn();

    if (this.state === 'OPEN') {
      const elapsed = now - this.lastStateChangeTime;
      if (elapsed >= this.openDurationMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        this.lastStateChangeTime = now;
      }
    }

    return this.state;
  }

  public canExecute(): boolean {
    const currentState = this.getState();

    if (currentState === 'CLOSED') {
      return true;
    }

    if (currentState === 'OPEN') {
      return false;
    }

    if (currentState === 'HALF_OPEN') {
      return this.halfOpenAttempts < this.halfOpenMaxAttempts;
    }

    return false;
  }

  public recordAttempt(): void {
    if (this.getState() === 'HALF_OPEN') {
      this.halfOpenAttempts++;
    }
  }

  public recordFailure(): void {
    const now = this.timeFn();
    const currentState = this.getState();

    if (currentState === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.lastStateChangeTime = now;
      this.halfOpenAttempts = 0;
      return;
    }

    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChangeTime = now;
      this.halfOpenAttempts = 0;
    }
  }

  public recordSuccess(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.halfOpenAttempts = 0;
    this.lastStateChangeTime = this.timeFn();
  }

  public getTimeUntilRetryMs(): number {
    const now = this.timeFn();
    if (this.getState() !== 'OPEN') return 0;
    const elapsed = now - this.lastStateChangeTime;
    return Math.max(0, this.openDurationMs - elapsed);
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public reset(): void {
    this.recordSuccess();
  }
}
