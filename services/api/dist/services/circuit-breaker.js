/**
 * Circuit Breaker por Feed (Padrão de Resiliência R-04 & Blindagem contra Reconnect Storm)
 *
 * Estados:
 * CLOSED (normal) -> OPEN (falhou 3x consecutivas) -> HALF-OPEN (tenta 1x após 30s de cooldown)
 */
export class FeedCircuitBreaker {
    timeFn;
    state = 'CLOSED';
    consecutiveFailures = 0;
    lastStateChangeTime = Date.now();
    halfOpenAttempts = 0;
    failureThreshold;
    openDurationMs;
    halfOpenMaxAttempts;
    constructor(config = {}, timeFn = Date.now) {
        this.timeFn = timeFn;
        this.failureThreshold = config.failureThreshold ?? 3;
        this.openDurationMs = config.openDurationMs ?? 30000;
        this.halfOpenMaxAttempts = config.halfOpenMaxAttempts ?? 1;
    }
    getState() {
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
    canExecute() {
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
    recordAttempt() {
        if (this.getState() === 'HALF_OPEN') {
            this.halfOpenAttempts++;
        }
    }
    recordFailure() {
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
    recordSuccess() {
        this.state = 'CLOSED';
        this.consecutiveFailures = 0;
        this.halfOpenAttempts = 0;
        this.lastStateChangeTime = this.timeFn();
    }
    getTimeUntilRetryMs() {
        const now = this.timeFn();
        if (this.getState() !== 'OPEN')
            return 0;
        const elapsed = now - this.lastStateChangeTime;
        return Math.max(0, this.openDurationMs - elapsed);
    }
    getConsecutiveFailures() {
        return this.consecutiveFailures;
    }
    reset() {
        this.recordSuccess();
    }
}
