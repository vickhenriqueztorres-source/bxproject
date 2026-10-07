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

  /**
   * Avalia e atualiza o estado com base na passagem do tempo.
   */
  public getState(): CircuitState {
    const now = this.timeFn();

    if (this.state === 'OPEN') {
      const elapsed = now - this.lastStateChangeTime;
      if (elapsed >= this.openDurationMs) {
        // Transição automática para HALF-OPEN após o cooldown de 30s
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        this.lastStateChangeTime = now;
      }
    }

    return this.state;
  }

  /**
   * Verifica se uma tentativa de conexão/requisição é permitida no momento.
   */
  public canExecute(): boolean {
    const currentState = this.getState();

    if (currentState === 'CLOSED') {
      return true;
    }

    if (currentState === 'OPEN') {
      return false; // Bloqueado, aguardando término do cooldown de 30s
    }

    if (currentState === 'HALF_OPEN') {
      // Permite exatamente 1 tentativa de teste
      return this.halfOpenAttempts < this.halfOpenMaxAttempts;
    }

    return false;
  }

  /**
   * Registra uma tentativa de execução em HALF-OPEN.
   */
  public recordAttempt(): void {
    if (this.getState() === 'HALF_OPEN') {
      this.halfOpenAttempts++;
    }
  }

  /**
   * Registra uma falha de conexão/execução.
   */
  public recordFailure(): void {
    const now = this.timeFn();
    const currentState = this.getState();

    if (currentState === 'HALF_OPEN') {
      // Falha no teste -> reabre o circuito imediatamente por mais 30s
      this.state = 'OPEN';
      this.lastStateChangeTime = now;
      this.halfOpenAttempts = 0;
      return;
    }

    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.failureThreshold) {
      // Atingiu 3 falhas consecutivas -> abre o circuito por 30s
      this.state = 'OPEN';
      this.lastStateChangeTime = now;
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * Registra um sucesso na conexão/execução.
   */
  public recordSuccess(): void {
    // Sucesso fecha o circuito e restaura estado limpo
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.halfOpenAttempts = 0;
    this.lastStateChangeTime = this.timeFn();
  }

  /**
   * Retorna o tempo restante de cooldown em milissegundos se o circuito estiver OPEN.
   */
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
